import { StyleSheet, Text, View } from 'react-native';
import { MotionPressable } from './MotionPressable';
import { archetypesFor, MAX_PER_SLOT, slotLabel, togglePick, type ClosetPicks } from '../domain/closet';
import type { GarmentSlot, ShopFor } from '../domain/types';
import { colors } from '../theme/tokens';
import { eyebrow, family } from '../theme/typography';

const SLOTS: readonly GarmentSlot[] = ['top', 'pants', 'dress', 'outerwear', 'shoes'];

/** "What do you wear most?" Up to three archetypes per slot, one colour each. Rendered inside the caller's scroll view. */
export function ClosetGrid({ shopFor, picks, onChange }: { shopFor: ShopFor; picks: ClosetPicks; onChange: (next: ClosetPicks) => void }) {
  const all = archetypesFor(shopFor);
  return <View style={styles.grid}>
    {SLOTS.map(slot => {
      const items = all.filter(a => a.slot === slot);
      if (!items.length) return null;
      const chosen = items.filter(a => picks[a.id]).length, full = chosen >= MAX_PER_SLOT;
      return <View key={slot}>
        <View style={styles.labelRow}><Text style={[eyebrow, styles.label]}>{slotLabel(slot).toUpperCase()}</Text><Text style={styles.count}>{chosen} of {MAX_PER_SLOT}</Text></View>
        {items.map(a => {
          const picked = !!picks[a.id], blocked = full && !picked;
          return <View key={a.id} style={[styles.row, blocked && { opacity: 0.35 }]}>
            <Text numberOfLines={1} style={[styles.name, picked && styles.namePicked]}>{a.name}{shopFor === 'both' ? (a.department === 'mens' ? ' · men' : ' · women') : ''}</Text>
            <View style={styles.dots}>{a.colors.map(c => {
              const on = picks[a.id] === c.name;
              return <MotionPressable key={c.name} glass={false} disabled={blocked} hitSlop={7}
                accessibilityRole="checkbox" accessibilityLabel={c.name + ' ' + a.name} accessibilityState={{ checked: on, disabled: blocked }}
                onPress={() => onChange(togglePick(picks, a, c))} style={[styles.ring, on && styles.ringOn]}>
                <View style={[styles.dot, { backgroundColor: c.hex }]} />
              </MotionPressable>;
            })}</View>
          </View>;
        })}
      </View>;
    })}
  </View>;
}

const styles = StyleSheet.create({
  grid: { gap: 22 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 2 },
  label: { color: colors.muted },
  count: { fontFamily: family.sans, fontSize: 12, color: colors.faint },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 46, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  name: { flex: 1, fontFamily: family.sans, fontSize: 15, color: colors.ink2, paddingRight: 10 },
  namePicked: { fontFamily: family.sansMedium, color: colors.ink },
  dots: { flexDirection: 'row', gap: 6 },
  ring: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'transparent' },
  ringOn: { borderColor: colors.ink },
  dot: { width: 24, height: 24, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line2 },
});
