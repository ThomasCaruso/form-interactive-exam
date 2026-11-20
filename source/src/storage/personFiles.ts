import { Directory, File, Paths } from 'expo-file-system';

const PERSON_DIR = 'person-references';

function personDirectory(): Directory {
  const dir = new Directory(Paths.document, PERSON_DIR);
  if (!dir.exists) dir.create({ idempotent: true, intermediates: true });
  return dir;
}

function extensionFor(uri: string, mimeType?: string | null, fileName?: string | null): string {
  const fromName = fileName && fileName.includes('.') ? '.' + fileName.split('.').pop()!.toLowerCase() : '';
  if (/^\.(jpe?g|png|webp|heic|gif)$/.test(fromName)) return fromName === '.jpeg' ? '.jpg' : fromName;
  const fromUri = uri.includes('.') ? '.' + uri.split('?')[0]!.split('.').pop()!.toLowerCase() : '';
  if (/^\.(jpe?g|png|webp|heic|gif)$/.test(fromUri)) return fromUri === '.jpeg' ? '.jpg' : fromUri;
  if (mimeType === 'image/png') return '.png';
  if (mimeType === 'image/webp') return '.webp';
  return '.jpg';
}

export interface ImportedPersonPhoto {
  /** Durable file URI inside app document storage. */
  localUri: string;
}

/**
 * Copy a picker result (cache file or content:// URI) into durable,
 * app-owned storage. The caller owns the picker asset afterwards; the
 * returned URI is what gets persisted on the garment metadata.
 */
export async function importPersonPhoto(tempUri: string, mimeType?: string | null, fileName?: string | null): Promise<ImportedPersonPhoto> {
  const dir = personDirectory();
  const destination = new File(dir, Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8) + extensionFor(tempUri, mimeType, fileName));
  await new File(tempUri).copy(destination, { overwrite: true });
  return { localUri: destination.uri };
}

/** Delete one copied photo. Tolerant: a missing file is already the goal. */
export async function deletePersonPhoto(localUri: string): Promise<void> {
  try {
    // Persisted metadata is not permission to delete arbitrary app files.
    const target = new URL(localUri);
    const root = new URL(new Directory(Paths.document, PERSON_DIR).uri);
    const rootPath = decodeURIComponent(root.pathname).replace(/\/?$/, '/');
    const path = decodeURIComponent(target.pathname);
    const name = path.slice(rootPath.length);
    if (target.protocol !== 'file:' || target.host !== root.host || target.username || target.password || target.search || target.hash || !path.startsWith(rootPath) || !name || /[\\/]/.test(name)) return;
    const file = new File(localUri);
    if (file.exists) await file.delete();
  } catch {
    console.warn('FORM: could not delete person photo');
  }
}
