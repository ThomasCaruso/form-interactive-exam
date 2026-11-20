import { useScreenSize } from '../web/desktop';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AppState, Platform, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { cancelAnimation, Easing, interpolate, type SharedValue, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN, scheduleOnUI } from 'react-native-worklets';
import type { Look, Product, ReviewStatus } from '../domain/types';
import { canShowSwipeHint, deckPromotion, swipeDecision, swipeExitVector, verticalDragOffset } from '../domain/discoveryGesture';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { colors } from '../theme/tokens';
import { family } from '../theme/typography';
import { DiscoveryCardFace } from './DiscoveryCardFace';

/** One card in the deck: the piece (or a complete look shown as a piece) and the line explaining it. */
export interface DeckEntry { product: Product; look?: Look; reason: string }
interface Props {
  /** Front card first. Up to five are drawn: four layered, and a fifth hidden behind them so it is ready when the deck moves. */
  cards: DeckEntry[]; onTry?: () => void; cardHeight: number;
  initialHintEligible?: boolean; onHintUsed?: () => void;
  canUndo: boolean; onUndo: () => void;
  onOpen: () => void; onReview: (status: ReviewStatus, card: DeckEntry) => void;
}
type Pose = { x: number; y: number; tilt: number };
const ZERO: Pose = { x: 0, y: 0, tilt: 0 };
const KEYBOARD_CONTROL = [
  'button', 'a[href]', 'input', 'textarea', 'select', 'summary',
  '[contenteditable]:not([contenteditable="false"])',
  '[tabindex]:not([tabindex="-1"])',
  '[role="button"]', '[role="link"]', '[role="tab"]', '[role="dialog"]',
].join(', ');
// Four cards show as a layered stack; a fifth waits invisibly behind the last, ready to fade in as the deck moves.
const DRAWN = 5, LAYERS = 4;
// Each card further back sits STEP px higher (so its top edge shows), is SHRINK narrower, and a shade darker.
const STEP = 9, SHRINK = 0.045, SHADE = 0.035;
/** How the deck moves:
 * - Every card is keyed by its piece, so moving up the deck is a re-render, never a fresh mount with a picture to load.
 * - A swipe advances the deck on the UI thread the moment you let go: the card you swiped hands its flight to a ghost
 *   slot, the next card takes the pose, and the decision is sent to the app afterwards. A quick run of swipes is never
 *   held up by the app saving and redrawing, and the card behind is the one that comes next. */
