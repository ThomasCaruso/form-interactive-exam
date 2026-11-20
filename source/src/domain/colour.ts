/** How a colour behaves in an outfit. Catalog hexes are measured from photographs and read
 * nearly grey, so role and family come from the colour's name; the hex gives lightness. */
export type ColourRole = 'neutral' | 'soft' | 'accent';
export type Undertone = 'warm' | 'cool' | 'none';
export type Pattern = 'solid' | 'stripe' | 'check' | 'print';
export interface ColourRead { role: ColourRole; family: string; undertone: Undertone; lightness: number; pattern: Pattern }

const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
/** OKLCh: L 0–1 perceptual lightness, C chroma, h hue in degrees. */
export function oklch(hex: string) {
  const [r, g, b] = [1, 3, 5].map(i => lin(parseInt(hex.slice(i, i + 2), 16) / 255));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return { L, C: Math.hypot(A, B), h: (Math.atan2(B, A) * 180 / Math.PI + 360) % 360 };
}

// Word-bounded so "tailored" is not red and "tank" is not tan.
const NAMES: [RegExp, string, ColourRole, Undertone][] = [
  [/\b(khaki green|olive|smoky green|light green|sage)\b/, 'green', 'soft', 'warm'],
  [/\b(grayish brown|greyish brown|mocha|dark brown|brown|chocolate)\b/, 'brown', 'neutral', 'warm'],
  [/\b(denim|indigo)\b/, 'denim', 'neutral', 'cool'],
  [/\bnavy\b/, 'navy', 'neutral', 'cool'],
  [/\bblack\b/, 'black', 'neutral', 'none'],
  [/\b(off[ -]white|ivory|natural|cream|ecru)\b/, 'cream', 'neutral', 'warm'],
  [/\bwhite\b/, 'white', 'neutral', 'none'],
  [/\b(charcoal|gray|grey)\b/, 'gray', 'neutral', 'cool'],
  [/\b(beige|khaki|sand|camel|stone|taupe|tan)\b/, 'beige', 'neutral', 'warm'],
  [/\b(light blue|smoky blue|powder blue)\b/, 'blue', 'soft', 'cool'],
  [/\bblue\b/, 'blue', 'soft', 'cool'],
  [/\b(light (orange|yellow|pink)|smoky orange|lavender|lilac|blush)\b/, '', 'soft', 'warm'],
  [/\b(burgundy|maroon|wine|red)\b/, 'red', 'accent', 'warm'],
  [/\b(orange|rust)\b/, 'orange', 'accent', 'warm'],
  [/\b(yellow|mustard)\b/, 'yellow', 'accent', 'warm'],
  [/\b(pink|fuchsia|coral)\b/, 'pink', 'accent', 'warm'],
  [/\b(purple|violet)\b/, 'purple', 'accent', 'cool'],
  [/\b(forest|green|teal|mint|turquoise)\b/, 'green', 'accent', 'cool'],
];
const SOFT_FAMILY: [RegExp, string][] = [[/orange/, 'orange'], [/yellow/, 'yellow'], [/pink|blush/, 'pink'], [/lavender|lilac/, 'purple']];
// Typical OKLab lightness per family, for descriptions that carry no measured colour.
const FAMILY_L: Record<string, number> = { black: 0.2, navy: 0.3, brown: 0.4, denim: 0.45, purple: 0.45, red: 0.45, green: 0.5,
  gray: 0.6, blue: 0.6, other: 0.6, orange: 0.65, pink: 0.75, beige: 0.78, yellow: 0.85, cream: 0.92, white: 0.97 };

const patternOf = (n: string): Pattern =>
  /\bstrip(e|ed|es)\b|pinstripe/.test(n) ? 'stripe'
  : /\b(check|checked|plaid|gingham|houndstooth|tartan)\b/.test(n) ? 'check'
  : /\b(pattern|print|printed|floral|leopard|paisley|polka|logo|graphic|zebra|jacquard)\b|-print\b/.test(n) ? 'print' : 'solid';

type NameRow = (typeof NAMES)[number];
/** The earliest colour word wins; at the same position the longer phrase wins ("khaki green" over "khaki"). */
function nameHit(n: string): NameRow | undefined {
  let best: { at: number; len: number; row: NameRow } | undefined;
  for (const row of NAMES) {
    const m = row[0].exec(n);
    if (m && (!best || m.index < best.at || (m.index === best.at && m[0].length > best.len))) best = { at: m.index, len: m[0].length, row };
  }
  return best?.row;
}
const familyOf = (n: string, hit: NameRow | undefined) => (hit ? hit[1] || SOFT_FAMILY.find(([re]) => re.test(n))![1] : 'other');
function fromHit(n: string, hit: NameRow | undefined, lightness: number, fallbackRole: ColourRole): ColourRead {
  const pattern = patternOf(n);
  if (!hit) return { role: /multicolou?r/.test(n) ? 'accent' : fallbackRole, family: 'other', undertone: 'none', lightness, pattern };
  return { role: hit[2], family: familyOf(n, hit), undertone: hit[3], lightness, pattern };
}

export function readColour(name: string, hex: string): ColourRead {
  const n = name.toLowerCase();
  const { L, C } = oklch(hex);
  return fromHit(n, nameHit(n), L, C < 0.03 ? 'neutral' : 'accent');
}

/** For product descriptions with no measured colour, such as stylist looks. */
export function readColourName(text: string): ColourRead {
  const n = text.toLowerCase();
  const hit = nameHit(n);
  const shift = /\b(light|pale|powder|ice)\b/.test(n) ? 0.15 : /\b(dark|deep|charcoal)\b/.test(n) ? -0.15 : 0;
  return fromHit(n, hit, Math.min(0.98, Math.max(0.05, FAMILY_L[familyOf(n, hit)] + shift)), 'neutral');
}
