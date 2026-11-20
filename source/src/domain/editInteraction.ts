import type { Look, Product } from './types';
/** Resolve the current piece; stale sheets must not inspect a removed garment. */
export function inspectedLookPiece(look: Pick<Look, 'products'>, id?: string | null): Product | null {
  return id ? look.products.find(piece => piece.id === id) ?? null : null;
}
