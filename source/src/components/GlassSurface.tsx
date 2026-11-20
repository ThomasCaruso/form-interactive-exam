import type { PropsWithChildren } from 'react';
import { StyleSheet, View, type ViewProps, type ViewStyle } from 'react-native';
import { colors } from '../theme/tokens';

/**
 * FORM Atelier surfaces. The former glass material is retired: no gradients,
 * no shadows. Dark surfaces are flat ink; light surfaces are paper edged with
 * a hairline. The names stay so every screen picks up the system at once.
 */
export type GlassTone = 'light' | 'dark';

export function GlassFill(_: { tone?: GlassTone; radius?: number; strength?: number }) {
  return null;
}

export function GlassRim(_: { tone?: GlassTone; radius?: number; strength?: number }) {
  return null;
}

export function glassStyle(tone: GlassTone = 'light', radius = 20, quiet = false): ViewStyle {
  if (tone === 'dark') return { borderRadius: radius, backgroundColor: colors.ink, boxShadow: 'none' };
  return { borderRadius: radius, backgroundColor: 'transparent', boxShadow: 'none', ...(quiet ? null : { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line2 }) };
}

export function GlassSurface({ children, style, tone = 'light', quiet = false, backing, ...props }: PropsWithChildren<ViewProps & { tone?: GlassTone; quiet?: boolean; backing?: string }>) {
  const flat = StyleSheet.flatten(style);
  const radius = typeof flat?.borderRadius === 'number' ? flat.borderRadius : 20;
  return <View {...props} style={[style, glassStyle(tone, radius, quiet), backing ? { backgroundColor: backing } : undefined]}>{children}</View>;
}

/** Plain paper. */
export function GlassAtmosphere() {
  return <View pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[StyleSheet.absoluteFill, { backgroundColor: colors.paper }]} />;
}
