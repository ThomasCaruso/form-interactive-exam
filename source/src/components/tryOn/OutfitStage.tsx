import { LinearGradient } from 'expo-linear-gradient';
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Image, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useFrameCallback, useSharedValue, type SharedValue } from 'react-native-reanimated';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';
import { scheduleOnRN, scheduleOnUI } from 'react-native-worklets';
import { CUTOUT_PAD, cutouts } from '../../data/cutouts';
import { isUserUpload } from '../../domain/garments';
import { layoutOutfit, STAGE_SLOTS, type PieceBox, type StageSlot } from '../../domain/outfitLayout';
import { stagePieceFor } from '../../domain/outfitRead';
import type { Product } from '../../domain/types';
import { useReduceMotion } from '../../hooks/useReduceMotion';
import { colors } from '../../theme/tokens';
import { family } from '../../theme/typography';
import { tactile } from '../../utils/haptics';
import { LocalPhoto } from '../LocalPhoto';
import { MotionPressable } from '../MotionPressable';
import { ProductVisual } from '../ProductVisual';

/** Each piece is a heavily damped spring hanging from the one above it, so the outfit follows a drag and
 * settles without wobbling. Everything moves on the UI thread; JavaScript only hears about swaps. */
type Phys = { x: number; vx: number; y: number; vy: number; r: number; vr: number; s: number; vs: number; o: number; fly: number };
type Physics = Record<StageSlot, Phys>;
const NUDGE = 0.06;
const NEAR: Record<StageSlot, readonly StageSlot[]> = { outerwear: ['top', 'dress'], top: ['outerwear', 'pants'], dress: ['outerwear', 'shoes'], pants: ['top', 'shoes'], shoes: ['pants', 'dress'] };
/** `sx`/`sy`: where the touch began on screen, so a scroll that starts on a piece isn't taken for a tap. */
type Drag = { slot: StageSlot | null; held: boolean; dx: number; dy: number; sx: number; sy: number };
/** Press and hold a piece for a closer look: after `HOLD_S` it lifts and grows until you let go. */
type Lift = { slot: StageSlot | null; t: number; on: boolean };
const HOLD_S = 0.32;
const still = (): Phys => { 'worklet'; return { x: 0, vx: 0, y: 0, vy: 0, r: 0, vr: 0, s: 1, vs: 0, o: 1, fly: 0 }; };
const gone = (): Phys => { 'worklet'; return { x: 0, vx: 0, y: 0, vy: 0, r: 0, vr: 0, s: 1, vs: 0, o: 0, fly: 0 }; };
const flyStep = (p: Phys, dt: number) => { 'worklet'; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 1.02; p.vy *= 1.02; p.r += p.vr * dt; p.o = Math.max(0, p.o - dt * 5); };
// How high each layer sits above the floor: higher layers cast longer, softer shadows.
const LIFT: Record<StageSlot, number> = { outerwear: 1.2, top: 1, dress: 1, pants: 0.55, shoes: 0.12 };
const SHADOW = '#1C1610';
const FLY_MS = 190, STAGGER_MS = 110, EXIT_MS = 420;
/** The piece leaving after a swap: drawn by its own layer so the new one can come in at the same time. */
type Outgoing = { product: Product; box: PieceBox; under: boolean; token: number };
/** A piece one swipe away, already drawn (hidden) where it would stand, so a swipe can bring it in on the UI thread
 * without waiting for the app to save the change and redraw. */
type Arrival = { slot: StageSlot; dir: 1 | -1; product: Product; box: PieceBox; under: boolean };
export type StageNeighbours = Partial<Record<StageSlot, { prev?: Product; next?: Product }>>;
const arrivalKey = (slot: StageSlot, dir: number) => { 'worklet'; return slot + (dir > 0 ? '+' : '-'); };

