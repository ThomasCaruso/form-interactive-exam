import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ContextSheet } from './ContextSheet';
import { FormIcon } from './FormIcon';
import { GlassSurface } from './GlassSurface';
import { LocalPhoto } from './LocalPhoto';
import { MotionPressable } from './MotionPressable';
import { ProductVisual } from './ProductVisual';
import { isUserUpload, slotLabel } from '../domain/garments';
import { formatMoney } from '../domain/selectors';
import type { Product } from '../domain/types';
import { colors } from '../theme/tokens';
import { family } from '../theme/typography';

/**
 * One piece of a look, up close: details, swap, and taking it off. `onRemove` is offered for your own pieces;
 * `removeAny` offers it for catalog pieces too (on the stage, where a piece can always come off).
 */
export function PieceSheet({ piece, onClose, onSwap, onRemove, removeAny = false }: { piece: Product | null; onClose: () => void; onSwap?: (product: Product) => void; onRemove?: (product: Product) => void; removeAny?: boolean }) {
  const router = useRouter();
  // The confirm belongs to one piece: inspecting another closes it.
  const [revealFor, setRevealFor] = useState<string | null>(null);
  const revealRemove = !!piece && revealFor === piece.id;
  const setRevealRemove = (on: boolean) => setRevealFor(on && piece ? piece.id : null);
  const uploaded = !!piece && isUserUpload(piece);
  const canRemove = !!piece && !!onRemove && (uploaded || removeAny);
  return <ContextSheet visible={!!piece} title="The piece" onClose={onClose}>
    {piece && <>
      <View style={styles.sheetProduct}>
        <GlassSurface quiet style={styles.sheetImage}>{uploaded ? <LocalPhoto uri={piece.localUri} label={piece.name + ', your uploaded photo'} /> : <ProductVisual product={piece} />}</GlassSurface>
        <View style={{ flex: 1, gap: 6 }}><Text style={styles.brand}>{uploaded ? 'YOUR PIECE' : piece.brand.toUpperCase()}</Text><Text style={styles.name}>{piece.name}</Text><Text style={styles.meta}>{uploaded ? slotLabel(piece.slot) : piece.color + ' · ' + formatMoney(piece.priceCents)}</Text></View>
      </View>
      {!uploaded && <View style={styles.sheetActions}>
        <MotionPressable accessibilityRole="button" accessibilityLabel={'View ' + piece.name + ' details'} onPress={() => { const id = piece.id; onClose(); router.push({ pathname: '/product', params: { id } }); }} style={styles.sheetButton}><Text style={styles.viewText}>View details</Text><FormIcon name="arrow" size={18} /></MotionPressable>
        {onSwap && <MotionPressable accessibilityRole="button" accessibilityLabel={'Swap ' + piece.name + ' for an alternative'} onPress={() => { onClose(); onSwap(piece); }} style={[styles.sheetButton, { backgroundColor: colors.ink }]}><Text style={[styles.viewText, { color: colors.card }]}>Swap piece</Text><FormIcon name="rewind" size={18} color={colors.card} /></MotionPressable>}
      </View>}
      {canRemove && <View style={!uploaded ? { marginTop: 12 } : undefined}>
        {revealRemove ? <View><Text style={styles.confirmText}>Remove from this look?</Text><View style={styles.sheetActions}><MotionPressable accessibilityRole="button" onPress={() => setRevealRemove(false)} style={styles.sheetButton}><Text style={styles.viewText}>Keep</Text></MotionPressable><MotionPressable accessibilityRole="button" accessibilityLabel={'Remove ' + piece.name + ' from this look'} onPress={() => { onClose(); onRemove!(piece); }} style={styles.sheetButton}><Text style={styles.viewText}>Remove</Text></MotionPressable></View></View>
          : <MotionPressable accessibilityRole="button" onPress={() => setRevealRemove(true)} style={styles.sheetButton}><Text style={styles.viewText}>Remove from this look</Text></MotionPressable>}
      </View>}
    </>}
  </ContextSheet>;
}
const styles = StyleSheet.create({
  sheetProduct: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  sheetImage: { width: 100, height: 130, backgroundColor: colors.paper2, borderRadius: 4, overflow: 'hidden' },
  sheetActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  sheetButton: { flexGrow: 1, flexDirection: 'row', minHeight: 54, paddingHorizontal: 18, gap: 12, borderRadius: 27, backgroundColor: colors.paper2, alignItems: 'center', justifyContent: 'center' },
  viewText: { fontFamily: family.sansMedium, fontSize: 14, color: colors.ink },
  brand: { fontFamily: family.sansMedium, fontSize: 9, letterSpacing: 1.8, color: colors.muted },
  name: { fontFamily: family.sansMedium, fontSize: 14, lineHeight: 19, color: colors.ink, marginTop: 2 },
  meta: { fontFamily: family.sans, fontSize: 12, lineHeight: 17, color: colors.muted, marginTop: 1 },
  confirmText: { marginBottom: 12, fontFamily: family.sansMedium, fontSize: 13, lineHeight: 18, color: colors.ink },
});
