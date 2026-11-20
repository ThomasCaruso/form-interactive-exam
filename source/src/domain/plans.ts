import type { DayContext } from './context';
import { pieceWord } from './pieceWord';
import type { DayKey, DayOccasion, DayPlan, Product, SavedLook } from './types';

/**
 * Your week: an outfit planned per day. Days are local calendar days stored as 'YYYY-MM-DD' — never Date objects or
 * UTC timestamps, so a plan for Friday stays on Friday through a timezone or daylight-saving change.
 * See docs/superpowers/specs/2026-10-12-outfit-calendar-design.md.
 */
export type Plans = Record<DayKey, DayPlan>;

const DN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const pad = (n: number) => (n < 10 ? '0' : '') + n;

export const dayKey = (d: Date): DayKey => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
/** Local midday, so no daylight-saving shift can move it onto another day. */
export const parseDay = (key: DayKey): Date => { const [y, m, d] = key.split('-').map(Number); return new Date(y, m - 1, d, 12); };
export const addDays = (key: DayKey, n: number): DayKey => { const d = parseDay(key); d.setDate(d.getDate() + n); return dayKey(d); };
export const weekFrom = (today: DayKey): DayKey[] => Array.from({ length: 7 }, (_, i) => addDays(today, i));
export const isPast = (key: DayKey, today: DayKey) => key < today;
export const dayOfMonth = (key: DayKey) => Number(key.slice(8));
export const weekday = (key: DayKey) => DN[parseDay(key).getDay()];
export const weekdayName = (key: DayKey) => FULL[parseDay(key).getDay()];
export const monthName = (key: DayKey) => MONTHS[parseDay(key).getMonth()];
/** 'Today', 'Tomorrow' or 'Tue 13'. */
export const dayLabel = (key: DayKey, today: DayKey) => key === today ? 'Today' : key === addDays(today, 1) ? 'Tomorrow' : weekday(key) + ' ' + dayOfMonth(key);
/** '13 – 19 Oct', or '28 Oct – 3 Nov' across a month. */
export function rangeLabel(from: DayKey, to: DayKey): string {
  const a = monthName(from).slice(0, 3), b = monthName(to).slice(0, 3);
  return a === b ? dayOfMonth(from) + ' – ' + dayOfMonth(to) + ' ' + b : dayOfMonth(from) + ' ' + a + ' – ' + dayOfMonth(to) + ' ' + b;
}
/** The month around `key` as whole Monday-first weeks; days outside the month are null. */
export function monthGrid(key: DayKey): (DayKey | null)[] {
  const first = parseDay(key.slice(0, 8) + '01'), lead = (first.getDay() + 6) % 7;
  const days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const cells: (DayKey | null)[] = Array.from({ length: lead }, () => null);
  for (let d = 1; d <= days; d++) cells.push(key.slice(0, 8) + pad(d));
  while (cells.length % 7) cells.push(null);
  return cells;
}
export const shiftMonth = (key: DayKey, n: number): DayKey => { const d = parseDay(key.slice(0, 8) + '01'); d.setMonth(d.getMonth() + n); return dayKey(d); };

export const OCCASIONS: { id: DayOccasion; label: string }[] = [
  { id: 'work', label: 'Work' }, { id: 'casual', label: 'Casual' }, { id: 'going-out', label: 'Going out' }, { id: 'active', label: 'Active' }, { id: 'formal', label: 'Formal' },
];
export const occasionLabel = (o: DayOccasion | undefined) => OCCASIONS.find(x => x.id === o)?.label ?? '';

export interface DayOutfit { name: string; products: Product[]; tucked?: boolean; outfitId: string | null; worn: boolean }
/** What a day shows: the frozen snapshot once it has passed, else the live outfit it points at. */
export function outfitOn(plans: Plans, saved: readonly SavedLook[], day: DayKey): DayOutfit | null {
  const p = plans[day];
  if (!p) return null;
  if (p.worn) return { ...p.worn, outfitId: p.outfitId, worn: true };
  const s = p.outfitId ? saved.find(x => x.id === p.outfitId) : undefined;
  return s ? { name: s.look.title, products: s.look.products, tucked: s.tucked, outfitId: s.id, worn: false } : null;
}

const empty = (p: DayPlan) => !p.outfitId && !p.worn && !p.occasion && !p.note;

/** Passed days freeze what they showed, so history never changes when an outfit is later edited or deleted.
 * A passed day whose outfit is gone (and has nothing else on it) is dropped. */
