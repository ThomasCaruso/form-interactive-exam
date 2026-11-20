import * as Calendar from 'expo-calendar';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { PermissionsAndroid, Platform } from 'react-native';
import { clock, coarse, eventsByDay, morningLine, weatherOn, type CalendarEvent, type DayContext, type WeatherCache } from '../domain/context';
import { addDays, dayKey, fillWeek, outfitOn, parseDay, weekFrom } from '../domain/plans';
import type { DayKey } from '../domain/types';
import { useFormStore } from '../state/store';
import { currentUnits } from './units';

/**
 * The phone side of "plan around your day". Three things, each off until you turn it on:
 * - Calendar: read here, grouped and classified on the phone (src/domain/context.ts). Titles never leave it.
 * - Weather: an approximate place (rounded to about 10 km) goes to our weather relay
 *   (supabase/functions/weather), which holds the Apple WeatherKit key. Same relay for iPhone and Android.
 * - Morning note: a local notification at the time you choose with today's outfit, first event and forecast.
 * None of it exists on the web build: no calendar, no local notifications.
 */

export const CONTEXT_SUPPORTED = Platform.OS !== 'web';
// A loopback relay (the local dev runner) is only reachable through adb reverse; a release build ignores it.
const LOCAL = /^https?:\/\/(127\.0\.0\.1|localhost|10\.0\.2\.2)(:|\/|$)/;
const DEV_URL = process.env.EXPO_PUBLIC_WEATHER_URL;
const RELAY = (DEV_URL && (__DEV__ || !LOCAL.test(DEV_URL)) ? DEV_URL : null)
  ?? (process.env.EXPO_PUBLIC_SUPABASE_URL ? process.env.EXPO_PUBLIC_SUPABASE_URL + '/functions/v1/weather' : null);
const ANON = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const FRESH = 3 * 3600 * 1000;
/** The times the morning note can come, in minutes after midnight. */
export const MORNING_TIMES = [6 * 60 + 30, 7 * 60, 7 * 60 + 30, 8 * 60];
export const morningTimeLabel = (minutes: number) => clock(new Date(2026, 0, 1, Math.floor(minutes / 60), minutes % 60).getTime(), currentUnits());
export const MORNING_CATEGORY = 'form-today', WEAR_ACTION = 'wear';
export const SUGGEST_CATEGORY = 'form-suggest', WEAR_SUGGESTION = 'wear-suggestion';
const CHANNEL = 'morning';
const NOTE_PREFIX = 'form-morning-';

const store = useFormStore.getState;
const timeZone = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { return 'UTC'; } };

/** Where a permission stands: 'blocked' means the phone won't ask again, so only Settings can change it. */
export type Access = 'granted' | 'ask' | 'blocked';
const access = (r: { granted: boolean; canAskAgain: boolean }): Access => r.granted ? 'granted' : r.canAskAgain ? 'ask' : 'blocked';

// --- Calendar ------------------------------------------------------------------------------------

// expo-calendar reports Android access only when read *and* write are granted, and FORM blocks write in the
// manifest (it never writes). Reading needs only READ_CALENDAR, so on Android ask for and check that alone.
// Read inside Android-only branches: PermissionsAndroid doesn't exist on the web.
const READ = 'android.permission.READ_CALENDAR' as const;
const calendarAllowed = async () => Platform.OS === 'android' ? await PermissionsAndroid.check(READ) : (await Calendar.getCalendarPermissions()).granted;
// Android can't say "won't ask again" without asking, so remember the last answer for this session.
let calendarBlocked = false;

/** Asks for calendar access. */
export async function connectCalendar(): Promise<Access> {
  let granted: boolean;
  if (Platform.OS === 'android') {
    const r = await PermissionsAndroid.request(READ);
    granted = r === PermissionsAndroid.RESULTS.GRANTED;
    calendarBlocked = r === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN;
  } else {
    const r = await Calendar.requestCalendarPermissions();
    granted = r.granted;
    calendarBlocked = !r.granted && !r.canAskAgain;
  }
  store().setContextPref('calendar', granted);
  if (granted) await readCalendar();
  return granted ? 'granted' : calendarBlocked ? 'blocked' : 'ask';
}

/** Where each source's permission stands, without asking. */
export async function accessNow(): Promise<Record<'calendar' | 'weather' | 'morning', Access>> {
  if (!CONTEXT_SUPPORTED) return { calendar: 'blocked', weather: 'blocked', morning: 'blocked' };
  const [cal, loc, note] = await Promise.all([calendarAllowed(), Location.getForegroundPermissionsAsync(), Notifications.getPermissionsAsync()]);
  return { calendar: cal ? 'granted' : calendarBlocked ? 'blocked' : 'ask', weather: access(loc), morning: access(note) };
}

