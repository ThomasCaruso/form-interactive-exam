import type { Product, Profile, ReviewStatus, SavedPiece } from './types';
import { colorFamily } from './colorFamily';

/** What kind of garment this is, read from its name. Finer than the slot, so the feed can vary shirts from knits. */
export function garmentType(product: Pick<Product, 'name' | 'slot'>): string {
  const n = product.name.toLowerCase();
  if (product.slot === 'shoes') return /boot/.test(n) ? 'boots' : 'sneakers';
  if (product.slot === 'dress' || /\bdress\b(?! trousers)/.test(n)) return 'dress';
  if (/skirt/.test(n) && !/pants/.test(n)) return 'skirt';
  if (/shorts/.test(n)) return 'shorts';
  if (/coat/.test(n)) return 'coat';
  if (/jacket|blouson|coverall/.test(n)) return 'jacket';
  if (/hoodie|sweatshirt/.test(n)) return 'sweatshirt';
  if (/denim|jean/.test(n) && /pants|trousers/.test(n)) return 'jeans';
  if (/chino|trousers|darted|pleat|flat front|baker|straight pants/.test(n)) return 'trousers';
  if (/pants|sweatpants/.test(n)) return 'easy pants';
  if (/cardigan/.test(n)) return 'cardigan';
  if (/sweater|knit|pullover(?! shirt)/.test(n)) return 'sweater';
  if (/polo/.test(n)) return 'polo';
  if (/blouse/.test(n)) return 'blouse';
  if (/shirt/.test(n) && !/t-shirt/.test(n)) return 'shirt';
  return 't-shirt';
}

/** The traits a swipe teaches about. Each yes or no moves every trait the piece carries. */
const traitCache = new WeakMap<Product, string[]>();
export function traits(p: Product): string[] {
  const cached = traitCache.get(p); if (cached) return cached;
  const result = [
    'type:' + garmentType(p), 'colour:' + colorFamily(p), 'name:' + p.name,
    'material:' + (p.material ?? '').replace(/ blend$/i, '').toLowerCase(),
    'fit:' + (p.relaxed ? 'relaxed' : 'close'), 'formality:' + (p.formality ?? 1),
    ...(p.styleTags ?? []).map(tag => 'style:' + tag),
  ];
  traitCache.set(p, result); return result;
}

export interface TasteSignals { liked: Product[]; passed: Product[] }
export type Affinity = Map<string, number>;

/** Smoothed yes-minus-no per trait, in [-1, 1]. One answer nudges; a pattern decides. */
export function learnAffinity({ liked, passed }: TasteSignals): Affinity {
  const tally = new Map<string, { yes: number; no: number }>();
  const add = (p: Product, key: 'yes' | 'no') => traits(p).forEach(t => { const v = tally.get(t) ?? { yes: 0, no: 0 }; v[key]++; tally.set(t, v); });
  liked.forEach(p => add(p, 'yes')); passed.forEach(p => add(p, 'no'));
  return new Map([...tally].map(([t, { yes, no }]) => [t, (yes - no) / (yes + no + 2)]));
}

const WEIGHT: Record<string, number> = { type: 22, colour: 16, name: 26, material: 10, fit: 8, formality: 8, style: 12 };
/** How much what you've swiped so far says you'd want this piece. */
export function learnedScore(p: Product, affinity: Affinity): number {
  if (!affinity.size) return 0;
  return traits(p).reduce((sum, t) => sum + (affinity.get(t) ?? 0) * WEIGHT[t.slice(0, t.indexOf(':'))], 0);
}

/** Every answer the person has given: first-run taste cards, feed swipes and saves. */
export function signalsFrom(state: { profile: Pick<Profile, 'tasteAnswers'>; recommendationReview: Record<string, ReviewStatus>; savedPieces: Pick<SavedPiece, 'id' | 'product'>[] }, catalog: Product[]): TasteSignals {
  const byId = new Map(catalog.map(p => [p.id, p]));
  const liked = new Map<string, Product>(), passed = new Map<string, Product>();
  const put = (id: string, yes: boolean, product = byId.get(id)) => { if (product) (yes ? liked : passed).set(id, product); };
  state.profile.tasteAnswers?.liked.forEach(id => put(id, true));
  state.profile.tasteAnswers?.passed.forEach(id => put(id, false));
  Object.entries(state.recommendationReview).forEach(([id, status]) => put(id, status === 'saved'));
  state.savedPieces.forEach(s => put(s.id, true, byId.get(s.id) ?? s.product));
  passed.forEach((_, id) => liked.has(id) && passed.delete(id));
  return { liked: [...liked.values()], passed: [...passed.values()] };
}

/**
 * Best-first, but never a run of the same thing: a piece loses ground when its type,
 * colour family or name has just been shown. Every fifth card explores something unseen.
 */
export function diversify(products: Product[], score: (p: Product) => number): Product[] {
  const pool = products.map((p, i) => ({ p, s: score(p), type: garmentType(p), family: colorFamily(p), i }));
  const out: typeof pool = [];
  while (pool.length) {
    const recent = out.slice(-4), shownTypes = new Set(out.slice(-8).map(x => x.type));
    const explore = out.length % 5 === 4;
    let best = 0, bestValue = -Infinity;
    pool.forEach((x, k) => {
      let v = x.s - x.i * 0.01;
      v -= recent.filter(r => r.type === x.type).length * 18 + recent.filter(r => r.family === x.family).length * 6 + recent.filter(r => r.p.name === x.p.name).length * 40;
      if (out.length && out[out.length - 1].p.slot === x.p.slot) v -= 6;
      if (explore && !shownTypes.has(x.type)) v += 40;
      if (v > bestValue) { bestValue = v; best = k; }
    });
    out.push(pool.splice(best, 1)[0]);
  }
  return out.map(x => x.p);
}
