import { importWebPhoto, deleteWebPhoto } from './webPhotoStorage';
export interface ImportedPersonPhoto { localUri: string }
export async function importPersonPhoto(uri: string, _mimeType?: string | null, _fileName?: string | null): Promise<ImportedPersonPhoto> { return importWebPhoto(uri, 'person'); }
export async function deletePersonPhoto(uri: string): Promise<void> { await deleteWebPhoto(uri, 'person'); }
