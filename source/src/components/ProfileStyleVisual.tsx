import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MotionPressable } from './MotionPressable';
import { ProductVisual } from './ProductVisual';
import { FormIcon } from './FormIcon';
import { onboardingPalette } from '../data/onboarding';
import { rankProducts } from '../domain/stylingEngine';
import { colorMatches } from '../domain/styleBrief';
import type { Profile } from '../domain/types';
import { colors } from '../theme/tokens';
import { family } from '../theme/typography';

/** Actual eligible catalog imagery, used as style references rather than an outfit/stock claim. */
export function ProfileStyleVisual({ profile, onPress }: { profile: Profile; onPress: () => void }) {
  const pieces = useMemo(() => {
    const ranked = rankProducts(profile);
    return (['top', 'pants', 'shoes'] as const).flatMap(slot => {
      const product = ranked.find(piece => piece.slot === slot);
      return product ? [product] : [];
    });
  }, [profile]);
  const palette = onboardingPalette.filter(item => profile.favoriteColors?.some(color => colorMatches(color, item.value)));
  const hues = palette.length ? palette : onboardingPalette;
  const background = hues.find(item => !['Soft black', 'Navy'].includes(item.name))?.hex ?? '#E4DACE';
  return <MotionPressable accessibilityRole="button" accessibilityLabel={'Edit your style direction and palette: ' + (profile.styles.join(', ') || 'Open to discovery') + '; palette: ' + (palette.length ? hues.map(item => item.name).join(', ') : 'open to colors')} onPress={onPress} style={styles.root}>
    <View style={styles.heading}><Text numberOfLines={2} style={styles.direction}>{profile.styles.join(' · ') || 'A direction of your own'}</Text><FormIcon name="chevron" size={15} color={colors.muted} /></View>
    <View style={[styles.scene, { backgroundColor: background + '55' }]}>
      <View pointerEvents="none" style={[styles.light, { backgroundColor: hues[hues.length - 1].hex + '12' }]} />
      {pieces.map(product => <View key={product.id} style={[styles.photo, product.slot === 'shoes' && styles.shoes]}><ProductVisual product={product} transition={false} /></View>)}
      {!pieces.length && <Text style={styles.empty}>Your palette, ready for a new direction.</Text>}
    </View>
    <View style={styles.footer}><View style={styles.palette}>{hues.map(item => <View key={item.name} style={[styles.swatch, { backgroundColor: item.hex }]} />)}</View><Text style={styles.caption}>{palette.length ? 'Your palette' : 'Explore a palette'}</Text></View>
    <Text style={styles.reference}>Style references · tap to refine</Text>
  </MotionPressable>;
}
const styles = StyleSheet.create({
  root: { borderRadius: 4, padding: 14, backgroundColor: colors.card }, heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14, paddingHorizontal: 2, marginBottom: 13 }, direction: { fontFamily: family.sansMedium, fontSize: 12, lineHeight: 18, color: colors.ink2, flex: 1 },
  scene: { height: 144, borderRadius: 4, paddingHorizontal: 10, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 8, overflow: 'hidden' }, light: { position: 'absolute', width: 170, height: 170, borderRadius: 85, right: -35, top: -70 }, photo: { flex: 1, height: 120, borderRadius: 4, backgroundColor: colors.plate, overflow: 'hidden' }, shoes: { height: 94, alignSelf: 'flex-end' },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 15, paddingHorizontal: 2 }, palette: { flexDirection: 'row', gap: 7 }, swatch: { width: 25, height: 25, borderRadius: 13, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(28,29,25,0.12)' }, caption: { fontFamily: family.sans, fontSize: 11, lineHeight: 18, color: colors.muted }, reference: { fontFamily: family.sans, fontSize: 10, lineHeight: 16, color: colors.muted, marginTop: 10, paddingHorizontal: 2 }, empty: { fontFamily: family.serif, fontSize: 24, lineHeight: 28, color: colors.ink2, flex: 1, textAlign: 'center' },
});
