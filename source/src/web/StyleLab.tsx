import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { Image, View } from 'react-native';
import { OutfitStage, type StageNeighbours } from '../components/tryOn/OutfitStage';
import { CUTOUT_PAD, cutouts } from '../data/cutouts';
import { realCatalogProducts } from '../data/realCatalog';
import { completeLooks } from '../domain/completeLooks';
import type { StageSlot } from '../domain/outfitLayout';
import { stepRail } from '../domain/outfitRead';
import { formatMoney } from '../domain/selectors';
import { applyFit, applyTaste, firstRunProfile, tasteChips, tasteDeck } from '../domain/taste';
import type { Product, Profile, ShopFor } from '../domain/types';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { useFormStore } from '../state/store';
import { colors } from '../theme/tokens';
import { family } from '../theme/typography';

/** The landing page as one live scene. Real catalogue pieces drift in; drag one onto the figure to wear it, flick it
 * away to pass. Every answer goes through the app's own taste model and styling engine, the outfit re-dresses, the
 * colour field and headline follow, and after eight answers the edit is ready and the app opens already set up.
 * Nothing leaves the browser; the weather is fetched only if the visitor asks for it. */

// ---------- The moment: local clock, season, and (only on request) the weather ----------
type Weather = { temp: number; unit: 'C' | 'F'; sky: string; lat: number };
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SEASONS = ['winter', 'winter', 'early spring', 'spring', 'late spring', 'early summer', 'summer', 'late summer', 'early autumn', 'autumn', 'late autumn', 'winter'];
const SOUTH_ZONES = /^(Australia|Antarctica|Pacific\/(Auckland|Chatham|Fiji)|America\/(Sao_Paulo|Argentina|Santiago|Montevideo|Asuncion|Lima|La_Paz)|Africa\/(Johannesburg|Maputo|Harare|Windhoek|Lusaka|Gaborone))/;
function moment(now: Date, weather: Weather | null) {
  let zone = '';
  try { zone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? ''; } catch {}
  const south = weather ? weather.lat < 0 : SOUTH_ZONES.test(zone);
  const season = SEASONS[(now.getMonth() + (south ? 6 : 0)) % 12];
  const h = now.getHours();
  const part = h < 5 ? 'night' : h < 12 ? 'morning' : h < 17 ? 'afternoon' : h < 21 ? 'evening' : 'night';
  const time = `${h % 12 || 12}:${String(now.getMinutes()).padStart(2, '0')}`;
  const adjective = weather ? weather.sky : season.replace(' ', '-');
  const article = /^[aeiou]/.test(adjective) ? 'an' : 'a';
  const date = now.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' }).toUpperCase().replace(',', '');
  return {
    sentence: `It’s ${time} on ${article} ${adjective} ${DAYS[now.getDay()]} ${part}.`,
    stamp: [date, `${time} ${h < 12 ? 'AM' : 'PM'}`, season.toUpperCase(), weather ? `${weather.temp}°${weather.unit} ${weather.sky.toUpperCase()}` : ''].filter(Boolean).join('  ·  '),
  };
}
function skyWord(code: number, wind: number) {
  if (code >= 95) return 'stormy';
  if (code >= 71 && code <= 86 && !(code >= 80 && code <= 82)) return 'snowy';
  if (code >= 51) return 'wet';
  if (code === 45 || code === 48) return 'misty';
  if (wind > 32) return 'windy';
  if (code === 3) return 'grey';
  if (code >= 1) return 'soft, bright';
  return 'clear';
}
async function localWeather(): Promise<Weather> {
  const pos = await new Promise<GeolocationPosition>((ok, no) => navigator.geolocation.getCurrentPosition(ok, no, { timeout: 12000, maximumAge: 600000 }));
  // Rounded to about a kilometre; sent only to Open-Meteo for the forecast.
  const lat = Math.round(pos.coords.latitude * 100) / 100, lon = Math.round(pos.coords.longitude * 100) / 100;
  const unit = /-US$|-LR$|-MM$/.test(navigator.language) ? 'F' : 'C';
  const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,wind_speed_10m${unit === 'F' ? '&temperature_unit=fahrenheit' : ''}`);
  const c = (await r.json()).current;
  return { temp: Math.round(c.temperature_2m), unit, sky: skyWord(c.weather_code, c.wind_speed_10m), lat };
}

// ---------- Styling: the app's own taste model and engine ----------
const STAGED: Product['slot'][] = ['top', 'dress', 'pants', 'shoes'];
const staged = (p: Product) => STAGED.includes(p.slot) && !!cutouts[p.id];
const RAILS = Object.fromEntries((['top', 'dress', 'pants', 'shoes'] as const).map(s => [s, realCatalogProducts.filter(p => p.slot === s && staged(p))])) as Record<string, Product[]>;
const shopFor = (liked: Product[]): ShopFor => {
  const w = liked.some(p => p.department === 'womens'), m = liked.some(p => p.department === 'mens');
  return w && !m ? 'womens' : m && !w ? 'mens' : 'both';
};
const complete = (ps: Product[]) => ps.some(p => p.slot === 'shoes') && (ps.some(p => p.slot === 'dress') || (ps.some(p => p.slot === 'top') && ps.some(p => p.slot === 'pants')));
/** Puts one piece on: a dress replaces top and trousers, a top or trousers replace a dress and get a partner. */
function wear(outfit: Product[], piece: Product): Product[] {
  let out = outfit.filter(p => p.slot !== piece.slot && p.id !== piece.id);
  if (piece.slot === 'dress') out = out.filter(p => p.slot !== 'top' && p.slot !== 'pants');
  if (piece.slot === 'top' || piece.slot === 'pants') {
    out = out.filter(p => p.slot !== 'dress');
    const need = piece.slot === 'top' ? 'pants' : 'top';
    if (!out.some(p => p.slot === need)) {
      const partner = RAILS[need].find(p => p.department === piece.department) ?? RAILS[need][0];
      if (partner) out.push(partner);
    }
  }
  return [...out, piece];
}
function engineLooks(base: Profile, liked: Product[], passed: Product[]) {
  try { return completeLooks(applyTaste(firstRunProfile(base, shopFor(liked)), liked, passed), { liked, passed }); } catch { return []; }
}
/** The engine's best complete look for what it has learned, then everything said yes to put back on, newest last. */
function restyle(base: Profile, liked: Product[], passed: Product[], current: Product[]) {
  const looks = engineLooks(base, liked, passed);
  const newest = liked[liked.length - 1];
  const pick = looks.find(l => newest && l.products.some(p => p.id === newest.id)) ?? looks[0];
  let next = (pick?.products ?? []).filter(staged);
  if (!complete(next)) next = current;
  for (const p of liked) next = wear(next, p);
  return { outfit: next, looks: looks.length };
}

// ---------- Small colour helpers ----------
const PAPER = [243, 240, 234];
const rgb = (hex?: string) => { const m = /^#?([0-9a-f]{6})$/i.exec(hex ?? ''); if (!m) return [214, 203, 186]; const n = parseInt(m[1], 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
const soften = (c: number[], k: number) => c.map((v, i) => v + (PAPER[i] - v) * k);
const DEFAULT_FIELD = ['#D9CBB5', '#E7DCCB', '#CDBBA2', '#EDE6DA', '#D3C6B4'];

// ---------- Floating pieces ----------
type Mode = 'enter' | 'float' | 'drag' | 'fling' | 'wear';
type Body = { x: number; y: number; vx: number; vy: number; r: number; vr: number; s: number; o: number; mode: Mode; t: number;
  gx: number; gy: number; fx: number; fy: number; tx: number; ty: number; seed: number; hover: boolean; el: HTMLDivElement | null };
type Sample = { x: number; y: number; t: number };
/** A steady 0–1 number per piece, so each one drifts in its own way. */
const seedOf = (id: string) => [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 9973, 7) / 9973;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const ease = (t: number) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

type Props = { onStart: () => void };
/** Four answers are enough for a first edit: two womenswear, two menswear. The full quiz is still under Get started. */
const ANSWERS = 4;

export function StyleLab({ width: W, height: H, onStart }: Props & { width: number; height: number }) {
  const router = useRouter();
  const reduced = useReduceMotion();
  const base = useFormStore(s => s.profile);
  const finishOnboarding = useFormStore(s => s.finishOnboarding);
  const deck = useMemo(() => tasteDeck('both').filter(p => cutouts[p.id]).slice(0, ANSWERS), []);
  const [liked, setLiked] = useState<Product[]>([]), [passed, setPassed] = useState<Product[]>([]);
  const [leaving, setLeaving] = useState<string[]>([]);
  const [outfit, setOutfit] = useState<Product[]>(() => restyle(base, [], [], []).outfit);
  const [tucked, setTucked] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [weather, setWeather] = useState<Weather | null>(null), [asking, setAsking] = useState<'idle' | 'busy' | 'no'>('idle');
  const [pulse, setPulse] = useState(0);
  const [hint, setHint] = useState(true);
  useEffect(() => { const id = setInterval(() => setNow(new Date()), 20000); return () => clearInterval(id); }, []);

  const decided = useMemo(() => new Set([...liked, ...passed].map(p => p.id)), [liked, passed]);
  const queue = deck.filter(p => !decided.has(p.id)).slice(0, 1);
  const front = queue[0];
  const done = liked.length + passed.length >= deck.length;
  const shown = [...queue, ...leaving.map(id => deck.find(p => p.id === id)!).filter(p => p && !queue.includes(p))];

  // ---------- Geometry ----------
  const pad = W >= 1280 ? 64 : 40;
  const leftW = Math.round(W * 0.34);
  const fh = Math.round(Math.min(H - 110, 760)), fw = Math.round(Math.min(fh * 0.6, W * 0.3));
  const fx = Math.round(pad + leftW + Math.max(24, W * 0.03)), fy = Math.round((H - fh) / 2 - 8);
  const zoneL = fx + fw + 28, zoneR = W - pad, zoneW = zoneR - zoneL, zoneC = (zoneL + zoneR) / 2;
  const anchors = [
    { x: zoneC, y: H * 0.34, s: 1 },
    { x: zoneC - zoneW * 0.22, y: H * 0.79, s: 0.56 },
    { x: zoneC + zoneW * 0.24, y: H * 0.83, s: 0.5 },
  ];
  const sizeOf = (p: Product) => {
    const aspect = cutouts[p.id]?.aspect ?? 1, area = Math.pow(Math.min(zoneW * 0.62, H * 0.3), 2);
    let w = Math.sqrt(area / aspect), h = w * aspect;
    const k = Math.min(1, (zoneW * 0.86) / w, (H * 0.36) / h);
    w *= k; h *= k;
    return { w: Math.round(w), h: Math.round(h) };
  };

  // Everything the frame loop needs, refreshed every render.
  const geo = useRef({ W, H, fx, fy, fw, fh, anchors, queue: queue.map(p => p.id), reduced });
  const sizes = useRef(new Map<string, { w: number; h: number }>());
  const shownSizes = shown.map(p => [p.id, sizeOf(p)] as const);
  useLayoutEffect(() => {
    geo.current = { W, H, fx, fy, fw, fh, anchors, queue: queue.map(p => p.id), reduced };
    shownSizes.forEach(([id, size]) => sizes.current.set(id, size));
  });

  // ---------- Decisions ----------
  const latest = useRef({ liked, passed, outfit, base });
  useLayoutEffect(() => { latest.current = { liked, passed, outfit, base }; });
  const decide = useCallback((p: Product, yes: boolean, fling?: { vx: number; vy: number }) => {
    const b = bodies.current.get(p.id);
    if (b) {
      b.mode = yes ? 'wear' : 'fling'; b.t = 0; b.fx = b.x; b.fy = b.y;
      const g = geo.current;
      if (yes) { b.tx = g.fx + g.fw / 2; b.ty = g.fy + g.fh * (p.slot === 'shoes' ? 0.9 : p.slot === 'pants' ? 0.63 : p.slot === 'dress' ? 0.45 : 0.3); }
      else { b.vx = fling?.vx ?? 1700; b.vy = fling?.vy ?? -420; b.vr = clamp(b.vx * 0.35, -720, 720); }
    }
    setHint(false);
    setLeaving(l => l.includes(p.id) ? l : [...l, p.id]);
    const { liked: L, passed: P, outfit: O, base: B } = latest.current;
    const nextLiked = yes ? [...L, p] : L, nextPassed = yes ? P : [...P, p];
    if (yes) setLiked(nextLiked); else setPassed(nextPassed);
    // The figure re-dresses as the piece lands.
    setTimeout(() => {
      const r = restyle(B, nextLiked, nextPassed, O);
      setOutfit(r.outfit);
      if (yes) setPulse(n => n + 1);
    }, yes && !geo.current.reduced ? 260 : 0);
  }, []);

  // ---------- The frame loop: pieces, figure tilt, cursor, colour field, kinetic type ----------
  const bodies = useRef(new Map<string, Body>());
  const scene = useRef<HTMLDivElement | null>(null), figure = useRef<HTMLDivElement | null>(null), halo = useRef<HTMLDivElement | null>(null);
  const cursor = useRef<HTMLDivElement | null>(null), cursorLabel = useRef<HTMLSpanElement | null>(null), canvas = useRef<HTMLCanvasElement | null>(null);
  const headline = useRef<HTMLDivElement | null>(null);
  const pointer = useRef({ x: -999, y: -999, cx: -999, cy: -999, inside: false, label: '' });
  const drag = useRef<{ id: string; samples: Sample[]; start: Sample } | null>(null);
  const active = useRef(true);
  const chars = useRef<{ el: HTMLElement; x: number; y: number; k: number }[]>([]);
  const fieldTarget = useRef<number[][]>(DEFAULT_FIELD.map(rgb));
  useFocusEffect(useCallback(() => { active.current = true; return () => { active.current = false; }; }, []));

  const register = (id: string) => (el: HTMLDivElement | null) => {
    let b = bodies.current.get(id);
    if (!b && el) {
      const i = Math.max(0, geo.current.queue.indexOf(id)), a = geo.current.anchors[i] ?? geo.current.anchors[0];
      b = { x: geo.current.W + 260, y: a.y + (seedOf(id) - 0.5) * 120, vx: -900, vy: 0, r: 18, vr: 0, s: a.s, o: 1, mode: 'enter', t: 0,
        gx: 0, gy: 0, fx: 0, fy: 0, tx: 0, ty: 0, seed: seedOf(id) * 10, hover: false, el };
      if (geo.current.reduced) { b.x = a.x; b.y = a.y; b.vx = 0; b.r = 0; }
      bodies.current.set(id, b);
    }
    if (b) b.el = el;
  };

  useEffect(() => {
    let raf = 0, last = performance.now(), clock = 0;
    const blobs = DEFAULT_FIELD.map((h, i) => ({ c: rgb(h), seed: i * 1.7 + 0.3 }));
    const tick = (t: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.033, (t - last) / 1000); last = t;
      if (!active.current || document.hidden) return;
      clock += dt;
      const g = geo.current, ptr = pointer.current, calm = g.reduced;
      ptr.cx += (ptr.x - ptr.cx) * (calm ? 1 : 0.24); ptr.cy += (ptr.y - ptr.cy) * (calm ? 1 : 0.24);
      const sceneRect = scene.current?.getBoundingClientRect();
      const ox = sceneRect?.left ?? 0, oy = sceneRect?.top ?? 0;
      const mx = ptr.x - ox, my = ptr.y - oy;
      const nx = ptr.inside ? clamp(mx / g.W - 0.5, -0.5, 0.5) : 0, ny = ptr.inside ? clamp(my / g.H - 0.5, -0.5, 0.5) : 0;

      // Pieces.
      const held = drag.current;
      let hot = false;
      for (const [id, b] of bodies.current) {
        const size = sizes.current.get(id);
        if (!b.el || !size) continue;
        const slot = g.queue.indexOf(id), a = g.anchors[Math.max(0, slot)] ?? g.anchors[0];
        if (b.mode === 'drag') {
          const tx = mx - b.gx, ty = my - b.gy;
          b.vx += ((tx - b.x) * 700 - b.vx * 46) * dt; b.vy += ((ty - b.y) * 700 - b.vy * 46) * dt;
          b.x += b.vx * dt; b.y += b.vy * dt;
          const swing = clamp(-b.vx * 0.018, -24, 24);
          b.vr += ((swing - b.r) * 140 - b.vr * 16) * dt; b.r += b.vr * dt;
          b.s += (1.06 - b.s) * Math.min(1, dt * 14);
          hot = mx > g.fx - 30 && mx < g.fx + g.fw + 30 && my > g.fy && my < g.fy + g.fh;
        } else if (b.mode === 'fling') {
          b.vy += 900 * dt; b.vx *= 0.996; b.x += b.vx * dt; b.y += b.vy * dt; b.r += b.vr * dt; b.o = Math.max(0, b.o - dt * 1.4);
          if (b.o <= 0 || b.x < -600 || b.x > g.W + 600 || b.y > g.H + 600) { bodies.current.delete(id); setLeaving(l => l.filter(x => x !== id)); continue; }
        } else if (b.mode === 'wear') {
          b.t += dt / (calm ? 0.12 : 0.42);
          const k = ease(Math.min(1, b.t));
          b.x = b.fx + (b.tx - b.fx) * k; b.y = b.fy + (b.ty - b.fy) * k - Math.sin(k * Math.PI) * 60;
          b.r *= 0.86; b.s = 1 - 0.45 * k; b.o = 1 - clamp((k - 0.55) / 0.45, 0, 1);
          if (b.t >= 1) { bodies.current.delete(id); setLeaving(l => l.filter(x => x !== id)); continue; }
        } else {
          // Floating at its place in the queue, breathing, leaning away from the cursor a little.
          const bob = calm ? 0 : Math.sin(clock * 1.1 + b.seed) * 7, sway = calm ? 0 : Math.cos(clock * 0.7 + b.seed) * 5;
          const tx = a.x + sway - nx * 26 * a.s, ty = a.y + bob - ny * 18 * a.s;
          const k = b.mode === 'enter' ? 90 : 70, c = b.mode === 'enter' ? 15 : 13;
          b.vx += ((tx - b.x) * k - b.vx * c) * dt; b.vy += ((ty - b.y) * k - b.vy * c) * dt;
          b.x += b.vx * dt; b.y += b.vy * dt;
          const tr = calm ? 0 : clamp(-b.vx * 0.012, -16, 16) + Math.sin(clock * 0.6 + b.seed) * 2.2;
          b.vr += ((tr - b.r) * 90 - b.vr * 13) * dt; b.r += b.vr * dt;
          const ts = a.s * (b.hover && slot >= 0 ? 1.05 : 1);
          b.s += (ts - b.s) * Math.min(1, dt * 9);
          b.o += ((slot === 0 ? 1 : 0.9) - b.o) * Math.min(1, dt * 6);
          if (b.mode === 'enter' && Math.abs(tx - b.x) < 30) b.mode = 'float';
        }
        b.el.style.transform = `translate3d(${b.x - size.w / 2}px, ${b.y - size.h / 2}px, 0) rotate(${b.r}deg) scale(${b.s})`;
        b.el.style.opacity = String(b.o);
        b.el.style.zIndex = b.mode === 'drag' || b.mode === 'wear' ? '30' : slot === 0 ? '12' : '11';
        b.el.dataset.lift = b.mode === 'drag' ? '1' : '0';
      }

      // The figure turns toward the cursor, and opens up when a piece is held over it.
      if (figure.current) {
        const ry = calm ? 0 : nx * 9, rx = calm ? 0 : -ny * 5;
        figure.current.style.transform = `perspective(1400px) rotateY(${ry}deg) rotateX(${rx}deg) scale(${hot ? 1.025 : 1})`;
        figure.current.dataset.hot = hot ? '1' : '0';
      }
      if (halo.current) { halo.current.style.opacity = String(held ? (hot ? 1 : 0.65) : 0.38); halo.current.style.transform = `translate(${nx * -30}px, ${ny * -20}px) scale(${hot ? 1.12 : 1})`; }

      // Cursor.
      if (cursor.current) {
        const label = held ? (hot ? 'Wear it' : 'Flick to pass') : ptr.label;
        cursor.current.style.transform = `translate3d(${ptr.cx}px, ${ptr.cy}px, 0)`;
        cursor.current.dataset.state = held ? (hot ? 'wear' : 'drag') : label ? 'label' : 'idle';
        cursor.current.style.opacity = ptr.inside ? '1' : '0';
        if (cursorLabel.current && cursorLabel.current.textContent !== label) cursorLabel.current.textContent = label;
      }

      // Kinetic headline: letters near the cursor lift and lean away.
      if (!calm) for (const ch of chars.current) {
        const dx = ptr.cx - ch.x, dy = ptr.cy - ch.y, d = Math.hypot(dx, dy);
        const k = ptr.inside ? Math.max(0, 1 - d / 230) : 0;
        if (Math.abs(k - ch.k) < 0.002) continue;
        ch.k = k;
        ch.el.style.transform = k ? `translate(${-dx * k * 0.1}px, ${-dy * k * 0.1 - k * 9}px) scaleY(${1 + k * 0.16}) skewX(${-dx / 230 * k * 12}deg)` : '';
      }

      // Colour field: slow blobs, easing toward the colours chosen so far, one of them following the cursor.
      const cv = canvas.current, ctx = cv?.getContext('2d');
      if (cv && ctx) {
        const w = cv.width, h = cv.height, targets = fieldTarget.current;
        ctx.fillStyle = 'rgb(243,240,234)'; ctx.fillRect(0, 0, w, h);
        blobs.forEach((bl, i) => {
          const tc = targets[i % targets.length];
          bl.c = bl.c.map((v, j) => v + (tc[j] - v) * Math.min(1, dt * 1.4));
          const s = bl.seed, sp = calm ? 0 : clock;
          let x = w * (0.5 + 0.38 * Math.sin(sp * 0.11 + s * 2.1)), y = h * (0.5 + 0.36 * Math.cos(sp * 0.09 + s * 1.3));
          if (i === 0 && ptr.inside) { x = x * 0.4 + (mx / g.W) * w * 0.6; y = y * 0.4 + (my / g.H) * h * 0.6; }
          const rad = Math.max(w, h) * (0.42 + 0.08 * Math.sin(sp * 0.3 + s));
          const grd = ctx.createRadialGradient(x, y, 0, x, y, rad);
          const [r, gg, bb] = bl.c.map(Math.round);
          grd.addColorStop(0, `rgba(${r},${gg},${bb},0.95)`); grd.addColorStop(1, `rgba(${r},${gg},${bb},0)`);
          ctx.fillStyle = grd; ctx.fillRect(0, 0, w, h);
        });
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Colour targets: what was said yes to, then what is on the figure, softened toward the paper.
  useEffect(() => {
    const hexes = [...liked.slice(-4).reverse().map(p => p.hex), ...outfit.map(p => p.hex)].filter(Boolean) as string[];
    const list = (hexes.length ? hexes : DEFAULT_FIELD).map(h => soften(rgb(h), liked.length ? 0.4 : 0.38));
    while (list.length < 5) list.push(list[list.length % Math.max(1, list.length)]);
    fieldTarget.current = list.slice(0, 5);
  }, [liked, outfit]);

  // Pointer tracking across the scene, and dragging.
  useEffect(() => {
    const move = (e: PointerEvent) => {
      const p = pointer.current; p.x = e.clientX; p.y = e.clientY; p.inside = !!scene.current?.contains(e.target as Node) || !!drag.current;
      if (p.cx < -900) { p.cx = p.x; p.cy = p.y; }
      const d = drag.current;
      if (d) { d.samples.push({ x: e.clientX, y: e.clientY, t: performance.now() }); if (d.samples.length > 8) d.samples.shift(); }
    };
    const up = (e: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      drag.current = null;
      const b = bodies.current.get(d.id), p = deck.find(x => x.id === d.id);
      if (!b || !p) return;
      const rect = scene.current?.getBoundingClientRect(), mx = e.clientX - (rect?.left ?? 0), my = e.clientY - (rect?.top ?? 0);
      const g = geo.current;
      // Speed over the last moments of the drag; on a slow frame that may be only the last two events.
      const at = performance.now(), recent = d.samples.filter(x => at - x.t < 120);
      const s = recent.length >= 2 ? recent : d.samples.length >= 2 && at - d.samples[d.samples.length - 1].t < 250 ? d.samples.slice(-2) : [];
      const first = s[0], lastS = s[s.length - 1];
      const dtS = first && lastS && lastS.t > first.t ? (lastS.t - first.t) / 1000 : 0;
      const vx = dtS ? (lastS.x - first.x) / dtS : 0, vy = dtS ? (lastS.y - first.y) / dtS : 0;
      const over = mx > g.fx - 30 && mx < g.fx + g.fw + 30 && my > g.fy && my < g.fy + g.fh;
      // A toss: fast at the end, or a quick throw overall (slow frames can merge the last moves into one).
      const took = (at - d.start.t) / 1000, thrown = Math.hypot(e.clientX - d.start.x, e.clientY - d.start.y);
      const tossed = took < 0.45 && thrown > 120;
      if (!over && tossed && Math.hypot(vx, vy) < 700) decide(p, false, { vx: clamp((e.clientX - d.start.x) / took, -3200, 3200), vy: clamp((e.clientY - d.start.y) / took, -2400, 2400) });
      else if (over) decide(p, true);
      else if (Math.hypot(vx, vy) > 700) decide(p, false, { vx: clamp(vx, -3200, 3200), vy: clamp(vy, -2400, 2400) });
      else b.mode = 'float';
    };
    const over = (e: PointerEvent) => {
      const t = (e.target as HTMLElement | null)?.closest?.('[data-cursor]') as HTMLElement | null;
      pointer.current.label = t?.dataset.cursor ?? '';
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up); window.addEventListener('pointerover', over);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); window.removeEventListener('pointerover', over); };
  }, [deck, decide]);

  const grab = (id: string) => (e: ReactPointerEvent<HTMLDivElement>) => {
    const b = bodies.current.get(id), rect = scene.current?.getBoundingClientRect();
    if (!b || !rect || b.mode === 'fling' || b.mode === 'wear' || !geo.current.queue.includes(id)) return;
    e.preventDefault();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
    b.mode = 'drag'; b.gx = e.clientX - rect.left - b.x; b.gy = e.clientY - rect.top - b.y;
    const start = { x: e.clientX, y: e.clientY, t: performance.now() };
    drag.current = { id, samples: [start], start };
    setHint(false);
  };

  // Keyboard: right arrow wears the piece in front, left arrow passes.
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (!active.current || !front || (e.target as HTMLElement)?.closest?.('input, textarea')) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); decide(front, true); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); decide(front, false); }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [front, decide]);

  // ---------- Words ----------
  const m = moment(now, weather);
  const chips = tasteChips(liked, 3);
  // The headline is what it has learned, one trait a line; the last line, in italic, is how sure it is.
  const lines: string[] = done ? ['Your edit', 'is ready.']
    : liked.length ? [...chips.slice(0, 2).map(c => c + '.'), liked.length < 2 ? 'Getting warmer.' : 'That’s you.']
    : passed.length ? ['Not that.', 'Noted.'] : ['Let’s', 'dress you.'];
  const left = deck.length - liked.length - passed.length;
  const kicker = !liked.length && !passed.length ? m.sentence : done ? 'Complete looks, sized and priced.' : `${left} to go.`;
  const headKey = lines.join('|');
  const longest = Math.max(...lines.map(l => l.length));
  const headFit = Math.round(clamp(Math.min(leftW / (Math.max(9, longest) * 0.4), H / 6.6, H * 0.46 / lines.length / 0.92, 132), 40, 132));
  useEffect(() => {
    const id = setTimeout(() => {
      chars.current = [...(headline.current?.querySelectorAll<HTMLElement>('.lab-ch') ?? [])].map(el => { const r = el.getBoundingClientRect(); return { el, x: r.left + r.width / 2, y: r.top + r.height / 2, k: 0 }; });
    }, 60);
    return () => clearTimeout(id);
  }, [headKey, W, H]);


  // ---------- The figure: the app's real outfit stage ----------
  const onSwap = useCallback((slot: StageSlot, dir: 1 | -1) => {
    let ok = false;
    setOutfit(o => {
      const cur = o.find(p => p.slot === slot), next = stepRail(RAILS[slot] ?? [], cur?.id, dir);
      if (!cur || !next || next.id === cur.id) return o;
      ok = true;
      return o.map(p => p.slot === slot ? next : p);
    });
    return ok || !!RAILS[slot]?.length;
  }, []);
  const neighbours = useMemo(() => {
    const out: StageNeighbours = {};
    for (const p of outfit) { const rail = RAILS[p.slot] ?? []; out[p.slot as StageSlot] = { prev: stepRail(rail, p.id, -1), next: stepRail(rail, p.id, 1) }; }
    return out;
  }, [outfit]);

  const askWeather = async () => {
    if (asking === 'busy' || weather) return;
    setAsking('busy');
    try { setWeather(await localWeather()); setAsking('idle'); } catch { setAsking('no'); }
  };
  const finish = () => {
    const profile = applyFit(applyTaste(firstRunProfile(base, shopFor(liked)), liked, passed), 'M', 'regular');
    if (finishOnboarding(profile, [])) router.replace('/home'); else onStart();
  };
  const restart = () => { bodies.current.clear(); setLiked([]); setPassed([]); setLeaving([]); setHint(true); setOutfit(restyle(base, [], [], []).outfit); };

  const accent = liked.length ? liked[liked.length - 1].hex : outfit[0]?.hex;
  const [ar, ag, ab] = soften(rgb(accent), 0.15).map(Math.round);
  const frontSize = front ? sizeOf(front) : { w: 0, h: 0 };

  return <div ref={scene} className="lab" style={{ width: W, height: H, ['--serif' as string]: family.serif, ['--italic' as string]: family.serifItalic, ['--sans' as string]: family.sans, ['--sansm' as string]: family.sansMedium } as CSSProperties}>
    <style>{CSS}</style>
    <canvas ref={canvas} width={Math.ceil(W / 10)} height={Math.ceil(H / 10)} className="lab-field" aria-hidden />
    <div className="lab-grain" aria-hidden />

    {/* Left: the moment, the rewriting headline, and what it has learned. */}
    <div className="lab-copy" style={{ left: pad, top: Math.max(36, H * 0.07), width: leftW }}>
      <div className="lab-stamp">{m.stamp}{!weather && <button type="button" className="lab-link" data-cursor="Ask" onClick={askWeather}>
        {asking === 'busy' ? 'Checking the sky…' : asking === 'no' ? 'No weather — clock it is' : 'Use my weather ↗'}</button>}</div>
      <p key={kicker} className="lab-kicker">{kicker}</p>
      <div ref={headline} key={headKey} className="lab-head" role="heading" aria-level={1} aria-label={lines.join(' ')} style={{ fontSize: headFit }}>
        {lines.map((line, li) => <div key={li} className={li === lines.length - 1 ? 'lab-line lab-it' : 'lab-line'}>
          {line.split(' ').map((word, wi) => <span key={wi} className="lab-word">
            {[...word].map((c, ci) => <span key={ci} className="lab-ch"><span className="lab-ci" style={{ animationDelay: `${(li * 14 + wi * 4 + ci) * 16}ms` }}>{c}</span></span>)}
          </span>).flatMap((w, wi) => wi ? [' ', w] : [w])}
        </div>)}
      </div>
    </div>
    <div className="lab-readout" style={{ left: pad, bottom: Math.max(28, H * 0.07), width: Math.min(leftW, 260) }}>
      <div className="lab-ticks" aria-label={`${liked.length + passed.length} of ${deck.length} answered`}>
        {deck.map(p => <span key={p.id} className={liked.includes(p) ? 'on' : passed.includes(p) ? 'no' : ''} />)}
      </div>
    </div>

    {/* The figure. */}
    <div ref={halo} className="lab-halo" aria-hidden style={{ left: fx - fw * 0.35, top: fy - fh * 0.05, width: fw * 1.7, height: fh * 1.1, background: `radial-gradient(closest-side, rgba(${ar},${ag},${ab},0.55), rgba(${ar},${ag},${ab},0))` }} />
    <div className="lab-plinth" aria-hidden style={{ left: fx + fw * 0.12, top: fy + fh - 18, width: fw * 0.76 }} />
    <div ref={figure} className="lab-figure" style={{ left: fx, top: fy, width: fw, height: fh }} data-cursor="Swipe">
      <View style={{ width: fw, height: fh }}>
        <OutfitStage bare products={outfit} tucked={tucked} onToggleTuck={() => setTucked(t => !t)} onSwap={onSwap} onRemove={() => {}} neighbours={neighbours} />
      </View>
      {pulse > 0 && <div key={pulse} className="lab-pulse" aria-hidden />}
    </div>

    {/* Right: the pieces, waiting their turn. */}
    {shown.map(p => {
      const cut = cutouts[p.id], s = sizeOf(p), mpad = CUTOUT_PAD * s.w;
      return <div key={p.id} ref={register(p.id)} className="lab-piece" data-lab="piece" data-cursor={p === front ? 'Drag me' : 'Up next'} aria-hidden
        onPointerDown={grab(p.id)} onPointerEnter={() => { const b = bodies.current.get(p.id); if (b) b.hover = true; }} onPointerLeave={() => { const b = bodies.current.get(p.id); if (b) b.hover = false; }}
        style={{ width: s.w, height: s.h, transform: `translate3d(${W + 400}px, ${H / 2}px, 0)` }}>
        <div className="lab-shadow" />
        {cut && <Image source={cut.source} style={{ position: 'absolute', left: -mpad, top: -mpad, width: s.w + 2 * mpad, height: s.h + 2 * mpad }} />}
      </div>;
    })}
    {!done && front && <div className="lab-meta" style={{ left: zoneL, width: zoneW, top: anchors[0].y + Math.min(frontSize.h / 2, H * 0.18) + 26 }}>
      <div key={front.id} className="lab-name"><small>{(front.brand ?? 'MUJI').toUpperCase()} · {formatMoney(front.priceCents)}</small><b>{front.name}</b></div>
      <div className="lab-actions">
        <button type="button" className="lab-btn" data-cursor="Pass" onClick={() => decide(front, false)}>← Pass</button>
        <button type="button" className="lab-btn dark" data-cursor="Wear" onClick={() => decide(front, true)}>Wear it →</button>
      </div>
    </div>}
    {hint && !done && <div className="lab-hint" style={{ left: zoneL - 40, width: zoneW + 40, top: H * 0.06 + 26 }} aria-hidden>
      Drag it onto the figure to wear it. <em>Flick it away to pass.</em>
    </div>}
    {hint && !done && !reduced && <svg className="lab-arrow" aria-hidden width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      <path d={`M ${zoneC - frontSize.w * 0.45} ${anchors[0].y - 10} C ${zoneC - frontSize.w * 0.9} ${H * 0.18}, ${fx + fw * 0.9} ${H * 0.16}, ${fx + fw * 0.66} ${fy + fh * 0.24}`} />
    </svg>}

    {done && <div className="lab-done" style={{ left: zoneL, width: zoneW, top: H * 0.4 }}>
      <button type="button" className="lab-cta" data-cursor="Open" onClick={finish}>See my looks <span>→</span></button>
      <button type="button" className="lab-link" data-cursor="Again" onClick={restart}>Start again</button>
    </div>}
    <div ref={cursor} className="lab-cursor" aria-hidden><span ref={cursorLabel} /></div>
  </div>;
}

const CSS = `
.lab { position: relative; overflow: hidden; background: ${colors.paper}; color: ${colors.ink}; user-select: none; -webkit-user-select: none; }
@media (pointer: fine) { .lab, .lab * { cursor: none !important; } }
.lab-field { position: absolute; inset: 0; width: 100%; height: 100%; filter: blur(28px) saturate(1.08); transform: scale(1.12); }
.lab-grain { position: absolute; inset: -50%; pointer-events: none; opacity: .09; mix-blend-mode: multiply; z-index: 40;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  animation: lab-grain 1s steps(6) infinite; }
@keyframes lab-grain { 0% { transform: translate(0,0) } 20% { transform: translate(-3%,2%) } 40% { transform: translate(2%,-3%) } 60% { transform: translate(-2%,-1%) } 80% { transform: translate(3%,3%) } 100% { transform: translate(0,0) } }
.lab-copy { position: absolute; z-index: 5; pointer-events: none; }
.lab-copy button { pointer-events: auto; }
.lab-stamp { font: 11px/1.6 var(--sansm); letter-spacing: .22em; color: ${colors.ink2}; display: flex; flex-wrap: wrap; gap: 6px 18px; align-items: center; }
.lab-link { font: 13px var(--sansm); letter-spacing: .02em; color: ${colors.ink}; background: rgba(248,246,241,.55); border: 1px solid rgba(22,21,18,.18); border-radius: 99px; padding: 7px 14px; backdrop-filter: blur(8px); transition: background .2s, border-color .2s; }
.lab-link:hover { background: ${colors.card}; border-color: ${colors.ink}; }
.lab-kicker { font: 26px/1.2 var(--italic); color: ${colors.ink2}; margin: 26px 0 0; animation: lab-fade .7s both; max-width: 96%; }
.lab-head { font-family: var(--serif); line-height: .9; letter-spacing: -.025em; margin-top: 22px; }
.lab-line { display: block; } .lab-it { font-family: var(--italic); }
.lab-word { display: inline-block; white-space: nowrap; }
.lab-ch { display: inline-block; transform-origin: 50% 85%; transition: transform .25s cubic-bezier(.2,.8,.2,1); will-change: transform; }
.lab-ci { display: inline-block; animation: lab-in .8s cubic-bezier(.2,.8,.2,1) both; }
@keyframes lab-in { from { opacity: 0; transform: translateY(.42em) rotate(4deg); filter: blur(10px); } to { opacity: 1; transform: none; filter: blur(0); } }
@keyframes lab-fade { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
.lab-readout { position: absolute; z-index: 5; }
.lab-ticks { display: flex; gap: 6px; margin-bottom: 18px; }
.lab-ticks span { flex: 1; height: 3px; border-radius: 3px; background: rgba(22,21,18,.14); transition: background .4s; position: relative; overflow: hidden; }
.lab-ticks span.on { background: ${colors.ink}; }
.lab-ticks span.no { background: repeating-linear-gradient(90deg, rgba(22,21,18,.5) 0 3px, transparent 3px 6px); }
.lab-grid { display: grid; grid-template-columns: 1.15fr 1fr 0.7fr 1fr; gap: 16px; border-top: 1px solid rgba(22,21,18,.16); padding-top: 14px; }
.lab-grid small { display: block; font: 9.5px var(--sansm); letter-spacing: .2em; color: ${colors.muted}; }
.lab-grid b { display: block; font: 400 19px/1.15 var(--serif); margin-top: 6px; animation: lab-fade .5s both; }
.lab-swatches { display: flex; gap: 5px; margin-top: 8px; }
.lab-swatches i { width: 18px; height: 18px; border-radius: 50%; border: 1px dashed rgba(22,21,18,.28); }
.lab-swatches i.on { border: 1px solid rgba(22,21,18,.2); animation: lab-pop .6s cubic-bezier(.3,1.6,.5,1) both; }
@keyframes lab-pop { from { transform: scale(0); } to { transform: scale(1); } }
.lab-halo { position: absolute; z-index: 1; pointer-events: none; transition: opacity .4s, transform .6s cubic-bezier(.2,.8,.2,1); }
.lab-plinth { position: absolute; z-index: 2; height: 30px; border-radius: 50%; background: radial-gradient(closest-side, rgba(28,22,16,.22), rgba(28,22,16,0)); }
.lab-figure { position: absolute; z-index: 3; transform-style: preserve-3d; transition: filter .3s; }
.lab-figure::before { content: ''; position: absolute; inset: -14px -24px; border-radius: 28px; border: 1.5px dashed rgba(22,21,18,0); transition: border-color .25s; pointer-events: none; }
.lab-figure[data-hot="1"]::before { border-color: rgba(22,21,18,.45); }
.lab-figlabel { position: absolute; top: -26px; left: 0; right: 0; display: flex; justify-content: space-between; font: 10px var(--sansm); letter-spacing: .22em; color: ${colors.ink2}; }
.lab-read { position: absolute; left: -20px; right: -20px; bottom: -40px; text-align: center; font: 19px var(--italic); color: ${colors.ink2}; margin: 0; animation: lab-fade .6s both; }
.lab-pulse { position: absolute; left: 50%; top: 50%; width: 120%; aspect-ratio: 1; border-radius: 50%; pointer-events: none; transform: translate(-50%,-50%) scale(.2);
  border: 2px solid rgba(22,21,18,.35); animation: lab-pulse .9s cubic-bezier(.2,.8,.2,1) forwards; }
@keyframes lab-pulse { to { transform: translate(-50%,-50%) scale(1.15); opacity: 0; } }
.lab-piece { position: absolute; left: 0; top: 0; z-index: 11; touch-action: none; will-change: transform; transform-origin: 50% 30%; }
.lab-piece img { pointer-events: none; -webkit-user-drag: none; }
.lab-shadow { position: absolute; left: 12%; right: 12%; bottom: -22px; height: 26px; border-radius: 50%; background: radial-gradient(closest-side, rgba(28,22,16,.26), rgba(28,22,16,0)); transition: transform .3s, opacity .3s; }
.lab-piece[data-lift="1"] .lab-shadow { transform: translateY(38px) scale(.8); opacity: .55; }
.lab-meta { position: absolute; z-index: 14; text-align: center; }
.lab-name { animation: lab-fade .5s both; }
.lab-name small { font: 10px var(--sansm); letter-spacing: .2em; color: ${colors.muted}; }
.lab-name b { display: block; font: 400 24px/1.1 var(--serif); margin-top: 6px; }
.lab-actions { display: flex; gap: 10px; justify-content: center; margin-top: 16px; }
.lab-btn { height: 44px; padding: 0 20px; border-radius: 99px; font: 14px var(--sansm); border: 1px solid rgba(22,21,18,.22); background: rgba(248,246,241,.6); color: ${colors.ink}; backdrop-filter: blur(8px); transition: transform .2s, background .2s; }
.lab-btn:hover { transform: translateY(-2px); background: ${colors.card}; }
.lab-btn.dark { background: ${colors.ink}; color: ${colors.paper}; border-color: ${colors.ink}; }
.lab-btn:focus-visible, .lab-link:focus-visible, .lab-cta:focus-visible { outline: 2px solid ${colors.ink}; outline-offset: 3px; }
.lab-count { position: absolute; z-index: 5; display: flex; justify-content: space-between; font: 10px var(--sansm); letter-spacing: .22em; color: ${colors.ink2}; border-bottom: 1px solid rgba(22,21,18,.16); padding-bottom: 10px; }
.lab-hint { position: absolute; z-index: 6; text-align: right; font: 17px/1.3 var(--italic); color: ${colors.ink2}; animation: lab-fade .8s .9s both; pointer-events: none; }
.lab-hint em { color: ${colors.muted}; }
.lab-arrow { position: absolute; left: 0; top: 0; z-index: 4; pointer-events: none; overflow: visible; }
.lab-arrow path { fill: none; stroke: rgba(22,21,18,.45); stroke-width: 1.4; stroke-dasharray: 5 7; animation: lab-dash 1.2s linear infinite, lab-fade 1s 1.4s both; }
@keyframes lab-dash { to { stroke-dashoffset: -24; } }
.lab-done { position: absolute; z-index: 14; animation: lab-fade .8s .2s both; }
.lab-done small { font: 10px var(--sansm); letter-spacing: .22em; color: ${colors.ink2}; }
.lab-done h2 { font: 400 46px/.98 var(--serif); letter-spacing: -.02em; margin: 14px 0 0; }
.lab-done h2 em { font-family: var(--italic); font-style: normal; }
.lab-done p { font: 14.5px/1.55 var(--sans); color: ${colors.ink2}; margin: 18px 0 26px; }
.lab-done .lab-link { display: block; margin: 16px 0 0; }
.lab-cta { display: inline-flex; align-items: center; gap: 12px; height: 58px; padding: 0 26px; border-radius: 99px; border: 0; background: ${colors.ink}; color: ${colors.paper}; font: 15px var(--sansm);
  box-shadow: 0 18px 40px -18px rgba(22,21,18,.6); transition: transform .25s cubic-bezier(.2,.8,.2,1); animation: lab-glow 2.4s ease-in-out infinite; }
.lab-cta:hover { transform: translateY(-2px) scale(1.02); } .lab-cta span { transition: transform .2s; } .lab-cta:hover span { transform: translateX(4px); }
@keyframes lab-glow { 50% { box-shadow: 0 18px 50px -12px rgba(22,21,18,.75); } }
.lab-foot { position: absolute; z-index: 5; text-align: right; font: 12px var(--sans); color: ${colors.muted}; }
.lab-cursor { position: fixed; left: 0; top: 0; z-index: 1000; pointer-events: none; width: 0; height: 0; transition: opacity .2s; }
.lab-cursor::before { content: ''; position: absolute; left: -6px; top: -6px; width: 12px; height: 12px; border-radius: 50%; background: ${colors.ink};
  transition: all .35s cubic-bezier(.2,.8,.2,1); }
.lab-cursor span { position: absolute; left: 0; top: 0; transform: translate(-50%,-50%); font: 11.5px var(--sansm); letter-spacing: .06em; white-space: nowrap; color: ${colors.paper}; opacity: 0; transition: opacity .2s; }
.lab-cursor[data-state="label"]::before { left: -36px; top: -36px; width: 72px; height: 72px; background: rgba(22,21,18,.88); }
.lab-cursor[data-state="drag"]::before { left: -46px; top: -46px; width: 92px; height: 92px; background: rgba(22,21,18,.82); }
.lab-cursor[data-state="wear"]::before { left: -54px; top: -54px; width: 108px; height: 108px; background: ${colors.ink}; box-shadow: 0 0 0 8px rgba(22,21,18,.12); }
.lab-cursor[data-state="label"] span, .lab-cursor[data-state="drag"] span, .lab-cursor[data-state="wear"] span { opacity: 1; }
@media (pointer: coarse) { .lab-cursor { display: none; } }
@media (prefers-reduced-motion: reduce) { .lab-grain, .lab-ci, .lab-arrow path, .lab-cta { animation: none !important; } }
`;
