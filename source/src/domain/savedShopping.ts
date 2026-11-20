import { isUserUpload } from './garments';
import { retailerProductUrl } from './retailer';
import type { GarmentSlot, Look, SavedPiece } from './types';
export type WishlistCategory = 'all' | GarmentSlot;
export type WishlistSort = 'recent' | 'price-low' | 'price-high';
/** Only exact validated retailer listings contribute to the shopping estimate. */
export function shoppingSummary(look: Pick<Look, 'products'>) {
  const owned = look.products.filter(isUserUpload);
  const online = look.products.filter(p => retailerProductUrl(p));
  const products = online.filter((p, i) => online.findIndex(other => other.id === p.id) === i);
  return { products, totalCents: products.reduce((sum, p) => sum + p.priceCents, 0), ownedCount: owned.length, sampleCount: look.products.filter(p => !isUserUpload(p) && !retailerProductUrl(p)).length };
}
/** Operate on a copy: collection order and immutable Saved look snapshots stay intact. */
export function savedWishlist(pieces: readonly SavedPiece[], category: WishlistCategory, sort: WishlistSort): SavedPiece[] {
  return pieces.filter(p => category === 'all' || p.product.slot === category).sort((a, b) => {
    const byPrice = sort === 'price-low' ? a.product.priceCents - b.product.priceCents : sort === 'price-high' ? b.product.priceCents - a.product.priceCents : 0;
    return byPrice || b.savedAt - a.savedAt || a.id.localeCompare(b.id);
  });
}