export function OutfitStage({ products, tucked, onToggleTuck, onSwap, onRemove, scrollable = false, neighbours, bare = false }: {
  products: Product[];
  /** No backdrop or rounded plate: the outfit stands straight on whatever is behind it (the website's landing). */
  bare?: boolean; tucked: boolean; onToggleTuck: () => void;
  /** What a swipe on each slot brings (`next` for a right swipe or a tap, `prev` for a left swipe). Must match what
   * `onSwap` puts on. Those pieces are decoded and laid out ahead, so a swap shows the moment you let go. */
  neighbours?: StageNeighbours;
  /** Inside a scrolling page: only sideways drags move pieces, so vertical swipes scroll (no swipe-down to remove). */
  scrollable?: boolean;
  /** Return false when there was nothing else to change to, so the piece comes back. */
  onSwap: (slot: StageSlot, dir: 1 | -1) => boolean; onRemove: (slot: StageSlot) => void;
}) {
  const reduced = useReduceMotion();
  const [size, setSize] = useState({ width: 0, height: 0 });
  const pieces = useMemo(() => products.map(p => [p, stagePieceFor(p, cutouts)] as const).filter((x): x is readonly [Product, NonNullable<typeof x[1]>] => !!x[1]), [products]);
  const layout = useMemo(() => layoutOutfit(pieces.map(x => x[1]), tucked, size), [pieces, tucked, size]);
  const productOf = (id: string) => pieces.find(x => x[0].id === id)![0];
  // Where each neighbour would stand if it were swapped in: layout maths only.
  const arrivals = useMemo(() => {
    const out: Arrival[] = [];
    for (const [, piece] of pieces) for (const dir of [1, -1] as const) {
      const product = dir > 0 ? neighbours?.[piece.slot]?.next : neighbours?.[piece.slot]?.prev;
      const next = product && stagePieceFor(product, cutouts);
      if (!product || !next || out.some(a => a.product.id === product.id)) continue;
      const after = layoutOutfit(pieces.map(x => x[1].slot === piece.slot ? next : x[1]), tucked, size);
      const box = after.boxes.find(b => b.slot === piece.slot);
      if (box) out.push({ slot: piece.slot, dir, product, box, under: piece.slot === 'pants' && after.tucked });
    }
    return out;
  }, [pieces, neighbours, tucked, size]);

  const phys = useSharedValue<Physics>({ outerwear: still(), top: still(), dress: still(), pants: still(), shoes: still() });
  const exit = useSharedValue<Physics>({ outerwear: gone(), top: gone(), dress: gone(), pants: gone(), shoes: gone() });
  const [outgoing, setOutgoing] = useState<Partial<Record<StageSlot, Outgoing>>>({});
  const inc = useSharedValue<Record<string, Phys>>({});
  const arrivalIds = useSharedValue<Record<string, string>>({});
  const stageW = useSharedValue(0);
  // An arrival on its way in stays drawn by the same layer until the stage adopts it, even once it is no longer a
  // neighbour (the swap has landed).
  const [flying, setFlying] = useState<Partial<Record<StageSlot, Arrival>>>({});
  useEffect(() => { arrivalIds.set(Object.fromEntries(arrivals.map(a => [arrivalKey(a.slot, a.dir), a.product.id]))); }, [arrivalIds, arrivals]);
  useEffect(() => { stageW.set(size.width); }, [stageW, size.width]);
  const drag = useSharedValue<Drag>({ slot: null, held: false, dx: 0, dy: 0, sx: 0, sy: 0 });
  const lift = useSharedValue<Lift>({ slot: null, t: 0, on: false });
  const lifted = () => { tactile('selection'); };
  const boxes = useSharedValue<PieceBox[]>([]);
  const calm = useSharedValue(reduced);
  // How much a held piece grows: shoes most (they are the smallest), nothing wider than the stage.
  const liftScale = (slot: StageSlot) => {
    'worklet';
    const b = boxes.get().find(x => x.slot === slot);
    return b ? Math.max(1.12, Math.min(slot === 'shoes' ? 1.6 : 1.3, stageW.get() * 0.9 / b.w)) : 1;
  };
  useEffect(() => { boxes.set(layout.boxes); }, [boxes, layout.boxes]);
  useEffect(() => { calm.set(reduced); }, [calm, reduced]);

  useFrameCallback(frame => {
    'worklet';
    const P = phys.get(), d = drag.get();
    const dt = Math.min(0.032, (frame.timeSincePreviousFrame ?? 16) / 1000);
    let moving = !!d.slot && d.held;
    const l = lift.get();
    if (d.slot && !d.held && !l.on && !calm.get()) {
      const t = l.t + dt;
      if (t >= HOLD_S) { lift.set({ slot: d.slot, t, on: true }); scheduleOnRN(lifted); } else lift.set({ slot: d.slot, t, on: false });
    }
    if (l.on) moving = true;
    for (const k of STAGE_SLOTS) { const p = P[k]; if (p.fly || Math.abs(p.x) + Math.abs(p.vx) + Math.abs(p.y) + Math.abs(p.vy) + Math.abs(p.r) + Math.abs(p.vr) + Math.abs(p.s - 1) + Math.abs(p.vs) > 0.02) moving = true; }
    const E = exit.get();
    if (STAGE_SLOTS.some(k => E[k].fly)) exit.modify(X => { 'worklet'; for (const k of STAGE_SLOTS) if (X[k].fly) { flyStep(X[k], dt); if (!X[k].o) X[k].fly = 0; } return X; });
    // Arrivals spring to their place the same way a piece settles after a drag.
    const I = inc.get();
    if (Object.keys(I).some(k => I[k].o > 0 && Math.abs(I[k].x) + Math.abs(I[k].vx) > 0.02)) inc.modify(J => {
      'worklet';
      for (const k of Object.keys(J)) {
        const p = J[k];
        if (!p.o) continue;
        p.vx += (-p.x * 150 - p.vx * 22) * dt; p.x += p.vx * dt;
        const lean = Math.max(-0.6, Math.min(0.6, -p.vx * 0.004));
        p.vr += ((lean - p.r) * 160 - p.vr * 24) * dt; p.r += p.vr * dt;
        if (Math.abs(p.x) + Math.abs(p.vx) < 0.02) Object.assign(p, { x: 0, vx: 0, r: 0, vr: 0 });
      }
      return J;
    });
    if (!moving) return;
    phys.modify(Q => {
      'worklet';
      const held = (k: StageSlot) => d.held && d.slot === k;
      // Only the dragged piece follows the finger. Its direct neighbours shift a few percent, as if the outfit were
      // one thing; nothing is passed further along.
      const nudge = (k: StageSlot) => d.held && d.slot !== null && NEAR[d.slot].includes(k) ? d.dx * NUDGE : 0;
      const target: Record<StageSlot, number> = {
        outerwear: held('outerwear') ? d.dx : nudge('outerwear'),
        top: held('top') ? d.dx : nudge('top'),
        dress: held('dress') ? d.dx : nudge('dress'),
        pants: held('pants') ? d.dx : nudge('pants'),
        shoes: held('shoes') ? d.dx : nudge('shoes'),
      };
      for (const k of STAGE_SLOTS) {
        const p = Q[k], h = held(k);
        if (p.fly) { flyStep(p, dt); continue; }
        if (calm.get()) { p.x = h ? d.dx : 0; p.y = 0; p.r = 0; p.s = 1; p.vx = p.vy = p.vr = p.vs = 0; continue; }
        const lean = k === 'shoes' ? 0 : Math.max(-0.6, Math.min(0.6, -p.vx * 0.004));
        const up = l.on && l.slot === k;
        const tr = h ? p.x * 0.015 : lean, ty = h ? d.dy * 0.15 : 0, ts = up ? liftScale(k) : h ? 1.02 : 1;
        p.vx += ((target[k] - p.x) * (h ? 900 : 150) - p.vx * (h ? 50 : 22)) * dt; p.x += p.vx * dt;
        p.vr += ((tr - p.r) * 160 - p.vr * 24) * dt; p.r += p.vr * dt;
        p.vy += ((ty - p.y) * 180 - p.vy * 25) * dt; p.y += p.vy * dt;
        p.vs += ((ts - p.s) * 220 - p.vs * 28) * dt; p.s += p.vs * dt;
        if (!h && Math.abs(p.x) + Math.abs(p.vx) + Math.abs(p.y) + Math.abs(p.vy) + Math.abs(p.r) + Math.abs(p.vr) + Math.abs(p.s - 1) + Math.abs(p.vs) < 0.02) Object.assign(p, { x: 0, vx: 0, y: 0, vy: 0, r: 0, vr: 0, s: 1, vs: 0 });
      }
      return Q;
    });
  });

  // ---- Swaps. The swap starts the moment you let go: the piece you flung is handed to its slot's exit layer (same
  // picture, same place) and flies off the way you swiped, while the next one slides in from the other side.
  // Removal (swipe down) still flies the piece itself and then takes it off.
  const lastDir = useRef<Partial<Record<StageSlot, 1 | -1>>>({});
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const later = (fn: () => void, ms: number) => { timers.current.push(setTimeout(fn, ms)); };
  const hide = (slot: StageSlot) => { 'worklet'; phys.modify(P => { 'worklet'; Object.assign(P[slot], gone()); return P; }); };
  const dropIn = (slot: StageSlot, dir: number, quiet: boolean) => {
    'worklet';
    phys.modify(P => {
      'worklet';
      Object.assign(P[slot], still(), quiet ? {} : { x: -dir * 8, y: -16, s: 1.02 });
      if (!quiet) { const order: StageSlot[] = ['outerwear', 'top', 'dress', 'pants', 'shoes']; order.slice(order.indexOf(slot) + 1).forEach((k, i) => { P[k].vy += 35 / (i + 1); }); }
      return P;
    });
  };
  /** Comes in from the side opposite the swipe (swipe left: it arrives from the right), fast at first, no overshoot. */
  const enter = (slot: StageSlot, dir: number, width: number, quiet: boolean) => {
    'worklet';
    phys.modify(P => { 'worklet'; Object.assign(P[slot], still(), quiet ? {} : { x: -dir * width, vx: dir * width * 6 }); return P; });
  };
  /** Hands the flung piece to the exit layer: it carries on the way it was thrown, rotating the same way. */
  const handOff = (slot: StageSlot, dirX: number) => {
    'worklet';
    const p = phys.get()[slot];
    const speed = Math.max(1100, Math.abs(p.vx));
    exit.modify(E => { 'worklet'; Object.assign(E[slot], { x: p.x, y: p.y, r: p.r, s: p.s, vs: 0, o: 1, fly: 1, vx: dirX * speed, vy: 0, vr: dirX * 70 }); return E; });
    phys.modify(P => { 'worklet'; Object.assign(P[slot], gone()); return P; });
  };
  /** Nothing else to change to: the piece comes back from where it got to. */
  const bringBack = (slot: StageSlot) => {
    'worklet';
    const e = exit.get()[slot];
    phys.modify(P => { 'worklet'; Object.assign(P[slot], still(), { x: e.x, r: e.r }); return P; });
    exit.modify(E => { 'worklet'; Object.assign(E[slot], gone()); return E; });
  };
  /** Starts the neighbour in from the side opposite the swipe. Returns its id, or '' when none was ready. */
  const launchArrival = (slot: StageSlot, dir: number) => {
    'worklet';
    const id = arrivalIds.get()[arrivalKey(slot, dir)];
    if (!id) return '';
    const width = stageW.get();
    inc.modify(I => { 'worklet'; I[id] = Object.assign(still(), calm.get() ? {} : { x: -dir * width, vx: dir * width * 6 }); return I; });
    return id;
  };
  /** The swap has landed with the piece that is arriving: the slot's own layer takes it over where it is. */
  const adopt = (slot: StageSlot, id: string, dir: number, width: number, quiet: boolean) => {
    'worklet';
    const a = inc.get()[id];
    if (!a || !a.o) { enter(slot, dir, width, quiet); return; }
    phys.modify(P => { 'worklet'; Object.assign(P[slot], still(), { x: a.x, vx: a.vx, r: a.r, vr: a.vr }); return P; });
    inc.modify(I => { 'worklet'; I[id] = gone(); return I; });
  };
  const dropArrival = (id: string) => { 'worklet'; inc.modify(I => { 'worklet'; if (I[id]) I[id] = gone(); return I; }); };
  /** Still hidden half a second after a swap (it ended on the same piece): bring it in anyway. */
  const revive = (slot: StageSlot, dir: number, width: number, quiet: boolean) => { 'worklet'; const p = phys.get()[slot]; if (p.fly || !p.o) enter(slot, dir, width, quiet); };
  // The gesture may hold on to an older render, so the latest handlers and layout are read from a ref.
  const latest = useRef({ onSwap, onRemove, layout, pieces, arrivals, width: size.width });
  useLayoutEffect(() => { latest.current = { onSwap, onRemove, layout, pieces, arrivals, width: size.width }; });
  const predicted = useRef<Partial<Record<StageSlot, string>>>({});
  const token = useRef(0);
  const swapped = (slot: StageSlot, dirX: number, arrivingId: string) => {
    const { layout: now, pieces: on, width } = latest.current;
    const arrival = arrivingId ? latest.current.arrivals.find(a => a.product.id === arrivingId) : undefined;
    if (arrival) { predicted.current[slot] = arrivingId; setFlying(f => ({ ...f, [slot]: arrival })); }
    const box = now.boxes.find(b => b.slot === slot), product = on.find(x => x[1].slot === slot)?.[0];
    const mine = ++token.current;
    // Frozen in the same render as the swap, so the leaving layer keeps the old picture.
    if (box && product) setOutgoing(o => ({ ...o, [slot]: { product, box, under: slot === 'pants' && now.tucked, token: mine } }));
    lastDir.current[slot] = dirX as 1 | -1;
    if (!latest.current.onSwap(slot, dirX as 1 | -1)) {
      lastDir.current[slot] = undefined;
      scheduleOnUI(bringBack, slot);
      if (arrivingId) { scheduleOnUI(dropArrival, arrivingId); predicted.current[slot] = undefined; setFlying(f => ({ ...f, [slot]: undefined })); }
    } else later(() => scheduleOnUI(revive, slot, dirX, width, reduced), 500);
    later(() => setOutgoing(o => o[slot]?.token === mine ? { ...o, [slot]: undefined } : o), EXIT_MS);
  };
  const removed = (slot: StageSlot) => { later(() => latest.current.onRemove(slot), reduced ? 0 : FLY_MS); };
  const fly = (slot: StageSlot, dirX: number, dirY: number) => {
    'worklet';
    if (dirY) {
      phys.modify(P => { 'worklet'; const p = P[slot]; p.fly = 1; p.vx = 0; p.vy = dirY * 900; p.vr = 0; return P; });
      scheduleOnRN(removed, slot);
      return;
    }
    handOff(slot, dirX);
    scheduleOnRN(swapped, slot, dirX, launchArrival(slot, dirX));
  };
  const ids = useRef<Partial<Record<StageSlot, string>>>({}), mounted = useRef(false);
  useLayoutEffect(() => {
    const now: Partial<Record<StageSlot, string>> = {};
    for (const [p, piece] of pieces) now[piece.slot] = p.id;
    const changed = STAGE_SLOTS.filter(s => now[s] && now[s] !== ids.current[s]);
    ids.current = now;
    if (!mounted.current) { mounted.current = true; return; }
    if (!changed.length) return;
    // A swipe brings its one piece in from the side straight away; anything else (shuffle, another outfit) drops in.
    const dropped = changed.filter(s => !lastDir.current[s]);
    for (const s of changed.filter(c => lastDir.current[c])) {
      const id = predicted.current[s];
      if (id && id === now[s]) scheduleOnUI(adopt, s, id, lastDir.current[s]!, size.width, reduced);
      else { if (id) scheduleOnUI(dropArrival, id); scheduleOnUI(enter, s, lastDir.current[s]!, size.width, reduced); }
      later(() => setFlying(f => f[s]?.product.id === id ? { ...f, [s]: undefined } : f), 150);
    }
    predicted.current = {};
    dropped.forEach(s => scheduleOnUI(hide, s));
    dropped.forEach((s, i) => later(() => scheduleOnUI(dropIn, s, 1, reduced), reduced ? 0 : i * STAGGER_MS));
    tactile('selection');
    lastDir.current = {};
  }, [pieces]); // eslint-disable-line react-hooks/exhaustive-deps

  const pan = usePanGesture({
    // Inside a scrolling page, a vertical drag fails the pan so the page scrolls.
    activeOffsetX: scrollable ? [-10, 10] : undefined, failOffsetY: scrollable ? [-12, 12] : undefined, minDistance: scrollable ? undefined : 6, maxPointers: 1,
    onBegin: event => {
      'worklet';
      const P = phys.get(), list = boxes.get();
      let hit: StageSlot | null = null;
      for (let i = list.length - 1; i >= 0 && !hit; i--) {
        const b = list[i], p = P[b.slot];
        if (!p.fly && event.x >= b.x + p.x - 6 && event.x <= b.x + p.x + b.w + 6 && event.y >= b.y + p.y && event.y <= b.y + p.y + b.h) hit = b.slot;
      }
      drag.set({ slot: hit, held: false, dx: 0, dy: 0, sx: event.absoluteX, sy: event.absoluteY });
      lift.set({ slot: null, t: 0, on: false });
    },
    onActivate: () => { 'worklet'; const d = drag.get(); if (d.slot) drag.set({ ...d, held: true }); },
    onUpdate: event => { 'worklet'; const d = drag.get(); if (d.slot) drag.set({ ...d, dx: event.translationX, dy: event.translationY }); },
    onDeactivate: event => {
      'worklet';
      const d = drag.get(); drag.set({ ...d, slot: null, held: false, dx: 0, dy: 0 });
      lift.set({ slot: null, t: 0, on: false });

      if (!d.slot || event.canceled) return;
      const dx = event.translationX, dy = event.translationY;
      if (!scrollable && dy > 90 && dy > Math.abs(dx) * 1.3) fly(d.slot, 0, 1);
      else if (Math.abs(dx) > 80 || Math.abs(event.velocityX) > 700) fly(d.slot, dx < 0 ? -1 : 1, 0); // Left: flies and spins left, the previous piece. Right: the next.
      else phys.modify(P => { 'worklet'; P[d.slot!].vx = event.velocityX * 0.2; return P; });
    },
    onTouchesUp: event => {
      'worklet';
      // A tap: the pan never activated and the finger barely moved. Try the next piece on that slot's rail.
      const d = drag.get(), t = event.changedTouches[0];
      const still = !t || Math.hypot(t.absoluteX - d.sx, t.absoluteY - d.sy) < 10;
      // Letting go of a held piece only puts it back; it isn't a tap.
      const wasLifted = lift.get().on;
      if (wasLifted) lift.set({ slot: null, t: 0, on: false });
      if (d.slot && !d.held) { drag.set({ ...d, slot: null }); if (still && !wasLifted) fly(d.slot, 1, 0); }
    },
    onFinalize: () => { 'worklet'; if (lift.get().on || lift.get().slot) lift.set({ slot: null, t: 0, on: false }); },
  });

  const [top, pants, shoes] = (['top', 'pants', 'shoes'] as const).map(s => products.find(p => p.slot === s || (s === 'top' && p.slot === 'dress')));
  const backdrop = [mix(top?.hex, 0.10), mix(pants?.hex ?? top?.hex, 0.15), mix(shoes?.hex, 0.08)] as const;
  const names = products.map(p => p.name).join(', ');
  return <View style={[styles.stage, bare && { backgroundColor: 'transparent', borderRadius: 0, overflow: 'visible' }]} onLayout={e => setSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}>
    {!bare && <LinearGradient pointerEvents="none" colors={backdrop} locations={[0, 0.72, 1]} start={{ x: 0.3, y: 0 }} end={{ x: 0.7, y: 1 }} style={StyleSheet.absoluteFill} />}
    <GestureDetector gesture={pan}>
      <View style={StyleSheet.absoluteFill} accessible accessibilityRole="adjustable" accessibilityLabel={names ? 'Outfit: ' + names : 'Empty outfit'}
        accessibilityActions={layout.boxes.flatMap(b => [{ name: 'next-' + b.slot, label: 'Next ' + slotName(b.slot) }, { name: 'off-' + b.slot, label: 'Take off ' + slotName(b.slot) }])}
        onAccessibilityAction={e => { const [kind, slot] = e.nativeEvent.actionName.split('-') as ['next' | 'off', StageSlot]; if (kind === 'next') onSwap(slot, 1); else onRemove(slot); }}>
        {layout.ground && <Ground ground={layout.ground} phys={phys} glow={dark(shoes?.hex) ? layout.boxes.find(b => b.slot === 'shoes') : undefined} />}
        {layout.boxes.map(box => <Fragment key={box.slot}>
          <Layer box={box} product={productOf(box.id)} phys={phys} lift={lift} under={box.slot === 'pants' && layout.tucked} />
          {/* The exit layer mirrors the piece, hidden, so a fling can hand it over on the UI thread with no wait. */}
          {!outgoing[box.slot] && <Layer box={box} product={productOf(box.id)} phys={exit} under={box.slot === 'pants' && layout.tucked} />}
        </Fragment>)}
        {STAGE_SLOTS.map(slot => { const o = outgoing[slot]; return o && <Layer key={'out-' + slot} box={o.box} product={o.product} phys={exit} under={o.under} />; })}
        {[...Object.values(flying).filter((a): a is Arrival => !!a), ...arrivals].filter((a, i, all) => all.findIndex(b => b.product.id === a.product.id) === i)
          .map(a => <Arriving key={'in-' + a.product.id} arrival={a} inc={inc} />)}
      </View>
    </GestureDetector>
    {layout.canTuck && <MotionPressable glass={false} accessibilityRole="button" accessibilityLabel={tucked ? 'Tuck in: the top over the trousers' : 'Untuck: the trousers over the top'} onPress={onToggleTuck} style={[styles.tuck, { top: layout.waistY - 16 }]}>
      {/* The owner's call: "Tuck in" brings the top over the trousers, "Untuck" lets the trousers come over it. */}
      <Text style={styles.tuckText}>{tucked ? 'Tuck in' : 'Untuck'}</Text>
    </MotionPressable>}
  </View>;
}

