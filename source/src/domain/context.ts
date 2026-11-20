import { dayKey, type DayFit } from './plans';
import type { DayKey, DayOccasion } from './types';

/** What the planner knows about a day besides your outfits: the calendar (read on this phone, never sent anywhere)
 * and the forecast (from the weather relay, for an approximate place). Everything here is pure and tested. */

export interface CalendarEvent { title: string; start: number; end: number; allDay: boolean; location?: string }
export type Sky = 'clear' | 'partly' | 'cloudy' | 'rain' | 'snow' | 'storm' | 'fog' | 'wind';
export interface WeatherDay { day: DayKey; hi: number; lo: number; rain: number; sky: Sky }
export interface WeatherCache { fetchedAt: number; place: string; days: WeatherDay[]; source: string; attribution: { name: string; url: string } }
/** A day's events, earliest first; `start` is null for an all-day event. The headline is the one that decided the occasion. */
export interface DayEvent { title: string; start: number | null; occasion: DayOccasion | null }
export interface DayEvents { occasion: DayOccasion | null; headline: DayEvent | null; events: DayEvent[] }
export interface DayContext { occasion?: DayOccasion | null; weather?: WeatherDay | null }
/** How this phone shows temperatures and times (expo-localization). Celsius and 24-hour when unknown. */
export interface Units { fahrenheit: boolean; h24: boolean }
export const METRIC: Units = { fahrenheit: false, h24: true };

// Order matters: the first rule that matches an event wins, and a day takes its weightiest event (RANK).
const RULES: [DayOccasion, RegExp][] = [
  ['formal', /\b(wedding|gala|black[- ]tie|funeral|memorial|ceremony|graduation|opera|christening|baptism|awards?|ball|cotillion|bar mitzvah|bat mitzvah)\b/i],
  ['active', /\b(gym|run|running|jog|yoga|pilates|workout|work out|tennis|padel|squash|football|soccer|basketball|hike|hiking|climb|climbing|bouldering|swim|swimming|cycling|spin|crossfit|bootcamp|boxing|golf|5k|10k|marathon|physio)\b/i],
  ['work', /\b(interview|meeting|mtg|presentation|pitch|client|clients|conference|offsite|off-site|onsite|on-site|office|all[- ]hands|board|workshop|stand-?up|sync|1:1|1-1|one[- ]on[- ]one|review|demo|kickoff|kick-off|standup|seminar|townhall|town hall|work)\b/i],
  ['going-out', /\b(dinner|drinks|date night|party|birthday|bar|club|concert|gig|show|theatre|theater|cocktails?|reservation|restaurant|celebration|night out|anniversary|wine|tasting|premiere|opening)\b/i],
  ['casual', /\b(brunch|coffee|lunch|park|picnic|beach|errands?|shopping|market|bbq|barbecue|movie|cinema|museum|gallery|family|kids|playdate|walk|zoo|farmers)\b/i],
];
const RANK: Record<DayOccasion, number> = { formal: 5, work: 4, 'going-out': 3, active: 2, casual: 1 };
/** Calendar entries that say nothing about what to wear. */
const NOISE = /^(ooo|out of office|busy|focus( time)?|blocked?|hold|tentative|reminder|holiday|vacation|pto|commute|home|lunch break|away)$/i;
// Checked before RULES, so a word like "office", "run" or "board" doesn't decide the day on its own.
const NOTHING = /\b(post office|doctor'?s?|dentist|orthodontist|vet|deadline|due|submission|submit|payroll|invoices?|taxes|dry run|run (payroll|through)|run-through|show and tell|(movie|film|book) review|rsvp|buy|gift|pick ?up|drop ?off|call)\b/i;
const CASUAL = /\b(work(ing)? from home|wfh|remote day|at home|ball ?game|board games?|game night|book club)\b/i;

/** The occasion an event suggests, from its title and place. Null when it says nothing about clothes. */
export function classifyEvent(e: Pick<CalendarEvent, 'title' | 'allDay'> & { location?: string }): DayOccasion | null {
  const title = e.title.trim();
  if (!title || NOISE.test(title)) return null;
  // All-day birthdays are other people's; an all-day "party" is still a party.
  if (e.allDay && /\b(birthday|bday)\b/i.test(title) && !/\b(party|dinner|drinks)\b/i.test(title)) return null;
  if (NOTHING.test(title)) return null;
  if (CASUAL.test(title)) return 'casual';
  const text = title + ' ' + (e.location ?? '');
  for (const [occasion, re] of RULES) if (re.test(text)) return occasion;
  return null;
}

const pad = (n: number) => String(n).padStart(2, '0');
/** '9:30' or '9:30 AM', as the phone shows time. '' for an all-day event. */
export function clock(ms: number | null, units: Units = METRIC) {
  if (ms === null) return '';
  const d = new Date(ms), h = d.getHours(), m = ':' + pad(d.getMinutes());
  return units.h24 ? h + m : ((h % 12) || 12) + m + (h < 12 ? ' AM' : ' PM');
}
/** A temperature from the relay (always Celsius) as this phone shows it: '17°' or '63°'. */
export const degrees = (c: number, units: Units = METRIC) => Math.round(units.fahrenheit ? c * 9 / 5 + 32 : c) + '°';

/** Groups events by local day for the given days. All-day and multi-day events count on every day they cover. */
export function eventsByDay(events: readonly CalendarEvent[], days: readonly DayKey[]): Record<DayKey, DayEvents> {
  const out: Record<DayKey, DayEvents> = {};
  for (const day of days) {
    const on = events.filter(e => {
      // All-day events end at the following midnight; timed ones end when they end.
      const first = dayKey(new Date(e.start)), last = dayKey(new Date(e.allDay ? e.end - 1 : Math.max(e.start, e.end - 1)));
      return e.allDay ? first <= day && day <= last : first === day;
    }).sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.start - b.start);
    if (!on.length) continue;
    const listed: DayEvent[] = on.map(e => ({ title: e.title.trim(), start: e.allDay ? null : e.start, occasion: classifyEvent(e) })).filter(e => e.title);
    const lead = listed.reduce<DayEvent | null>((best, e) => (e.occasion && (!best?.occasion || RANK[e.occasion] > RANK[best.occasion]) ? e : best), null);
    out[day] = { occasion: lead?.occasion ?? null, headline: lead, events: listed };
  }
  return out;
}

