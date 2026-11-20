import { useEffect } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { PlateImage } from './PlateImage';
import Animated, { Easing, cancelAnimation, interpolate, useAnimatedStyle, useSharedValue, withRepeat, withTiming, type SharedValue } from 'react-native-reanimated';
import { coverScenes } from '../data/editorial';
import { retailerPhotography } from '../data/retailerPhotography';
import { colors } from '../theme/tokens';
import { family } from '../theme/typography';

const LOOP = 14000;
const swing = Easing.bezierFn(0.6, 0, 0.2, 1);
/** Wipe progress inside [from, to] of the loop, eased like the canvas. */
function wipe(t: number, from: number, to: number) {
  'worklet';
  if (t <= from) return 0;
  if (t >= to) return 1;
  return swing((t - from) / (to - from));
}
const W = { start: 0.14, end: 0.24, reset: 0.53 }, M = { start: 0.64, end: 0.74 };

/** One clock shared by the photographs and the progress segments. */
export function useCoverLoop(reduced: boolean) {
  const t = useSharedValue(reduced ? 0.3 : 0);
  useEffect(() => {
    if (reduced) { cancelAnimation(t); t.value = 0.3; return; }
    t.value = 0;
    t.value = withRepeat(withTiming(1, { duration: LOOP, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(t);
  }, [reduced, t]);
  return t;
}

/** The cover: chosen pieces wipe into the same look as worn. Womenswear, then menswear. No copy over faces. */
export function CoverLoop({ t, width, height }: { t: SharedValue<number>; width: number; height: number }) {
  const sx = width / 390, sy = height / 604;
  const womens = useAnimatedStyle(() => ({ opacity: interpolate(t.value, [0, 0.46, 0.5, 0.96, 1], [1, 1, 0, 0, 1]) }));
  const mens = useAnimatedStyle(() => ({ opacity: interpolate(t.value, [0, 0.46, 0.5, 0.96, 1], [0, 0, 1, 1, 0]) }));
  const wipeW = (v: number) => { 'worklet'; return v >= W.reset ? 0 : wipe(v, W.start, W.end); };
  const wipeM = (v: number) => { 'worklet'; return wipe(v, M.start, M.end); };
  const dress = retailerPhotography[coverScenes.womens.pieces]?.source, shoe = retailerPhotography[coverScenes.womens.shoe]?.source;
  return <View accessible accessibilityRole="image" accessibilityLabel="Pieces chosen for you. Womenswear, then menswear shown worn." style={{ width, height, overflow: 'hidden', backgroundColor: colors.plate }}>
    <Animated.View style={[StyleSheet.absoluteFill, womens]}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.plate }]}>
        {dress && <PlateImage source={dress} style={{ position: 'absolute', left: 30 * sx, top: 90 * sy, width: 330 * sx, height: 420 * sy }} />}
        {shoe && <PlateImage source={shoe} softEdge style={{ position: 'absolute', left: 236 * sx, top: 430 * sy, width: 140 * sx, height: 140 * sx }} />}
      </View>
      {coverScenes.womens.worn && <Reveal t={t} progress={wipeW} width={width} height={height} tagTop={286 * sy}>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.paper }]}><PlateImage source={coverScenes.womens.worn} ground={colors.paper} resizeMode="cover" style={{ width, height }} /></View>
      </Reveal>}
    </Animated.View>
    <Animated.View style={[StyleSheet.absoluteFill, mens]}>
      <Image source={coverScenes.mens.flatLay} resizeMode="cover" style={{ width, height }} />
      <Reveal t={t} progress={wipeM} width={width} height={height} tagTop={286 * sy}>
        <Image source={coverScenes.mens.worn} resizeMode="cover" style={{ width, height }} />
      </Reveal>
    </Animated.View>
  </View>;
}

function Reveal({ t, progress, width, height, tagTop, children }: { t: SharedValue<number>; progress: (v: number) => number; width: number; height: number; tagTop: number; children: React.ReactNode }) {
  const clip = useAnimatedStyle(() => ({ width: width * progress(t.value) }));
  const drift = useAnimatedStyle(() => ({ transform: [{ scale: interpolate(progress(t.value), [0, 1], [1.04, 1]) }] }));
  const line = useAnimatedStyle(() => { const p = progress(t.value); return { opacity: interpolate(p, [0, 0.02, 0.85, 0.97], [0, 1, 1, 0], 'clamp'), transform: [{ translateX: width * p }] }; });
  return <>
    <Animated.View style={[styles.clip, { height }, clip]}><Animated.View style={[{ width, height }, drift]}>{children}</Animated.View></Animated.View>
    <Animated.View pointerEvents="none" style={[styles.line, line]}><Text style={[styles.tag, { top: tagTop }]}>TRY ON</Text></Animated.View>
  </>;
}

/** Two unlabeled segments: womenswear, then menswear. */
export function CoverProgress({ t, reduced }: { t: SharedValue<number>; reduced: boolean }) {
  const a = useAnimatedStyle(() => ({ transform: [{ scaleX: reduced ? 1 : interpolate(t.value, [0, 0.5, 0.98, 1], [0, 1, 1, 0]) }] }));
  const b = useAnimatedStyle(() => ({ transform: [{ scaleX: reduced ? 0 : interpolate(t.value, [0, 0.5, 0.98, 1], [0, 0, 1, 1]) }] }));
  return <View accessible={false} importantForAccessibility="no-hide-descendants" style={styles.segments}>
    {[a, b].map((style, i) => <View key={i} style={styles.segment}><Animated.View style={[styles.fill, { transformOrigin: 'left' }, style]} /></View>)}
  </View>;
}

const styles = StyleSheet.create({
  clip: { position: 'absolute', left: 0, top: 0, overflow: 'hidden' },
  line: { position: 'absolute', top: 0, bottom: 0, left: -1, width: 1, backgroundColor: colors.paper },
  tag: { position: 'absolute', left: 8, backgroundColor: colors.paper, color: colors.ink, fontFamily: family.sansMedium, fontSize: 10, letterSpacing: 1.8, paddingVertical: 7, paddingHorizontal: 10, width: 74 },
  segments: { flexDirection: 'row', gap: 6 },
  segment: { flex: 1, height: 2, backgroundColor: colors.line, overflow: 'hidden' },
  fill: { flex: 1, backgroundColor: colors.ink },
});