function Layer({ box, product, phys, under, lift }: { box: PieceBox; product: Product; phys: SharedValue<Physics>; under: boolean; lift?: SharedValue<Lift> }) {
  const slot = box.slot;
  const style = useAnimatedStyle(() => {
    const p = phys.get()[slot];
    // A held piece comes to the front while it is lifted (and while it settles back).
    const front = !!lift && (lift.get().slot === slot && lift.get().on || p.s > 1.05);
    return { zIndex: front ? 20 : 0, opacity: p.o, transform: [{ translateX: p.x }, { translateY: p.y }, { rotate: p.r + 'deg' }, { scale: p.s }] };
  });
  const cut = cutouts[product.id];
  return <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: box.x, top: box.y, width: box.w, height: box.h, transformOrigin: box.hang }, style]}>
    {cut ? <Cutout source={cut.source} pad={CUTOUT_PAD} w={box.w} h={box.h} lift={LIFT[slot]} under={under} />
      : product.cutoutUri ? <Cutout source={{ uri: product.cutoutUri }} pad={0} w={box.w} h={box.h} lift={LIFT[slot]} under={under} />
      : <Plate product={product} />}
  </Animated.View>;
}

/** The cut-out with its two shadows: a tight contact line and a soft cast shadow, both from the one light.
 * `pad`: the clear margin baked into prepared cut-outs; one the person added fills its image (pad 0). */
