import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { FormIcon } from '../FormIcon';
import { MotionPressable } from '../MotionPressable';
import { colors, layout } from '../../theme/tokens';
import { eyebrow, family } from '../../theme/typography';

/** Back, quiet progress segments, and an optional skip. */
export function StepHeader({ step, total = 4, onBack, onSkip }: { step: number; total?: number; onBack: () => void; onSkip?: () => void }) {
  return <View style={styles.header}>
    <MotionPressable glass={false} accessibilityRole="button" accessibilityLabel="Back" onPress={onBack} style={styles.back}><FormIcon name="back" size={20} /></MotionPressable>
    <View accessible accessibilityRole="progressbar" accessibilityLabel={'Step ' + step + ' of ' + total} accessibilityValue={{ min: 1, max: total, now: step }} style={styles.segments}>
      {Array.from({ length: total }, (_, i) => i + 1).map(i => <View key={i} style={[styles.segment, i <= step && styles.on]} />)}
    </View>
    {onSkip ? <MotionPressable glass={false} accessibilityRole="button" onPress={onSkip} style={styles.skip}><Text style={styles.skipText}>Skip</Text></MotionPressable> : <View style={styles.skip} />}
  </View>;
}

/** Eyebrow, then a serif headline whose second half is italic. */
export function Headline({ kicker, title, italic, aside, light = false }: { kicker: string; title: string; italic?: string; aside?: ReactNode; light?: boolean }) {
  return <View>
    <View style={styles.kickerRow}><Text style={[eyebrow, light && { color: '#9C978C' }]}>{kicker.toUpperCase()}</Text>{aside}</View>
    <Text accessibilityRole="header" style={[styles.title, light && { color: colors.paper }]}>{title}{italic ? <Text style={styles.italic}>{(title.endsWith('\n') ? '' : ' ') + italic}</Text> : null}</Text>
  </View>;
}

const styles = StyleSheet.create({
  header: { height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginLeft: -10 },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  segments: { flexDirection: 'row', gap: 4 },
  segment: { width: 28, height: 2, backgroundColor: colors.line },
  on: { backgroundColor: colors.ink },
  skip: { width: 44, height: 44, alignItems: 'flex-end', justifyContent: 'center' },
  skipText: { fontFamily: family.sans, fontSize: 13, color: colors.muted },
  kickerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  title: { fontFamily: family.serif, fontSize: 38, lineHeight: 41, letterSpacing: -0.4, color: colors.ink, marginTop: 8 },
  italic: { fontFamily: family.serifItalic },
});
export const gutter = layout.gutter;
