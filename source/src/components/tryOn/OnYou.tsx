import { StyleSheet, Text, View } from 'react-native';
import { ContextSheet } from '../ContextSheet';
import { MotionPressable } from '../MotionPressable';
import { Mirror } from './Mirror';
import type { TryOnScene } from '../../domain/tryOnScene';
import type { PersonReference } from '../../domain/types';
import { colors } from '../../theme/tokens';
import { family } from '../../theme/typography';

/** The AI preview, on request: you wearing the outfit on the stage. */
export function OnYou({ visible, onClose, body, ...mirror }: {
  visible: boolean; onClose: () => void; body: PersonReference; resultUri?: string; resultLabel: string; active: boolean; message?: string;
  problem?: string; onRetry: () => void; scene: TryOnScene; onScene: () => void; onPhotos: () => void;
}) {
  return <ContextSheet visible={visible} title="On you" onClose={onClose}>
    <View style={styles.frame}><Mirror body={body} {...mirror} /></View>
    <MotionPressable glass={false} accessibilityRole="button" onPress={mirror.onPhotos} style={styles.link}><Text style={styles.linkText}>Your photos</Text></MotionPressable>
  </ContextSheet>;
}
const styles = StyleSheet.create({
  frame: { height: 460 },
  link: { alignSelf: 'center', minHeight: 40, justifyContent: 'center', paddingHorizontal: 12, marginTop: 6 },
  linkText: { fontFamily: family.sans, fontSize: 12, color: colors.muted, textDecorationLine: 'underline' },
});
