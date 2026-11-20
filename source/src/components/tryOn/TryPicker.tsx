import { useRouter } from 'expo-router';
import type { ReactElement } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useShallow } from 'zustand/react/shallow';
import { ContextSheet } from '../ContextSheet';
import { LocalPhoto } from '../LocalPhoto';
import { LookVisual } from '../LookVisual';
import { MotionPressable } from '../MotionPressable';
import { ProductVisual } from '../ProductVisual';
import { closetPieceToProduct, isPhotoPiece } from '../../domain/closet';
import { isUserUpload, selectionFromProduct } from '../../domain/garments';
import { tryableFromProducts } from '../../domain/trying';
import type { Look, Product } from '../../domain/types';
import { useFormStore } from '../../state/store';
import { colors } from '../../theme/tokens';
import { eyebrow, family } from '../../theme/typography';

/** Everything you could put on: saved pieces, saved looks, your own clothes. */
export function TryPicker({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const router = useRouter();
  const s = useFormStore(useShallow(st => ({ savedPieces: st.savedPieces, saved: st.saved, closet: st.closet, tryPiece: st.tryPiece, trySet: st.trySet })));
  const pieces = s.savedPieces.map(p => p.product), looks = s.saved.map(l => l.look), own = s.closet.filter(isPhotoPiece).map(closetPieceToProduct);
  const pick = (product: Product) => { s.tryPiece(selectionFromProduct(product)); onClose(); };
  const pickLook = (look: Look) => { s.trySet(tryableFromProducts(look.products)); onClose(); };
  const tile = (product: Product) => <MotionPressable key={product.id} glass={false} accessibilityRole="button" accessibilityLabel={'Try ' + product.name} onPress={() => pick(product)} style={styles.tile}>
    <View style={styles.media}>{isUserUpload(product) ? <LocalPhoto uri={product.localUri} label={product.name} /> : <ProductVisual product={product} />}</View>
    <Text numberOfLines={1} style={styles.name}>{product.name}</Text>
  </MotionPressable>;
  return <ContextSheet visible={visible} title="Add to the outfit" onClose={onClose}>
    {!!pieces.length && <Section title="SAVED PIECES"><>{pieces.map(tile)}</></Section>}
    {!!looks.length && <Section title="SAVED LOOKS"><>{looks.map(look => <MotionPressable key={look.id} glass={false} accessibilityRole="button" accessibilityLabel={'Try ' + look.title} onPress={() => pickLook(look)} style={styles.tile}>
      <View style={styles.media}><LookVisual look={{ ...look, previewKey: undefined }} /></View><Text numberOfLines={1} style={styles.name}>{look.title}</Text>
    </MotionPressable>)}</></Section>}
    <Section title="YOUR CLOTHES"><>{own.map(tile)}
      <MotionPressable glass={false} accessibilityRole="button" onPress={() => { onClose(); router.push('/add-piece'); }} style={[styles.tile, styles.addTile]}><Text style={styles.plus}>+</Text><Text style={[styles.name, styles.addText]}>Add from a photo</Text></MotionPressable>
    </></Section>
    {!pieces.length && !looks.length && <Text style={styles.empty}>Save pieces in For You and they’ll be ready to try here.</Text>}
  </ContextSheet>;
}
function Section({ title, children }: { title: string; children: ReactElement }) {
  return <View style={styles.section}><Text style={[eyebrow, styles.label]}>{title}</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>{children}</ScrollView></View>;
}
const styles = StyleSheet.create({
  section: { marginBottom: 18 }, label: { color: colors.muted, marginBottom: 8 }, row: { gap: 10 },
  tile: { width: 92 }, media: { width: 92, height: 112, borderRadius: 10, overflow: 'hidden', backgroundColor: colors.paper2 },
  name: { fontFamily: family.sans, fontSize: 11, color: colors.ink2, marginTop: 5 },
  addTile: { height: 112, borderRadius: 10, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.faint, alignItems: 'center', justifyContent: 'center' },
  addText: { textAlign: 'center', paddingHorizontal: 10, marginTop: 2 },
  plus: { fontFamily: family.sans, fontSize: 22, color: colors.muted },
  empty: { fontFamily: family.sans, fontSize: 12, color: colors.muted, marginBottom: 8 },
});
