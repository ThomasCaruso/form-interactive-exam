import { closetPieceToProduct, isPhotoPiece } from './closet';
import { selectionFromProduct, selectionKey, type TryOnSelectionItem } from './garments';
import type { SceneId, TryOnScene } from './tryOnScene';
import type { ClosetPiece, GarmentSlot, Look, Product } from './types';

/** The trying row is what you have on in Try On. One piece per slot keeps every preview wearable. */
export type SlotOf = (item: TryOnSelectionItem) => GarmentSlot | undefined;

export function slotResolver(closet: readonly Pick<ClosetPiece, 'id' | 'slot'>[]): SlotOf {
  return item => item.source === 'catalog' ? item.product.slot : closet.find(p => p.id === item.id)?.slot;
}

export const clashes = (a: GarmentSlot, b: GarmentSlot) =>
  a === b || (a === 'dress' && (b === 'top' || b === 'pants')) || (b === 'dress' && (a === 'top' || a === 'pants'));

/** Adds a piece, dropping whatever it would be worn instead of. Re-adding returns the same array. */
export function withPiece(selection: readonly TryOnSelectionItem[], item: TryOnSelectionItem, slotOf: SlotOf): TryOnSelectionItem[] {
  const key = selectionKey(item);
  if (selection.some(entry => selectionKey(entry) === key)) return selection as TryOnSelectionItem[];
  const slot = slotOf(item);
  return [...selection.filter(entry => { const other = slotOf(entry); return !(slot && other && clashes(slot, other)); }), item];
}

export function withPieces(items: readonly TryOnSelectionItem[], slotOf: SlotOf): TryOnSelectionItem[] {
  return items.reduce<TryOnSelectionItem[]>((selection, item) => withPiece(selection, item, slotOf), []);
}

/** Only pieces with an image can be rendered: closet archetypes and photo-less uploads are left out. */
export function tryableFromProducts(products: readonly Product[]): TryOnSelectionItem[] {
  return products.filter(p => p.source !== 'closet' && (p.source !== 'user_upload' || !!p.localUri)).map(selectionFromProduct);
}

export function selectionProducts(selection: readonly TryOnSelectionItem[], closet: readonly ClosetPiece[]): Product[] {
  const out: Product[] = [];
  for (const item of selection) {
    if (item.source === 'catalog') { out.push(item.product); continue; }
    const piece = closet.find(p => p.id === item.id);
    if (piece && isPhotoPiece(piece)) out.push(closetPieceToProduct(piece));
  }
  return out;
}

export function sameOutfit(outfit: readonly { id: string }[] | undefined, products: readonly { id: string }[]): boolean {
  if (!outfit?.length || outfit.length !== products.length) return false;
  const a = outfit.map(p => p.id).sort(), b = products.map(p => p.id).sort();
  return a.every((id, i) => id === b[i]);
}

/** A saveable look for whatever is on in Try On; the same pieces always give the same id. */
export function lookFromTrying(products: readonly Product[]): Look {
  return {
    id: 'try-' + products.map(p => p.id).sort().join('-'), number: '',
    title: products.length === 1 ? products[0].name : 'Your try-on', vibe: 'Tried on',
    description: products.map(p => p.name).join(', '), why: 'You put this together in Try On.',
    scene: { a: '', b: '' }, products: [...products],
  };
}

export const MIRROR_SCENES: readonly SceneId[] = ['original', 'studio', 'city'];
export function nextScene(scene: TryOnScene): TryOnScene {
  return { id: MIRROR_SCENES[(MIRROR_SCENES.indexOf(scene.id) + 1) % MIRROR_SCENES.length] };
}
