import { isPhotoPiece } from './closet';
import type { ClosetPiece, Product } from './types';

/** Pasted into ChatGPT (or any image tool) with the piece's photo. The stage needs the garment alone, flat and
 * front-facing, on a transparent background, filling the frame so it lands at the right size. */
export const CUTOUT_PROMPT = 'Cut out the clothing item in this photo. Show only the garment, flat and front-facing, '
  + 'with no hanger, person, mannequin, tags or props. Keep its exact colour, fabric, print and every detail. '
  + 'Soft, even studio light. Fill the frame edge to edge with only a small margin. '
  + 'Output a PNG with a fully transparent background.';

/** Photo pieces the stage could show if they had a cut-out. Accessories don't go on the stage. */
export function cutoutQueue(closet: readonly ClosetPiece[]): ClosetPiece[] {
  return closet.filter(p => isPhotoPiece(p) && p.slot !== 'accessory' && !p.cutoutUri);
}

/** Whether the stage can draw a product as a cut-out: a prepared catalog one, or one the person added. */
export function hasStageCutout(product: Product, catalog: Readonly<Record<string, unknown>>): boolean {
  return !!catalog[product.id] || !!product.cutoutUri;
}

/** Only PNG and WebP can carry transparency; a JPEG back from an image tool would bring its background with it. */
export function canBeTransparent(mimeType?: string | null, fileName?: string | null, uri?: string): boolean {
  if (mimeType) return /^image\/(png|webp)$/i.test(mimeType);
  const name = (fileName || uri || '').split('?')[0]!.toLowerCase();
  return /\.(png|webp)$/.test(name);
}