const SKY_WORD: Record<Sky, string> = { clear: 'Clear', partly: 'Partly cloudy', cloudy: 'Cloudy', rain: 'Rain', snow: 'Snow', storm: 'Storms', fog: 'Fog', wind: 'Windy' };
export const isWet = (w: WeatherDay) => w.sky === 'rain' || w.sky === 'storm' || w.sky === 'snow' || w.rain >= 0.4;
/** 'Rain likely', 'Clear'. Rain is named when it is the sky or the chance is at least 40%. */
export const skyWord = (w: WeatherDay) => isWet(w) ? (w.sky === 'snow' ? 'Snow' : w.sky === 'storm' ? 'Storms' : 'Rain') + (w.rain >= 0.7 ? '' : ' likely') : SKY_WORD[w.sky];
/** '17° · Rain likely', '24° · Clear'. */
export const weatherLine = (w: WeatherDay, units: Units = METRIC) => degrees(w.hi, units) + ' · ' + skyWord(w);

/** The forecast for a day, when the cache has it — and, given `now`, only when it is less than a day old. */
export function weatherOn(cache: WeatherCache | null | undefined, day: DayKey, now?: number): WeatherDay | null {
  if (!cache || (now !== undefined && now - cache.fetchedAt > 24 * 3600 * 1000)) return null;
  return cache.days.find(d => d.day === day) ?? null;
}

/** Rounds a coordinate to 0.1° (about 10 km) — the only location detail that ever leaves the phone. */
export const coarse = (n: number) => Math.round(n * 10) / 10;

/** 'Client meeting · 9:30', or the title alone for an all-day event. */
export const eventLine = (e: DayEvent, units: Units = METRIC) => e.title + (e.start === null ? '' : ' · ' + clock(e.start, units));

/** The body of the morning note: 'Client meeting at 9:30 · 17° · Rain likely'. */
export function morningLine(events: DayEvents | undefined, weather: WeatherDay | null, units: Units = METRIC) {
  const h = events?.headline;
  return [h ? h.title + (h.start === null ? '' : ' at ' + clock(h.start, units)) : '', weather ? weatherLine(weather, units) : ''].filter(Boolean).join(' · ');
}

/** The line under a day whose outfit may not suit it (plans.dayFit). */
export function fitLine(fit: DayFit, weather: WeatherDay | null | undefined, units: Units = METRIC) {
  switch (fit) {
    case 'cold': return 'Light for ' + (weather ? degrees(weather.hi, units) : 'the cold') + '. Add a layer?';
    case 'warm': return 'Warm for ' + (weather ? degrees(weather.hi, units) : 'the day') + '.';
    case 'formal': return 'Dressier day than this outfit.';
    case 'work': return 'Casual for a work day.';
    case 'active': return 'Nothing sporty for an active day.';
  }
}
