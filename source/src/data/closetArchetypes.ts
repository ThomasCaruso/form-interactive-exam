import type { GarmentSlot } from '../domain/types';
import type { Pattern } from '../domain/colour';

/** A kind of garment most closets have. People pick these in the closet grid; the judge reads the attributes. */
export interface ClosetArchetype {
  id: string; department: 'mens' | 'womens'; slot: GarmentSlot;
  /** garmentType vocabulary, plus shoe types the catalog lacks. */
  type: string; name: string;
  formality: number; relaxed: boolean; warmth: number; material: string; pattern?: Pattern;
  colors: readonly { name: string; hex: string }[];
}
const C = {
  white: { name: 'White', hex: '#f4f4f2' }, black: { name: 'Black', hex: '#1c1c1e' }, navy: { name: 'Navy', hex: '#26324a' },
  gray: { name: 'Gray', hex: '#8e9093' }, charcoal: { name: 'Charcoal Gray', hex: '#3d3f43' }, beige: { name: 'Beige', hex: '#cdbb9c' },
  camel: { name: 'Camel', hex: '#b08a5b' }, brown: { name: 'Brown', hex: '#5d4331' }, olive: { name: 'Olive', hex: '#5b5e3a' },
  ivory: { name: 'Ivory', hex: '#ece6d8' }, lightBlue: { name: 'Light Blue', hex: '#bcd0e6' }, darkDenim: { name: 'Dark Denim', hex: '#2b3a55' },
  lightDenim: { name: 'Light Denim', hex: '#8ea6c4' }, burgundy: { name: 'Burgundy', hex: '#5a1f2c' }, forest: { name: 'Forest Green', hex: '#2c4a36' },
  navyStripe: { name: 'Navy Stripe', hex: '#e9e7e1' }, redCheck: { name: 'Red Check', hex: '#8a2f2f' },
} as const;
const a = (department: 'mens' | 'womens', slot: GarmentSlot, id: string, name: string, type: string, formality: number, relaxed: boolean, warmth: number, material: string, colors: { name: string; hex: string }[], pattern?: Pattern): ClosetArchetype =>
  ({ id: department[0] + '-' + id, department, slot, type, name, formality, relaxed, warmth, material, colors, pattern });

