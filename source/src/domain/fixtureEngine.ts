import { briefExcludes, briefReason, briefScore, colorMatches, parseStyleBrief } from './styleBrief';
import { catalogProducts, fixtureLooks } from '../data/catalog';
import { learnAffinity, learnedScore, type TasteSignals } from './learning';
import { fromProduct, type JudgePiece } from './judgePiece';
import { judgeOutfit } from './pairingJudge';
import type { EditRequest, Look, Product, Profile, Refinement, ReviewStatus, SavedLook, SavedPiece, Session } from './types';
const normalized = (value: string) => value.trim().toLowerCase();
// Reading a piece's colour and fabric is the slow part of judging; each catalog piece is read once.
const pieceCache = new WeakMap<Product, JudgePiece>();
const judgePiece = (p: Product) => { let piece = pieceCache.get(p); if (!piece) pieceCache.set(p, piece = fromProduct(p)); return piece; };
// Rebuilding looks (each context, each profile change) judges the same combinations again; verdicts are kept
// per exact piece objects, so an edited piece is a new object and is judged afresh.
const verdictCache = new Map<string, { products: Product[]; verdict: ReturnType<typeof judgeOutfit> }>();
/** Whether the pieces go together, by the pairing judge. */
export function judgeProducts(products: Product[]) {
  const key = products.map(p => p.id).join('|'), hit = verdictCache.get(key);
  if (hit && hit.products.length === products.length && hit.products.every((p, i) => p === products[i])) return hit.verdict;
  const verdict = judgeOutfit(products.map(judgePiece));
  if (verdictCache.size >= 20000) verdictCache.clear();
  verdictCache.set(key, { products, verdict });
  return verdict;
}
const passes = (products: Product[]) => judgeProducts(products).verdict === 'pass';
/** Ranking points a whole-outfit judge score of 0 costs, against 1. Half of it is one formality step off on every piece. */
const PAIRING_POINTS = 16;
const includes = (values: string[] | undefined, value: string) => (values ?? []).some(v => normalized(v) === normalized(value));
/** Unisex pieces serve everyone; otherwise the piece must be in a department the user shops. */
export function inDepartment(product: Product, profile: Pick<Profile, 'shopFor'>) {
  const shopFor = profile.shopFor ?? 'mens';
  return !product.department || product.department === 'unisex' || shopFor === 'both' || product.department === shopFor;
}
export function eligibleProduct(product: Product, profile: Profile) {
  return inDepartment(product, profile) && !includes(profile.avoidedBrands, product.brand) && !(profile.avoidedColors ?? []).some(color => colorMatches(color, product.color)) && product.priceCents <= profile.budgetCents && !briefExcludes(product, parseStyleBrief(profile.styleBrief));
}
/** Explicit demo rules, never inference about the wearer. */
export function fixtureReason(product: Product, profile: Profile): string {
  if (product.priceCents > profile.budgetCents) return 'Above your current look budget; kept as a demo reference.';
  const personal = briefReason(product, parseStyleBrief(profile.styleBrief));
  if (personal && eligibleProduct(product, profile)) return personal;
  if (includes(profile.brands, product.brand)) return product.brand + ' is in your preferred brands.';
  if ((profile.favoriteColors ?? []).some(color => colorMatches(color, product.color))) return product.color + ' is in your favorite colors.';
  const style = product.styleTags?.find(tag => includes(profile.styles, tag));
  if (style) return 'Matches your ' + style.toLowerCase() + ' preference.';
  return 'Inside your ' + '$' + profile.budgetCents / 100 + ' look budget.';
}
/** Stated preferences, plus what every yes and no so far has taught. */
export function productScorer(profile: Profile, signals?: TasteSignals) {
  const intent = parseStyleBrief(profile.styleBrief), affinity = signals ? learnAffinity(signals) : new Map<string, number>();
  return (p: Product) => briefScore(p, intent) + (p.styleTags ?? []).reduce((sum, tag) => sum + (includes(profile.styles, tag) ? (tag === 'Classic' ? 40 : 10) : 0), 0)
    + (includes(profile.brands, p.brand) ? 8 : 0) + ((profile.favoriteColors ?? []).some(color => colorMatches(color, p.color)) ? 12 : 0) + learnedScore(p, affinity);
}
export function rankProducts(profile: Profile, catalog: Product[] = catalogProducts, signals?: TasteSignals): Product[] {
  const score = productScorer(profile, signals);
  const scores = new Map(catalog.map(p => [p.id, score(p)]));
  return catalog.filter(p => eligibleProduct(p, profile)).sort((a, b) => scores.get(b.id)! - scores.get(a.id)! || catalog.indexOf(a) - catalog.indexOf(b));
}
export function unseenProducts(products: Product[], review: Record<string, ReviewStatus>, saved: Pick<SavedPiece, 'id'>[]) {
  return products.filter(p => !review[p.id] && !saved.some(s => s.id === p.id));
}
export function recommendedSize(product: Product, profile: Profile) {
  if (product.slot === 'top' || product.slot === 'dress' || product.slot === 'outerwear') return profile.topSize || 'Not set';
  // Letter-sized bottoms (most womenswear) use the bottom size, falling back to the top size.
  if (product.slot === 'pants' && product.availableSizes?.some(size => /^X*[SML]$|^XL$/.test(size))) return profile.fitting?.bottomSize || profile.topSize || 'Not set';
  if (product.slot === 'shoes') return profile.shoe || 'Not set';
  return profile.waist && profile.inseam ? profile.waist + ' × ' + profile.inseam : profile.waist ? 'Waist ' + profile.waist + ' in' : profile.inseam ? 'Inseam ' + profile.inseam + ' in' : 'Not set';
}
export function buildFixtureSession(request: EditRequest, profile: Profile, seed: string, createdAt = Date.now(), catalog: Product[] = catalogProducts, signals?: TasteSignals): Session {
  const effective = { ...profile, budgetCents: Math.min(request.budgetCents, profile.budgetCents) };
  // The best few per slot keep combinations small on a large catalog.
  const limits: Record<string, number> = { top: 14, pants: 10, dress: 6, shoes: 5 };
  const counts: Record<string, number> = {};
  const candidates = rankProducts(effective, catalog, signals).filter(p => (counts[p.slot] = (counts[p.slot] ?? 0) + 1) <= (limits[p.slot] ?? 6));
  const formal = /formal|business|black tie/i.test(request.dressCode) && !/casual/i.test(request.dressCode);
  const casual = /relaxed|casual/i.test(request.dressCode) && !/smart/i.test(request.dressCode);
  const combinations: Product[][] = [];
  for (const top of candidates.filter(p => p.slot === 'top'))
    for (const pants of candidates.filter(p => p.slot === 'pants'))
      for (const shoes of candidates.filter(p => p.slot === 'shoes'))
        if (top.priceCents + pants.priceCents + shoes.priceCents <= effective.budgetCents) combinations.push([top, pants, shoes]);
  // A dress is a complete outfit with shoes.
  for (const dress of candidates.filter(p => p.slot === 'dress'))
    for (const shoes of candidates.filter(p => p.slot === 'shoes'))
      if (dress.priceCents + shoes.priceCents <= effective.budgetCents) combinations.push([dress, shoes]);
  const rank = new Map(candidates.map((p, i) => [p.id, i]));
  // What the swipes taught counts per piece, so a liked dress outranks a mid-ranked top and trousers.
  const affinity = signals ? learnAffinity(signals) : undefined;
  // Averaged per piece so a two-piece dress look competes fairly with three-piece looks.
  const learned = new Map(affinity ? candidates.map(p => [p.id, learnedScore(p, affinity)]) : []);
  const score = (ps: Product[]) => ps.reduce((s, p) => s + (rank.get(p.id) ?? 0) - (learned.get(p.id) ?? 0) + (formal ? 3 - (p.formality ?? 0) : casual ? p.formality ?? 0 : Math.abs(1 - (p.formality ?? 0))) * 8, 0) / ps.length;
  // Score and key each outfit once; the sort then only compares numbers and strings.
  // How well the pieces go together counts for the whole outfit, and a failing outfit is shown only when nothing passes.
  const judged = combinations.map(ps => ({ ps, verdict: judgeProducts(ps), key: ps.map(p => p.id).join() }));
  const anyPass = judged.some(j => j.verdict.verdict === 'pass');
  const ranked = judged.filter(j => !anyPass || j.verdict.verdict === 'pass')
    .map(j => ({ ...j, score: score(j.ps) + (1 - j.verdict.score) * PAIRING_POINTS }));
  ranked.sort((a, b) => a.score - b.score || a.key.localeCompare(b.key));
  combinations.splice(0, combinations.length, ...ranked.map(r => r.ps));
  // A balance: top-and-bottoms lead, and a dress look is at most one of the three.
  const isDress = (ps: Product[]) => ps[0].slot === 'dress';
  const fits = (ps: Product[]) => !isDress(ps) || (picks.length > 0 && !picks.some(isDress));
  const picks: Product[][] = [];
  for (const ps of combinations) {
    if (fits(ps) && (!picks.length || !picks.some(p => p[0].id === ps[0].id))) picks.push(ps);
    if (picks.length === 3) break;
  }
  for (const ps of combinations) {
    if (picks.length === 3) break;
    if (fits(ps) && !picks.includes(ps)) picks.push(ps);
  }
  if (!picks.length) picks.push(...combinations.slice(0, 3));
  return {
    id: 'session-' + seed, occasion: request.occasion, request: { ...request }, createdAt,
    looks: picks.map((products, i) => ({
      ...fixtureLooks[i], id: 'look-' + seed + '-' + i, number: String(i + 1).padStart(2, '0'),
      ...(products.every(p => p.retailer) ? { vibe: request.dressCode, description: 'A clean silhouette with coordinated pieces for ' + request.occasion.toLowerCase() + '.' } : {}),
      products: products.map(p => ({ ...p, size: recommendedSize(p, profile) })), previewKey: undefined,
      why: (products.every(p => p.retailer) ? 'Selected for ' : 'Demo fixture styling for ') + request.occasion + ' · ' + request.dressCode + '.',
    })),
  };
}
export function refineFixtureLook(look: Look, action: Refinement, profile: Profile, budgetCents = profile.budgetCents, catalog: Product[] = catalogProducts): Look {
  const ranked = rankProducts(profile, catalog);
  // Pieces change one at a time, each against the outfit as it stands, so the whole-look cap and the judge see every change.
  const result: Product[] = [...look.products];
  look.products.forEach((p, i) => {
    const others = result.reduce((s, item) => s + item.priceCents, 0) - result[i].priceCents;
    const options = ranked.filter(candidate => candidate.slot === p.slot && candidate.id !== p.id && eligibleProduct(candidate, profile) && others + candidate.priceCents <= budgetCents);
    // Best first for the action; the first that keeps the outfit passing wins.
    let choices: Product[] = [];
    if (action === 'Lower price') choices = options.filter(c => c.priceCents < p.priceCents).sort((a,b) => a.priceCents - b.priceCents);
    if (action === 'Different shoes' && p.slot === 'shoes') choices = options;
    if (action === 'More formal') choices = options.filter(c => (c.formality ?? 0) > (p.formality ?? 0)).sort((a,b) => (b.formality ?? 0) - (a.formality ?? 0));
    if (action === 'Less formal') choices = options.filter(c => (c.formality ?? 0) < (p.formality ?? 0)).sort((a,b) => (a.formality ?? 0) - (b.formality ?? 0));
    if (action === 'Warmer' && p.slot === 'top') choices = options.filter(c => catalog === catalogProducts ? c.id === 'warm-knit' || c.id === 'overshirt' : (c.warmth ?? 0) > (p.warmth ?? 0));
    if (action === 'More relaxed') choices = options.filter(c => catalog === catalogProducts ? c.id === (p.slot === 'top' ? 'fine-knit' : p.slot === 'pants' ? 'relaxed' : 'runner') : c.relaxed && !p.relaxed);
    const withChoice = (c: Product) => result.map((item, j) => j === i ? c : item);
    // A piece stays rather than breaking an outfit that passes; an outfit that already fails takes the best choice.
    const replacement = choices.find(c => passes(withChoice(c))) ?? (passes(result) ? undefined : choices[0]);
    if (replacement) result[i] = { ...replacement, size: recommendedSize(replacement, profile) };
  });
  if (result.every((p,i) => p.id === look.products[i].id)) return look;
  return { ...look, id: look.id.split('-adjust-')[0] + '-adjust-' + action.toLowerCase().replaceAll(' ', '-') + '-' + result.map(p => [p.id, p.brand, p.priceCents, p.color, p.size].join('.')).join('_'), products: result, previewKey: undefined, why: (result.every(p => p.retailer) ? 'Adjusted: ' : 'Demo fixture adjustment: ') + action.toLowerCase() + '.', refinements: [...(look.refinements ?? []), action] };
}

