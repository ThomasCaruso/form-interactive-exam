import { useScreenSize } from '../web/desktop';
import { useCallback, type PropsWithChildren, type ReactNode } from 'react';
import { useFocusEffect } from 'expo-router';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { setStatusBarStyle } from 'expo-status-bar';
import { colors, layout, spacing } from '../theme/tokens';
import { family } from '../theme/typography';
import { MotionPressable } from './MotionPressable';
import { GlassAtmosphere } from './GlassSurface';
import { FormIcon, type FormIconName } from './FormIcon';

export function EditorialScreen({ children, footer }: PropsWithChildren<{ footer?: ReactNode }>) {
  useFocusEffect(useCallback(() => { setStatusBarStyle('dark'); }, []));
  const insets = useSafeAreaInsets();
  const { height } = useScreenSize();
  return <View style={[editorial.root, { paddingTop: insets.top }]}><GlassAtmosphere /><ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false} contentContainerStyle={[editorial.content, { paddingTop: spacing.lg, paddingBottom: insets.bottom + spacing.section, minHeight: footer ? undefined : height - 64 - insets.bottom }]}>{children}</ScrollView>{footer}</View>;
}
export function CircleAction({ icon, label, onPress, selected = false, small = false }: { icon: FormIconName; label: string; onPress: () => void; selected?: boolean; small?: boolean }) {
  return <MotionPressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected }} onPress={onPress} hitSlop={small ? 4 : 0} style={[editorial.circle, small && editorial.smallCircle, selected && { backgroundColor: colors.paper2 }]}><FormIcon name={icon} size={small ? 20 : 28} filled={selected} /></MotionPressable>;
}
export function SectionLabel({ children, footer }: PropsWithChildren<{ footer?: ReactNode }>) { return <Text style={editorial.label}>{children}</Text>; }
export const editorial = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  content: { paddingHorizontal: layout.gutter, paddingBottom: spacing.section, flexGrow: 1 },
  heading: { fontFamily: family.serif, fontSize: 36, lineHeight: 41, color: colors.ink, letterSpacing: -0.6 },
  title: { fontFamily: family.serif, fontSize: 29, lineHeight: 34, color: colors.ink },
  label: { fontFamily: family.sans, fontSize: 11, lineHeight: 18, letterSpacing: 1.8, color: colors.muted, textTransform: 'uppercase' },
  body: { fontFamily: family.sans, fontSize: 15, lineHeight: 23, color: colors.ink },
  secondary: { fontFamily: family.sans, fontSize: 13, lineHeight: 20, color: colors.muted },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  circle: { width: 60, height: 60, borderRadius: 30, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line2, alignItems: 'center', justifyContent: 'center' },
  smallCircle: { width: 48, height: 48, borderRadius: 24 },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: colors.line, marginVertical: 24 },
});
