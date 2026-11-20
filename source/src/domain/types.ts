/**
 * FORM domain types — typed ports of the demo data shapes.
 * Money is ALWAYS integer cents internally; format only at the UI edge.
 */

/** Shared slot vocabulary across catalog products and user-uploaded garments. */
export type GarmentSlot = 'top' | 'pants' | 'dress' | 'outerwear' | 'shoes' | 'accessory';

/** Which catalog department a piece belongs to. Absent means unisex. */
export type Department = 'womens' | 'mens' | 'unisex';
/** What the user shops for. Absent means menswear, the original catalog. */
export type ShopFor = 'womens' | 'mens' | 'both';

/** Where a garment came from. Catalog pieces ship with FORM; uploads stay on the device. */
/** 'closet' is an owned piece without a photo (an archetype), shown as a colour swatch. */
export type GarmentSource = 'catalog' | 'user_upload' | 'closet';

export interface ColorOption {
  name: string;
  hex: string;
}

export interface ProductAlternative {
  brand: string;
  name: string;
  priceCents: number;
  color: string;
  hex: string;
  /** Why FORM suggests this alternative, e.g. "Lower price" or "More relaxed". */
  reason: string;
}

export interface Product {
  id: string;
  slot: GarmentSlot;
  department?: Department;
  /** Garment source. Absent means catalog. Uploaded garments carry 'user_upload' plus a localUri. */
  source?: GarmentSource;
  brand: string;
  name: string;
  priceCents: number;
  /** Product image or transparent cutout, rendered without storefront framing. */
  imageUri?: string;
  /** Exact retailer listing; absence identifies legacy demo or local upload. */
  retailer?: { name: string; url: string; productId: string; variantId: string; currency: 'USD'; checkedAt: string };
  /** Curated styling attributes, not retailer or fit claims. */
  warmth?: number;
  relaxed?: boolean;
  assetKey?: string;
  /** Device-local file URI — user uploads only. Never a data: or remote URI. */
  localUri?: string;
  /** width ÷ height of localUri, when known at intake; boards re-measure on load. */
  aspect?: number;
  /** A transparent cut-out the person made for their own photo (Try On's Needs a cut-out queue). Device-local. */
  cutoutUri?: string;
  /** height ÷ width of cutoutUri — the stage's convention, the inverse of `aspect`. */
  cutoutAspect?: number;
  material?: string;
  availableSizes?: string[];
  styleTags?: string[];
  formality?: number;
  /** Currently selected color name. */
  color: string;
  /** Currently selected color hex — drives the figure recolor. */
  hex: string;
  /** Recommended size for this user's profile. */
  size: string;
  details: string;
  /** Selectable palette for this garment's slot. */
  palette: readonly ColorOption[];
  alternatives: readonly ProductAlternative[];
}

export interface LookScene {
  a: string;
  b: string;
}

export interface Look {
  id: string;
  /** Display ordinal, e.g. "01". */
  number: string;
  title: string;
  vibe: string;
  description: string;
  /** Stylist rationale — "Why FORM chose this". */
  why: string;
  scene: LookScene;
  products: Product[];
  previewKey?: 'quiet' | 'night' | 'weekend';
  refinements?: Refinement[];
}

export type Refinement = 'Less formal' | 'More formal' | 'Lower price' | 'Different shoes' | 'Warmer' | 'More relaxed';
export type ReviewStatus = 'saved' | 'passed';
export interface EditRequest { occasion: string; dressCode: string; budgetCents: number; location?: string; notes?: string; }
export interface SavedPiece { id: string; product: Product; savedAt: number; }

export interface Session {
  id: string;
  occasion: string;
  looks: Look[];
  createdAt: number;
  request?: EditRequest;
}

/**
 * Immutable snapshot of a look at save time. Saved looks must NEVER resolve
 * through a session by id — later swaps or session trimming must not be able
 * to change what the user sees on their board.
 */
