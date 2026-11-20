import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { degrees, eventLine, fitLine, weatherLine, weatherOn } from '../../domain/context';
import { dayFit, dayLabel, dayOfMonth, outfitOn, occasionLabel, rangeLabel, weekday, weekFrom } from '../../domain/plans';
import type { DayKey, DayOccasion } from '../../domain/types';
import { CONTEXT_SUPPORTED, weekContext } from '../../services/dayContext';
import { useUnits } from '../../services/units';
import { useFormStore } from '../../state/store';
import { colors } from '../../theme/tokens';
import { family } from '../../theme/typography';
import { FormIcon } from '../FormIcon';
import { MotionPressable } from '../MotionPressable';
import { OutfitThumb } from '../OutfitShelf';
import { showToast } from '../Toast';
import { ConnectSheet, skyIcon, WeatherCredit } from './ConnectSheet';

const GAP = 6, HERO_W = 104, HERO_H = 132;
/** Occasion tags short enough for a sixth of the card. */
const TAG: Record<DayOccasion, string> = { work: 'WORK', casual: 'CASUAL', 'going-out': 'OUT', active: 'ACTIVE', formal: 'FORMAL' };

/** Your week on the You page: today large, the six days after it as a row of small stages, and Fill my week.
 * Tapping any day opens its sheet (DaySheet); Month opens the calendar. */
