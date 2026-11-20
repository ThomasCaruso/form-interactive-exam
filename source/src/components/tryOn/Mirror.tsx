import { useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { LocalPhoto } from '../LocalPhoto';
import { MotionPressable } from '../MotionPressable';
import { sceneLabel, type TryOnScene } from '../../domain/tryOnScene';
import type { PersonReference } from '../../domain/types';
import { useReduceMotion } from '../../hooks/useReduceMotion';
import { colors } from '../../theme/tokens';
import { family } from '../../theme/typography';

/** One picture: you, you being dressed, or you dressed. Hold a result to see the original. */
export function Mirror({ body, resultUri, resultLabel, active, message, problem, onRetry, scene, onScene }: {
  body: PersonReference; resultUri?: string; resultLabel: string; active: boolean; message?: string;
  problem?: string; onRetry: () => void; scene: TryOnScene; onScene: () => void;
}) {
  const reduced = useReduceMotion(), [holding, setHolding] = useState(false);
  const showResult = !!resultUri && !holding;
  return <View style={styles.mirror}>
    <Pressable disabled={!resultUri} onPressIn={() => setHolding(true)} onPressOut={() => setHolding(false)} accessibilityRole={resultUri ? 'imagebutton' : 'image'} accessibilityHint={resultUri ? 'Hold to compare with your original photo' : undefined} style={StyleSheet.absoluteFill}>
      <View style={[StyleSheet.absoluteFill, active && { opacity: 0.55 }]}><LocalPhoto uri={body.localUri} label="Your full-body photo" /></View>
      {showResult && <Animated.View key={resultUri} entering={reduced ? undefined : FadeIn.duration(520)} style={[StyleSheet.absoluteFill, styles.result]}>
        <Image source={{ uri: resultUri }} resizeMode="contain" style={StyleSheet.absoluteFill} accessibilityLabel={resultLabel} />
      </Animated.View>}
    </Pressable>
    <MotionPressable glass={false} disabled={active} accessibilityRole="button" accessibilityLabel={'Scene: ' + sceneLabel(scene) + '. Tap to change.'} onPress={onScene} style={styles.chip}>
      <Text style={styles.chipText}>{sceneLabel(scene)}</Text>
    </MotionPressable>
    {!!resultUri && !holding && <Text pointerEvents="none" style={styles.hint}>Hold to compare</Text>}
    {active && <View pointerEvents="none" style={styles.status}><ActivityIndicator size="small" color={colors.paper} /><Text numberOfLines={1} accessibilityLiveRegion="polite" style={styles.statusText}>{message ?? 'Preparing your photos'}</Text></View>}
    {!active && !!problem && <View style={styles.status}><Text numberOfLines={2} accessibilityRole="alert" style={[styles.statusText, { flex: 1 }]}>{problem}</Text>
      <MotionPressable glass={false} accessibilityRole="button" onPress={onRetry} style={styles.retry}><Text style={styles.retryText}>Retry</Text></MotionPressable></View>}
  </View>;
}
const styles = StyleSheet.create({
  mirror: { flex: 1, borderRadius: 22, overflow: 'hidden', backgroundColor: colors.plate },
  result: { backgroundColor: colors.plate },
  chip: { position: 'absolute', left: 12, top: 12, minHeight: 32, paddingHorizontal: 12, borderRadius: 16, justifyContent: 'center', backgroundColor: 'rgba(243,240,234,0.88)' },
  chipText: { fontFamily: family.sansMedium, fontSize: 11, color: colors.ink2 },
  hint: { position: 'absolute', right: 14, bottom: 12, fontFamily: family.sans, fontSize: 10, color: colors.muted },
  status: { position: 'absolute', left: 10, right: 10, bottom: 10, minHeight: 40, borderRadius: 20, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.scrim },
  statusText: { fontFamily: family.sans, fontSize: 12, color: colors.paper },
  retry: { minHeight: 32, paddingHorizontal: 10, justifyContent: 'center' },
  retryText: { fontFamily: family.sansMedium, fontSize: 12, color: colors.paper, textDecorationLine: 'underline' },
});