function Cutout({ source, pad, w, h, lift, under }: { source: ImageSourcePropType; pad: number; w: number; h: number; lift: number; under: boolean }) {
  const m = pad * w;
  const frame = { position: 'absolute' as const, left: -m, top: -m, width: w + 2 * m, height: h + 2 * m };
  return <>
    <Image source={source} blurRadius={6} style={[frame, { tintColor: SHADOW, opacity: 0.16 + lift * 0.06, transform: [{ translateX: 3 * lift + 1.5 }, { translateY: 5 * lift + 2 }] }]} />
    <Image source={source} blurRadius={1} style={[frame, { tintColor: SHADOW, opacity: 0.32, transform: [{ translateX: 0.5 }, { translateY: 1 }] }]} />
    {under && <Image source={source} blurRadius={1} style={[frame, { tintColor: SHADOW, opacity: 0.3, transform: [{ translateY: -1.5 }] }]} />}
    <Image source={source} style={frame} />
  </>;
}

/** A neighbour drawn where it would stand, hidden until a swipe brings it in. Being drawn is what decodes its cut-out
 * and shadows ahead of time. */
function Arriving({ arrival, inc }: { arrival: Arrival; inc: SharedValue<Record<string, Phys>> }) {
  const { box, product, under } = arrival, id = product.id, slot = box.slot;
  const style = useAnimatedStyle(() => {
    const p = inc.get()[id];
    if (!p) return { opacity: 0 };
    return { opacity: p.o, transform: [{ translateX: p.x }, { translateY: p.y }, { rotate: p.r + 'deg' }, { scale: p.s }] };
  });
  const cut = cutouts[id];
  return <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: box.x, top: box.y, width: box.w, height: box.h, transformOrigin: box.hang }, style]}>
    {cut ? <Cutout source={cut.source} pad={CUTOUT_PAD} w={box.w} h={box.h} lift={LIFT[slot]} under={under} />
      : product.cutoutUri ? <Cutout source={{ uri: product.cutoutUri }} pad={0} w={box.w} h={box.h} lift={LIFT[slot]} under={under} /> : null}
  </Animated.View>;
}

