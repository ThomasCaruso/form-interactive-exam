import { photoAsset } from '../utils/photoAsset';
import { productPhotography } from '../data/photography';
import type { TryOnSelectionItem } from '../domain/garments';
import { isPhotoPiece } from '../domain/closet';
import type { ClosetPiece, GarmentSlot, GarmentSource } from '../domain/types';

/**
 * Legacy single-reference try-on boundary. The live studio uses higgsfield.ts
 * for multi-reference requests and durable job polling. Nothing in this legacy adapter calls a network — this build ships an
 * honest, unconnected provider so the try-on UI can speak in real request
 * shapes today. When FASHN (or any provider) is connected, implement
 * TryOnProvider with: the user's reference photo plus the selected catalog
 * and uploaded garment images, and return it from getTryOnProvider().
 */

export interface TryOnGarmentInput {
  id: string;
  source: GarmentSource;
  /** Absolute image reference: a device file URI for uploads, a bundled asset URI for catalog pieces. */
  imageUri: string;
  slot: GarmentSlot;
}

/** personImageUri is the user's own reference photo; not captured anywhere in this build. */
export interface TryOnRequest {
  personImageUri: string;
  garments: TryOnGarmentInput[];
}

export type TryOnStatus = 'unavailable' | 'processing' | 'done';

export interface TryOnResult {
  status: TryOnStatus;
  imageUri?: string;
  message?: string;
}

export interface TryOnProvider {
  readonly id: string;
  generateTryOn(request: TryOnRequest): Promise<TryOnResult>;
}

/** The demo stand-in: never renders the user's garment on a model, never fakes success. */
export class UnconnectedTryOnProvider implements TryOnProvider {
  readonly id = 'unconnected';

  async generateTryOn(): Promise<TryOnResult> {
    return { status: 'unavailable', message: 'Try-on generation is not connected in this build.' };
  }
}

let provider: TryOnProvider | null = null;

export function getTryOnProvider(): TryOnProvider {
  if (!provider) provider = new UnconnectedTryOnProvider();
  return provider;
}

/**
 * Resolve the temporary on-screen selection into real provider inputs:
 * uploads contribute their local file URI, catalog pieces their bundled
 * photograph. Unresolvable pieces are skipped rather than guessed at.
 */
export function resolveTryOnInputs(selection: readonly TryOnSelectionItem[], closet: readonly ClosetPiece[]): TryOnGarmentInput[] {
  const inputs: TryOnGarmentInput[] = [];
  for (const item of selection) {
    if (item.source === 'user_upload') {
      const garment = closet.find(g => g.id === item.id);
      if (garment && isPhotoPiece(garment)) inputs.push({ id: garment.id, source: 'user_upload', imageUri: garment.localUri, slot: garment.slot });
      continue;
    }
    const photo = productPhotography[item.product.id]?.source;
    const imageUri = photo ? photoAsset(photo)?.uri : item.product.imageUri;
    if (imageUri) inputs.push({ id: item.product.id, source: 'catalog', imageUri, slot: item.product.slot });
  }
  return inputs;
}
