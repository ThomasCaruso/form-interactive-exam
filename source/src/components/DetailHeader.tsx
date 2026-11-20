import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { MotionPressable } from './MotionPressable';
import { editorial } from './Editorial';
import { FormIcon } from './FormIcon';
import { colors } from '../theme/tokens';
export function DetailHeader({ title }: { title: string }) {
  const router = useRouter();
  return <View style={styles.header}><MotionPressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.canGoBack() ? router.back() : router.replace('/edits')} style={styles.back}><FormIcon name="back" /></MotionPressable><Text style={editorial.label}>{title}</Text><View style={{ width: 48, height: 48 }} /></View>;
}
const styles = StyleSheet.create({ header: { ...editorial.row, paddingBottom: 14 }, back: { width: 48, height: 48, justifyContent: 'center', alignItems: 'center', borderRadius: 24, backgroundColor: colors.paper2 } });
export function TextAction({ label, onPress, dark = false, disabled = false, haptic }: { haptic?: false; label: string; onPress: () => void; dark?: boolean; disabled?: boolean }) {
  return <MotionPressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} haptic={haptic} onPress={onPress} style={{ minHeight: 54, paddingHorizontal: 20, borderRadius: 26, justifyContent: 'center', alignItems: 'center', backgroundColor: dark ? colors.ink : colors.paper2 }}><Text style={[editorial.body, { fontFamily: 'DMSans_500Medium' }, dark && { color: colors.paper }]}>{label}</Text></MotionPressable>;
}
