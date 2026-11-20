import { realCatalogProducts } from '../data/realCatalog';
import { onModelPhotography } from '../data/editorial';
import { colorFamily } from './colorFamily';
import { garmentType } from './learning';
import type { FittingProfile, Product, Profile, ShopFor } from './types';

export { colorFamily };

export const DEFAULT_SIZES = ['XS', 'S', 'M', 'L', 'XL'] as const;
export const TASTE_DECK_SIZE = 8;
export type Silhouette = NonNullable<FittingProfile['fitPreference']>;

/** A first-run profile: nothing assumed about the person beyond the house budget. */
export function firstRunProfile(base: Profile, shopFor: ShopFor): Profile {
  return { ...base, name: '', height: '', waist: '', inseam: '', shoe: '', brands: [], styles: [], favoriteColors: [], avoidedColors: [], avoidedBrands: [], styleBrief: '', shopFor };
}

const interleave = <T,>(a: T[], b: T[]) => Array.from({ length: Math.max(a.length, b.length) }, (_, i) => [a[i], b[i]]).flat().filter((x): x is T => x !== undefined);
const SLOT_ORDER = ['top', 'pants', 'dress'];
/**
 * The widest spread of taste in few cards: each pick is the piece that adds the most
 * unseen traits — garment type, colour family, style, formality, fit — so eight answers
 * cover tees to tailoring, dark to soft colour. Ties keep catalog order.
 */
function spread(products: Product[], count: number): Product[] {
  const pool = [...products], picked: Product[] = [], seen = new Set<string>();
  const facets = (p: Product) => ['type:' + garmentType(p), 'family:' + colorFamily(p), 'formality:' + (p.formality ?? 1), 'fit:' + !!p.relaxed, ...(p.styleTags ?? []).map(t => 'style:' + t)];
  while (picked.length < count && pool.length) {
    const names = new Set(picked.map(p => p.name)), types = picked.map(garmentType);
    let best = 0, bestValue = -Infinity;
    const bottoms = picked.filter(p => p.slot === 'pants').length;
    pool.forEach((p, i) => {
      // Tops say more about taste than trousers do; shorts least of all.
      if (names.has(p.name) || (p.slot === 'pants' && bottoms >= Math.ceil(count * 0.375)) || garmentType(p) === 'shorts') return;
      const f = facets(p);
      // A new garment type matters most; then new colour families and styles.
      const value = f.filter(x => !seen.has(x)).length + (types.includes(garmentType(p)) ? -3 : 2) - (picked.length && picked[picked.length - 1].slot === p.slot ? 1 : 0) - i * 0.001;
      if (value > bestValue) { bestValue = value; best = i; }
    });
    if (bestValue === -Infinity) break;
    const [p] = pool.splice(best, 1);
    picked.push(p); facets(p).forEach(x => seen.add(x));
  }
  return picked;
}

/**
 * The first-run edit: Northeast staples from the real catalog (oxfords, stripes, chinos, navy knits, tailoring, a trench),
 * shown as product photographs. Pieces missing from a catalog are skipped and the spread fills the gap.
 */
export const NORTHEAST_DECK: Record<'womens' | 'mens', string[]> = {
  womens: ['muji-8709412323518-white-stripe', 'muji-8760984338622-dark-beige', 'muji-8723206537406-smoky-green', 'muji-8705314160830-medium-gray', 'muji-8667801223358-beige', 'muji-8705376256190-grayish-brown', 'muji-8714961027262-off-white-stripe', 'muji-8658121949374-blue'],
  mens: ['muji-8654640513214-white', 'muji-8759293739198-light-beige', 'muji-8937308258494-navy', 'muji-8759733223614-light-blue-stripe', 'muji-8958259790014-medium-gray', 'muji-8617827795134-dark-navy', 'muji-8761033097406-dark-navy', 'muji-8709545033918-dark-navy'],
};
/** Real catalog pieces to rate: the Northeast edit first, topped up by the widest spread. Shoes are unisex and add little taste signal. */
export function tasteDeck(shopFor: ShopFor, catalog: Product[] = realCatalogProducts): Product[] {
  const pool = (department: 'womens' | 'mens', count: number) => {
    const ps = catalog.filter(p => p.department === department && SLOT_ORDER.includes(p.slot));
    const curated = NORTHEAST_DECK[department].map(id => ps.find(p => p.id === id)).filter((p): p is Product => !!p).slice(0, count);
    if (curated.length >= count) return curated;
    const worn = ps.filter(p => onModelPhotography[p.id] && !curated.includes(p));
    return [...curated, ...spread(worn.length >= count - curated.length ? worn : ps.filter(p => !curated.includes(p)), count - curated.length)];
  };
  return shopFor === 'both' ? interleave(pool('womens', TASTE_DECK_SIZE / 2), pool('mens', TASTE_DECK_SIZE / 2)) : pool(shopFor, TASTE_DECK_SIZE);
}

function ranked(values: string[]) {
  const counts = new Map<string, number>();
  values.forEach(v => counts.set(v, (counts.get(v) ?? 0) + 1));
  return [...counts].sort((a, b) => b[1] - a[1] || values.indexOf(a[0]) - values.indexOf(b[0])).map(([v]) => v);
}

/** What the yes answers have in common so far, in words. */
export function tasteChips(liked: Product[], limit = 4): string[] {
  if (!liked.length) return [];
  const materials = ranked(liked.flatMap(p => p.material ? [p.material.replace(/ blend$/i, '')] : []));
  const families = ranked(liked.map(colorFamily));
  const relaxed = liked.filter(p => p.relaxed).length * 2 > liked.length ? ['Relaxed'] : liked.every(p => !p.relaxed) && liked.length > 1 ? ['Close fit'] : [];
  const styles = ranked(liked.flatMap(p => p.styleTags ?? []));
  return [...new Set([materials[0], families[0], ...relaxed, styles[0], families[1], styles[1]].filter((x): x is string => !!x))].slice(0, limit);
}

/** Yes answers become explicit preferences: the style words and exact colors of liked pieces. */
export function applyTaste(profile: Profile, liked: Product[], passed: Product[] = []): Profile {
  const tasteAnswers = { liked: liked.map(p => p.id), passed: passed.map(p => p.id) };
  if (!liked.length) return { ...profile, tasteAnswers };
  return { ...profile, tasteAnswers, styles: ranked(liked.flatMap(p => p.styleTags ?? [])).slice(0, 3), favoriteColors: ranked(liked.map(p => p.color)).slice(0, 5) };
}

/** Usual size and silhouette, stored where the engine and fitting flow already read them. */
export function applyFit(profile: Profile, size: string, silhouette: Silhouette): Profile {
  return { ...profile, topSize: size, fitting: { units: profile.fitting?.units ?? 'imperial', ...profile.fitting, bottomSize: size, fitPreference: silhouette } };
}
