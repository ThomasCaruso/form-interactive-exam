/** The invisible body: cut-outs placed at real-world proportions so separate packshots read as one outfit.
 * Everything is worked out in centimetres from the shoulder line, then scaled to fit the stage. */
export type StageSlot = 'outerwear' | 'top' | 'dress' | 'pants' | 'shoes';
export const STAGE_SLOTS: readonly StageSlot[] = ['outerwear', 'top', 'dress', 'pants', 'shoes'];
/** A piece on the stage. `aspect` is height ÷ width of its image. */
export interface StagePiece { id: string; slot: StageSlot; aspect: number; short?: boolean }
/** Where a piece is drawn, in stage pixels. `hang` is the edge it hangs from (shoes stand on the floor). */
export interface PieceBox { id: string; slot: StageSlot; x: number; y: number; w: number; h: number; z: number; hang: 'top' | 'bottom' }
/** `tucked`: the trousers are drawn over the top from a higher waist. The shirt's front disappears into them and its
 * sides and sleeves keep hanging (a front tuck), so nothing is cut and no cut edge can show. */
export interface OutfitLayout { boxes: PieceBox[]; canTuck: boolean; tucked: boolean; waistY: number; ground?: { x: number; y: number; w: number } }

// Flat widths: a shirt with its sleeves out, trousers across the hips, a pair of shoes side by side. Clothes are laid
// flat with sleeves and legs spread, which draws them wider than they are worn; shoes are photographed as they stand.
// So shoes get the same spread (about 1.3 times their true 34 cm), or they look undersized next to the clothes.
const WIDTH_CM: Record<StageSlot, number> = { outerwear: 74, top: 68, dress: 56, pants: 48, shoes: 44 };
const SHORT_WIDTH_CM = 54;
// The invisible leg under shorts, skirts and dresses is drawn shorter than life: empty height there only shrinks the
// whole outfit to fit the stage and leaves the shoes stranded at the bottom.
const WAIST_TO_SHOE_CM = 74;   // where shoes land under shorts, skirts and dresses
const SHOE_GAP_CM = 8;         // at least this much leg shows under a short hem
const DRESS_WAIST_CM = 45;
const BREAK = 0.18;            // full-length trousers fall over the top of the shoe

export const isShortBottom = (name: string) => /\b(shorts?|skirts?)\b/i.test(name);

export function layoutOutfit(pieces: readonly StagePiece[], tucked: boolean, stage: { width: number; height: number }, pad = 12): OutfitLayout {
  const of = (slot: StageSlot) => pieces.find(p => p.slot === slot);
  const top = of('top'), outer = of('outerwear'), dress = of('dress'), pants = dress ? undefined : of('pants'), shoes = of('shoes');
  const widthOf = (p: StagePiece) => p.slot === 'pants' && p.short ? SHORT_WIDTH_CM : WIDTH_CM[p.slot];
  const heightOf = (p: StagePiece) => widthOf(p) * p.aspect;
  const canTuck = !!(top && pants);
  const tuck = canTuck && tucked;

  const cm = new Map<StagePiece, number>(); // top edge of each piece
  if (outer) cm.set(outer, -2);
  if (top && !dress) cm.set(top, 0);
  if (dress) cm.set(dress, 0);
  const waist = dress ? DRESS_WAIST_CM : top ? heightOf(top) * (tuck ? 0.6 : 0.8) : outer ? heightOf(outer) * 0.8 : DRESS_WAIST_CM;
  if (pants) cm.set(pants, waist);
  if (shoes) {
    const fullLength = pants && !pants.short && heightOf(pants) >= 70;
    const lowerEnd = dress ? heightOf(dress) : pants ? waist + heightOf(pants) : waist;
    cm.set(shoes, fullLength ? waist + heightOf(pants!) - heightOf(shoes) * BREAK : Math.max(lowerEnd + SHOE_GAP_CM, waist + WAIST_TO_SHOE_CM));
  }
  const placed = [...cm.keys()];
  if (!placed.length) return { boxes: [], canTuck, tucked: tuck, waistY: 0 };

  const minY = Math.min(...placed.map(p => cm.get(p)!)), maxY = Math.max(...placed.map(p => cm.get(p)! + heightOf(p)));
  const maxW = Math.max(...placed.map(widthOf));
  const k = Math.min((stage.height - pad * 2) / (maxY - minY), (stage.width - pad * 2) / maxW);
  const offY = pad + (stage.height - pad * 2 - (maxY - minY) * k) / 2 - minY * k;
  const Z: Record<StageSlot, number> = { shoes: 0, pants: tuck ? 3 : 1, dress: 2, top: 2, outerwear: 4 };
  const boxes = placed.map(p => {
    const w = widthOf(p) * k;
    return { id: p.id, slot: p.slot, x: stage.width / 2 - w / 2, y: offY + cm.get(p)! * k, w, h: heightOf(p) * k, z: Z[p.slot], hang: p.slot === 'shoes' ? 'bottom' as const : 'top' as const };
  }).sort((a, b) => a.z - b.z);

  const shoeBox = boxes.find(b => b.slot === 'shoes');
  const out: OutfitLayout = { boxes, canTuck, tucked: tuck, waistY: offY + waist * k };
  if (shoeBox) out.ground = { x: shoeBox.x - shoeBox.w * 0.18, y: shoeBox.y + shoeBox.h * 0.86, w: shoeBox.w * 1.36 };
  return out;
}
