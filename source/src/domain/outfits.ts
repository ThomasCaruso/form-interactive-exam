import { cloneLook } from './transforms';
import type { Look, Product, SavedLook } from './types';

/** Your outfits are your saved looks: `look.title` is the name, `look.products` the pieces. They are edited in place
 * on Edits; nothing else changes them. See docs/superpowers/specs/2026-10-12-edits-your-outfits-design.md. */

/** `base`, or `base 2`, `base 3`… — the first that no outfit uses. A trailing number on `base` is counted on from. */
export function uniqueName(base: string, taken: readonly string[]): string {
  const clean = base.trim() || 'Outfit';
  const lower = new Set(taken.map(t => t.trim().toLowerCase()));
  if (!lower.has(clean.toLowerCase())) return clean;
  const m = clean.match(/^(.*?)\s+(\d+)$/);
  const stem = m ? m[1] : clean;
  for (let n = m ? Number(m[2]) + 1 : 2; ; n++) if (!lower.has((stem + ' ' + n).toLowerCase())) return stem + ' ' + n;
}

/** A new outfit of yours. `from` gives the look's copy (title, why…); `products` and `name` are what it starts with. */
export function makeOutfit(from: Look | null, products: readonly Product[], name: string, occasion: string, now: number, seed: string): SavedLook {
  const id = 'outfit-' + now.toString(36) + '-' + seed;
  const base: Look = from ? cloneLook(from) : { id, number: '', title: name, vibe: 'Yours', description: '', why: '', scene: { a: '', b: '' }, products: [] };
  return { id, occasion, savedAt: now, look: { ...base, id, title: name, products: products.map(p => ({ ...p })) } };
}

export const outfitNames = (saved: readonly SavedLook[]) => saved.map(s => s.look.title);
