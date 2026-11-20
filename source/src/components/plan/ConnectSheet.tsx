import { useEffect, useState } from 'react';
import { Image, Linking, StyleSheet, Text, View } from 'react-native';
import { isWet, type WeatherCache, type WeatherDay } from '../../domain/context';
import { accessNow, connectCalendar, connectMorning, connectWeather, disconnect, MORNING_TIMES, morningTimeLabel, type Access } from '../../services/dayContext';
import { useFormStore } from '../../state/store';
import { colors } from '../../theme/tokens';
import { family } from '../../theme/typography';
import { ContextSheet } from '../ContextSheet';
import { FormIcon, type FormIconName } from '../FormIcon';
import { MotionPressable } from '../MotionPressable';

/** Matches weatherLine: a day that reads "Rain likely" shows rain. */
export const skyIcon = (w: WeatherDay): FormIconName => (w.sky === 'snow' ? 'snow' : isWet(w) ? 'rain' : w.sky === 'clear' ? 'sun' : 'cloud');

/** The forecast's attribution: Apple's Weather mark (bundled, so it reads the same on Android and offline), else the
 * provider's name. */
export function WeatherMark({ source, name }: { source: string; name: string }) {
  return source === 'apple'
    ? <Image accessibilityLabel="Apple Weather" source={require('../../../assets/weather/apple-weather.png')} style={{ width: 77, height: 14 }} resizeMode="contain" />
    : <Text style={styles.attributionText}>Weather by {name}</Text>;
}

/** The attribution as a link to the provider's data sources. Shown wherever a forecast is. */
export function WeatherCredit({ weather, label, style }: { weather: WeatherCache; label?: string; style?: object }) {
  return <MotionPressable glass={false} accessibilityRole="link" accessibilityLabel={'Weather data from ' + weather.attribution.name + '. Opens its data sources'}
    onPress={() => Linking.openURL(weather.attribution.url)} hitSlop={8} style={[styles.credit, style]}>
    <WeatherMark source={weather.source} name={weather.attribution.name} />
    {!!label && <Text style={styles.sources}>{label}</Text>}
  </MotionPressable>;
}

type Source = 'calendar' | 'weather' | 'morning';
const BUSY: Record<Source, string> = { calendar: 'Reading your calendar…', weather: 'Finding your area…', morning: 'Scheduling your notes…' };