// Your own calendars: ones you can write to, or your primary one. Read-only ones are holidays, subscriptions, sports
// fixtures and colleagues' shared calendars, which aren't your day.
const OWN = new Set(['owner', 'editor', 'contributor', 'root']);
const isOwn = (c: Calendar.ExpoCalendar) => c.isVisible !== false && c.type !== Calendar.CalendarType.BIRTHDAYS && c.type !== Calendar.CalendarType.SUBSCRIBED
  && (!!c.isPrimary || c.allowsModifications || OWN.has(String(c.accessLevel ?? '')));

/** Reads the next 14 days of events from your own calendars and keeps them, grouped by day, in memory.
 * Skips canceled events and invitations you declined. */
export async function readCalendar(today: DayKey = dayKey(new Date())) {
  if (!CONTEXT_SUPPORTED || !store().contextPrefs.calendar) return;
  if (!await calendarAllowed()) { store().setContextPref('calendar', false); return; }
  const calendars = (await Calendar.getCalendars(Calendar.EntityTypes.EVENT)).filter(isOwn);
  if (!calendars.length) { store().setDayEvents({}); return; }
  const midnight = (day: DayKey) => { const d = parseDay(day); d.setHours(0, 0, 0, 0); return d; };
  const start = midnight(today), end = midnight(addDays(today, 14));
  const raw = (await Calendar.listEvents(calendars, start, end)).filter(e => String(e.status).toLowerCase() !== 'canceled');
  const declined = await Promise.all(raw.map(e => e.getAttendees()
    .then(people => people.some(a => a.isCurrentUser && String(a.status).toLowerCase() === 'declined'))
    .catch(() => false)));
  const events: CalendarEvent[] = raw.filter((_, i) => !declined[i]).map(e => ({
    title: e.title ?? '', start: new Date(e.startDate).getTime(), end: new Date(e.endDate).getTime(), allDay: !!e.allDay, location: e.location ?? undefined,
  }));
  store().setDayEvents(eventsByDay(events, Array.from({ length: 14 }, (_, i) => addDays(today, i))));
}

// --- Weather -------------------------------------------------------------------------------------

/** Asks for approximate location. Android never sees a request for precise location. */
export async function connectWeather(): Promise<Access> {
  const r = await Location.requestForegroundPermissionsAsync();
  store().setContextPref('weather', r.granted);
  if (r.granted) await refreshWeather(true);
  return access(r);
}

/** Fetches the 10-day forecast unless the cached one is under three hours old for the same place. */
export async function refreshWeather(force = false) {
  if (!CONTEXT_SUPPORTED || !store().contextPrefs.weather || !RELAY) return;
  const { granted } = await Location.getForegroundPermissionsAsync();
  if (!granted) { store().setContextPref('weather', false); return; }
  // A recent cached fix; else a fresh low-accuracy one, which can hang with approximate-only access, so give up
  // after 10 s; else any cached fix — weather only needs the place to about 10 km.
  const fix = await Location.getLastKnownPositionAsync({ maxAge: 6 * 3600 * 1000 })
    ?? await Promise.race([Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }), new Promise<null>(done => setTimeout(() => done(null), 10000))]).catch(() => null)
    ?? await Location.getLastKnownPositionAsync();
  if (!fix) throw new Error('no location fix');
  const lat = coarse(fix.coords.latitude), lon = coarse(fix.coords.longitude), tz = timeZone(), place = lat + ',' + lon + ',' + tz;
  const cached = store().weather;
  if (!force && cached && cached.place === place && Date.now() - cached.fetchedAt < FRESH) return;
  const res = await fetch(RELAY + '?lat=' + lat + '&lon=' + lon + '&tz=' + encodeURIComponent(tz), { headers: ANON ? { Authorization: 'Bearer ' + ANON, apikey: ANON } : {} }).catch(() => null);
  if (!res?.ok) {
    // Offline or the relay is down: keep the last forecast for a day, then stop showing it.
    if (cached && Date.now() - cached.fetchedAt > 24 * 3600 * 1000) store().setWeather(null);
    throw new Error('weather ' + (res?.status ?? 'offline'));
  }
  const body = await res.json() as Pick<WeatherCache, 'days' | 'source' | 'attribution'>;
  store().setWeather({ fetchedAt: Date.now(), place, days: body.days, source: body.source, attribution: body.attribution });
}