export function settlePlans(plans: Plans, saved: readonly SavedLook[], today: DayKey): Plans {
  let changed = false;
  const next: Plans = {};
  for (const [day, p] of Object.entries(plans)) {
    if (!isPast(day, today) || p.worn || !p.outfitId) { next[day] = p; continue; }
    changed = true;
    const s = p.outfitId ? saved.find(x => x.id === p.outfitId) : undefined;
    const settled: DayPlan = s ? { ...p, worn: { name: s.look.title, products: s.look.products.map(x => ({ ...x })), ...(s.tucked ? { tucked: true } : {}) } } : { ...p, outfitId: null };
    if (!empty(settled)) next[day] = settled;
  }
  return changed ? next : plans;
}

/** Deleting an outfit takes it off the days still ahead; passed days keep their snapshot. */
export function clearOutfitFromPlans(plans: Plans, outfitId: string, today: DayKey): { plans: Plans; cleared: Plans } {
  const next: Plans = { ...plans }, cleared: Plans = {};
  for (const [day, p] of Object.entries(plans)) {
    if (p.outfitId !== outfitId || p.worn || isPast(day, today)) continue;
    cleared[day] = p;
    const rest: DayPlan = { ...p, outfitId: null };
    if (empty(rest)) delete next[day]; else next[day] = rest;
  }
  return { plans: Object.keys(cleared).length ? next : plans, cleared };
}

/** The most recent passed day each outfit and each piece was worn. */
export function lastWorn(plans: Plans, saved: readonly SavedLook[], today: DayKey): { outfits: Record<string, DayKey>; products: Record<string, DayKey> } {
  const outfits: Record<string, DayKey> = {}, products: Record<string, DayKey> = {};
  for (const day of Object.keys(plans).sort()) {
    if (!isPast(day, today)) continue;
    const o = outfitOn(plans, saved, day);
    if (!o) continue;
    if (o.outfitId) outfits[o.outfitId] = day;
    for (const p of o.products) products[p.id] = day;
  }
  return { outfits, products };
}

const SLOT_WORD: Record<string, string> = { top: 'top', pants: 'trousers', dress: 'dress', outerwear: 'jacket', shoes: 'shoes', accessory: 'accessory' };

/** One soft line under the picker when a choice repeats: the same outfit or piece on the day before or after, or
 * the outfit worn recently. Never blocks anything. */
export function repeatHint(plans: Plans, saved: readonly SavedLook[], day: DayKey, outfitId: string | null, today: DayKey): string | null {
  const s = outfitId ? saved.find(x => x.id === outfitId) : undefined;
  if (!s) return null;
  for (const n of [addDays(day, -1), addDays(day, 1)]) {
    const o = outfitOn(plans, saved, n);
    if (!o) continue;
    const when = n === today ? 'today' : n === addDays(today, -1) ? 'yesterday' : weekdayName(n);
    if (o.outfitId === s.id) return 'Same outfit as ' + when + '.';
    const shared = s.look.products.find(p => p.slot !== 'accessory' && o.products.some(q => q.id === p.id));
    if (shared) return 'Same ' + pieceWord(shared, SLOT_WORD) + ' as ' + when + '.';
  }
  const last = lastWorn(plans, saved, today).outfits[s.id];
  if (!last) return null;
  const ago = Math.round((parseDay(day).getTime() - parseDay(last).getTime()) / 86400000);
  if (ago <= 7) return 'You wore this last ' + weekdayName(last) + '.';
  if (ago <= 31) return 'Last worn ' + weekday(last) + ' ' + dayOfMonth(last) + ' ' + monthName(last).slice(0, 3) + '.';
  return null;
}

const mean = (xs: number[]) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
/** Average formality, 0 (gym) to 3 (black tie); null when no piece says. */
const formality = (products: readonly Product[]) => mean(products.map(p => p.formality).filter((f): f is number => typeof f === 'number'));
const sporty = (products: readonly Product[]) => products.some(p => /trainer|sneaker|running|jogger|short|track|sport/i.test(p.name + ' ' + (p.styleTags ?? []).join(' ')));
/** How warm an outfit dresses: the warmth of what's on top (0–2 per piece) plus one for a coat. Null without data. */
const warmth = (products: readonly Product[]) => {
  const up = products.filter(p => p.slot === 'top' || p.slot === 'outerwear' || p.slot === 'dress');
  if (!up.some(p => typeof p.warmth === 'number')) return null;
  return up.reduce((n, p) => n + (p.warmth ?? 0), 0) + (up.some(p => p.slot === 'outerwear') ? 1 : 0);
};
/** Outfit warmth a forecast high calls for: 0 for a hot day up to 3 for a cold one. */
export function warmthFor(hi: number) { return hi >= 24 ? 0 : hi >= 17 ? 1 : hi >= 10 ? 2 : 3; }

