import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { DetailHeader } from '../src/components/DetailHeader';
import { EditorialScreen } from '../src/components/Editorial';
import { FormIcon } from '../src/components/FormIcon';
import { MotionPressable } from '../src/components/MotionPressable';
import { OutfitThumb } from '../src/components/OutfitShelf';
import { DaySheet } from '../src/components/plan/DaySheet';
import { degrees, weatherLine, weatherOn } from '../src/domain/context';
import { useUnits } from '../src/services/units';
import { dayOfMonth, isPast, monthGrid, monthName, monthStat, occasionLabel, outfitOn, shiftMonth, weekdayName } from '../src/domain/plans';
import type { DayKey } from '../src/domain/types';
import { useToday } from '../src/hooks/useToday';
import { useFormStore } from '../src/state/store';
import { colors } from '../src/theme/tokens';
import { family } from '../src/theme/typography';

const GAP = 4;

/** The month: every day's outfit, planned ahead and worn behind. Tap a day to plan it or see what you wore. */
export default function PlanScreen() {
  const today = useToday();
  const plans = useFormStore(s => s.plans), saved = useFormStore(s => s.saved);
  const forecast = useFormStore(s => s.weather), dayEvents = useFormStore(s => s.dayEvents);
  const units = useUnits();
  const [month, setMonth] = useState<DayKey>(() => today.slice(0, 8) + '01');
  const [open, setOpen] = useState<DayKey | null>(null);
  const [w, setW] = useState(0);
  // Floored: a fractional width can wrap the seventh day onto the next row.
  const cell = w ? Math.floor((w - GAP * 6) / 7) : 0, cellH = Math.round(cell * 1.42);
  const stat = monthStat(plans, saved, month, today);
  const year = month.slice(0, 4);
  return <EditorialScreen>
    <DetailHeader title="YOUR MONTH" />
    <View style={styles.head}>
      <Text accessibilityRole="header" style={styles.title}>{monthName(month)}<Text style={styles.year}>  {year}</Text></Text>
      <View style={styles.arrows}>
        <MotionPressable accessibilityRole="button" accessibilityLabel="Previous month" onPress={() => setMonth(m => shiftMonth(m, -1))} style={styles.arrow}><View style={{ transform: [{ scaleX: -1 }] }}><FormIcon name="chevron" size={16} /></View></MotionPressable>
        <MotionPressable accessibilityRole="button" accessibilityLabel="Next month" onPress={() => setMonth(m => shiftMonth(m, 1))} style={styles.arrow}><FormIcon name="chevron" size={16} /></MotionPressable>
      </View>
    </View>
    <Text style={styles.stat}>{stat ?? (month < today.slice(0, 8) + '01' ? 'Nothing recorded this month.' : 'Tap a day to plan what you’ll wear.')}</Text>
    <View style={styles.week}>{['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <Text key={i} style={[styles.weekday, { width: cell || undefined, flex: cell ? undefined : 1 }]}>{d}</Text>)}</View>
    <View style={styles.grid} onLayout={e => setW(e.nativeEvent.layout.width)}>
      {cell > 0 && monthGrid(month).map((day, i) => {
        if (!day) return <View key={'x' + i} style={{ width: cell, height: cellH }} />;
        const o = outfitOn(plans, saved, day), plan = plans[day], past = isPast(day, today), isToday = day === today;
        const sky = past ? null : weatherOn(forecast, day), events = past ? 0 : dayEvents[day]?.events.length ?? 0;
        return <MotionPressable key={day} glass={false} accessibilityRole="button"
          accessibilityLabel={weekdayName(day) + ' ' + dayOfMonth(day) + (isToday ? ', today' : '') + ': ' + (o ? (past ? 'wore ' : '') + o.name : 'nothing planned') + (plan?.confirmed ? ', worn' : '') + (plan?.occasion ? ', ' + occasionLabel(plan.occasion) : '') + (events ? ', ' + events + (events === 1 ? ' event' : ' events') : '') + (sky ? ', ' + weatherLine(sky, units) : '')}
          onPress={() => setOpen(day)} style={[styles.cell, { width: cell, height: cellH }, o ? styles.filled : styles.blank, past && !o && styles.gone, isToday && styles.today]}>
          <View style={styles.cellHead}>
            <Text style={[styles.num, past && styles.pastNum, isToday && styles.todayNum]}>{dayOfMonth(day)}</Text>
            {plan?.confirmed ? <FormIcon name="check" size={10} color={colors.ink} /> : sky ? <Text style={styles.temp}>{degrees(sky.hi, units)}</Text> : events ? <View style={styles.eventDot} /> : null}
          </View>
          {o ? <View style={{ opacity: past ? 0.72 : 1 }}><OutfitThumb products={o.products} tucked={o.tucked} width={cell - 4} height={cellH - 20} /></View>
            : (plan?.note || plan?.occasion) ? <View style={styles.dotWrap}><View style={styles.dot} /></View> : null}
        </MotionPressable>;
      })}
    </View>
    <View style={styles.legend}>
      <View style={styles.key}><View style={[styles.swatch, styles.today]} /><Text style={styles.legendText}>Today</Text></View>
      <View style={styles.key}><View style={[styles.swatch, styles.filled, { opacity: 0.72 }]} /><Text style={styles.legendText}>Worn</Text></View>
      <View style={styles.key}><View style={[styles.swatch, styles.filled]} /><Text style={styles.legendText}>Planned</Text></View>
      <View style={styles.key}><View style={styles.dot} /><Text style={styles.legendText}>Note only</Text></View>
      <View style={styles.key}><FormIcon name="check" size={11} color={colors.ink} /><Text style={styles.legendText}>Wearing it</Text></View>
    </View>
    <DaySheet day={open} today={today} onClose={() => setOpen(null)} />
  </EditorialScreen>;
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 6 },
  title: { fontFamily: family.serif, fontSize: 40, lineHeight: 46, letterSpacing: -0.6, color: colors.ink },
  year: { fontFamily: family.sans, fontSize: 13, letterSpacing: 0, color: colors.muted },
  arrows: { flexDirection: 'row', gap: 6, marginBottom: 4 },
  arrow: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line2 },
  stat: { fontFamily: family.serifItalic, fontSize: 19, lineHeight: 25, color: colors.ink2, marginTop: 8, marginBottom: 18 },
  week: { flexDirection: 'row', gap: GAP, marginBottom: 6 },
  weekday: { fontFamily: family.sansMedium, fontSize: 10, letterSpacing: 1, color: colors.muted, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  cell: { borderRadius: 4, paddingHorizontal: 2, paddingTop: 3, borderWidth: 1.5, borderColor: 'transparent', overflow: 'hidden' },
  filled: { backgroundColor: colors.paper2 },
  blank: { backgroundColor: colors.card },
  gone: { opacity: 0.5 },
  today: { borderColor: colors.ink },
  cellHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingRight: 2 },
  num: { fontFamily: family.sansMedium, fontSize: 10.5, lineHeight: 14, color: colors.ink, paddingLeft: 3 },
  temp: { fontFamily: family.sans, fontSize: 9, color: colors.muted },
  eventDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.ink2 },
  pastNum: { color: colors.muted },
  todayNum: { color: colors.ink },
  dotWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.faint },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 18 },
  key: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 12, height: 14, borderRadius: 2, borderWidth: 1.5, borderColor: 'transparent' },
  legendText: { fontFamily: family.sans, fontSize: 11, color: colors.muted },
});