/** Swap one piece for the highest-ranked same-slot alternative that goes with the rest, within the look's budget; null when nothing qualifies. */
export function swapFixturePiece(look: Look, pieceId: string, profile: Profile, budgetCents = profile.budgetCents, catalog: Product[] = catalogProducts): Look | null {
  const current = look.products.find(p => p.id === pieceId);
  if (!current) return null;
  const total = look.products.reduce((s, p) => s + p.priceCents, 0);
  const preferred = new Map(rankProducts(profile, catalog).map((p, index) => [p.id, index]));
  const options = catalog
    .filter(candidate => candidate.slot === current.slot && candidate.id !== current.id && eligibleProduct(candidate, profile) && total - current.priceCents + candidate.priceCents <= budgetCents)
    .sort((a, b) => (preferred.get(a.id) ?? catalog.length) - (preferred.get(b.id) ?? catalog.length) || catalog.indexOf(a) - catalog.indexOf(b));
  // The best-ranked piece that goes with the rest of the outfit; when none does, the best-ranked piece.
  const replacement = options.find(c => passes(look.products.map(p => p.id === pieceId ? c : p))) ?? options[0];
  if (!replacement) return null;
  const products = look.products.map(p => p.id === pieceId ? { ...replacement, size: recommendedSize(replacement, profile) } : p);
  const base = look.id.split('-adjust-')[0].split('-swap-')[0];
  return { ...look, id: base + '-swap-' + pieceId + '-' + products.map(p => [p.id, p.brand, p.priceCents, p.color, p.size].join('.')).join('_'), products, previewKey: undefined, why: (products.every(p => p.retailer) ? 'Swapped: ' : 'Demo fixture swap: ') + replacement.name.toLowerCase() + ' for ' + current.name.toLowerCase() + '.' };
}

/** A complete fixture pairing for every catalog piece; no profile inference. */
export function relatedFixtureLook(product: Product): Look {
  return fixtureLooks.find(l => l.products.some(p => p.id === product.id)) ?? {
    id: 'related-' + product.id, number: '01', title: 'A considered pairing', vibe: 'Demo complete look',
    description: 'An understated fixture pairing around this piece.', why: 'Demo styling: one piece in each garment slot.',
    scene: { a: '#b8b1a5', b: '#e9e4da' },
    products: (['top', 'pants', 'shoes'] as const).map(slot => slot === product.slot ? product : catalogProducts.filter(p => p.slot === slot).sort((a,b) => a.priceCents - b.priceCents)[0]),
  };
}



export function refinementBudget(lookId: string, profile: Profile, sessions: Session[], saved: SavedLook[]): number {
  const request = sessions.find(s => s.looks.some(l => l.id === lookId))?.request ?? saved.find(s => s.id === lookId)?.request;
  return Math.min(request?.budgetCents ?? profile.budgetCents, profile.budgetCents);
}
