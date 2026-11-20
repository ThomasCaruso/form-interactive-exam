import { StyleSheet, Text, View } from 'react-native';
import { ContextSheet } from './ContextSheet';
import { GlassSurface } from './GlassSurface';
import { MotionPressable } from './MotionPressable';
import { ProductVisual } from './ProductVisual';
import { FormIcon } from './FormIcon';
import { shoppingSummary } from '../domain/savedShopping';
import { formatMoney } from '../domain/selectors';
import type { Product, SavedLook } from '../domain/types';
import { colors } from '../theme/tokens';
import { family } from '../theme/typography';
/** Shopping always resolves from the saved snapshot, never from a later edit. */
export function SavedLookShopSheet({ entry, onClose, onShop }: { entry?: SavedLook; onClose: () => void; onShop: (product: Product) => void }) {
  const summary = entry ? shoppingSummary(entry.look) : null;
  return <ContextSheet visible={!!entry} title="Make the look yours" onClose={onClose}>
    {entry && summary && <>
      <Text style={styles.title}>{entry.look.title}</Text>
      <View style={styles.row}><Text style={styles.meta}>{summary.products.length} online pieces</Text><Text style={styles.price}>{formatMoney(summary.totalCents)}</Text></View>
      <Text style={styles.meta}>Choose a piece to check its size and buy directly from the retailer.</Text>
      {summary.products.map(product => <GlassSurface key={product.id} style={styles.piece}><View style={styles.photo}><ProductVisual product={product} transition={false} /></View><View style={{ flex: 1, gap: 4 }}><Text style={styles.brand}>{product.brand}</Text><Text style={styles.name}>{product.name}</Text><Text style={styles.meta}>{product.color} · {formatMoney(product.priceCents)}</Text><MotionPressable accessibilityRole="button" accessibilityLabel={'Shop ' + product.name + ' at ' + product.retailer!.name} onPress={() => onShop(product)} style={styles.shop}><Text style={styles.name}>{'Shop at ' + product.retailer!.name}</Text><FormIcon name="arrow" size={16} /></MotionPressable></View></GlassSurface>)}
      {!!summary.ownedCount && <Text style={styles.meta}>{summary.ownedCount} {summary.ownedCount === 1 ? 'piece is' : 'pieces are'} from your own wardrobe.</Text>}
      {!!summary.sampleCount && <Text style={styles.meta}>{summary.sampleCount} sample {summary.sampleCount === 1 ? 'piece has' : 'pieces have'} no verified retailer listing.</Text>}
      <Text style={styles.note}>Prices are a guide. Confirm size, current price and availability at the retailer. Taxes and shipping extra.</Text>
    </>}
  </ContextSheet>;
}
const styles = StyleSheet.create({
  title: { fontFamily: family.serif, fontSize: 28, lineHeight: 33, color: colors.ink }, row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  price: { fontFamily: family.sansMedium, fontSize: 20, color: colors.ink }, meta: { fontFamily: family.sans, fontSize: 12, lineHeight: 18, color: colors.muted },
  piece: { flexDirection: 'row', gap: 16, borderRadius: 4, padding: 14 }, photo: { width: 72, height: 100, backgroundColor: colors.plate, borderRadius: 4, overflow: 'hidden' },
  brand: { fontFamily: family.sansMedium, fontSize: 10, lineHeight: 16, letterSpacing: 1, color: colors.muted }, name: { fontFamily: family.sansMedium, fontSize: 13, lineHeight: 19, color: colors.ink },
  shop: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, borderRadius: 4, marginTop: 6 }, note: { fontFamily: family.sans, fontSize: 10, lineHeight: 17, color: colors.muted },
});
