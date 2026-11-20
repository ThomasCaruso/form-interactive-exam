import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PlateImage } from '../PlateImage';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { retailerPhotography } from '../../data/retailerPhotography';
import { swipeDecision } from '../../domain/discoveryGesture';
import type { Product } from '../../domain/types';
import { colors } from '../../theme/tokens';
import { family } from '../../theme/typography';

/** The photograph a taste card leads with: the piece itself on the plate. */
export function TastePhoto({ product }: { product: Product }) {
  const flat = retailerPhotography[product.id]?.source ?? (product.imageUri ? { uri: product.imageUri } : undefined);
  return <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.plate, padding: 28 }]}>{flat && <PlateImage source={flat} style={styles.fill} />}</View>;
}

/** One rateable piece. Drag right for yes, left for no; buttons do the same. */
export function TasteCard({ product, index, total, decision, onDecide }: { product: Product; index: number; total: number; decision: 'yes' | 'no' | null; onDecide: (yes: boolean) => void }) {
  const x = useSharedValue(0);
  useEffect(() => { x.set(0); }, [product.id, x]);
  // A button press animates the same exit as a swipe.
  useEffect(() => { if (decision) x.set(withTiming(decision === 'yes' ? 520 : -520, { duration: 260 })); }, [decision, x]);
  const pan = usePanGesture({
    activeOffsetX: [-8, 8], failOffsetY: [-28, 28], maxPointers: 1,
    onUpdate: event => { 'worklet'; x.set(event.translationX); },
    onDeactivate: event => {
      'worklet';
      const status = event.canceled ? null : swipeDecision(event.translationX, event.translationY, 340);
      if (status) { x.set(withTiming(status === 'saved' ? 520 : -520, { duration: 220 })); scheduleOnRN(onDecide, status === 'saved'); }
      else x.set(withSpring(0, { damping: 22, stiffness: 260 }));
    },
  });
  const motion = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }, { rotate: interpolate(x.get(), [-300, 300], [-6, 6]) + 'deg' }] }));
  const yes = useAnimatedStyle(() => ({ opacity: interpolate(x.get(), [20, 100], [0, 1], 'clamp') }));
  const no = useAnimatedStyle(() => ({ opacity: interpolate(x.get(), [-100, -20], [1, 0], 'clamp') }));
  const style = product.styleTags?.[0] ?? 'Everyday';
  return <GestureDetector gesture={pan}>
    <Animated.View accessible accessibilityLabel={'Piece ' + (index + 1) + ' of ' + total + ': ' + product.name + ', ' + product.color} accessibilityActions={[{ name: 'activate', label: 'I would wear it' }, { name: 'longpress', label: 'Not for me' }]} onAccessibilityAction={e => onDecide(e.nativeEvent.actionName === 'activate')} style={[styles.card, motion]}>
      <View style={styles.photo}><TastePhoto product={product} /></View>
      <Animated.Text style={[styles.stamp, styles.stampYes, yes]}>YES</Animated.Text>
      <Animated.Text style={[styles.stamp, styles.stampNo, no]}>NOT FOR ME</Animated.Text>
      <View style={styles.caption}>
        <View style={{ flexShrink: 1 }}><Text style={styles.style}>{style}</Text><Text numberOfLines={1} style={styles.name}>{product.name} · {product.color}</Text></View>
        <View style={[styles.swatch, { backgroundColor: product.hex }]} />
      </View>
    </Animated.View>
  </GestureDetector>;
}

/** The two cards beneath, so the deck reads as a stack. */
export function DeckBacking() {
  return <>
    <View pointerEvents="none" style={[styles.card, styles.under, { top: 16, left: 16, right: 16, backgroundColor: '#EFEBE4' }]} />
    <View pointerEvents="none" style={[styles.card, styles.under, { top: 8, left: 8, right: 8, backgroundColor: '#F1EDE7' }]} />
  </>;
}

const styles = StyleSheet.create({
  fill: { width: '100%', height: '100%' },
  card: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderRadius: 2, overflow: 'hidden' },
  under: { bottom: -16 },
  photo: { flex: 1, overflow: 'hidden' },
  caption: { height: 70, paddingHorizontal: 16, borderTopWidth: 1, borderTopColor: colors.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, backgroundColor: colors.paper },
  style: { fontFamily: family.serif, fontSize: 22, lineHeight: 24, color: colors.ink },
  name: { fontFamily: family.sans, fontSize: 12.5, lineHeight: 17, color: colors.muted, marginTop: 2 },
  swatch: { width: 14, height: 14, borderRadius: 7, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(22,21,18,0.18)' },
  stamp: { position: 'absolute', top: 18, fontFamily: family.sansMedium, fontSize: 11, letterSpacing: 2, paddingHorizontal: 10, paddingVertical: 6, overflow: 'hidden' },
  stampYes: { left: 16, backgroundColor: colors.ink, color: colors.paper },
  stampNo: { right: 16, backgroundColor: colors.paper, color: colors.ink, borderWidth: 1, borderColor: colors.line2 },
});