export interface SavedLook {
  id: string;
  occasion: string;
  savedAt: number;
  request?: EditRequest;
  look: Look;
  /** Your outfits (Edits) remember how the top is worn. */
  tucked?: boolean;
}

export interface PassedLook {
  lookId: string;
  title: string;
  occasion: string;
  passedAt: number;
}

export type ProfileSection = 'direction' | 'budget' | 'fit' | 'week';
/** A local calendar day, 'YYYY-MM-DD'. */
export type DayKey = string;
export type DayOccasion = 'work' | 'casual' | 'going-out' | 'active' | 'formal';
/** One day of Your week. `outfitId` follows the live outfit while the day is ahead; once it has passed, `worn`
 * freezes what it was, so history never changes. */
export interface DayPlan {
  outfitId: string | null;
  occasion?: DayOccasion;
  note?: string;
  /** You said you were wearing it (Today's card or the morning note), not just that it was planned. */
  confirmed?: boolean;
  worn?: { name: string; products: Product[]; tucked?: boolean };
}
export type PersonPhotoRole = 'portrait' | 'face-left' | 'face-right' | 'head' | 'body';
export interface PersonReference { id: string; role: PersonPhotoRole; localUri: string; width: number; height: number; createdAt: number; }
export interface FittingProfile { units: 'metric' | 'imperial'; heightCm?: number; weightKg?: number; waistCm?: number; inseamCm?: number; bottomSize?: string; fitPreference?: 'fitted' | 'regular' | 'relaxed'; }
export interface Profile {
  /** User-supplied fitting information; never a scan or fit guarantee. */
  fitting?: FittingProfile;
  /** Full personal styling brief; current build interprets supported catalog keywords locally. */
  styleBrief?: string;
  /** Presentation only; hidden sections never disable their preferences. */
  hiddenProfileSections?: ProfileSection[];
  /** Departments the feed draws from. */
  shopFor?: ShopFor;
  /** First-run taste answers by product id. Every later swipe adds to what these teach. */
  tasteAnswers?: { liked: string[]; passed: string[] };
  name: string;
  height: string;
  topSize: string;
  waist: string;
  inseam: string;
  shoe: string;
  budgetCents: number;
  styles: string[];
  priority: string;
  brands: string[];
  favoriteColors?: string[];
  avoidedColors?: string[];
  avoidedBrands?: string[];
}

export interface StyleOption {
  name: string;
  description: string;
}

/**
 * Legacy (store v1) record for a garment the user photographed. Store v2 keeps
 * these as ClosetPiece with origin 'photo'; this shape is only migration input.
 * A garment the user photographed themselves. The image file lives in
 * app-owned document storage; only this metadata (including the local URI)
 * is persisted. No cloud copy, no AI processing — local-only in this build.
 */
export interface UserGarment {
  id: string;
  source: 'user_upload';
  /** Durable local file URI inside app document storage. */
  localUri: string;
  slot: GarmentSlot;
  name?: string;
  color?: string;
  /** width ÷ height of the photo, when the picker reported dimensions. */
  aspect?: number;
  createdAt: number;
}

export type ClosetOrigin = 'archetype' | 'purchased' | 'photo';
/** Something the person owns. Archetypes are approximate; photos and purchases are exact pieces. */
export interface ClosetPiece {
  id: string;
  origin: ClosetOrigin;
  confidence: 'approximate' | 'exact';
  slot: GarmentSlot;
  /** garmentType vocabulary. */
  type: string;
  name?: string;
  /** Colour name as the person or archetype gave it; '' when unknown. */
  color: string;
  /** '' when unknown (photos): the judge then reads colour from the name alone. */
  hex: string;
  /** Unknown on photos until the person is asked. */
  formality?: number; relaxed?: boolean; warmth?: number;
  material?: string; pattern?: 'solid' | 'stripe' | 'check' | 'print';
  archetypeId?: string;
  productId?: string;
  localUri?: string; aspect?: number;
  /** See Product.cutoutUri. */
  cutoutUri?: string; cutoutAspect?: number;
  createdAt: number; lastConfirmedAt?: number;
}
