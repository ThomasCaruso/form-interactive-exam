import { importWebPhoto, deleteWebPhoto } from './webPhotoStorage';
import { useFormStore } from '../state/store';
import type { ClosetPiece } from '../domain/types';
export interface ImportedGarmentPhoto { localUri: string }
export async function importGarmentPhoto(uri: string, _mimeType?: string | null, _fileName?: string | null): Promise<ImportedGarmentPhoto> { return importWebPhoto(uri, 'garment'); }
export async function deleteGarmentPhoto(uri: string): Promise<void> { await deleteWebPhoto(uri, 'garment'); }
export async function removeGarmentWithFile(piece: ClosetPiece): Promise<void> { useFormStore.getState().removeClosetPiece(piece.id); if (piece.localUri) await deleteGarmentPhoto(piece.localUri); if (piece.cutoutUri) await deleteGarmentPhoto(piece.cutoutUri); }
