import { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Extrapolation, interpolate, runOnJS, useAnimatedReaction, useAnimatedStyle, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { OutfitStage } from '../components/tryOn/OutfitStage';
import { CUTOUT_PAD, cutouts } from '../data/cutouts';
import { realCatalogProducts } from '../data/realCatalog';
import { layoutOutfit, type StageSlot } from '../domain/outfitLayout';
import { readOutfit, stagePieceFor, stepRail } from '../domain/outfitRead';
import { formatMoney } from '../domain/selectors';
import type { Product } from '../domain/types';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { colors } from '../theme/tokens';
import { family } from '../theme/typography';

const byId = (id: string) => realCatalogProducts.find(p => p.id === id)!;
/** The edit the section builds: an oxford, wide chinos and sneakers. */
const OUTFIT = ['muji-8654640513214-white', 'muji-9031730692286-dark-beige', 'muji-8926194106558-off-white'].map(byId);
/** Other yeses: they fly in with the outfit, step aside while FORM builds it, then become the swaps. */
const OTHERS = ['muji-8958259790014-brown', 'muji-8654640513214-navy', 'muji-8937414852798-dark-gray', 'muji-8650821599422-ivory', 'muji-8513572405438-black'].map(byId);
const RAILS: Partial<Record<StageSlot, Product[]>> = {
  top: [OUTFIT[0], OTHERS[1], OTHERS[0], OTHERS[3]],
  pants: [OUTFIT[1], OTHERS[2], byId('muji-8830601658558-navy')],
  shoes: [OUTFIT[2], OTHERS[4]],
};
const FLYERS = [...OUTFIT, ...OTHERS];
// Where each yes floats before FORM gathers them, as fractions of the free area right of the copy.
const SCATTER = [[.12, .2, -9], [.5, .62, 7], [.86, .74, -6], [.42, .14, 11], [.8, .2, -12], [.16, .7, 8], [.64, .4, -4], [.98, .46, 10]] as const;

const STEPS = [
  { eyebrow: '01 · TEACH IT YOUR TASTE', title: 'You said yes', italic: 'to these.', body: 'Eight quick reactions. FORM reads the colours, fabrics and shapes you keep choosing.' },
  { eyebrow: '02 · GET YOUR EDIT', title: 'FORM builds', italic: 'the outfit.', body: 'The pieces you liked, put together in your size and budget, exactly as the Edits tab shows them.' },
  { eyebrow: '03 · MAKE IT YOURS', title: 'Swap anything.', italic: 'It’s your edit.', body: 'Tap or swipe a piece to try the next one. Untuck the shirt. This is the real outfit stage from the app.' },
];

const clamp01 = (t: number) => { 'worklet'; return Math.min(1, Math.max(0, t)); };
const ease = (t: number) => { 'worklet'; return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };

/** "How it works" as one pinned scene: the yeses float in, gather into the Edits outfit stage, and the stage comes alive. */
export function ScrollDressing({ scrollY, width, height, onStart }: { scrollY: SharedValue<number>; width: number; height: number; onStart: () => void }) {
  const reduced = useReduceMotion();
  const trackTop = useSharedValue(0);
  const span = height * 3.2;
  const progress = useSharedValue(0);
  // How far the scene has come into view before it pins: -1 a screen away, 0 pinned. The yeses float in over it.
  const enter = useSharedValue(-1);
  useAnimatedReaction(() => (scrollY.value - trackTop.value) / span, raw => { progress.value = clamp01(raw); enter.value = Math.max(-1, Math.min(0, raw * span / height)); }, [span, height]);

  const [step, setStep] = useState(0);
  useAnimatedReaction(() => progress.value < .3 ? 0 : progress.value < .58 ? 1 : 2, (s, prev) => { if (s !== prev) runOnJS(setStep)(s); });

  // The scene's geometry: copy on the left, the stage centred in the space on the right.
  const copyW = Math.min(520, width * .36), stageW = Math.min(440, (width - copyW) * .5), stageH = Math.min(height - 230, 640);
  const stageX = copyW + 64 + (width - copyW - 64 - stageW) / 2, stageY = (height - stageH) / 2 + 26;
  const boxes = useMemo(() => layoutOutfit(OUTFIT.map(p => stagePieceFor(p, cutouts)!), false, { width: stageW, height: stageH }).boxes, [stageW, stageH]);

  const [outfit, setOutfit] = useState(OUTFIT);
  const [tucked, setTucked] = useState(false);
  const swap = (slot: StageSlot, dir: 1 | -1) => {
    const rail = RAILS[slot]; const next = rail && stepRail(rail, outfit.find(p => p.slot === slot)?.id, dir);
    if (!next) return false;
    setOutfit(o => o.map(p => p.slot === slot ? next : p)); return true;
  };
  const neighbours = useMemo(() => Object.fromEntries((Object.keys(RAILS) as StageSlot[]).map(slot => {
    const cur = outfit.find(p => p.slot === slot)?.id;
    return [slot, { next: stepRail(RAILS[slot]!, cur, 1), prev: stepRail(RAILS[slot]!, cur, -1) }];
  })), [outfit]);
  const total = outfit.reduce((sum, p) => sum + p.priceCents, 0);

  const live = useAnimatedStyle(() => ({ opacity: interpolate(progress.value, [.5, .56], [0, 1], Extrapolation.CLAMP) }));
  const plate = useAnimatedStyle(() => ({ opacity: interpolate(progress.value, [.3, .48], [0, 1], Extrapolation.CLAMP), transform: [{ scale: interpolate(progress.value, [.3, .5], [.94, 1], Extrapolation.CLAMP) }] }));
  const bar = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` as `${number}%` }));

  return <View style={{ width: '100%', height: height + span }} onLayout={e => { trackTop.value = e.nativeEvent.layout.y; }}>
    <View style={[styles.pinned, { height }]}>
      <View style={[styles.copy, { width: copyW }]}>
        <Typed step={STEPS[step]} reduced={reduced} />
        <View style={styles.steps}>{STEPS.map((s, i) => <View key={s.eyebrow} style={styles.stepRow}>
          <View style={[styles.stepLine, i === step && styles.stepLineOn]} /><Text style={[styles.stepText, i === step && { color: colors.ink }]}>{['Taste', 'Edit', 'Make it yours'][i]}</Text>
        </View>)}</View>
        {step === 2 && <Pressable accessibilityRole="button" onPress={onStart} style={styles.cta}><Text style={styles.ctaText}>Build your own edit  →</Text></Pressable>}
      </View>

      {/* The Edits screen's chrome: the look's name and price above the stage, the honest read below it. */}
      <Animated.View style={[{ position: 'absolute', left: stageX, top: stageY - 70, width: stageW }, plate]}>
        <View style={styles.chromeRow}><Text style={styles.lookTitle}>Your edit</Text><View style={styles.keep}><Text style={styles.keepText}>Keep</Text></View></View>
        <Text style={styles.lookMeta}>An idea from FORM · {formatMoney(total)}</Text>
      </Animated.View>
      <Animated.View style={[{ position: 'absolute', left: stageX, top: stageY, width: stageW, height: stageH, borderRadius: 22, backgroundColor: colors.plate }, plate]} />
      <Animated.View pointerEvents={step === 2 ? 'auto' : 'none'} style={[{ position: 'absolute', left: stageX, top: stageY, width: stageW, height: stageH }, live]}>
        <OutfitStage scrollable products={outfit} tucked={tucked} onToggleTuck={() => setTucked(t => !t)} onSwap={swap} onRemove={() => {}} neighbours={neighbours} />
      </Animated.View>
      <Animated.View style={[{ position: 'absolute', left: stageX, top: stageY + stageH + 16, width: stageW }, plate]}>
        <Text style={styles.read}>{readOutfit(outfit).line}</Text>
      </Animated.View>

      {FLYERS.map((p, i) => {
        const box = boxes.find(b => b.id === p.id);
        const [fx, fy, r] = SCATTER[i];
        const free = { x: copyW + 40, w: width - copyW - 140, y: 70, h: height - 260 };
        return <Flyer key={p.id} product={p} progress={progress} enter={enter} index={i} reduced={reduced}
          from={{ x: free.x + fx * free.w, y: free.y + fy * free.h, r }}
          to={box ? { x: stageX + box.x, y: stageY + box.y, w: box.w, h: box.h } : { x: stageX + stageW / 2 - 40, y: stageY + stageH / 2 - 40, w: 80, h: 80 * cutouts[p.id].aspect }} gathers={!!box} />;
      })}
      <View style={styles.track}><Animated.View style={[styles.trackFill, bar]} /></View>
    </View>
  </View>;
}

/** One yes, drawn at its final size on the stage and moved there by transforms, so the hand-off to the live stage is seamless. */
function Flyer({ product, progress, enter, index, from, to, gathers, reduced }: {
  product: Product; progress: SharedValue<number>; enter: SharedValue<number>; index: number; reduced: boolean; gathers: boolean;
  from: { x: number; y: number; r: number }; to: { x: number; y: number; w: number; h: number };
}) {
  const startW = Math.min(170, 250 / cutouts[product.id].aspect), s0 = startW / to.w;
  const style = useAnimatedStyle(() => {
    const p = progress.value;
    const arrive = reduced ? 1 : clamp01((enter.value + .75 - index * .05) / .3);
    const g = ease(clamp01((p - .26 - (gathers ? index * .02 : 0)) / .24));
    const drift = reduced ? 0 : Math.sin(p * 14 + index) * 10 * (1 - g);
    const cx = to.x + to.w / 2, cy = to.y + to.h / 2;
    const tx = (from.x - cx) * (1 - g), ty = (from.y + drift - cy) * (1 - g) + (1 - arrive) * 40;
    const scale = gathers ? s0 + (1 - s0) * g : s0 * (1 - g * .5);
    const opacity = gathers ? arrive * (1 - clamp01((p - .52) / .04)) : arrive * (1 - clamp01((p - .26) / .14));
    return { opacity, transform: [{ translateX: tx }, { translateY: ty }, { rotate: from.r * (1 - g) + 'deg' }, { scale }] };
  });
  const m = CUTOUT_PAD * to.w;
  return <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: to.x, top: to.y, width: to.w, height: to.h }, style]}>
    <Image source={cutouts[product.id].source} style={{ position: 'absolute', left: -m, top: -m, width: to.w + 2 * m, height: to.h + 2 * m }} />
  </Animated.View>;
}

/** The step's headline types itself in when the step changes. */
function Typed({ step, reduced }: { step: typeof STEPS[number]; reduced: boolean }) {
  const full = step.title + '\n' + step.italic;
  const [n, setN] = useState(reduced ? full.length : 0);
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  useEffect(() => {
    if (reduced) { setN(full.length); return; }
    setN(0); clearInterval(timer.current);
    timer.current = setInterval(() => setN(k => { if (k >= full.length) { clearInterval(timer.current); return k; } return k + 1; }), 34);
    return () => clearInterval(timer.current);
  }, [full, reduced]);
  const shown = full.slice(0, n), [a, b = ''] = shown.split('\n');
  return <View>
    <Text style={styles.eyebrow}>{step.eyebrow}</Text>
    <Text accessibilityLabel={step.title + ' ' + step.italic} style={styles.title}>{a}{shown.includes('\n') ? '\n' : ''}<Text style={styles.italic}>{b}</Text><Text style={styles.caret}>|</Text></Text>
    <Text style={styles.body}>{step.body}</Text>
  </View>;
}

const styles = StyleSheet.create({
  pinned: { position: 'sticky', top: 0, width: '100%', overflow: 'hidden', backgroundColor: colors.card, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.line } as object,
  copy: { position: 'absolute', left: 64, top: 0, bottom: 0, justifyContent: 'center' },
  eyebrow: { fontFamily: family.sansMedium, fontSize: 11, letterSpacing: 2.6, color: colors.muted },
  title: { fontFamily: family.serif, fontSize: 68, lineHeight: 68, letterSpacing: -0.9, color: colors.ink, marginTop: 16, minHeight: 136 },
  italic: { fontFamily: family.serifItalic },
  caret: { fontFamily: family.sans, fontSize: 52, color: colors.faint },
  body: { fontFamily: family.sans, fontSize: 16, lineHeight: 26, color: colors.ink2, marginTop: 18, maxWidth: 420 },
  steps: { marginTop: 40, gap: 12 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepLine: { width: 24, height: 1.5, backgroundColor: colors.faint, transitionProperty: 'width, background-color', transitionDuration: '300ms' } as object,
  stepLineOn: { width: 48, backgroundColor: colors.ink },
  stepText: { fontFamily: family.sansMedium, fontSize: 11, letterSpacing: 2, color: colors.faint, textTransform: 'uppercase' },
  cta: { alignSelf: 'flex-start', marginTop: 32, height: 52, paddingHorizontal: 26, borderRadius: 999, backgroundColor: colors.ink, justifyContent: 'center' },
  ctaText: { fontFamily: family.sansMedium, fontSize: 15, color: colors.paper },
  chromeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  lookTitle: { fontFamily: family.serif, fontSize: 30, color: colors.ink },
  keep: { height: 34, paddingHorizontal: 16, borderRadius: 999, borderWidth: 1, borderColor: colors.line2, justifyContent: 'center' },
  keepText: { fontFamily: family.sansMedium, fontSize: 12.5, color: colors.ink },
  lookMeta: { fontFamily: family.sans, fontSize: 12.5, color: colors.muted, marginTop: 2 },
  read: { fontFamily: family.serifItalic, fontSize: 17, lineHeight: 23, color: colors.ink2, textAlign: 'center' },
  track: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 2 },
  trackFill: { height: 2, backgroundColor: colors.ink },
});
