import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { clock, degrees, fitLine, weatherLine, weatherOn } from '../../domain/context';
import { dayFit, dayLabel, dayOfMonth, isPast, monthName, OCCASIONS, occasionLabel, outfitOn, repeatHint, weekdayName } from '../../domain/plans';
import type { DayKey } from '../../domain/types';
import { useFormStore } from '../../state/store';
import { colors } from '../../theme/tokens';
import { family } from '../../theme/typography';
import { ContextSheet } from '../ContextSheet';
import { FormIcon } from '../FormIcon';
import { MotionPressable } from '../MotionPressable';
import { OutfitThumb } from '../OutfitShelf';
import { showToast } from '../Toast';
import { useUnits } from '../../services/units';
import { skyIcon, WeatherCredit } from './ConnectSheet';

const HERO_W = 112, HERO_H = 140, PICK_W = 68, PICK_H = 86;

/** One day: the outfit, a picker of your outfits, the occasion and a note. A passed day shows what you wore. */
export function DaySheet({ day, today, onClose }: { day: DayKey | null; today: DayKey; onClose: () => void }) {
  const router = useRouter();
  const plans = useFormStore(s => s.plans), saved = useFormStore(s => s.saved);
  const dayEvents = useFormStore(s => s.dayEvents), forecast = useFormStore(s => s.weather);
  const store = useFormStore.getState;
  const units = useUnits();
  const title = day ? (day === today ? 'Today' : weekdayName(day) + ' ' + dayOfMonth(day) + ' ' + monthName(day).slice(0, 3)) : '';
  return <ContextSheet visible={!!day} title={title} onClose={onClose}>
    {day && (() => {
      const past = isPast(day, today), plan = plans[day], o = outfitOn(plans, saved, day);
      const outfits = saved.filter(s => s.look.products.length > 0);
      const hint = past ? null : repeatHint(plans, saved, day, o?.outfitId ?? null, today);
      const ev = past ? undefined : dayEvents[day], sky = past ? null : weatherOn(forecast, day);
      const suggested = !plan?.occasion ? ev?.occasion ?? null : null;
      const fit = o && !past ? dayFit(o.products, { occasion: plan?.occasion ?? suggested, weather: sky }) : null;
      const details = [occasionLabel(plan?.occasion), past ? plan?.note : ''].filter(Boolean).join(' · ');
      const toEdits = (id?: string | null) => { onClose(); if (id) store().setActiveOutfit(id); router.navigate('/edits'); };
      return <>
        <View style={styles.hero}>
          {/* Keyed on empty/filled: Android doesn't draw images in a view that has had a dashed border. */}
          <View key={o ? 'on' : 'off'} style={[styles.heroPlate, !o && styles.emptyPlate]}>
            {o ? <OutfitThumb products={o.products} tucked={o.tucked} width={HERO_W - 4} height={HERO_H - 4} /> : <FormIcon name="calendar" size={26} color={colors.faint} />}
          </View>
          <View style={styles.heroText}>
            <Text style={styles.kicker}>{past ? 'WHAT YOU WORE' : o ? 'PLANNED' : 'NOTHING PLANNED YET'}</Text>
            <Text numberOfLines={3} style={styles.name}>{o ? o.name : past ? 'Nothing recorded.' : outfits.length ? 'Pick an outfit below.' : 'No outfits yet.'}</Text>
            {!!details && <Text style={styles.quiet}>{details}</Text>}
            {!past && o?.outfitId && <MotionPressable glass={false} accessibilityRole="button" accessibilityLabel={'Open ' + o.name + ' on Edits'} onPress={() => toEdits(o.outfitId)} style={styles.link}><Text style={styles.linkText}>Open on Edits</Text><FormIcon name="chevron" size={12} /></MotionPressable>}
          </View>
        </View>

        {!past && <>
          {(sky || !!ev?.events.length) && <View style={styles.day}>
            {sky && <View style={styles.skyRow}><FormIcon name={skyIcon(sky)} size={16} color={colors.ink2} /><Text style={styles.skyText}>{weatherLine(sky, units)}</Text><Text style={styles.lo}>low {degrees(sky.lo, units)}</Text></View>}
            {ev?.events.slice(0, 4).map((e, i) => <View key={i} style={styles.event}>
              <Text style={[styles.time, !units.h24 && styles.time12]}>{e.start === null ? 'All day' : clock(e.start, units)}</Text>
              <Text numberOfLines={1} style={styles.eventTitle}>{e.title}</Text>
            </View>)}
            {(ev?.events.length ?? 0) > 4 && <Text style={[styles.more, !units.h24 && styles.more12]}>+{ev!.events.length - 4} more</Text>}
            {sky && forecast && <WeatherCredit weather={forecast} />}
          </View>}

          <View style={styles.block}>
            <Text style={styles.label}>YOUR OUTFITS</Text>
            {outfits.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.picker} contentContainerStyle={styles.pickerRow}>
              {outfits.map(s => {
                const on = s.id === o?.outfitId;
                return <MotionPressable key={s.id} glass={false} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={s.look.title} onPress={() => store().planDay(day, s.id)} style={styles.pick}>
                  <View style={[styles.pickPlate, on && styles.on]}><OutfitThumb products={s.look.products} tucked={s.tucked} width={PICK_W - 7} height={PICK_H - 7} /></View>
                  <Text numberOfLines={1} style={[styles.pickName, on && styles.pickNameOn]}>{s.look.title}</Text>
                </MotionPressable>;
              })}
              <MotionPressable glass={false} accessibilityRole="button" accessibilityLabel="Make a new outfit on Edits" onPress={() => toEdits()} style={styles.pick}>
                <View style={[styles.pickPlate, styles.emptyPlate]}><Text style={styles.plus}>+</Text></View>
                <Text style={styles.pickName}>New outfit</Text>
              </MotionPressable>
            </ScrollView> : <MotionPressable accessibilityRole="button" onPress={() => toEdits()} style={styles.none}><Text style={styles.quiet}>Your outfits live on Edits. Make one, then plan it here.</Text><FormIcon name="arrow" size={16} /></MotionPressable>}
            {!!fit && <Text accessibilityLiveRegion="polite" style={styles.fit}>{fitLine(fit, sky, units)}</Text>}
            {!!hint && <Text accessibilityLiveRegion="polite" style={styles.hint}>{hint}</Text>}
          </View>

          <View style={styles.block}>
            <Text style={styles.label}>OCCASION{suggested ? '  ·  FROM YOUR CALENDAR' : ''}</Text>
            <View style={styles.chips}>{OCCASIONS.map(x => {
              const on = plan?.occasion === x.id, hinted = suggested === x.id;
              return <MotionPressable key={x.id} glass={false} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityHint={hinted ? 'Suggested by your calendar' : undefined} onPress={() => store().setDayDetails(day, { occasion: on ? undefined : x.id })} style={[styles.chip, on && styles.chipOn, hinted && styles.chipHinted]}>
                <Text style={[styles.chipText, on && styles.chipTextOn, hinted && styles.chipTextHinted]}>{x.label}</Text>
              </MotionPressable>;
            })}</View>
          </View>

          <View style={styles.block}>
            <Text style={styles.label}>NOTE</Text>
            <TextInput accessibilityLabel={'Note for ' + dayLabel(day, today)} value={plan?.note ?? ''} onChangeText={note => store().setDayDetails(day, { note })} maxLength={80}
              placeholder="Dinner at Nonna’s, interview, flight…" placeholderTextColor={colors.faint} returnKeyType="done" style={styles.input} />
          </View>

          {!!plan && <MotionPressable glass={false} accessibilityRole="button" onPress={() => {
            const before = store().clearDay(day);
            onClose();
            const l = dayLabel(day, today);
            showToast('Cleared ' + (l === 'Today' || l === 'Tomorrow' ? l.toLowerCase() : l), 'passed', { label: 'Undo', onPress: () => store().restoreDays({ [day]: before }) });
          }} style={styles.clear}><Text style={styles.clearText}>Clear day</Text></MotionPressable>}
        </>}
      </>;
    })()}
  </ContextSheet>;
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', gap: 16, alignItems: 'center' },
  heroPlate: { width: HERO_W, height: HERO_H, borderRadius: 4, padding: 2, backgroundColor: colors.paper2, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  emptyPlate: { backgroundColor: 'transparent', borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.line2 },
  heroText: { flex: 1, gap: 6 },
  kicker: { fontFamily: family.sansMedium, fontSize: 10, letterSpacing: 1.5, color: colors.muted },
  name: { fontFamily: family.serif, fontSize: 27, lineHeight: 30, color: colors.ink },
  quiet: { fontFamily: family.sans, fontSize: 12, lineHeight: 18, color: colors.muted, flex: 1 },
  link: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 36, alignSelf: 'flex-start' },
  linkText: { fontFamily: family.sansMedium, fontSize: 12, color: colors.ink, textDecorationLine: 'underline' },
  block: { gap: 10 },
  label: { fontFamily: family.sansMedium, fontSize: 10, letterSpacing: 1.6, color: colors.muted },
  picker: { marginHorizontal: -24 },
  pickerRow: { paddingHorizontal: 24, gap: 10 },
  pick: { width: PICK_W, gap: 6 },
  pickPlate: { width: PICK_W, height: PICK_H, borderRadius: 6, padding: 2, backgroundColor: colors.paper2, borderWidth: 1.5, borderColor: 'transparent', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  on: { borderColor: colors.ink },
  plus: { fontFamily: family.sans, fontSize: 24, color: colors.ink2 },
  pickName: { fontFamily: family.sans, fontSize: 10.5, color: colors.muted },
  pickNameOn: { fontFamily: family.sansMedium, color: colors.ink },
  none: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, borderRadius: 4, backgroundColor: colors.paper2 },
  hint: { fontFamily: family.serifItalic, fontSize: 18, lineHeight: 23, color: colors.ink2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 38, paddingHorizontal: 15, borderRadius: 19, justifyContent: 'center', borderWidth: 1, borderColor: colors.line2 },
  chipOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { fontFamily: family.sansMedium, fontSize: 12.5, color: colors.ink2 },
  chipTextOn: { color: colors.paper },
  chipHinted: { borderColor: colors.ink, borderStyle: 'dashed' },
  chipTextHinted: { color: colors.ink },
  day: { gap: 8, padding: 12, borderRadius: 4, backgroundColor: colors.paper2 },
  skyRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  skyText: { fontFamily: family.sansMedium, fontSize: 13, color: colors.ink },
  lo: { fontFamily: family.sans, fontSize: 12, color: colors.muted },
  event: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  time: { width: 44, fontFamily: family.sansMedium, fontSize: 11, color: colors.muted },
  time12: { width: 60 },
  eventTitle: { flex: 1, fontFamily: family.sans, fontSize: 13, color: colors.ink2 },
  more: { fontFamily: family.sans, fontSize: 11, color: colors.muted, paddingLeft: 54 },
  more12: { paddingLeft: 70 },
  fit: { fontFamily: family.sansMedium, fontSize: 12.5, lineHeight: 18, color: '#7A5A1E' },
  input: { fontFamily: family.sans, fontSize: 15, color: colors.ink, minHeight: 48, paddingHorizontal: 14, borderRadius: 4, borderWidth: 1, borderColor: colors.line2, backgroundColor: colors.paper },
  clear: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  clearText: { fontFamily: family.sansMedium, fontSize: 12.5, color: '#9A3A2E', textDecorationLine: 'underline' },
});
