import type { Product } from './types';

export const STYLE_BRIEF_LIMIT = 600;
export type BriefSignal = { kind: 'style' | 'color' | 'material' | 'brand' | 'fit' | 'formality'; value: string; avoid: boolean };
export type BriefIntent = { signals: BriefSignal[] };
const normalize = (value: string) => value.toLowerCase().trim().replace(/grey/g, 'gray');
const colorGroups: Record<string, string[]> = {
  Black: ['black', 'soft black'], White: ['white', 'bone', 'ivory', 'cream', 'off white', 'off-white'],
  Gray: ['gray', 'light gray', 'medium gray', 'dark gray', 'charcoal'], Beige: ['beige', 'dark beige', 'light beige', 'taupe', 'sand'],
  Navy: ['navy', 'navy blue'], Brown: ['brown', 'dark brown', 'chocolate'], Blue: ['blue', 'light blue'],
};
const colorGroup = (value: string) => Object.entries(colorGroups).find(([, aliases]) => aliases.includes(normalize(value)))?.[0] ?? normalize(value);
export function colorMatches(a: string, b: string) { return colorGroup(a) === colorGroup(b); }
const terms: { kind: BriefSignal['kind']; value: string; aliases: string[] }[] = [
  { kind: 'style', value: 'Minimal', aliases: ['minimal', 'minimalist', 'understated', 'quiet'] },
  { kind: 'style', value: 'Classic', aliases: ['classic', 'timeless'] },
  { kind: 'style', value: 'Elevated casual', aliases: ['elevated casual', 'smart casual', 'refined'] },
  { kind: 'style', value: 'Streetwear', aliases: ['streetwear'] },
  ...Object.entries(colorGroups).map(([value, aliases]) => ({ kind: 'color' as const, value, aliases })),
  { kind: 'color', value: 'Neutrals', aliases: ['neutral', 'neutrals', 'neutral colors', 'neutral palette'] },
  ...['Cotton', 'Linen', 'Denim', 'Wool', 'Leather'].map(value => ({ kind: 'material' as const, value, aliases: [value.toLowerCase()] })),
  ...['MUJI', 'COS', 'Uniqlo', 'New Balance', 'Arket'].map(value => ({ kind: 'brand' as const, value, aliases: [value.toLowerCase()] })),
  { kind: 'fit', value: 'Relaxed', aliases: ['relaxed', 'loose', 'roomy', 'oversized'] },
  { kind: 'fit', value: 'Tailored', aliases: ['tailored', 'tailoring', 'structured'] },
  { kind: 'formality', value: 'Formal', aliases: ['formal', 'business'] },
  { kind: 'formality', value: 'Casual', aliases: ['casual', 'off duty', 'off-duty'] },
];
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const expressions = terms.map(term => ({ ...term, expression: new RegExp('\\b(?:' + term.aliases.map(escape).join('|') + ')\\b', 'gi') }));
const cache = new Map<string, BriefIntent>();
/** Deliberately bounded keyword interpretation, not simulated AI understanding. Full text stays in Profile. */
export function parseStyleBrief(value?: string): BriefIntent {
  const text = typeof value === 'string' ? normalize(value.slice(0, STYLE_BRIEF_LIMIT)).replace(/[’']/g, "'").replace(/\bnavy blue\b/g, 'navy').replace(/\b(?:don't|do not|never|not) (?:prefer|love)\b/g, 'avoid') : '';
  const existing = cache.get(text); if (existing) return existing;
  const signals = new Map<string, BriefSignal>();
  // Contrast/preference words start fresh clauses; negation is scoped to its clause.
  const clauses = text.replace(/\bnot only\b/g, '').split(/[.;!\n]|\b(?:but|however|prefer|love|instead|while)\b|(?=\b(?:avoid|without|exclude|no|not|don't|never|stay away from)\b)/);
  for (const clause of clauses) {
    const avoid = /\b(?:avoid|without|exclude|no|not|don't|never|stay away from)\b/.test(clause);
    const hits = expressions.flatMap(term => Array.from(clause.matchAll(new RegExp(term.expression.source, 'gi')), match => ({ ...term, start: match.index!, end: match.index! + match[0].length })));
    const owned: typeof hits = [];
    for (const hit of hits.sort((a, b) => (b.end - b.start) - (a.end - a.start) || a.start - b.start)) {
      if (!owned.some(previous => hit.start < previous.end && hit.end > previous.start)) owned.push(hit);
    }
    for (const term of owned.sort((a, b) => a.start - b.start)) {
      const key = term.kind + ':' + term.value;
      const previous = signals.get(key);
      // If text contradicts itself, the conservative exclusion wins.
      signals.set(key, { kind: term.kind, value: term.value, avoid: avoid || !!previous?.avoid });
    }
  }
  const result = { signals: [...signals.values()] };
  if (cache.size >= 64) cache.delete(cache.keys().next().value!);
  cache.set(text, result); return result;
}
function matches(product: Product, signal: BriefSignal) {
  if (signal.kind === 'color') return signal.value === 'Neutrals' ? ['Black', 'White', 'Gray', 'Beige', 'Navy', 'Brown'].includes(colorGroup(product.color)) : colorMatches(signal.value, product.color);
  if (signal.kind === 'style') return product.styleTags?.some(tag => normalize(tag) === normalize(signal.value)) ?? false;
  if (signal.kind === 'brand') return normalize(product.brand) === normalize(signal.value);
  if (signal.kind === 'material') return new RegExp('\\b' + escape(signal.value) + '\\b', 'i').test(product.material ?? '');
  if (signal.kind === 'fit') return signal.value === 'Relaxed' ? product.relaxed === true : product.relaxed === false && (product.formality ?? 0) >= 1;
  return signal.value === 'Formal' ? (product.formality ?? 0) >= 2 : product.formality !== undefined && product.formality <= 1;
}
export function briefExcludes(product: Product, intent: BriefIntent) {
  return intent.signals.some(signal => signal.avoid && matches(product, signal));
}
export function briefScore(product: Product, intent: BriefIntent) {
  return intent.signals.reduce((score, signal) => score + (matches(product, signal) ? (signal.avoid ? -24 : signal.kind === 'color' ? 24 : 18) : 0), 0);
}
export const briefSignalLabel = (signal: BriefSignal) => (signal.avoid ? 'Avoid ' : '') + signal.value;
export function briefReason(product: Product, intent: BriefIntent): string | undefined {
  const match = intent.signals.find(signal => !signal.avoid && matches(product, signal));
  return match ? 'Reflects ' + match.value.toLowerCase() + ' in your style brief.' : undefined;
}
