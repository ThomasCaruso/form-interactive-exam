import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { degrees, weatherLine, weatherOn } from '../../domain/context';
import { addDays, dayLabel, dayOfMonth, outfitOn, weekday } from '../../domain/plans';
import type { DayKey } from '../../domain/types';
import { useFormStore } from '../../state/store';
import { useUnits } from '../../services/units';
import { colors } from '../../theme/tokens';
import { family } from '../../theme/typography';
import { ContextSheet } from '../ContextSheet';
import { FormIcon } from '../FormIcon';
import { MotionPressable } from '../MotionPressable';
import { OutfitThumb } from '../OutfitShelf';
import { showToast } from '../Toast';
import { skyIcon } from './ConnectSheet';

const GAP = 6;

/** "Plan it" from Edits: the next two weeks; tap a day to wear this outfit then. Planned days show their outfit. */
export function DayPicker({ outfitId, name, today, visible, onClose }: { outfitId: string; name: string; today: DayKey; visible: boolean; onClose: () => void }) {
  const plans = useFormStore(s => s.plans), saved = useFormStore(s => s.saved);
  const forecast = useFormStore(s => s.weather), dayEvents = useFormStore(s => s.dayEvents);
  const units = useUnits();
  const [w, setW] = useState(0);
  const cell = w ? Math.floor((w - GAP * 6) / 7) : 0;
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i));
  function pick(day: DayKey) {
    const store = useFormStore.getState(), before = store.plans[day];
    store.planDay(day, outfitId);
    onClose();
    const l = dayLabel(day, today);
    showToast('Planned for ' + (l === 'Today' || l === 'Tomorrow' ? l.toLowerCase() : l), 'success', { label: 'Undo', onPress: () => useFormStore.getState().restoreDays({ [day]: before }) });
  }
  return <ContextSheet visible={visible} title="Wear it on…" onClose={onClose}>
    <Text style={styles.sub}>{name}</Text>
    <View style={styles.grid} onLayout={e => setW(e.nativeEvent.layout.width)}>
      {cell > 0 && days.map(day => {
        const o = outfitOn(plans, saved, day), mine = o?.outfitId === outfitId, sky = weatherOn(forecast, day), ev = dayEvents[day];
        return <MotionPressable key={day} glass={false} accessibilityRole="button" accessibilityState={{ selected: mine }}
          accessibilityLabel={dayLabel(day, today) + (o ? ', has ' + o.name : ', free') + (ev?.headline ? ', ' + ev.headline.title : '') + (sky ? ', ' + weatherLine(sky, units) : '')}
          onPress={() => pick(day)} style={[styles.cell, { width: cell }, mine && styles.mine, day === today && styles.today]}>
          <Text style={styles.dn}>{day === today ? 'Today' : weekday(day)}</Text>
          <Text style={styles.d}>{dayOfMonth(day)}</Text>
          <View style={styles.meta}>
            {sky ? <><FormIcon name={skyIcon(sky)} size={10} color={colors.muted} /><Text style={styles.temp}>{degrees(sky.hi, units)}</Text></> : null}
            {!!ev?.events.length && <View style={styles.eventDot} />}
          </View>
          <View style={{ height: cell * 1.05, alignItems: 'center', justifyContent: 'center' }}>
            {o ? <OutfitThumb products={o.products} tucked={o.tucked} width={cell - 6} height={cell * 1.05} /> : <View style={styles.dot} />}
          </View>
        </MotionPressable>;
      })}
    </View>
    <Text style={styles.sub}>A day that already has an outfit gets this one instead. You can undo it.</Text>
  </ContextSheet>;
}

const styles = StyleSheet.create({
  sub: { fontFamily: family.sans, fontSize: 12, lineHeight: 18, color: colors.muted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  cell: { borderRadius: 4, paddingTop: 6, paddingBottom: 3, alignItems: 'center', backgroundColor: colors.paper2, borderWidth: 1.5, borderColor: 'transparent' },
  mine: { borderColor: colors.ink },
  today: { backgroundColor: colors.paper },
  dn: { fontFamily: family.sans, fontSize: 9, color: colors.muted },
  d: { fontFamily: family.sansMedium, fontSize: 14, lineHeight: 19, color: colors.ink },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.line2 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 13 },
  temp: { fontFamily: family.sansMedium, fontSize: 9.5, color: colors.muted },
  // Something on your calendar that day.
  eventDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.ink2, marginLeft: 1 },
});