export function DiscoveryCard({ cards, onTry, cardHeight, initialHintEligible = true, onHintUsed, canUndo, onUndo, onOpen, onReview }: Props) {
  const { width, height } = useScreenSize();
  const reduced = useReduceMotion();
  const ids = cards.slice(0, DRAWN).map(c => c.product.id), idsKey = ids.join('|');
  const hint = useSharedValue(0), touched = useSharedValue(false), played = useSharedValue(!initialHintEligible);
  const active = useSharedValue(AppState.currentState === 'active');
  // The deck as the UI thread sees it: what is still to decide, front first. It runs ahead of the app's own list
  // while decisions are on their way.
  const order = useSharedValue<string[]>(ids);
  const decided = useSharedValue<Record<string, true>>({});
  const poseOwner = useSharedValue(ids[0] ?? '');
  const pose = useSharedValue<Pose>(ZERO);
  // Cards on their way out, three at most in flight.
  const ghost0 = useSharedValue<Pose>(ZERO), ghost1 = useSharedValue<Pose>(ZERO), ghost2 = useSharedValue<Pose>(ZERO);
  const ghostIds = useSharedValue<string[]>(['', '', '']), ghostSaved = useSharedValue<boolean[]>([false, false, false]), ghostNext = useSharedValue(0);
  const originX = useSharedValue(0), originY = useSharedValue(0);
  const touchX = useSharedValue(0), touchY = useSharedValue(0);
  const dragging = useSharedValue(false), focused = useSharedValue(true);
  const latest = useRef({ cards, onReview, onHintUsed });
  useLayoutEffect(() => { latest.current = { cards, onReview, onHintUsed }; }, [cards, onReview, onHintUsed]);
  // A card that has been decided stays drawn by its own instance until its flight ends.
  const [leaving, setLeaving] = useState<DeckEntry[]>([]);

  const restore = useCallback(() => {
    'worklet';
    cancelAnimation(pose);
    cancelAnimation(hint); hint.set(0);
    pose.set(ZERO);
    originX.set(0); originY.set(0);
    dragging.set(false);
  }, [dragging, hint, originX, originY, pose]);
  useFocusEffect(useCallback(() => {
    focused.set(true);
    scheduleOnUI(restore);
    return () => {
      focused.set(false);
      scheduleOnUI(restore);
    };
  }, [focused, restore]));
  // The app's list has moved (a decision landed, an undo, a re-deal): the UI deck follows it, leaving out what is
  // already decided but not yet saved. The pose is only reset when the front card is a different one, so a drag on
  // the card under your thumb carries on.
  useLayoutEffect(() => {
    scheduleOnUI((now: string[]) => {
      'worklet';
      const was = decided.get(), keep: Record<string, true> = {};
      for (const id of now) if (was[id]) keep[id] = true;
      decided.set(keep);
      const next = now.filter(id => !keep[id]);
      order.set(next);
      const g = ghostIds.get();
      if (g.some(id => id && next.includes(id))) ghostIds.set(g.map(id => next.includes(id) ? '' : id));
      if (poseOwner.get() !== (next[0] ?? '')) {
        cancelAnimation(pose); pose.set(ZERO); originX.set(0); originY.set(0);
        poseOwner.set(next[0] ?? '');
      }
    }, idsKey ? idsKey.split('|') : []);
  }, [idsKey, decided, order, ghostIds, poseOwner, pose, originX, originY]);

  const markHintUsed = useCallback(() => { latest.current.onHintUsed?.(); }, []);
  const dismissHint = useCallback(() => {
    'worklet';
    if (!touched.get()) scheduleOnRN(markHintUsed);
    touched.set(true); cancelAnimation(hint); hint.set(0);
  }, [hint, markHintUsed, touched]);
  const playHint = useCallback(() => {
    'worklet';
    if (!canShowSwipeHint({ focused: focused.get(), active: active.get(), reduced, touched: touched.get(), locked: !order.get().length, played: played.get() })) return;
    played.set(true); scheduleOnRN(markHintUsed);
    const timing = { easing: Easing.inOut(Easing.quad) };
    hint.set(withSequence(withTiming(-5, { ...timing, duration: 110 }), withTiming(6, { ...timing, duration: 180 }), withTiming(-3, { ...timing, duration: 150 }), withTiming(0, { ...timing, duration: 140 })));
  }, [active, focused, hint, markHintUsed, order, played, reduced, touched]);
  useFocusEffect(useCallback(() => {
    const timer = setTimeout(() => scheduleOnUI(playHint), 1100);
    return () => { clearTimeout(timer); cancelAnimation(hint); hint.set(0); };
  }, [hint, playHint]));
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      active.set(state === 'active');
      if (state !== 'active') { cancelAnimation(hint); hint.set(0); }
    });
    return () => subscription.remove();
  }, [active, hint]);

  const leaveTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => leaveTimers.current.forEach(clearTimeout), []);
  const commitDecision = useCallback((status: ReviewStatus, id: string, animated: boolean) => {
    const card = latest.current.cards.find(c => c.product.id === id);
    if (!card) return;
    if (animated) {
      setLeaving(l => [...l.filter(c => c.product.id !== id), card]);
      leaveTimers.current.push(setTimeout(() => setLeaving(l => l.filter(c => c !== card)), 520));
    }
    latest.current.onReview(status, card);
  }, []);
  const settle = () => {
    'worklet';
    if (reduced) { pose.set(ZERO); return; }
    const spring = { stiffness: 320, damping: 32, mass: 0.8, overshootClamping: true };
    pose.set(withSpring(ZERO, spring));
  };
  const launch = (status: ReviewStatus, dx: number, dy: number, velocity: number) => {
    'worklet';
    const now = order.get(), id = now[0];
    if (!id || !focused.get() || poseOwner.get() !== id) return;
    dismissHint();
    if (!reduced) {
      const travel = swipeExitVector(dx, dy, width, height);
      const duration = Math.max(200, Math.min(300, Math.hypot(travel.x, travel.y) / Math.max(1.8, velocity)));
      const from = pose.get(), target = { x: from.x + travel.x, y: from.y + travel.y, tilt: status === 'saved' ? 16 : -16 };
      const slot = ghostNext.get(), ghost = slot === 0 ? ghost0 : slot === 1 ? ghost1 : ghost2;
      ghostNext.set((slot + 1) % 3);
      ghostIds.set(ghostIds.get().map((g, i) => i === slot ? id : g));
      ghostSaved.set(ghostSaved.get().map((g, i) => i === slot ? status === 'saved' : g));
      cancelAnimation(ghost);
      ghost.set(from);
      ghost.set(withTiming(target, { duration, easing: Easing.out(Easing.quad) }, finished => {
        if (finished && ghostIds.get()[slot] === id) ghostIds.set(ghostIds.get().map((g, i) => i === slot ? '' : g));
      }));
    }
    const was = decided.get(), mark: Record<string, true> = { [id]: true };
    for (const k of Object.keys(was)) mark[k] = true;
    decided.set(mark);
    order.set(now.slice(1));
    cancelAnimation(pose); pose.set(ZERO); originX.set(0); originY.set(0);
    poseOwner.set(now[1] ?? '');
    scheduleOnRN(commitDecision, status, id, !reduced);
  };
  // Recognition, tracking, return and exit all run on the UI thread. JavaScript
  // only receives the decision/haptic events, never individual drag frames.
  const pan = usePanGesture({
    enabled: focused, activeOffsetX: [-8, 8], failOffsetY: [-28, 28], maxPointers: 1,
    onTouchesDown: event => {
      'worklet';
      dismissHint();
      const touch = event.changedTouches[0];
      if (touch) {
        touchX.set(touch.absoluteX); touchY.set(touch.absoluteY);
        dragging.set(false);
      }
    },
    onTouchesMove: event => {
      'worklet';
      const touch = event.changedTouches[0];
      if (touch && Math.hypot(touch.absoluteX - touchX.get(), touch.absoluteY - touchY.get()) > 8) dragging.set(true);
    },
    onBegin: () => {
      'worklet';
      dragging.set(false);
    },
    onActivate: () => {
      'worklet';
      if (!order.get().length) return;
      cancelAnimation(pose);
      originX.set(pose.get().x); originY.set(pose.get().y);
      dragging.set(true);
    },
    onUpdate: event => {
      'worklet';
      if (!order.get().length) return;
      const nextX = reduced ? 0 : originX.get() + event.translationX;
      pose.set({
        x: nextX,
        y: reduced ? 0 : Math.max(-14, Math.min(14, originY.get() + verticalDragOffset(event.translationY))),
        tilt: reduced ? 0 : Math.max(-5, Math.min(5, nextX / width * 5)),
      });
    },
    onDeactivate: event => {
      'worklet';
      if (!order.get().length) return;
      const status = event.canceled ? null : swipeDecision(event.translationX, event.translationY, width - 40);
      if (status) launch(status, event.translationX, event.translationY, Math.hypot(event.velocityX, event.velocityY) / 1000);
      else settle();
    },
    onFinalize: event => {
      'worklet';
      if (event.canceled && dragging.get()) settle();
    },
  });
  // On the web the deck also answers the keyboard: arrows decide, Enter opens, Z (or Backspace) undoes.
  const keyActions = useRef<{ review: (status: ReviewStatus) => void; open: () => void; undo: () => void; canUndo: boolean } | null>(null);
  useLayoutEffect(() => {
    keyActions.current = { review: status => scheduleOnUI(launch, status, status === 'saved' ? 1 : -1, 0, 0), open: onOpen, undo: onUndo, canUndo };
  });
  useFocusEffect(useCallback(() => {
    if (Platform.OS !== 'web') return;
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || event.metaKey || event.ctrlKey || event.altKey || event.repeat) return;
      // A focused control owns its keyboard input, including React Native Web's role-based controls.
      if (event.target instanceof Element && event.target.closest(KEYBOARD_CONTROL)) return;
      const actions = keyActions.current;
      if (!actions) return;
      if (event.key === 'ArrowRight') { event.preventDefault(); actions.review('saved'); }
      else if (event.key === 'ArrowLeft') { event.preventDefault(); actions.review('passed'); }
      else if (event.key === 'Enter') { event.preventDefault(); actions.open(); }
      else if ((event.key === 'z' || event.key === 'Z' || event.key === 'Backspace') && actions.canUndo) { event.preventDefault(); actions.undo(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []));
  const canPress = () => !dragging.get();
  const stackInset = STEP * Math.min(LAYERS - 1, Math.max(0, cards.length - 1));
  const motion: DeckMotion = { order, poseOwner, pose, hint, ghosts: [ghost0, ghost1, ghost2], ghostIds, ghostSaved, width, reduced, stackInset,
    faceHeight: cardHeight - stackInset };
  const drawn = cards.slice(0, DRAWN);
  const gone = leaving.filter(c => !ids.includes(c.product.id));
  const front = drawn[0];
  // Drawn back to front, so the front card is above the deck and a leaving card above everything.
  return <GestureDetector gesture={pan}>
    <View collapsable={false} onTouchStart={() => scheduleOnUI(dismissHint)} style={{ height: cardHeight }}>
      {[...drawn].reverse().map(card => <DeckCard key={card.product.id} card={card} motion={motion}
        front={card === front ? { canUndo, onTry: () => { if (canPress()) onTry?.(); }, onTouch: () => scheduleOnUI(dismissHint),
          onOpen: () => { if (canPress()) onOpen(); }, onUndo: () => { if (canPress()) onUndo(); },
          onReview: status => { if (canPress()) scheduleOnUI(launch, status, status === 'saved' ? 1 : -1, 0, 0); } } : undefined} />)}
      {gone.map(card => <DeckCard key={card.product.id} card={card} motion={motion} />)}
    </View>
  </GestureDetector>;
}

type DeckMotion = {
  order: SharedValue<string[]>; poseOwner: SharedValue<string>; pose: SharedValue<Pose>; hint: SharedValue<number>;
  ghosts: SharedValue<Pose>[]; ghostIds: SharedValue<string[]>; ghostSaved: SharedValue<boolean[]>;
  width: number; reduced: boolean; stackInset: number; faceHeight: number;
};
type FrontHandlers = { canUndo: boolean; onTry: () => void; onTouch: () => void; onOpen: () => void; onUndo: () => void; onReview: (status: ReviewStatus) => void };

/** One card. Where it stands (front, next, rear, flying out) is read on the UI thread from the deck order, so it moves
 * up the deck without waiting for a render. */
function DeckCard({ card, motion, front }: { card: DeckEntry; motion: DeckMotion; front?: FrontHandlers }) {
  const { order, poseOwner, pose, hint, ghosts, ghostIds, ghostSaved, width, reduced, stackInset, faceHeight } = motion;
  const id = card.product.id;
  const ghost0 = ghosts[0], ghost1 = ghosts[1], ghost2 = ghosts[2];
  const style = useAnimatedStyle(() => {
    const slot = ghostIds.get().indexOf(id);
    if (slot >= 0) {
      const g = (slot === 0 ? ghost0 : slot === 1 ? ghost1 : ghost2).get();
      return { opacity: 1, transform: [{ translateX: g.x }, { translateY: g.y }, { rotate: `${g.tilt}deg` }, { scale: 1 }] };
    }
    const at = order.get().indexOf(id);
    if (at < 0) return { opacity: 0, transform: [{ translateX: 0 }, { translateY: 0 }, { rotate: '0deg' }, { scale: 1 }] };
    const p = poseOwner.get() === order.get()[0] ? pose.get() : ZERO;
    if (at === 0) {
      const h = poseOwner.get() === id ? hint.get() : 0, mine = poseOwner.get() === id ? p : ZERO;
      return { opacity: 1, transform: [{ translateX: mine.x + h }, { translateY: mine.y }, { rotate: `${mine.tilt + h * 0.12}deg` }, { scale: 1 }] };
    }
    // Every card behind moves one layer forward as the front one is dragged away. Scaling is about the centre, so the
    // lift is corrected to keep each card's top edge exactly STEP above the one in front.
    const depth = Math.max(0, at - (reduced ? 1 : deckPromotion(p.x, width)));
    const scale = 1 - SHRINK * depth;
    return { opacity: Math.max(0, Math.min(1, LAYERS - depth)), transform: [{ translateX: 0 }, { translateY: -STEP * depth - (1 - scale) * faceHeight / 2 }, { rotate: '0deg' }, { scale }] };
  });
  const shade = useAnimatedStyle(() => {
    const at = order.get().indexOf(id);
    if (at <= 0 || ghostIds.get().includes(id)) return { opacity: 0 };
    const p = poseOwner.get() === order.get()[0] ? pose.get() : ZERO;
    return { opacity: SHADE * Math.max(0, at - (reduced ? 1 : deckPromotion(p.x, width))) };
  });
  // Every shared value is read in the style function itself: Reanimated re-runs a style only for values it reads
  // directly, not ones read inside a helper it calls.
  const stamp = (saved: boolean, ghosts: string[], ghostWasSaved: boolean[], owner: string, x: number) => {
    'worklet';
    const slot = ghosts.indexOf(id);
    if (slot >= 0) return ghostWasSaved[slot] === saved ? 1 : 0;
    if (owner !== id) return 0;
    return saved ? interpolate(x, [20, 95], [0, 1], 'clamp') : interpolate(x, [-95, -20], [1, 0], 'clamp');
  };
  const saveMotion = useAnimatedStyle(() => ({ opacity: stamp(true, ghostIds.get(), ghostSaved.get(), poseOwner.get(), pose.get().x) }));
  const passMotion = useAnimatedStyle(() => ({ opacity: stamp(false, ghostIds.get(), ghostSaved.get(), poseOwner.get(), pose.get().x) }));
  return <Animated.View pointerEvents={front ? 'auto' : 'none'} accessibilityElementsHidden={!front} importantForAccessibility={front ? 'auto' : 'no-hide-descendants'}
    style={[styles.card, { top: stackInset }, style]}>
    <DiscoveryCardFace look={card.look} product={card.product} reason={card.reason} cardHeight={faceHeight} interactive={!!front}
      canUndo={front?.canUndo} onTry={front?.onTry} onTouch={front?.onTouch} onOpen={front?.onOpen} onUndo={front?.onUndo} onReview={front?.onReview}>
      <Animated.View pointerEvents="none" style={[styles.feedback, styles.saveFeedback, saveMotion]}><Text style={[styles.feedbackText, styles.saveFeedbackText]}>SAVE</Text></Animated.View>
      <Animated.View pointerEvents="none" style={[styles.feedback, styles.passFeedback, passMotion]}><Text style={[styles.feedbackText, styles.passFeedbackText]}>PASS</Text></Animated.View>
    </DiscoveryCardFace>
    {/* Cards further back sit a shade darker, so the layers read apart. */}
    <Animated.View pointerEvents="none" style={[styles.shade, shade]} />
  </Animated.View>;
}
const styles = StyleSheet.create({
  card: { position: 'absolute', left: 0, right: 0, backgroundColor: colors.card, borderRadius: 4, overflow: 'hidden' },
  shade: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: '#1C1610' },
  feedback: { position: 'absolute', top: 64, borderWidth: 1.5, borderRadius: 4, paddingHorizontal: 11, paddingVertical: 4, backgroundColor: colors.card },
  saveFeedback: { left: 24, borderColor: '#68735F', transform: [{ rotate: '-12deg' }] },
  passFeedback: { right: 24, borderColor: '#9B6F61', transform: [{ rotate: '12deg' }] },
  feedbackText: { fontFamily: family.sansMedium, fontSize: 18, letterSpacing: 1.6 },
  saveFeedbackText: { color: '#68735F' },
  passFeedbackText: { color: '#9B6F61' },
});
