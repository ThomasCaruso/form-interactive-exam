import { fromProduct } from './judgePiece';
import { judgeOutfit } from './pairingJudge';
import { isShortBottom, type StagePiece, type StageSlot } from './outfitLayout';
import type { Product } from './types';

/** What the stage can draw for a product: its cut-out (prepared, or one the person added) when there is one, else its photo as a plate. */
export function stagePieceFor(product: Product, cutouts: Record<string, { aspect: number }>): StagePiece | undefined {
  if (product.slot === 'accessory') return undefined;
  const cut = cutouts[product.id];
  const aspect = cut?.aspect ?? (product.cutoutUri ? product.cutoutAspect : undefined) ?? (product.aspect ? 1 / product.aspect : 1.25);
  return { id: product.id, slot: product.slot, aspect, short: product.slot === 'pants' && isShortBottom(product.name) };
}

/** One honest line about the outfit, the way a friend would say it. */
export function readOutfit(products: readonly Product[]): { line: string; score: number } {
  if (!products.length) return { line: 'Start with anything, or shuffle.', score: 0 };
  const pieces = products.map(fromProduct), has = (slot: string) => pieces.some(p => p.slot === slot);
  const v = judgeOutfit(pieces);
  if (v.gates.includes('incomplete')) {
    const body = has('dress') || has('top'), legs = has('dress') || has('bottom');
    const line = !body && !legs ? 'Add a top and a bottom.' : !body ? 'Add a top.' : !legs ? 'Add trousers, shorts or a skirt.' : 'Add shoes to finish it.';
    return { line, score: v.score - 1 };
  }
  if (v.gates.includes('patterns')) return { line: 'Three patterns is a lot. Keep one.', score: v.score - 1 };
  if (v.verdict === 'fail') {
    const worst = [...v.reasons].sort((a, b) => b.penalty - a.penalty)[0];
    return { line: worst ? worst.text + '.' : 'Something here fights. Try a swap.', score: v.score };
  }
  const top = pieces.find(p => p.slot === 'top'), bottom = pieces.find(p => p.slot === 'bottom'), shoes = pieces.find(p => p.slot === 'shoes');
  const short = products.some(p => p.slot === 'pants' && isShortBottom(p.name));
  let line = 'Clean and easy. Works.';
  if (has('dress')) line = 'One piece and shoes. Done.';
  else if (top && bottom) {
    const d = top.colour.lightness - bottom.colour.lightness;
    if (Math.abs(d) < 0.15 && top.colour.family === bottom.colour.family) line = 'Tonal. Quiet, and it looks expensive.';
    else if (d < -0.3) line = 'Dark over light: a classic contrast.';
    else if (d > 0.3) line = 'Light over dark keeps it crisp.';
    else if (shoes && shoes.colour.lightness < 0.4 && bottom.colour.lightness > 0.65) line = 'Dark shoes anchor the lighter colours.';
    else if (short) line = 'Easy summer proportions. Works.';
  }
  return { line, score: v.score };
}

export type Rails = Record<StageSlot, Product[]>;
const RAIL_LIMIT = 30;

/** What you can flip through in each slot: saved, then owned, then the best of the catalog. The order doesn't
 * depend on what's on, so swiping back and forth is stable; a piece that's on but on no rail is put first. */
export function buildRails(current: readonly Product[], saved: readonly Product[], owned: readonly Product[], ranked: readonly Product[], hasCutout: (p: Product) => boolean): Rails {
  const rails: Rails = { outerwear: [], top: [], dress: [], pants: [], shoes: [] };
  const seen = new Set<string>();
  const add = (p: Product) => {
    if (p.slot === 'accessory' || seen.has(p.id) || rails[p.slot].length >= RAIL_LIMIT) return;
    seen.add(p.id); rails[p.slot].push(p);
  };
  // Only pieces with a cut-out; the rest would sit on a plate (they wait in the Needs a cut-out queue instead).
  [...saved, ...owned, ...ranked].filter(hasCutout).forEach(add);
  for (const p of current) if (p.slot !== 'accessory' && !seen.has(p.id)) { seen.add(p.id); rails[p.slot].unshift(p); }
  return rails;
}

/** What swiping the top brings: tops, with a dress after every few so a dress turns up now and then. Bottoms have
 * their own rail and never turn into a dress. */
export function upperRail(rails: Rails, every = 3): Product[] {
  if (!rails.dress.length) return rails.top;
  if (!rails.top.length) return rails.dress;
  const out: Product[] = [];
  let d = 0;
  rails.top.forEach((top, i) => { out.push(top); if ((i + 1) % every === 0 && d < rails.dress.length) out.push(rails.dress[d++]); });
  return out;
}

/** The next piece along a slot's rail; wraps around. */
export function stepRail(rail: readonly Product[], currentId: string | undefined, dir: 1 | -1): Product | undefined {
  if (!rail.length) return undefined;
  const i = rail.findIndex(p => p.id === currentId);
  return i < 0 ? rail[0] : rail[(i + dir + rail.length) % rail.length];
}

/** A different outfit that the judge likes, drawn from the rails (only `staged` pieces, i.e. ones with a cut-out).
 * Keeps a dress outfit a dress outfit. */
export function shuffleOutfit(rails: Rails, current: readonly Product[], random: () => number = Math.random, staged: (p: Product) => boolean = () => true): Product[] | undefined {
  const dress = current.some(p => p.slot === 'dress') && rails.dress.length;
  const slots: StageSlot[] = dress ? ['dress', 'shoes'] : ['top', 'pants', 'shoes'];
  const pick = (rail: Product[]) => [...rail].map(p => [random(), p] as const).sort((a, b) => a[0] - b[0]).slice(0, 8).map(x => x[1]);
  const options = slots.map(slot => pick(rails[slot].filter(staged)));
  if (options.some(o => !o.length)) return undefined;
  const now = new Set(current.map(p => p.id));
  let best: Product[] | undefined, bestScore = -Infinity;
  const walk = (i: number, chosen: Product[]) => {
    if (i === options.length) {
      if (chosen.every(p => now.has(p.id))) return;
      const score = readOutfit(chosen).score + random() * 0.12;
      if (score > bestScore) { bestScore = score; best = chosen; }
      return;
    }
    for (const p of options[i]) walk(i + 1, [...chosen, p]);
  };
  walk(0, []);
  return best;
}