export function YourWeek({ today, onOpenDay, onMonth }: { today: DayKey; onOpenDay: (day: DayKey) => void; onMonth: () => void }) {
  const plans = useFormStore(s => s.plans), saved = useFormStore(s => s.saved);
  const dayEvents = useFormStore(s => s.dayEvents), forecast = useFormStore(s => s.weather), prefs = useFormStore(s => s.contextPrefs);
  const dismissed = useFormStore(s => s.connectDismissed), eventsRead = useFormStore(s => s.eventsRead);
  const units = useUnits();
  const [rowW, setRowW] = useState(0), [connecting, setConnecting] = useState(false);
  const week = weekFrom(today), rest = week.slice(1);
  const now = outfitOn(plans, saved, today), nowPlan = plans[today];
  const open = week.filter(day => !outfitOn(plans, saved, day)).length;
  const tileW = rowW ? Math.floor((rowW - GAP * (rest.length - 1)) / rest.length) : 0, tileH = Math.round(tileW * 1.3);
  const lead = dayEvents[today]?.headline, sky = weatherOn(forecast, today);
  // Your occasion for a day, else the one its calendar suggests.
  const occasionOf = (day: DayKey) => plans[day]?.occasion ?? dayEvents[day]?.occasion ?? undefined;
  const fitOf = (day: DayKey) => { const o = outfitOn(plans, saved, day); return o && !o.worn ? dayFit(o.products, { occasion: occasionOf(day), weather: weatherOn(forecast, day) }) : null; };
  const details = [lead ? eventLine(lead, units) : occasionLabel(occasionOf(today)), nowPlan?.note].filter(Boolean).join(' · ');
  // The first day this week whose outfit may not suit it, for one line under the row.
  const misfit = week.map(day => ({ day, fit: fitOf(day) })).find(x => x.fit);

  function fill() {
    const { filled, before } = useFormStore.getState().fillWeek(today, weekContext(today));
    if (!filled.length) { showToast(saved.length ? 'Your week is already planned' : 'Make an outfit on Edits first', 'info'); return; }
    const after = useFormStore.getState(), loose = filled.filter(day => {
      const o = outfitOn(after.plans, after.saved, day);
      return o && dayFit(o.products, { occasion: after.plans[day]?.occasion ?? after.dayEvents[day]?.occasion, weather: weatherOn(after.weather, day) });
    }).length;
    showToast('Planned ' + filled.length + (filled.length === 1 ? ' day' : ' days') + (loose ? ' · ' + loose + ' could fit better' : ''), 'success', { label: 'Undo', onPress: () => useFormStore.getState().restoreDays(before) });
  }
  function wearing(on: boolean) {
    if (!now) return;
    useFormStore.getState().confirmWorn(today, on);
    showToast(on ? 'Wearing ' + now.name + ' today' : 'Not marked as worn', on ? 'success' : 'passed', { label: 'Undo', onPress: () => useFormStore.getState().confirmWorn(today, !on) });
  }

  const todayLabel = 'Today, ' + weekday(today) + ' ' + dayOfMonth(today) + ': ' + (now ? now.name : 'nothing planned')
    + (details ? '. ' + details : '') + (sky ? '. ' + weatherLine(sky, units) : '') + (nowPlan?.confirmed ? '. Wearing it' : '');
  const connected = prefs.calendar && prefs.weather;

  return <View style={styles.root}>
    <View style={styles.header}>
      <View style={{ flex: 1 }}><Text style={styles.label}>YOUR WEEK</Text><Text style={styles.range}>{rangeLabel(week[0], week[6])}</Text></View>
      <MotionPressable glass={false} accessibilityRole="button" accessibilityLabel="Open the month" onPress={onMonth} style={styles.month}>
        <FormIcon name="calendar" size={15} color={colors.ink2} /><Text style={styles.monthText}>Month</Text>
      </MotionPressable>
    </View>

    <View style={styles.today}>
      <MotionPressable glass={false} accessibilityRole="button" accessibilityLabel={todayLabel} accessibilityHint={now ? 'Change today’s outfit' : 'Plan today'} onPress={() => onOpenDay(today)} style={styles.todayMain}>
        {/* Keyed on empty/filled: Android doesn't draw images in a view that has had a dashed border. */}
        <View key={now ? 'on' : 'off'} style={[styles.heroPlate, !now && styles.emptyPlate]}>
          {now ? <OutfitThumb products={now.products} tucked={now.tucked} width={HERO_W - 4} height={HERO_H - 4} /> : <Text style={styles.plus}>+</Text>}
        </View>
        <View style={styles.todayText}>
          <Text style={styles.kicker}>TODAY · {weekday(today).toUpperCase()} {dayOfMonth(today)}</Text>
          <Text numberOfLines={2} style={styles.todayName}>{now ? now.name : 'Nothing planned yet.'}</Text>
          {/* With the calendar on, the line keeps its space while events load, so nothing below it jumps. */}
          {!!(details || !now || prefs.calendar) && <Text numberOfLines={2} style={styles.details}>{details || (!now ? 'Pick an outfit for today.' : eventsRead ? 'Nothing on your calendar.' : ' ')}</Text>}
          {sky && <View style={styles.sky}><FormIcon name={skyIcon(sky)} size={14} color={colors.ink2} /><Text style={styles.skyText}>{weatherLine(sky, units)}</Text></View>}
          {!now && <View style={styles.change}><Text style={styles.changeText}>Plan today</Text><FormIcon name="chevron" size={12} color={colors.ink} /></View>}
        </View>
      </MotionPressable>
    </View>
    {now && <View style={styles.actions}>
      {nowPlan?.confirmed
        ? <MotionPressable glass={false} accessibilityRole="button" accessibilityState={{ checked: true }} accessibilityLabel={'Wearing ' + now.name + ' today'} accessibilityHint="Double tap to take it back" onPress={() => wearing(false)} style={styles.wearing}>
          <FormIcon name="check" size={14} color={colors.ink} /><Text style={styles.wearingText}>Wearing it</Text>
        </MotionPressable>
        : <MotionPressable glass={false} accessibilityRole="button" accessibilityLabel={'Wearing ' + now.name + ' today'} onPress={() => wearing(true)} style={styles.wear}>
          <FormIcon name="check" size={13} color={colors.ink} /><Text style={styles.wearText}>Wearing it</Text>
        </MotionPressable>}
      <MotionPressable glass={false} accessibilityRole="button" accessibilityLabel="Change today’s outfit" onPress={() => onOpenDay(today)} style={styles.changeButton}>
        <Text style={styles.changeText}>Change</Text><FormIcon name="chevron" size={12} color={colors.ink} />
      </MotionPressable>
    </View>}

    <View style={styles.rule} />
    <View style={styles.row} onLayout={e => setRowW(e.nativeEvent.layout.width)}>
      {tileW > 0 && rest.map(day => {
        const o = outfitOn(plans, saved, day), mine = plans[day]?.occasion, occ = occasionOf(day), w = weatherOn(forecast, day);
        const fromCalendar = !mine && !!occ;
        return <MotionPressable key={day} glass={false} accessibilityRole="button"
          accessibilityLabel={dayLabel(day, today) + ': ' + (o ? o.name : 'nothing planned') + (occ ? ', ' + occasionLabel(occ) + (fromCalendar ? ' from your calendar' : '') : '') + (w ? ', ' + weatherLine(w, units) : '')}
          onPress={() => onOpenDay(day)} style={{ width: tileW }}>
          <Text style={styles.dayName}>{weekday(day)}</Text>
          <Text style={styles.dayNumber}>{dayOfMonth(day)}</Text>
          <View key={o ? 'on' : 'off'} style={[styles.plate, { height: tileH }, !o && styles.emptyPlate]}>
            {o ? <OutfitThumb products={o.products} tucked={o.tucked} width={tileW - 4} height={tileH - 4} /> : <Text style={styles.smallPlus}>+</Text>}
          </View>
          <Text numberOfLines={1} style={[styles.occasion, fromCalendar && styles.occasionSuggested]}>{occ ? TAG[occ] : plans[day]?.note ? '•' : ''}</Text>
          {w && <View style={styles.tileSky}><FormIcon name={skyIcon(w)} size={13} color={colors.muted} /><Text style={styles.tileTemp}>{degrees(w.hi, units)}</Text></View>}
        </MotionPressable>;
      })}
    </View>
    {misfit?.fit && <MotionPressable glass={false} accessibilityRole="button" accessibilityHint="Opens the day" onPress={() => onOpenDay(misfit.day)} style={styles.misfit}>
      <Text style={styles.misfitText}><Text style={styles.misfitDay}>{dayLabel(misfit.day, today)}</Text>  {fitLine(misfit.fit, weatherOn(forecast, misfit.day), units)}</Text>
      <FormIcon name="chevron" size={12} color={colors.ink2} />
    </MotionPressable>}

    <View style={styles.footer}>
      <MotionPressable accessibilityRole="button" accessibilityLabel="Fill my week from my outfits" onPress={fill} style={styles.fill}><Text style={styles.fillText}>Fill my week</Text><FormIcon name="arrow" size={15} color={colors.paper} /></MotionPressable>
      <Text style={styles.open}>{open ? open + (open === 1 ? ' day open' : ' days open') : 'All seven planned'}</Text>
    </View>

    {CONTEXT_SUPPORTED && (!connected && !dismissed
      ? <View style={styles.connect}>
        <MotionPressable glass={false} accessibilityRole="button" accessibilityLabel="Plan around your calendar and the weather" onPress={() => setConnecting(true)} style={styles.connectMain}>
          <View style={styles.connectIcons}><FormIcon name="calendar" size={16} color={colors.ink2} /><FormIcon name="cloud" size={16} color={colors.ink2} /></View>
          <View style={{ flex: 1 }}><Text style={styles.connectTitle}>Plan around your day</Text><Text style={styles.connectBody}>Use your calendar and the forecast</Text></View>
          <FormIcon name="chevron" size={14} color={colors.ink2} />
        </MotionPressable>
        <MotionPressable glass={false} accessibilityRole="button" accessibilityLabel="Not now. Hide this" onPress={() => useFormStore.getState().dismissConnect()} style={styles.notNow}><Text style={styles.notNowText}>Not now</Text></MotionPressable>
      </View>
      : <View style={styles.sources}>
        {forecast && sky ? <WeatherCredit weather={forecast} /> : null}
        <MotionPressable glass={false} accessibilityRole="button" accessibilityLabel="Calendar, weather and morning note settings" onPress={() => setConnecting(true)} hitSlop={6} style={styles.sourcesLink}><Text style={styles.sourcesText}>Calendar, weather & morning note</Text></MotionPressable>
      </View>)}
    {/* Not connected but showing a forecast (the calendar is off): the attribution still goes with it. */}
    {CONTEXT_SUPPORTED && !connected && !dismissed && forecast && sky && <WeatherCredit weather={forecast} />}
    <ConnectSheet visible={connecting} onClose={() => setConnecting(false)} />
  </View>;
}

