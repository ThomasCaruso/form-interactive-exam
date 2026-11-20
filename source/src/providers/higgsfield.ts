import type { TryOnScene } from '../domain/tryOnScene';
import { photoAsset } from '../utils/photoAsset';
import { fetch } from 'expo/fetch';
import { File } from 'expo-file-system';
import { Platform } from 'react-native';
import { webPhotoBase64 } from '../storage/webPhotoStorage';
import { productPhotography } from '../data/photography';
import { retailerPhotography } from '../data/retailerPhotography';
import type { PersonReference, Product } from '../domain/types';

export const studioMode = process.env.EXPO_PUBLIC_TRYON_MODE === 'codex' ? 'codex' : 'higgsfield';
const url = process.env.EXPO_PUBLIC_TRYON_URL;
const token = process.env.EXPO_PUBLIC_TRYON_TOKEN;
export class StudioError extends Error { constructor(message: string, readonly status = 0) { super(message); } }
export interface StudioJob { id: string; status: 'queued' | 'preparing' | 'submitting' | 'processing' | 'done' | 'failed' | 'unknown'; imageUri?: string; message?: string; credits?: number; title?: string; bodyReferenceId?: string; scene?: TryOnScene; outfit?: {id:string;name:string;slot:string;priceCents:number}[] }
/** False when this build has no try-on studio to reach (no bridge address or token baked in). */
export const studioConfigured = !!token && (Platform.OS === 'web' || !!url);

export async function studioRequest<T>(route: string, input?: unknown): Promise<T> {
  const endpoint = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin + '/studio' : url;
  if (!endpoint || !token) throw Error('Try-on isn’t connected in this build.');
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), input ? 60000 : 100000);
  try {
    const response = await fetch(endpoint + route, { method: input ? 'POST' : 'GET', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', 'X-Form-Studio-Mode': studioMode }, ...(input ? { body: JSON.stringify(input) } : {}), signal: controller.signal });
    if (response.headers.get('x-form-studio') !== studioMode) throw new StudioError('The connected bridge uses another image provider. Reconnect the matching studio before checking or creating previews.');
    const result = await response.json();
    if (Platform.OS === 'web' && typeof result.imageUri === 'string' && result.imageUri.startsWith('http://127.0.0.1:8787/result/')) result.imageUri = endpoint + new URL(result.imageUri).pathname;
    if (!response.ok) throw new StudioError(result.message ?? 'Your studio connection could not complete this request.', response.status); return result;
  } catch (error) { if (error instanceof Error && !['Network request failed', 'Aborted'].includes(error.message)) throw error; throw Error('Reconnect your phone over USB and check your studio connection.'); }
  finally { clearTimeout(timer); }
}
export async function photoBytes(uri: string): Promise<string> {
  if (Platform.OS === 'web') return webPhotoBase64(uri);
  if (/^(file|content|asset):/.test(uri)) { const file = new File(uri); if (file.size > 10 * 1024 * 1024) throw Error('Choose photos under 10 MB.'); return file.base64(); }
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(uri, { signal: controller.signal }); if (!response.ok) throw Error('One clothing photo could not be loaded. Please choose another piece.');
    const bytes = new Uint8Array(await response.arrayBuffer()); if (bytes.length > 10 * 1024 * 1024) throw Error('Choose photos under 10 MB.');
    let binary = ''; for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192)); return btoa(binary);
  } finally { clearTimeout(timer); }
}
export function garmentReference(product: Product): string | undefined {
  if (product.source === 'user_upload') return product.localUri;
  const retailer = product.retailer && retailerPhotography[product.id];
  const bundled = retailer && retailer.imageUri === product.imageUri ? retailer.source : productPhotography[product.id]?.source;
  return bundled ? photoAsset(bundled)?.uri : product.imageUri;
}
export async function submitStudioPreview(clientId: string, photos: PersonReference[], products: Product[], scene: TryOnScene = {id:'original'}): Promise<StudioJob> {
  if (!photos.some(p => p.role === 'body')) throw Error('Add a full-body photo to begin your preview.');
  if (!products.length || products.length > 5 || new Set(products.map(p => p.slot)).size !== products.length) throw Error('Choose one piece per category, up to five pieces.');
  const references = []; for (const photo of [...photos].sort((a, b) => Number(b.role === 'body') - Number(a.role === 'body'))) references.push({ role: photo.role, base64: await photoBytes(photo.localUri) });
  const garments = []; for (const product of products) { const uri = garmentReference(product); if (!uri) throw Error('This piece needs a clear clothing photo.'); garments.push({ slot: product.slot, name: product.name.slice(0,160), base64: await photoBytes(uri) }); }
  return studioRequest<StudioJob>('/tryon', { clientId, references, garments, scene });
}
