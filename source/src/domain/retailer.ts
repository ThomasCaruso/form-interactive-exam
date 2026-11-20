import type { Product } from './types';
/** Only the exact supported retailer's HTTPS product pages are destinations. */
export function retailerProductUrl(product: Product): string | null {
  if (!product.retailer || product.source === 'user_upload') return null;
  try {
    const url = new URL(product.retailer.url);
    if (url.protocol !== 'https:' || url.hostname !== 'www.muji.us' || url.username || url.password || url.port || !/^\/products\/[a-z0-9-]+$/.test(url.pathname)) return null;
    if (url.searchParams.get('variant') !== product.retailer.variantId) return null;
    return url.href;
  } catch { return null; }
}
