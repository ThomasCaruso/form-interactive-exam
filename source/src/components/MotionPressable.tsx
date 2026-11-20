import { useEffect, useState, type ReactNode } from 'react';
import { Animated, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Pressable, type PressableProps } from 'react-native-gesture-handler';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { pressFeedback, type TactileKind } from '../utils/haptics';
import { GlassFill, GlassRim, glassStyle } from './GlassSurface';
import { colors } from '../theme/tokens';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
type Props = Omit<PressableProps, 'style' | 'children'> & {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  haptic?: TactileKind | false;
  dimWhenDisabled?: boolean;
  glass?: boolean | 'quiet';
};
/** A small, damped press response shared by primary controls. */
export function MotionPressable({ children, style, haptic = 'soft', dimWhenDisabled = true, glass = true, onPress, onPressIn, onPressOut, disabled, ...props }: Props) {
  const [scale] = useState(() => new Animated.Value(1));
  const reduced = useReduceMotion();
  useEffect(() => () => scale.stopAnimation(), [scale]);
  const settle = (toValue: number) => {
    scale.stopAnimation();
    if (reduced || disabled) { scale.setValue(1); return; }
    Animated.spring(scale, { toValue, stiffness: 450, damping: 32, mass: 0.6, useNativeDriver: true }).start();
  };
  const flat = StyleSheet.flatten(style);
  const baseTransform = flat?.transform;
  const isTab = props.accessibilityRole === 'tab';
  const quiet = glass === 'quiet' || (isTab && !props.accessibilityState?.selected) || (!flat?.backgroundColor && !props.accessibilityState?.selected && !props.accessibilityState?.checked);
  const radius = typeof flat?.borderRadius === 'number' ? flat.borderRadius : 16;
  const tone = flat?.backgroundColor === colors.ink || flat?.backgroundColor === colors.accent ? 'dark' : 'light';
  return <AnimatedPressable {...props} disabled={disabled} style={[style, glass && glassStyle(tone, radius, quiet), { opacity: disabled && dimWhenDisabled ? 0.42 : 1, transform: [...(Array.isArray(baseTransform) ? baseTransform : []), { scale: reduced || disabled ? 1 : scale }] }]}
    onPressIn={event => { settle(0.98); onPressIn?.(event); }}
    onPressOut={event => { settle(1); onPressOut?.(event); }}
    onPress={event => { if (!disabled) pressFeedback(() => onPress?.(event), haptic); }}>
    {glass && <GlassFill tone={tone} radius={radius} strength={quiet ? 0.18 : 1} />}
    {children}
    {glass && !quiet && <GlassRim tone={tone} radius={radius} />}
  </AnimatedPressable>;
}
