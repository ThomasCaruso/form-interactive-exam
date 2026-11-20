import { StyleSheet, Text } from 'react-native';
import { MotionPressable } from '../MotionPressable';
import { colors } from '../../theme/tokens';
import { family } from '../../theme/typography';

/** A small underlined text action: the Saved page's secondary control, in place of extra buttons. */
export function QuietLink({ label, onPress, accessibilityLabel }: { label: string; onPress: () => void; accessibilityLabel?: string }) {
  return <MotionPressable glass={false} accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label} onPress={onPress} style={styles.link}>
    <Text style={styles.text}>{label}</Text>
  </MotionPressable>;
}
const styles = StyleSheet.create({
  link: { minHeight: 44, justifyContent: 'center' },
  text: { fontFamily: family.sansMedium, fontSize: 12, lineHeight: 18, color: colors.ink, textDecorationLine: 'underline' },
});
