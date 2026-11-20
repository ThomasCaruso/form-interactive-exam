import { GlassSurface } from './GlassSurface';
import type { PropsWithChildren } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { colors, layout, radius, spacing } from '../theme/tokens';
import { family } from '../theme/typography';
import { FormIcon } from './FormIcon';
import { MotionPressable } from './MotionPressable';
/** Shared native modal: Android back, backdrop dismissal, bounded scroll and safe-area footer. */
export function ContextSheet({ visible, title, onClose, children }: PropsWithChildren<{ visible: boolean; title: string; onClose: () => void }>) {
  const insets = useSafeAreaInsets();
  const reduced = useReduceMotion();
  return <Modal transparent visible={visible} animationType={reduced ? 'none' : 'fade'} onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
    <GestureHandlerRootView style={styles.root}>
      <Pressable accessibilityRole="button" accessibilityLabel="Dismiss sheet" onPress={onClose} style={StyleSheet.absoluteFill} />
      <GlassSurface backing={colors.card} accessibilityViewIsModal style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.lg), maxHeight: '85%' }]}>
        <View style={styles.handle} />
        <View style={styles.header}><Text accessibilityRole="header" style={styles.title}>{title}</Text><MotionPressable accessibilityRole="button" accessibilityLabel="Close sheet" onPress={onClose} style={styles.close}><FormIcon name="close" size={20} /></MotionPressable></View>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>{children}</ScrollView>
      </GlassSurface>
    </GestureHandlerRootView>
  </Modal>;
}
const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.scrim },
  sheet: { backgroundColor: colors.card, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, paddingHorizontal: layout.gutter },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.line2, alignSelf: 'center', marginTop: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.sm },
  title: { fontFamily: family.sansMedium, fontSize: 28, lineHeight: 34, color: colors.ink, flex: 1 },
  close: { width: layout.touch, height: layout.touch, alignItems: 'center', justifyContent: 'center' },
  content: { paddingTop: spacing.md, paddingBottom: spacing.xl, gap: spacing.lg },
});
