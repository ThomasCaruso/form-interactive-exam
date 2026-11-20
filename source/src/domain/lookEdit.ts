import { clashes } from './trying';
import type { GarmentSlot, Look, Product } from './types';

/** Puts a piece on, taking off whatever it is worn instead of (a dress replaces the top and trousers). Same place in
 * the list as what it replaces. Already on: the same array back. */
export function dressPieces(products: readonly Product[], product: Product): Product[] {
  if (products.some(p => p.id === product.id)) return products as Product[];
  const kept = products.filter(p => !clashes(product.slot, p.slot));
  const at = products.findIndex(p => clashes(product.slot, p.slot));
  return at < 0 ? [...kept, product] : [...kept.slice(0, at), product, ...kept.slice(at)];
}

/** One swipe on the stage. A dress coming in takes the top and the bottoms off and hands back the bottoms to keep;
 * swiping from a dress on to a top puts those bottoms back (or `fallback`), since it was the top being changed. */
export function swapPieces(products: readonly Product[], next: Product, parked?: Product, fallback?: Product): { products: Product[]; parked?: Product } {
  const bottoms = products.find(p => p.slot === 'pants'), wasDress = products.some(p => p.slot === 'dress');
  let out = dressPieces(products, next);
  if (wasDress && next.slot === 'top') { const back = parked ?? fallback; if (back) out = dressPieces(out, back); }
  return { products: out, parked: next.slot === 'dress' ? bottoms ?? parked : parked };
}

/** Takes off the piece in a slot (a dress counts as the top and the trousers). Nothing there: the same array back. */
export function undressPieces(products: readonly Product[], slot: GarmentSlot): Product[] {
  const kept = products.filter(p => p.slot !== slot && !(p.slot === 'dress' && (slot === 'top' || slot === 'pants')));
  return kept.length === products.length ? products as Product[] : kept;
}

/** A new set of pieces (Shuffle); accessories already on are kept. */
export function restylePieces(products: readonly Product[], next: readonly Product[]): Product[] {
  return [...next, ...products.filter(p => p.slot === 'accessory' && !next.some(q => q.id === p.id))];
}

/** A FORM idea edited on the stage gets an id from its pieces, so the same pieces always give the same id; the part
 * before `~` keeps it tied to the idea it came from. */
function edited(look: Look, products: Product[]): Look {
  return { ...look, id: look.id.split('~')[0] + '~' + products.map(p => p.id).sort().join('+'), products };
}
export function dressLook(look: Look, product: Product): Look {
  const next = dressPieces(look.products, product);
  return next === look.products ? look : edited(look, next);
}
export function undressLook(look: Look, slot: GarmentSlot): Look {
  const next = undressPieces(look.products, slot);
  return next === look.products ? look : edited(look, next);
}
export function restyleLook(look: Look, products: readonly Product[]): Look {
  return edited(look, restylePieces(look.products, products));
}

/** What a change did, for the Undo toast. */
export function describeChange(before: readonly Product[], after: readonly Product[]): string {
  const added = after.filter(p => !before.some(q => q.id === p.id)), removed = before.filter(p => !after.some(q => q.id === p.id));
  const word = (p: Product) => p.slot === 'pants' ? 'bottom' : p.slot === 'outerwear' ? 'layer' : p.slot;
  if (added.length === 1 && added[0].slot === 'dress' && removed.length) return 'Changed to a dress';
  if (removed.length === 1 && removed[0].slot === 'dress' && added.some(p => p.slot === 'top')) return 'Changed the top';
  if (added.length === 1 && removed.length <= 1) return 'Changed the ' + word(added[0]);
  if (!added.length && removed.length === 1) return 'Took off the ' + word(removed[0]);
  return added.length ? 'New pieces' : 'Took pieces off';
}