export const closetArchetypes: readonly ClosetArchetype[] = [
  // Menswear
  a('mens', 'top', 'oxford', 'Oxford shirt', 'shirt', 2, false, 0, 'Cotton oxford', [C.white, C.lightBlue]),
  a('mens', 'top', 'tee', 'Plain tee', 't-shirt', 0, false, 0, 'Cotton jersey', [C.white, C.black, C.gray, C.navy]),
  a('mens', 'top', 'crew', 'Crewneck sweater', 'sweater', 1, false, 2, 'Knit', [C.navy, C.gray, C.beige, C.forest]),
  a('mens', 'top', 'hoodie', 'Hoodie', 'sweatshirt', 0, true, 1, 'Cotton fleece-back jersey', [C.gray, C.black, C.navy]),
  a('mens', 'top', 'polo', 'Polo', 'polo', 1, false, 0, 'Cotton', [C.navy, C.white, C.black]),
  a('mens', 'top', 'flannel', 'Flannel shirt', 'shirt', 1, true, 1, 'Cotton', [C.redCheck], 'check'),
  a('mens', 'top', 'linen', 'Linen shirt', 'shirt', 1, true, 0, 'Linen', [C.white, C.beige, C.lightBlue]),
  a('mens', 'pants', 'jeans', 'Dark jeans', 'jeans', 1, false, 1, 'Cotton denim', [C.darkDenim, C.lightDenim, C.black]),
  a('mens', 'pants', 'chinos', 'Chinos', 'trousers', 1, false, 1, 'Cotton', [C.beige, C.navy, C.olive, C.gray]),
  a('mens', 'pants', 'tailored', 'Tailored trousers', 'trousers', 2, false, 1, 'Wool blend', [C.charcoal, C.navy, C.gray]),
  a('mens', 'pants', 'joggers', 'Joggers', 'easy pants', 0, true, 1, 'Cotton fleece-back jersey', [C.gray, C.black]),
  a('mens', 'pants', 'shorts', 'Shorts', 'shorts', 0, false, 0, 'Cotton', [C.beige, C.navy]),
  a('mens', 'pants', 'wide', 'Wide-leg trousers', 'trousers', 1, true, 1, 'Cotton', [C.black, C.beige]),
  a('mens', 'shoes', 'leather-sneakers', 'White leather sneakers', 'sneakers', 1, false, 1, 'Leather', [C.white]),
  a('mens', 'shoes', 'canvas', 'Canvas sneakers', 'sneakers', 0, false, 0, 'Canvas', [C.white, C.black, C.navy]),
  a('mens', 'shoes', 'runners', 'Running shoes', 'sneakers', 0, false, 1, 'Synthetic', [C.gray, C.black]),
  a('mens', 'shoes', 'loafers', 'Loafers', 'loafers', 2, false, 1, 'Leather', [C.black, C.brown]),
  a('mens', 'shoes', 'derbies', 'Derby shoes', 'derbies', 2, false, 1, 'Leather', [C.brown, C.black]),
  a('mens', 'shoes', 'chelsea', 'Chelsea boots', 'boots', 2, false, 2, 'Leather', [C.brown, C.black]),
  a('mens', 'outerwear', 'denim-jacket', 'Denim jacket', 'jacket', 1, false, 1, 'Cotton denim', [C.lightDenim, C.darkDenim]),
  a('mens', 'outerwear', 'overcoat', 'Overcoat', 'coat', 2, false, 2, 'Wool', [C.camel, C.charcoal, C.navy]),
  a('mens', 'outerwear', 'bomber', 'Bomber jacket', 'jacket', 1, false, 1, 'Nylon', [C.black, C.olive]),
  a('mens', 'outerwear', 'puffer', 'Puffer jacket', 'coat', 0, true, 2, 'Nylon', [C.black, C.navy]),
  a('mens', 'outerwear', 'blazer', 'Blazer', 'jacket', 2, false, 1, 'Wool', [C.navy, C.charcoal]),
  // Womenswear
  a('womens', 'top', 'tee', 'Plain tee', 't-shirt', 0, false, 0, 'Cotton jersey', [C.white, C.black, C.gray]),
  a('womens', 'top', 'blouse', 'Blouse', 'blouse', 2, false, 0, 'Lyocell blend', [C.white, C.ivory, C.black]),
  a('womens', 'top', 'fine-knit', 'Fine knit', 'sweater', 1, false, 1, 'Knit', [C.black, C.ivory, C.camel]),
  a('womens', 'top', 'cardigan', 'Cardigan', 'cardigan', 1, false, 1, 'Knit', [C.gray, C.navy, C.beige]),
  a('womens', 'top', 'breton', 'Breton stripe top', 't-shirt', 1, false, 0, 'Cotton', [C.navyStripe], 'stripe'),
  a('womens', 'top', 'shirt', 'Button-up shirt', 'shirt', 2, false, 0, 'Cotton broadcloth', [C.white, C.lightBlue]),
  a('womens', 'pants', 'jeans', 'Straight jeans', 'jeans', 1, false, 1, 'Cotton denim', [C.darkDenim, C.lightDenim]),
  a('womens', 'pants', 'wide', 'Wide-leg trousers', 'trousers', 2, true, 1, 'Wool blend', [C.black, C.beige, C.navy]),
  a('womens', 'pants', 'midi-skirt', 'Midi skirt', 'skirt', 2, false, 0, 'Lyocell blend', [C.black, C.beige]),
  a('womens', 'pants', 'denim-skirt', 'Denim skirt', 'skirt', 1, false, 0, 'Cotton denim', [C.darkDenim]),
  a('womens', 'pants', 'tailored', 'Tailored trousers', 'trousers', 2, false, 1, 'Wool blend', [C.black, C.charcoal]),
  a('womens', 'pants', 'joggers', 'Joggers', 'easy pants', 0, true, 1, 'Cotton fleece-back jersey', [C.gray]),
  a('womens', 'dress', 'slip', 'Slip dress', 'dress', 2, false, 0, 'Lyocell blend', [C.black, C.navy]),
  a('womens', 'dress', 'tee-dress', 'T-shirt dress', 'dress', 0, true, 0, 'Cotton jersey', [C.black, C.gray]),
  a('womens', 'dress', 'shirt-dress', 'Shirt dress', 'dress', 1, false, 0, 'Cotton', [C.white, C.beige]),
  a('womens', 'dress', 'knit-dress', 'Knit dress', 'dress', 1, false, 2, 'Knit', [C.brown, C.black]),
  a('womens', 'shoes', 'sneakers', 'White sneakers', 'sneakers', 1, false, 1, 'Leather', [C.white]),
  a('womens', 'shoes', 'flats', 'Ballet flats', 'flats', 1, false, 0, 'Leather', [C.black, C.beige]),
  a('womens', 'shoes', 'loafers', 'Loafers', 'loafers', 2, false, 1, 'Leather', [C.black, C.brown]),
  a('womens', 'shoes', 'ankle-boots', 'Ankle boots', 'boots', 2, false, 2, 'Leather', [C.black, C.brown]),
  a('womens', 'shoes', 'heels', 'Heeled sandals', 'heels', 3, false, 0, 'Leather', [C.black]),
  a('womens', 'shoes', 'runners', 'Running shoes', 'sneakers', 0, false, 1, 'Synthetic', [C.gray]),
  a('womens', 'outerwear', 'trench', 'Trench coat', 'coat', 2, false, 1, 'Cotton', [C.beige, C.navy]),
  a('womens', 'outerwear', 'wool-coat', 'Wool coat', 'coat', 2, false, 2, 'Wool', [C.camel, C.black]),
  a('womens', 'outerwear', 'denim-jacket', 'Denim jacket', 'jacket', 1, false, 1, 'Cotton denim', [C.lightDenim]),
  a('womens', 'outerwear', 'blazer', 'Blazer', 'jacket', 2, false, 1, 'Wool', [C.black, C.navy]),
  a('womens', 'outerwear', 'puffer', 'Puffer jacket', 'coat', 0, true, 2, 'Nylon', [C.black]),
];
