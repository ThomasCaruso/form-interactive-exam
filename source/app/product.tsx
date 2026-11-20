import { useScreenSize } from '../src/web/desktop';
import { productPhotography } from '../src/data/photography';
import { ImageInspector } from '../src/components/ImageInspector';
import { MotionPressable } from '../src/components/MotionPressable';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { EditorialScreen, SectionLabel, editorial } from '../src/components/Editorial';
import { DetailHeader, TextAction } from '../src/components/DetailHeader';
import { ProductVisual } from '../src/components/ProductVisual';
import { showToast } from '../src/components/Toast';
import { realCatalogProducts } from '../src/data/realCatalog';
import { catalogProducts } from '../src/data/catalog';
import { createPairingSession, fixtureReason, recommendedSize, relatedFixtureLook } from '../src/domain/stylingEngine';
import { formatMoney, lookTotalCents } from '../src/domain/selectors';
import { retailerDestination } from '../src/providers/retailerDestination';
import { useFormStore } from '../src/state/store';
import { useShallow } from 'zustand/react/shallow';
import { colors } from '../src/theme/tokens';
export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const state = useFormStore(useShallow(s => ({ addSession: s.addSession, passPiece: s.passPiece, profile: s.profile, saved: s.saved, savedPieces: s.savedPieces, selectLook: s.selectLook, sessions: s.sessions, setActiveSession: s.setActiveSession, togglePiece: s.togglePiece })));
  const { width } = useScreenSize();
  const [page, setPage] = useState(0);
  const [inspecting, setInspecting] = useState(false);
  const product = [...realCatalogProducts, ...catalogProducts].find(p => p.id === id) ?? state.savedPieces.find(p => p.id === id)?.product ?? state.sessions.flatMap(s => s.looks.flatMap(l => l.products)).find(p => p.id === id) ?? state.saved.flatMap(s => s.look.products).find(p => p.id === id);
  const relatedSession = product ? state.sessions.find(s => s.looks.some(l => l.products.some(p => p.id === product.id))) : undefined;
  const related = product ? relatedSession?.looks.find(l => l.products.some(p => p.id === product.id)) ?? relatedFixtureLook(product, state.profile) : undefined;
  function openRelated() {
    if (!related) return;
    state.selectLook(related);
    if (relatedSession) state.setActiveSession(relatedSession.id);
    else state.addSession(createPairingSession(related, state.profile));
    router.push({ pathname: '/results', params: { lookId: related.id } });
  }
  if (!product) return <EditorialScreen><DetailHeader title="Piece" /><Text style={editorial.title}>This piece is unavailable.</Text></EditorialScreen>;
  if (inspecting) return <ImageInspector key={product.id} product={product} visible onClose={() => setInspecting(false)} />;
  const saved = state.savedPieces.some(p => p.id === product.id);
  return <EditorialScreen><DetailHeader title="The piece" />
    <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={styles.gallery} onMomentumScrollEnd={e => setPage(Math.round(e.nativeEvent.contentOffset.x / (width - 48)))}>
      {(product.retailer ? [0] : [0, 1]).map(i => <View key={i} style={{ width: width - 48, height: Math.min(440, (width - 48) * 1.15), overflow: 'hidden' }}><MotionPressable accessibilityRole="button" accessibilityLabel="Explore product image" onPress={() => setInspecting(true)} style={{ flex: 1 }}><ProductVisual product={product} gallery={i} /></MotionPressable></View>)}
    </ScrollView>
    <Text style={styles.galleryNote}>{page + 1} / {product.retailer ? 1 : 2} - {page ? "Detail crop" : "Full view"} - {productPhotography[product.id]?.illustrative ? "Illustrative demo image" : product.retailer ? "Retailer photo - tap to explore" : "Tap to explore"}</Text>
    <SectionLabel>{product.brand}</SectionLabel><Text style={editorial.title}>{product.name}</Text>
    <View style={[editorial.row, { marginVertical: 12 }]}><Text style={editorial.body}>{product.color}</Text><Text style={editorial.body}>{formatMoney(product.priceCents)}</Text></View>
    <Text style={editorial.secondary}>{product.material ?? product.details}</Text><View style={editorial.rule} />
    <SectionLabel>{product.retailer ? "Retailer sizes at last check" : "Available sizes · demo"}</SectionLabel><View style={styles.sizes}>{(product.availableSizes ?? [product.size]).map(size => <Text key={size} style={styles.size}>{size}</Text>)}</View>
    <Text style={editorial.body}>Your saved size: {recommendedSize(product, state.profile)}</Text><Text style={editorial.secondary}>Your profile size is a reference. Match it to the retailer’s size chart; sizing and fit are not verified.</Text>
    <View style={editorial.rule} /><SectionLabel>Why this was picked</SectionLabel><Text style={[editorial.body, { marginTop: 8 }]}>{fixtureReason(product, state.profile)}</Text><Text style={editorial.secondary}>Selected using your stated preferences</Text>
    {related && <><View style={editorial.rule} /><SectionLabel>A complete look</SectionLabel><MotionPressable accessibilityRole="button" accessibilityLabel={'Open related edit ' + related.title} onPress={openRelated} style={styles.related}><View><Text style={editorial.title}>{related.title}</Text><Text style={editorial.secondary}>{formatMoney(lookTotalCents(related))} · Complete look</Text></View><Text style={editorial.body}>→</Text></MotionPressable></>}
    {!related && <><View style={editorial.rule} /><TextAction label="Create a complete edit →" onPress={() => router.push({ pathname: '/create-edit', params: {} })} /></>}
    <View style={editorial.rule} /><View style={editorial.row}><TextAction label={saved ? 'Saved piece' : 'Save piece'} onPress={() => { const nowSaved = state.togglePiece(product); showToast(nowSaved ? 'Piece saved' : 'Piece removed', nowSaved ? 'success' : 'passed'); }} /><TextAction label="Not for me" onPress={() => { state.passPiece(product); showToast('Passed · removed from selection', 'passed'); router.back(); }} /></View>
    <TextAction dark label={product.retailer ? "Shop at " + product.retailer.name + " →" : "About this demo piece"} onPress={() => { void retailerDestination.viewProduct(product); }} /><Text style={[editorial.secondary, { marginTop: 10, textAlign: 'center' }]}>{product.retailer ? "USD price and sizes checked " + new Date(product.retailer.checkedAt).toLocaleDateString() + ". Confirm current price, size and stock at the retailer. Taxes and shipping extra." : "Sample item · no verified online listing"}</Text>
  </EditorialScreen>;
}
const styles = StyleSheet.create({
  gallery: { marginVertical: 8, backgroundColor: colors.paper2, borderRadius: 4 }, galleryNote: { ...editorial.secondary, textAlign: 'center', marginBottom: 24 },
  sizes: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginVertical: 12 },
  size: { ...editorial.body, padding: 10, minWidth: 42, textAlign: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line2, borderRadius: 4 },
  related: { ...editorial.row, minHeight: 72, paddingVertical: 12 },
});