const styles = StyleSheet.create({
  root: { borderRadius: 4, padding: 14, paddingTop: 12, backgroundColor: colors.card },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 2 },
  label: { fontFamily: family.sansMedium, fontSize: 10, letterSpacing: 1.8, color: colors.muted },
  range: { fontFamily: family.serif, fontSize: 25, lineHeight: 30, color: colors.ink, marginTop: 2 },
  month: { minHeight: 44, paddingHorizontal: 14, borderRadius: 22, flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line2 },
  monthText: { fontFamily: family.sansMedium, fontSize: 12, color: colors.ink2 },
  today: { marginTop: 14 },
  todayMain: { flexDirection: 'row', gap: 16, borderRadius: 4 },
  heroPlate: { width: HERO_W, height: HERO_H, borderRadius: 4, padding: 2, backgroundColor: colors.paper2, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  emptyPlate: { backgroundColor: 'transparent', borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.line2 },
  plus: { fontFamily: family.sans, fontSize: 30, color: colors.faint },
  todayText: { flex: 1, justifyContent: 'center', gap: 5 },
  kicker: { fontFamily: family.sansMedium, fontSize: 10, letterSpacing: 1.5, color: colors.ink2 },
  todayName: { fontFamily: family.serif, fontSize: 26, lineHeight: 29, color: colors.ink },
  details: { fontFamily: family.sans, fontSize: 12, lineHeight: 18, color: colors.muted },
  sky: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  skyText: { fontFamily: family.sansMedium, fontSize: 12, color: colors.ink2 },
  // Under the hero text, outside the pressable that opens the day, so each action is its own target.
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, marginLeft: HERO_W + 16 },
  wear: { minHeight: 44, paddingHorizontal: 14, borderRadius: 22, flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: colors.ink },
  wearText: { fontFamily: family.sansMedium, fontSize: 12.5, color: colors.ink },
  wearing: { minHeight: 44, paddingHorizontal: 4, flexDirection: 'row', alignItems: 'center', gap: 5 },
  wearingText: { fontFamily: family.sansMedium, fontSize: 12.5, color: colors.ink },
  change: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 32 },
  changeButton: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44, paddingHorizontal: 8 },
  changeText: { fontFamily: family.sansMedium, fontSize: 12.5, color: colors.ink, textDecorationLine: 'underline' },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: colors.line, marginTop: 14, marginBottom: 12 },
  row: { flexDirection: 'row', gap: GAP },
  dayName: { fontFamily: family.sans, fontSize: 10, color: colors.muted, textAlign: 'center' },
  dayNumber: { fontFamily: family.sansMedium, fontSize: 14, lineHeight: 19, color: colors.ink, textAlign: 'center', marginBottom: 5 },
  plate: { borderRadius: 4, padding: 2, backgroundColor: colors.paper2, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  smallPlus: { fontFamily: family.sans, fontSize: 18, color: colors.faint },
  occasion: { fontFamily: family.sansMedium, fontSize: 8.5, letterSpacing: 0.5, color: colors.ink2, textAlign: 'center', marginTop: 5, minHeight: 12 },
  // From the calendar, not chosen by you: lighter, and said so to TalkBack.
  occasionSuggested: { fontFamily: family.sans, color: colors.faint },
  tileSky: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2, marginTop: 2 },
  tileTemp: { fontFamily: family.sansMedium, fontSize: 11, color: colors.muted },
  misfit: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, marginTop: 8, paddingHorizontal: 12, borderRadius: 4, backgroundColor: colors.paper2 },
  misfitText: { flex: 1, fontFamily: family.sans, fontSize: 12, lineHeight: 17, color: colors.ink2 },
  misfitDay: { fontFamily: family.sansMedium, color: colors.ink },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 12 },
  fill: { minHeight: 44, paddingHorizontal: 16, borderRadius: 22, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.ink },
  fillText: { fontFamily: family.sansMedium, fontSize: 13, color: colors.paper },
  open: { fontFamily: family.sans, fontSize: 11, color: colors.muted },
  // Wraps rather than collides at large text sizes.
  sources: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', columnGap: 16, marginTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  sourcesLink: { minHeight: 44, justifyContent: 'center', flexShrink: 1 },
  sourcesText: { fontFamily: family.sans, fontSize: 11.5, color: colors.muted, textDecorationLine: 'underline' },
  connect: { flexDirection: 'row', alignItems: 'center', marginTop: 12, borderRadius: 4, backgroundColor: colors.paper2 },
  connectMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingLeft: 12, paddingRight: 4 },
  connectIcons: { flexDirection: 'row', gap: 2 },
  connectTitle: { fontFamily: family.sansMedium, fontSize: 13, color: colors.ink },
  connectBody: { fontFamily: family.sans, fontSize: 11, color: colors.muted, marginTop: 1 },
  notNow: { minHeight: 56, minWidth: 48, paddingHorizontal: 12, justifyContent: 'center', borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: colors.line2 },
  notNowText: { fontFamily: family.sansMedium, fontSize: 11.5, color: colors.muted },
});
