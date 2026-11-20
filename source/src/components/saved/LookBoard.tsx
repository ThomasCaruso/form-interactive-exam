import { StyleSheet, Text, View } from 'react-native';
import { CollageBoard } from '../CollageBoard';
import { FormIcon } from '../FormIcon';
import { MotionPressable } from '../MotionPressable';
import { QuietLink } from './QuietLink';
import { shoppingSummary } from '../../domain/savedShopping';
import { formatMoney } from '../../domain/selectors';
import type { SavedLook } from '../../domain/types';
import { colors } from '../../theme/tokens';
import { family } from '../../theme/typography';

type Props = { entry: SavedLook; onOpen: () => void; onManage: () => void; onRemove: () => void; onShop: () => void };

/** A saved look at full width: the styling board, its title and count, and a quiet Shop link. */
export function LookBoard({ entry, onOpen, onManage, onRemove, onShop }: Props) {
  const info = shoppingSummary(entry.look), count = entry.look.products.length;
  const meta = count + (count === 1 ? ' piece' : ' pieces') + (info.ownedCount ? ' · ' + info.ownedCount + ' your own' : '') + (info.products.length ? ' · ' + formatMoney(info.totalCents) + ' online' : '');
  const actions = [{ name: 'activate' }, ...(info.products.length ? [{ name: 'shop', label: 'Shop this look' }] : []), { name: 'remove', label: 'Remove from saved' }, { name: 'more', label: 'More options' }];
  return <View>
    <View accessible accessibilityRole="button" accessibilityLabel={entry.look.title + ', ' + meta} accessibilityHint="Opens the edit" accessibilityActions={actions}
      onAccessibilityAction={event => { const n = event.nativeEvent.actionName; if (n === 'activate') onOpen(); else if (n === 'shop') onShop(); else if (n === 'remove') onRemove(); else if (n === 'more') onManage(); }}>
      <MotionPressable glass="quiet" importantForAccessibility="no-hide-descendants" onPress={onOpen} onLongPress={onManage} delayLongPress={350} style={styles.board}><CollageBoard look={entry.look} interactive={false} fill /></MotionPressable>
      <Text numberOfLines={1} style={styles.occasion}>{entry.occasion.toUpperCase()}</Text>
      <Text numberOfLines={2} style={styles.title}>{entry.look.title}</Text>
      <Text style={styles.meta}>{meta}</Text>
    </View>
    {info.products.length ? <View style={styles.link}><QuietLink label="Shop look ↗" accessibilityLabel={'Shop ' + entry.look.title} onPress={onShop} /></View> : <Text style={styles.note}>Styling board · no verified retailer pieces</Text>}
    <MotionPressable glass={false} haptic="passed" accessibilityRole="button" accessibilityLabel={'Remove ' + entry.look.title + ' from saved'} onPress={onRemove} style={styles.heart}>
      <View style={styles.disc}><FormIcon name="heart" size={14} filled /></View>
    </MotionPressable>
  </View>;
}
const styles = StyleSheet.create({
  board: { aspectRatio: 1.08, borderRadius: 2, overflow: 'hidden', backgroundColor: colors.paper2 },
  occasion: { fontFamily: family.sansMedium, fontSize: 9, lineHeight: 14, letterSpacing: 1.3, color: colors.muted, marginTop: 12 },
  title: { fontFamily: family.serif, fontSize: 26, lineHeight: 30, color: colors.ink, marginTop: 3 },
  meta: { fontFamily: family.sans, fontSize: 12, lineHeight: 18, color: colors.muted, marginTop: 4 },
  link: { alignSelf: 'flex-start' },
  note: { fontFamily: family.sans, fontSize: 11, lineHeight: 17, color: colors.muted, marginTop: 10 },
  heart: { position: 'absolute', top: 0, right: 0, width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  disc: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(243,240,234,0.88)', alignItems: 'center', justifyContent: 'center' },
});
