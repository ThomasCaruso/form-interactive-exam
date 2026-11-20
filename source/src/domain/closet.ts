import { closetArchetypes, type ClosetArchetype } from '../data/closetArchetypes';
import { readColour, readColourName } from './colour';
import { textureOf, type JudgePiece, type JudgeSlot } from './judgePiece';
import { garmentType } from './learning';
import type { ClosetPiece, GarmentSlot, Product, ShopFor, UserGarment } from './types';

/**
 * The closet: what the person owns, as one record type whatever it came from.
 * Archetype picks are approximate; photos and purchases are exact pieces.
 */

const SLOT_LABELS: Record<GarmentSlot, string> = {
  top: 'Top', pants: 'Bottom', dress: 'Dress', outerwear: 'Outerwear', shoes: 'Shoes', accessory: 'Accessory',
};
export function slotLabel(slot: GarmentSlot): string {
  return SLOT_LABELS[slot];
}

export const MAX_PER_SLOT = 3;
const SLOT_ORDER: readonly GarmentSlot[] = ['top', 'pants', 'dress', 'outerwear', 'shoes'];
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Archetypes for the grid: men's before women's, each in slot order. */
export function archetypesFor(shopFor: ShopFor): ClosetArchetype[] {
  const departments = shopFor === 'both' ? ['mens', 'womens'] : [shopFor];
  return departments.flatMap(d => SLOT_ORDER.flatMap(slot => closetArchetypes.filter(a => a.department === d && a.slot === slot)));
}

export function fromArchetype(a: ClosetArchetype, colour: { name: string; hex: string }, now = Date.now()): ClosetPiece {
  return { id: 'arch-' + a.id + '-' + slug(colour.name), origin: 'archetype', confidence: 'approximate', slot: a.slot, type: a.type,
    name: a.name, color: colour.name, hex: colour.hex, formality: a.formality, relaxed: a.relaxed, warmth: a.warmth,
    material: a.material, pattern: a.pattern, archetypeId: a.id, createdAt: now };
}

/** v1 uploads become photo pieces. The id is kept so try-on selections and boards that embed it still resolve. */
export function fromLegacyGarment(g: UserGarment): ClosetPiece {
  return { id: g.id, origin: 'photo', confidence: 'exact', slot: g.slot, type: garmentType({ name: g.name ?? '', slot: g.slot }),
    name: g.name, color: g.color ?? '', hex: '', localUri: g.localUri, aspect: g.aspect, createdAt: g.createdAt };
}

export const isPhotoPiece = (p: ClosetPiece): p is ClosetPiece & { localUri: string } => p.origin === 'photo' && !!p.localUri;
/** Photos arrive without formality or fit; the person is asked before the judge leans on them. */
export const needsAttributes = (p: ClosetPiece) => p.formality === undefined || p.relaxed === undefined;

export const displayName = (p: ClosetPiece) => p.origin === 'archetype' && p.color
  ? p.color + ' ' + (p.name ?? slotLabel(p.slot)).toLowerCase()
  : p.name ?? slotLabel(p.slot);

/** Board/product-list view. Photos keep the user_upload identity; archetypes render as colour swatches. Never priced. */
export function closetPieceToProduct(p: ClosetPiece): Product {
  const photo = isPhotoPiece(p);
  return {
    id: p.id, slot: p.slot, source: photo ? 'user_upload' : 'closet', brand: photo ? 'Your upload' : 'Your closet',
    name: displayName(p), priceCents: 0, localUri: p.localUri, aspect: p.aspect, cutoutUri: p.cutoutUri, cutoutAspect: p.cutoutAspect, color: p.color, hex: photo ? 'transparent' : p.hex,
    size: '—', details: photo ? 'Your uploaded photo, kept on this device.' : 'Something like this is in your closet.',
    palette: [], alternatives: [], formality: p.formality, relaxed: p.relaxed, warmth: p.warmth, material: p.material,
  };
}

/** What the judge sees. Unknown attributes read as the middle of each scale. */
export function judgePieceFromCloset(p: ClosetPiece): JudgePiece {
  const slot: JudgeSlot = p.slot === 'pants' ? 'bottom' : p.slot === 'accessory' ? 'top' : p.slot;
  const text = (p.color + ' ' + (p.name ?? '')).trim();
  const colour = p.hex ? readColour(text, p.hex) : readColourName(text.toLowerCase());
  if (p.pattern && p.pattern !== 'solid') colour.pattern = p.pattern;
  return { id: p.id, slot, type: p.type, colour, formality: p.formality ?? 1, relaxed: p.relaxed ?? false, warmth: p.warmth ?? 1,
    texture: textureOf((p.material ?? '') + ' ' + (p.name ?? '')) };
}

/** Closet-grid state: archetype id → chosen colour name. */
export type ClosetPicks = Record<string, string>;

/** Tap a colour on an archetype. The same colour again removes it; at most MAX_PER_SLOT archetypes per slot. */
export function togglePick(picks: ClosetPicks, a: ClosetArchetype, colour: { name: string }): ClosetPicks {
  if (picks[a.id] === colour.name) {
    const { [a.id]: _removed, ...rest } = picks;
    return rest;
  }
  if (!picks[a.id] && Object.keys(picks).filter(id => closetArchetypes.find(x => x.id === id)?.slot === a.slot).length >= MAX_PER_SLOT) return picks;
  return { ...picks, [a.id]: colour.name };
}

export function picksToPieces(picks: ClosetPicks, now = Date.now()): ClosetPiece[] {
  return Object.entries(picks).flatMap(([id, name]) => {
    const a = closetArchetypes.find(x => x.id === id), colour = a?.colors.find(c => c.name === name);
    return a && colour ? [fromArchetype(a, colour, now)] : [];
  });
}
