import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Animated, StyleSheet, Text, View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { pressFeedback } from '../utils/haptics';
import { colors, layout, radius } from '../theme/tokens';
import { family } from '../theme/typography';
import { FormIcon } from './FormIcon';
/** The Atelier primary action: a flat ink pill. `light` is the hairline-outline secondary. */
export function RaisedButton({ label, onPress, disabled = false, light = false, icon, busy = false, showArrow = true }: { label: string; onPress: () => void; disabled?: boolean; light?: boolean; icon?: ReactNode; busy?: boolean; showArrow?: boolean }) {
  const [opacity] = useState(() => new Animated.Value(1));
  const reduced = useReduceMotion();
  useEffect(() => () => opacity.stopAnimation(), [opacity]);
  const settle = (pressed: boolean) => { opacity.stopAnimation(); Animated.timing(opacity, { toValue: pressed ? 0.78 : 1, duration: reduced ? 0 : pressed ? 60 : 140, useNativeDriver: true }).start(); };
  const ink = light ? colors.ink : colors.paper;
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: disabled || busy, busy }} disabled={disabled || busy} onPressIn={() => settle(true)} onPressOut={() => settle(false)} onPress={() => pressFeedback(onPress)} style={{ opacity: disabled ? 0.4 : 1 }}>
    <Animated.View style={[styles.pill, light ? styles.outline : styles.solid, { opacity }]}>
      <View style={styles.labelGroup}>{icon}<Text style={[styles.label, { color: ink }]}>{label}</Text>{busy ? <ActivityIndicator color={ink} /> : showArrow && <FormIcon name="arrow" size={16} color={ink} />}</View>
    </Animated.View>
  </Pressable>;
}
const styles = StyleSheet.create({
  pill: { height: layout.button, borderRadius: radius.pill, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center' },
  solid: { backgroundColor: colors.ink },
  outline: { borderWidth: 1, borderColor: colors.line2 },
  labelGroup: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
  label: { fontFamily: family.sansMedium, fontSize: 15, letterSpacing: 0.3, flexShrink: 1 },
});