/** Why an outfit may not suit its day, or null. Only clear misses: two steps off on warmth, a casual outfit on a
 * formal or work day, nothing sporty on an active one. Unknown warmth or formality never counts against it. */
export type DayFit = 'cold' | 'warm' | 'formal' | 'work' | 'active';
export function dayFit(products: readonly Product[], context: DayContext & { occasion?: DayOccasion | null }): DayFit | null {
  const f = formality(products), w = context.weather ? warmth(products) : null;
  if (context.occasion === 'formal' && f !== null && f < 2) return 'formal';
  if (context.occasion === 'work' && f !== null && f < 1) return 'work';
  if (context.occasion === 'active' && !sporty(products)) return 'active';
  if (context.weather && w !== null) {
    const gap = Math.min(w, 3) - warmthFor(context.weather.hi);
    if (gap <= -2) return 'cold';
    if (gap >= 2) return 'warm';
  }
  return null;
}
/** Small deterministic hash, so the same week fills the same way twice. */
const hash = (text: string) => { let h = 2166136261; for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619); return (h >>> 0) / 4294967296; };

/** Plans every empty day of the week from your outfits — no AI, no new clothes. Days you planned stay as they are.
 * Prefers: the day's occasion (yours, else the calendar's), warmth for the forecast, no outfit twice in the week,
 * no piece two days running, least recently worn first. */
export function fillWeek(plans: Plans, saved: readonly SavedLook[], today: DayKey, context: Record<DayKey, DayContext> = {}): { plans: Plans; filled: DayKey[] } {
  const outfits = saved.filter(s => s.look.products.length > 0);
  if (!outfits.length) return { plans, filled: [] };
  const next: Plans = { ...plans }, filled: DayKey[] = [];
  const worn = lastWorn(plans, saved, today);
  for (const day of weekFrom(today)) {
    const p = next[day];
    if (p && outfitOn(next, saved, day)) continue;
    const used = new Set(weekFrom(today).map(d => outfitOn(next, saved, d)?.outfitId).filter(Boolean));
    const near = [addDays(day, -1), addDays(day, 1)].flatMap(d => outfitOn(next, saved, d)?.products.map(x => x.id) ?? []);
    const occasion = p?.occasion ?? context[day]?.occasion ?? undefined, weather = context[day]?.weather;
    const score = (s: SavedLook) => {
      const f = formality(s.look.products) ?? 1;
      let v = 0;
      if (occasion === 'work') v += f >= 1.5 ? 40 : 0;
      else if (occasion === 'formal') v += f >= 2 ? 60 : f * 20;
      else if (occasion === 'going-out') v += f * 15;
      else if (occasion === 'active') v += sporty(s.look.products) ? 40 : 0;
      const w = weather ? warmth(s.look.products) : null;
      if (weather && w !== null) v -= 12 * Math.abs(Math.min(w, 3) - warmthFor(weather.hi));
      if (used.has(s.id)) v -= 100;
      v -= 20 * s.look.products.filter(x => near.includes(x.id)).length;
      const last = worn.outfits[s.id];
      v += last ? Math.min(14, (parseDay(today).getTime() - parseDay(last).getTime()) / 86400000) : 15;
      return v + hash(day + s.id);
    };
    const best = outfits.reduce((a, b) => (score(b) > score(a) ? b : a));
    next[day] = { ...(p ?? {}), outfitId: best.id };
    filled.push(day);
  }
  return { plans: next, filled };
}

/** 'N outfits worn · navy blouson worn most' for the passed days of a month; null when nothing was worn. */
export function monthStat(plans: Plans, saved: readonly SavedLook[], month: DayKey, today: DayKey): string | null {
  const counts = new Map<string, { n: number; name: string }>();
  let worn = 0;
  for (const day of monthGrid(month)) {
    if (!day || !isPast(day, today)) continue;
    const o = outfitOn(plans, saved, day);
    if (!o) continue;
    worn++;
    for (const p of o.products) { const c = counts.get(p.id) ?? { n: 0, name: p.name }; c.n++; counts.set(p.id, c); }
  }
  if (!worn) return null;
  const top = [...counts.values()].sort((a, b) => b.n - a.n)[0];
  return worn + (worn === 1 ? ' outfit worn' : ' outfits worn') + (top && top.n > 1 ? ' · ' + top.name.toLowerCase() + ' worn most' : '');
}