/** What the planner knows about each day of the week: the calendar's occasion and the forecast. */
export function weekContext(today: DayKey): Record<DayKey, DayContext> {
  const { dayEvents, weather } = store(), now = Date.now();
  return Object.fromEntries(weekFrom(today).map(day => [day, { occasion: dayEvents[day]?.occasion ?? null, weather: weatherOn(weather, day, now) }]));
}

// --- Morning note ----------------------------------------------------------------------------------

/** Asks to send notifications and schedules the week's morning notes. */
export async function connectMorning(): Promise<Access> {
  const r = await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowSound: false, allowBadge: false } });
  store().setContextPref('morning', r.granted);
  await scheduleMornings();
  return access(r);
}

let setUp: Promise<void> | null = null;
function prepare() {
  setUp ??= (async () => {
    if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync(CHANNEL, { name: 'Morning outfit', importance: Notifications.AndroidImportance.DEFAULT });
    await Notifications.setNotificationCategoryAsync(MORNING_CATEGORY, [{ identifier: WEAR_ACTION, buttonTitle: 'Wearing it', options: { opensAppToForeground: true } }]);
    await Notifications.setNotificationCategoryAsync(SUGGEST_CATEGORY, [{ identifier: WEAR_SUGGESTION, buttonTitle: 'Wear that', options: { opensAppToForeground: true } }]);
  })();
  return setUp;
}

let queued: ReturnType<typeof setTimeout> | null = null, waiting: (() => void)[] = [];
/** Re-schedules the next seven mornings from the current plans, calendar and forecast. Debounced; cheap to call.
 * Every caller's promise settles when the one write that covers it is done. */
export function scheduleMornings() {
  if (!CONTEXT_SUPPORTED) return Promise.resolve();
  if (queued) clearTimeout(queued);
  return new Promise<void>(resolve => {
    waiting.push(resolve);
    queued = setTimeout(() => {
      queued = null;
      const done = waiting;
      waiting = [];
      writeMornings().catch(e => console.warn('FORM morning notes', e)).finally(() => done.forEach(r => r()));
    }, 400);
  });
}

/** Writes the next seven mornings' notes now. A planned day offers Wearing it (unless you already said so); an
 * empty one suggests an outfit picked the way Fill my week would, with Wear that. Also run by the background task. */
export async function writeMornings() {
  if (!CONTEXT_SUPPORTED) return;
  const existing = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(existing.filter(n => n.identifier.startsWith(NOTE_PREFIX)).map(n => Notifications.cancelScheduledNotificationAsync(n.identifier)));
  const { contextPrefs, plans, saved, dayEvents, weather, morningAt } = store();
  if (!contextPrefs.morning) return;
  await prepare();
  const now = new Date(), today = dayKey(now), units = currentUnits();
  const suggested = fillWeek(plans, saved, today, weekContext(today)).plans;
  for (const day of weekFrom(today)) {
    const at = parseDay(day);
    at.setHours(Math.floor(morningAt / 60), morningAt % 60, 0, 0);
    if (at <= now) continue;
    const o = outfitOn(plans, saved, day), line = morningLine(dayEvents[day], weatherOn(weather, day, at.getTime()), units);
    const pick = o ? null : saved.find(s => s.id === suggested[day]?.outfitId) ?? null;
    const confirmed = !!plans[day]?.confirmed;
    await Notifications.scheduleNotificationAsync({
      identifier: NOTE_PREFIX + day,
      content: o ? {
        title: 'Today: ' + o.name,
        body: line || (confirmed ? 'Have a good day.' : 'Tap Wearing it if that’s still the plan.'),
        data: { day, kind: 'morning' },
        ...(confirmed ? {} : { categoryIdentifier: MORNING_CATEGORY }),
      } : pick ? {
        title: 'Nothing planned. ' + pick.look.title + '?',
        body: line || 'Picked from your outfits for today.',
        data: { day, kind: 'morning', suggest: pick.id },
        categoryIdentifier: SUGGEST_CATEGORY,
      } : {
        title: 'Nothing planned for today',
        body: line || 'Make an outfit on Edits, then plan it.',
        data: { day, kind: 'morning' },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: CHANNEL },
    });
  }
}

/** Turns one source off and forgets what it brought in. */
export async function disconnect(key: 'calendar' | 'weather' | 'morning') {
  store().setContextPref(key, false);
  await scheduleMornings();
}
