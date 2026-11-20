import type { Product } from './types';
import { readColour, readColourName, type ColourRead } from './colour';
import { garmentType } from './learning';

export type JudgeSlot = 'top' | 'bottom' | 'dress' | 'outerwear' | 'shoes';
export type Texture = 'fine' | 'smooth' | 'rough';
/** What the judge knows about one piece, whatever it came from. */
export interface JudgePiece {
  id: string; slot: JudgeSlot; type: string; colour: ColourRead;
  formality: number; relaxed: boolean; warmth: number; texture: Texture;
}

export const textureOf = (s: string): Texture =>
  // \b treats é as a non-word character, so bouclé is matched outside the word-bounded group.
  /\b(tweed|corduroy|fleece|shearling|mohair|chunky|cable|waffle)\b|\bboucl[eé]/i.test(s) ? 'rough'
  : /\b(silk|satin|cashmere|crepe|chiffon|lace|velvet)\b/i.test(s) ? 'fine' : 'smooth';

export function fromProduct(p: Product): JudgePiece {
  const slot: JudgeSlot = p.slot === 'pants' ? 'bottom' : p.slot === 'accessory' ? 'top' : p.slot;
  return { id: p.id, slot, type: garmentType(p), colour: readColour(p.color + ' ' + p.name, p.hex),
    formality: p.formality ?? 1, relaxed: !!p.relaxed, warmth: p.warmth ?? 1, texture: textureOf((p.material ?? '') + ' ' + p.name) };
}

/** Pieces from the golden-set file (scripts/golden/sample.ts GoldenPiece). */
export function fromGoldenPiece(g: { id: string; slot: string; type: string; name: string; color: string; hex: string;
  formality: number; relaxed: boolean; warmth: number; material: string; pattern?: string }): JudgePiece {
  const slot = (g.slot === 'pants' ? 'bottom' : g.slot) as JudgeSlot;
  const colour = readColour(g.color + ' ' + g.name, g.hex);
  if (g.pattern && g.pattern !== 'solid') colour.pattern = g.pattern as ColourRead['pattern'];
  return { id: g.id, slot, type: g.type, colour, formality: g.formality, relaxed: g.relaxed, warmth: g.warmth, texture: textureOf(g.material + ' ' + g.name) };
}

// Ordered: the first match decides. [pattern, slot, type, formality]
const TYPES: [RegExp, JudgeSlot, string, number][] = [
  [/\b(pumps?|heels?|stilettos?|slingbacks?)\b/, 'shoes', 'heels', 3],
  [/\b(derby|derbies|oxfords?|brogues?)\b/, 'shoes', 'derbies', 2],
  [/\b(loafers?|mules?)\b/, 'shoes', 'loafers', 2],
  [/\b(boots?|booties)\b/, 'shoes', 'boots', 1],
  [/\b(ballet flats?|flats|ballerinas?)\b/, 'shoes', 'flats', 1],
  [/\b(sneakers?|trainers?|slides?|espadrilles?|sandals?|flip-flops?)\b/, 'shoes', 'sneakers', 0],
  [/\b(suit jacket|tuxedo|blazer)\b/, 'outerwear', 'blazer', 2],
  [/\b(coat|trench|overcoat|parka|puffer|cape)\b/, 'outerwear', 'coat', 2],
  [/\b(jacket|bomber|gilet|anorak)\b/, 'outerwear', 'jacket', 1],
  [/\bgown\b/, 'dress', 'gown', 3],
  [/\b(dress|jumpsuit)\b/, 'dress', 'dress', 2],
  [/\bjeans\b/, 'bottom', 'jeans', 1],
  [/\bshorts\b/, 'bottom', 'shorts', 0],
  [/\b(leggings|joggers|sweatpants|track pants)\b/, 'bottom', 'easy pants', 0],
  [/\bskirt\b/, 'bottom', 'skirt', 1],
  [/\b(trousers|pants|chinos)\b/, 'bottom', 'trousers', 2],
  [/\b(hoodie|sweatshirt)\b/, 'top', 'sweatshirt', 0],
  [/\b(t-shirt|tee|tank|camisole|bodysuit|bra top|crop top)\b/, 'top', 't-shirt', 0],
  [/\bpolo\b/, 'top', 'polo', 1],
  [/\bcardigan\b/, 'top', 'cardigan', 1],
  [/\b(sweater|knit|jumper|turtleneck|pullover)\b/, 'top', 'sweater', 1],
  [/\bblouse\b/, 'top', 'blouse', 2],
  [/\bshirt\b/, 'top', 'shirt', 2],
  [/\b(top|vest)\b/, 'top', 't-shirt', 1],
];

/** A stylist-look item such as "black wool gabardine shorts". Accessories return null. */
export function fromText(desc: string, id = desc): JudgePiece | null {
  const n = desc.toLowerCase();
  const hit = TYPES.find(([re]) => re.test(n));
  if (!hit) return null;
  const [, slot, type, base] = hit;
  const formality = type === 'trousers' && /\b(track|cargo|drawstring|jersey)\b/.test(n) ? 1 : base;
  const warmth = /\b(wool|cashmere|shearling|down|fleece|alpaca|mohair|tweed|padded|quilted)\b/.test(n) ? 2
    : /\b(linen|seersucker|sandals?|shorts|tank|camisole|swim)\b/.test(n) ? 0 : 1;
  return { id, slot, type, colour: readColourName(n), formality,
    relaxed: /\b(oversized|relaxed|wide-leg|baggy|loose|slouchy|boxy|balloon)\b/.test(n), warmth, texture: textureOf(n) };
}
