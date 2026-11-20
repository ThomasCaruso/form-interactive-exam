import { photoAsset } from '../utils/photoAsset';
import { GlassSurface } from './GlassSurface';
import { inspectionBounds } from '../utils/imageInspection';
import { useEffect, useState } from 'react';
import { BackHandler, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { GestureDetector, GestureHandlerRootView, usePanGesture, usePinchGesture, useSimultaneousGestures } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Product } from '../domain/types';
import { productPhotography } from '../data/photography';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { colors } from '../theme/tokens';
import { family } from '../theme/typography';
import { MotionPressable } from './MotionPressable';
import { ProductVisual } from './ProductVisual';
import { StudioBackdrop } from './StudioBackdrop';

function clamp(value: number, limit: number) { 'worklet'; return Math.max(-limit, Math.min(limit, value)); }
/** Inspection is isolated from the discovery/paging gestures. No generated product angles. */
export function ImageInspector({ product, visible, onClose }: { product: Product; visible: boolean; onClose: () => void }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduced = useReduceMotion();
  useEffect(() => { const back = BackHandler.addEventListener("hardwareBackPress", () => { onClose(); return true; }); return () => back.remove(); }, [onClose]);
  const [original, setOriginal] = useState(false);
  const [frame, setFrame] = useState({ width: width - 32, height: height * .6 });
  const plate = productPhotography[product.id];
  const source = original ? plate?.original ?? plate?.source : plate?.source;
  const dimensions = source ? photoAsset(source) : null;
  const aspect = dimensions?.width && dimensions?.height ? dimensions.width / dimensions.height : product.aspect ?? 280 / 300;
  const scale = useSharedValue(1), startScale = useSharedValue(1);
  const x = useSharedValue(0), y = useSharedValue(0), startX = useSharedValue(0), startY = useSharedValue(0);
  const reset = () => { scale.set(withTiming(1, { duration: reduced ? 0 : 180 })); x.set(withTiming(0, { duration: reduced ? 0 : 180 })); y.set(withTiming(0, { duration: reduced ? 0 : 180 })); };
  const pinch = usePinchGesture({ enabled: visible,
    onActivate: () => { 'worklet'; startScale.set(scale.get()); },
    onUpdate: event => { 'worklet'; const next = Math.max(1, Math.min(3, startScale.get() * event.scale)); scale.set(next); x.set(clamp(x.get(), inspectionBounds(frame.width, frame.height, aspect, next).x)); y.set(clamp(y.get(), inspectionBounds(frame.width, frame.height, aspect, next).y)); },
  });
  const pan = usePanGesture({ enabled: visible, maxPointers: 1,
    onActivate: () => { 'worklet'; startX.set(x.get()); startY.set(y.get()); },
    onUpdate: event => { 'worklet'; x.set(clamp(startX.get() + event.translationX, inspectionBounds(frame.width, frame.height, aspect, scale.get()).x)); y.set(clamp(startY.get() + event.translationY, inspectionBounds(frame.width, frame.height, aspect, scale.get()).y)); },
  });
  const gesture = useSimultaneousGestures(pinch, pan);
  const pose = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }, { translateY: y.get() }, { scale: scale.get() }] }));
  const zoom = (direction: number) => { const next = Math.max(1, Math.min(3, scale.get() + direction * .5)); scale.set(withTiming(next, { duration: reduced ? 0 : 180 })); x.set(0); y.set(0); };
  return <GestureHandlerRootView style={[styles.root, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 12 }]}>
      <View style={styles.header}><View style={{ flex: 1 }}><Text style={styles.brand}>{product.brand.toUpperCase()}</Text><Text style={styles.title}>{product.name}</Text></View><MotionPressable accessibilityRole="button" accessibilityLabel="Close image inspector" onPress={onClose} style={styles.button}><Text style={styles.label}>Close</Text></MotionPressable></View>
      <GlassSurface onLayout={event => setFrame(event.nativeEvent.layout)} style={styles.stage}><StudioBackdrop /><GestureDetector gesture={gesture}><Animated.View style={[StyleSheet.absoluteFill, pose]}><ProductVisual product={product} original={original} /></Animated.View></GestureDetector></GlassSurface>
      <Text style={styles.hint}>Pinch to zoom · drag to explore</Text>
      <View style={styles.controls}><MotionPressable accessibilityRole="button" accessibilityLabel="Zoom out" onPress={() => zoom(-1)} style={styles.button}><Text style={styles.label}>−</Text></MotionPressable><MotionPressable accessibilityRole="button" accessibilityLabel="Reset image zoom" onPress={reset} style={[styles.button, { flex: 1 }]}><Text style={styles.label}>Reset view</Text></MotionPressable><MotionPressable accessibilityRole="button" accessibilityLabel="Zoom in" onPress={() => zoom(1)} style={styles.button}><Text style={styles.label}>+</Text></MotionPressable></View>
      {productPhotography[product.id]?.isolated && <MotionPressable accessibilityRole="button" accessibilityLabel={original ? 'Show isolated garment' : 'Show original photograph'} onPress={() => { setOriginal(!original); reset(); }} style={styles.source}><Text style={styles.label}>{original ? 'View studio image' : 'View original photograph'}</Text></MotionPressable>}
      <Text style={styles.note}>{product.retailer ? "Retailer photograph - exact product color" : plate?.illustrative && !original ? "Illustrative studio image - demo item" : "Catalog fixture photograph - zoom reveals existing detail"}</Text>
    </GestureHandlerRootView>;
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper, paddingHorizontal: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  brand: { fontFamily: family.sans, fontSize: 10, letterSpacing: 1.8, color: colors.muted },
  title: { fontFamily: family.sansMedium, fontSize: 22, lineHeight: 28, color: colors.ink },
  stage: { flex: 1, backgroundColor: colors.paper2, borderRadius: 4, overflow: 'hidden' },
  button: { minWidth: 52, minHeight: 52, paddingHorizontal: 16, backgroundColor: colors.card, borderRadius: 26, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line },
  controls: { flexDirection: 'row', gap: 12 },
  label: { fontFamily: family.sansMedium, fontSize: 14, color: colors.ink },
  hint: { fontFamily: family.sans, fontSize: 12, color: colors.muted, textAlign: 'center', marginVertical: 16 },
  source: { minHeight: 52, alignItems: 'center', justifyContent: 'center' },
  note: { fontFamily: family.sans, fontSize: 11, color: colors.muted, textAlign: 'center', marginTop: 8 },
});
