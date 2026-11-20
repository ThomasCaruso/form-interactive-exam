import type { Product } from './types';

function hsl(hex: string) {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  const s = max === min ? 0 : (max - min) / (1 - Math.abs(2 * l - 1));
  return { r, b, s, l };
}
/** A plain-language color family, read from the garment photograph's measured hex. */
export function colorFamily(product: Pick<Product, 'hex' | 'color'>): string {
  const { r, b, s, l } = hsl(product.hex);
  if (l < 0.3) return 'Dark tones';
  if (s < 0.28 && l > 0.82) return 'Light neutrals';
  if (s < 0.3 && r > b + 0.02) return 'Warm neutrals';
  if (s < 0.2) return 'Cool greys';
  return 'Soft colour';
}