/** Turn on what Your week plans around. Each is separate, off by default, and can be turned off again here. */
export function ConnectSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const prefs = useFormStore(s => s.contextPrefs), weather = useFormStore(s => s.weather), morningAt = useFormStore(s => s.morningAt);
  const [allowed, setAllowed] = useState<Partial<Record<Source, Access>>>({});
  const [busy, setBusy] = useState<Source | null>(null);
  // Where each permission stands each time the sheet opens, so a source blocked in Settings says so before a tap.
  useEffect(() => { if (visible) accessNow().then(setAllowed).catch(() => {}); }, [visible]);
  const rows: { key: Source; icon: FormIconName; title: string; body: string }[] = [
    { key: 'calendar', icon: 'calendar', title: 'Your calendar', body: 'Reads your own calendars on this phone to tell a work day from a wedding. Event titles never leave your phone.' },
    { key: 'weather', icon: 'cloud', title: 'The weather', body: 'Sends your approximate area, rounded to about 10 km, to get the forecast. Never your exact location.' },
    { key: 'morning', icon: 'sun', title: 'A morning note', body: 'Around ' + morningTimeLabel(morningAt) + ': today’s outfit, your first event and the forecast. Tap Wearing it to confirm. When nothing’s planned, it suggests an outfit.' },
  ];
  async function turnOn(key: Source) {
    setBusy(key);
    try {
      const a = await (key === 'calendar' ? connectCalendar() : key === 'weather' ? connectWeather() : connectMorning());
      setAllowed(s => ({ ...s, [key]: a }));
    } catch (e) {
      console.warn('FORM connect ' + key, e);
    } finally { setBusy(null); }
  }
  return <ContextSheet visible={visible} title="Plan around your day" onClose={onClose}>
    <Text style={styles.lede}>Your week can read your calendar and the forecast, so Fill my week picks for the day you’ll actually have.</Text>
    {rows.map(r => {
      const on = prefs[r.key], blocked = !on && allowed[r.key] === 'blocked', working = busy === r.key;
      return <View key={r.key} style={styles.row}>
        <View style={styles.icon}><FormIcon name={r.icon} size={18} color={colors.ink2} /></View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={styles.title}>{r.title}</Text>
          <Text style={styles.body}>{r.body}</Text>
          {working && <Text accessibilityLiveRegion="polite" style={styles.busy}>{BUSY[r.key]}</Text>}
          {blocked && <MotionPressable glass={false} accessibilityRole="link" accessibilityHint="Opens FORM's settings" onPress={() => Linking.openSettings()} style={styles.settings}><Text style={styles.settingsText}>Turned off for FORM. Allow it in Settings</Text></MotionPressable>}
          {r.key === 'morning' && on && <View accessibilityRole="radiogroup" accessibilityLabel="Morning note time" style={styles.times}>
            {MORNING_TIMES.map(t => {
              const sel = t === morningAt;
              return <MotionPressable key={t} glass={false} accessibilityRole="radio" accessibilityState={{ selected: sel }} onPress={() => useFormStore.getState().setMorningAt(t)} hitSlop={{ top: 6, bottom: 6 }} style={[styles.time, sel && styles.timeOn]}>
                <Text style={[styles.timeText, sel && styles.timeTextOn]}>{morningTimeLabel(t)}</Text>
              </MotionPressable>;
            })}
          </View>}
        </View>
        <MotionPressable glass={false} accessibilityRole="switch" accessibilityState={{ checked: on, busy: working }} accessibilityLabel={r.title}
          disabled={working || blocked} onPress={() => (on ? disconnect(r.key) : turnOn(r.key))} style={[styles.toggle, on && styles.toggleOn]}>
          {on && <FormIcon name="check" size={13} color={colors.paper} />}
          <Text style={[styles.toggleText, on && styles.toggleTextOn]}>{working ? '…' : on ? 'On' : 'Turn on'}</Text>
        </MotionPressable>
      </View>;
    })}
    {weather && <WeatherCredit weather={weather} label="Data sources" style={styles.attribution} />}
  </ContextSheet>;
}

const styles = StyleSheet.create({
  lede: { fontFamily: family.serifItalic, fontSize: 19, lineHeight: 25, color: colors.ink2 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  icon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper2, marginTop: 1 },
  title: { fontFamily: family.sansMedium, fontSize: 14, color: colors.ink },
  body: { fontFamily: family.sans, fontSize: 12, lineHeight: 17, color: colors.muted },
  busy: { fontFamily: family.sansMedium, fontSize: 12, color: colors.ink2 },
  settings: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  settingsText: { fontFamily: family.sansMedium, fontSize: 12, color: '#9A3A2E', textDecorationLine: 'underline' },
  times: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  time: { minHeight: 36, paddingHorizontal: 11, borderRadius: 18, justifyContent: 'center', borderWidth: 1, borderColor: colors.line2 },
  timeOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  timeText: { fontFamily: family.sansMedium, fontSize: 12, color: colors.ink2 },
  timeTextOn: { color: colors.paper },
  toggle: { minHeight: 44, minWidth: 80, paddingHorizontal: 12, borderRadius: 22, flexDirection: 'row', gap: 5, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line2 },
  toggleOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  toggleText: { fontFamily: family.sansMedium, fontSize: 12, color: colors.ink },
  toggleTextOn: { color: colors.paper },
  credit: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 12, alignSelf: 'flex-start' },
  attribution: { alignSelf: 'stretch', justifyContent: 'space-between', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  attributionText: { fontFamily: family.sansMedium, fontSize: 12, color: colors.ink2 },
  sources: { fontFamily: family.sans, fontSize: 12, color: colors.muted, textDecorationLine: 'underline' },
});
