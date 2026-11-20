import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { FormIcon } from '../FormIcon';
import { MotionPressable } from '../MotionPressable';
import { colors } from '../../theme/tokens';
import { family } from '../../theme/typography';

export type TileAction = { name: string; label: string; run: () => void };
type Props = {
  width: number; image: ReactNode; brand: string; name: string; detail: string;
  /** What TalkBack reads for the whole tile. */
  label: string;
  onPress: () => void; onLongPress: () => void;
  /** Extra TalkBack actions, matching the long-press menu. */
  actions: TileAction[];
  /** Shows the heart; tapping it removes the item. */
  onRemove?: () => void;
};

/** A grid tile: a 4:5 photo on the plate, then brand, name and price (or detail). */
export function PieceTile({ width, image, brand, name, detail, label, onPress, onLongPress, actions, onRemove }: Props) {
  return <View style={{ width }}>
    <View accessible accessibilityRole="button" accessibilityLabel={label} accessibilityHint="Long press for more options"
      accessibilityActions={[{ name: 'activate' }, ...actions.map(({ name: n, label: l }) => ({ name: n, label: l }))]}
      onAccessibilityAction={event => { const n = event.nativeEvent.actionName; if (n === 'activate') onPress(); else actions.find(a => a.name === n)?.run(); }}>
      <MotionPressable glass="quiet" importantForAccessibility="no-hide-descendants" onPress={onPress} onLongPress={onLongPress} delayLongPress={350} style={[styles.photo, { height: Math.round(width * 1.25) }]}>{image}</MotionPressable>
      <Text numberOfLines={1} style={styles.brand}>{brand.toUpperCase()}</Text>
      <Text numberOfLines={2} style={styles.name}>{name}</Text>
      <Text numberOfLines={1} style={styles.detail}>{detail}</Text>
    </View>
    {onRemove && <MotionPressable glass={false} haptic="passed" accessibilityRole="button" accessibilityLabel={'Remove ' + name + ' from saved'} onPress={onRemove} style={styles.heart}>
      <View style={styles.disc}><FormIcon name="heart" size={14} filled /></View>
    </MotionPressable>}
  </View>;
}
const styles = StyleSheet.create({
  photo: { borderRadius: 2, overflow: 'hidden', backgroundColor: colors.plate },
  brand: { fontFamily: family.sansMedium, fontSize: 9, lineHeight: 14, letterSpacing: 1.3, color: colors.muted, marginTop: 9 },
  name: { fontFamily: family.sans, fontSize: 13, lineHeight: 18, color: colors.ink, marginTop: 2 },
  detail: { fontFamily: family.sansMedium, fontSize: 13, lineHeight: 18, color: colors.ink2, marginTop: 3 },
  heart: { position: 'absolute', top: 0, right: 0, width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  disc: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(243,240,234,0.88)', alignItems: 'center', justifyContent: 'center' },
});