/** Pieces without a cut-out (your own photos) sit on a plate rather than pretending. */
function Plate({ product }: { product: Product }) {
  return <View style={styles.plate}>{isUserUpload(product) ? <LocalPhoto uri={product.localUri} label={product.name} /> : <ProductVisual product={product} transition={false} />}</View>;
}

/** The floor under the shoes: a soft contact shadow, and for dark shoes a pool of light behind them so their outline
 * reads against the paper instead of sitting there as a dark shape. */
function Ground({ ground, phys, glow }: { ground: { x: number; y: number; w: number }; phys: SharedValue<Physics>; glow?: PieceBox }) {
  const style = useAnimatedStyle(() => {
    const P = phys.get();
    return { opacity: P.shoes.o * (1 - Math.min(0.6, Math.abs(P.pants.x) * 0.004)), transform: [{ translateX: P.shoes.x }] };
  });
  const light = useAnimatedStyle(() => {
    const p = phys.get().shoes;
    return { opacity: p.fly ? 0 : p.o, transform: [{ translateX: p.x }] };
  });
  return <>
    {glow && <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: glow.x - glow.w * 0.35, top: glow.y - glow.h * 0.45, width: glow.w * 1.7, height: glow.h * 1.8 }, light]}>
      <Svg width="100%" height="100%"><Defs><RadialGradient id="shoeLight" cx="50%" cy="58%" rx="50%" ry="50%"><Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.75} /><Stop offset="0.55" stopColor="#FFFFFF" stopOpacity={0.3} /><Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} /></RadialGradient></Defs>
        <Ellipse cx="50%" cy="50%" rx="50%" ry="50%" fill="url(#shoeLight)" /></Svg>
    </Animated.View>}
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: ground.x + 4, top: ground.y, width: ground.w, height: 22 }, style]}>
      <Svg width="100%" height="100%"><Defs><RadialGradient id="ground" cx="50%" cy="50%" rx="50%" ry="50%"><Stop offset="0" stopColor="#261E16" stopOpacity={0.3} /><Stop offset="1" stopColor="#261E16" stopOpacity={0} /></RadialGradient></Defs>
        <Ellipse cx="50%" cy="50%" rx="50%" ry="50%" fill="url(#ground)" /></Svg>
    </Animated.View>
  </>;
}
/** Dark enough that the shoe's outline gets lost on the paper. */
function dark(hex: string | undefined): boolean {
  if (!hex || !/^#[0-9a-f]{6}$/i.test(hex)) return false;
  const n = parseInt(hex.slice(1), 16), [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 70;
}

const slotName = (slot: StageSlot) => ({ outerwear: 'jacket', top: 'top', dress: 'dress', pants: 'bottom', shoes: 'shoes' })[slot];
/** The outfit's own colours, washed into the paper. */
function mix(hex: string | undefined, t: number): string {
  if (!hex || !/^#[0-9a-f]{6}$/i.test(hex)) return colors.paper;
  const n = parseInt(hex.slice(1), 16), paper = [243, 240, 234];
  return 'rgb(' + [n >> 16, (n >> 8) & 255, n & 255].map((v, i) => Math.round(v * t + paper[i] * (1 - t))).join(',') + ')';
}
const styles = StyleSheet.create({
  stage: { flex: 1, borderRadius: 22, overflow: 'hidden' },
  plate: { flex: 1, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.plate },
  tuck: { position: 'absolute', right: 12, minHeight: 32, paddingHorizontal: 12, borderRadius: 16, justifyContent: 'center', backgroundColor: 'rgba(248,246,241,0.92)', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line2 },
  tuckText: { fontFamily: family.sansMedium, fontSize: 11, color: colors.ink2 },
});
