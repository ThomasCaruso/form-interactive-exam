import { GlassSurface } from './GlassSurface';
import { StyleSheet, Text, View } from 'react-native';
import { ProductVisual } from './ProductVisual';
import { realCatalogProducts } from '../data/realCatalog';
import { colors } from '../theme/tokens';
import { family } from '../theme/typography';
export function OnboardingScene({ compact = false, styles: selected = [], colors: palette = [] }: { compact?: boolean; styles?: string[]; colors?: string[] }) {
  const top = realCatalogProducts.find(p => p.slot === 'top' && (selected.includes('Classic') ? p.name.includes('Oxford') : p.color === 'White')) ?? realCatalogProducts[0];
  const pants = realCatalogProducts.find(p => p.slot === 'pants' && p.color === 'Beige') ?? realCatalogProducts.find(p => p.slot === 'pants')!;
  const shoe = realCatalogProducts.find(p => p.slot === 'shoes' && p.color === 'Off White') ?? realCatalogProducts.find(p => p.slot === 'shoes')!;
  return <View style={[scene.root, compact && { height: 160 }]} accessibilityLabel="Your wardrobe taking shape">
    <View style={scene.orbit} /><View style={[scene.orbit, scene.orbitInner]} />
    <GlassSurface quiet style={[scene.piece, scene.pants]}><ProductVisual product={pants} transition={false} /></GlassSurface>
    <GlassSurface quiet style={[scene.piece, scene.top]}><ProductVisual product={top} transition={false} /></GlassSurface>
    <GlassSurface quiet style={[scene.piece, scene.shoe]}><ProductVisual product={shoe} transition={false} /></GlassSurface>
    {!compact && <GlassSurface quiet style={scene.note}><Text style={scene.noteText}>A little more you.</Text><Text style={scene.noteSmall}>{palette.length ? palette.slice(0, 2).join(' / ') : 'YOUR NEXT CHAPTER'}</Text></GlassSurface>}
  </View>;
}
const scene = StyleSheet.create({ root: { height: 290, position: 'relative', marginVertical: 12 }, orbit: { position: 'absolute', width: '90%', height: '84%', left: '5%', top: '8%', borderRadius: 160, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line2 }, orbitInner: { width: '66%', left: '17%', height: '100%', top: 0 }, piece: { position: 'absolute', overflow: 'hidden', backgroundColor: colors.card, borderRadius: 4, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, padding: 12 }, top: { width: '46%', height: '84%', left: '12%', top: '2%', transform: [{ rotate: '-7deg' }] }, pants: { width: '40%', height: '80%', right: '7%', top: '5%', transform: [{ rotate: '8deg' }] }, shoe: { width: '41%', height: '39%', right: '2%', bottom: 0, transform: [{ rotate: '-5deg' }] }, note: { position: 'absolute', left: 0, bottom: 3, backgroundColor: colors.paper, borderRadius: 13, paddingVertical: 10, paddingHorizontal: 12 }, noteText: { fontFamily: family.serif, fontSize: 22, color: colors.ink }, noteSmall: { fontFamily: family.sans, fontSize: 8, letterSpacing: 1.4, color: colors.muted, marginTop: 4 } });
