import { useScreenSize } from '../src/web/desktop';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View, type ImageSourcePropType } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import { signInAvailable, signInProvider, useAuth } from '../src/auth/client';
import { FormIcon } from '../src/components/FormIcon';
import { MotionPressable } from '../src/components/MotionPressable';
import { PlateImage } from '../src/components/PlateImage';
import { ProviderMark } from '../src/components/ProviderMark';
import { RaisedButton } from '../src/components/RaisedButton';
import { showToast } from '../src/components/Toast';
import { Headline, StepHeader } from '../src/components/firstRun/Chrome';
import { DeckBacking, TasteCard } from '../src/components/firstRun/TasteCard';
import { previewAssets } from '../src/data/preview';
import { retailerPhotography } from '../src/data/retailerPhotography';
import { authMessage } from '../src/domain/auth';
import { pieceWord } from '../src/domain/pieceWord';
import { completeLooks } from '../src/domain/completeLooks';
import { applyFit, applyTaste, DEFAULT_SIZES, firstRunProfile, tasteChips, tasteDeck, type Silhouette } from '../src/domain/taste';
import type { Look, Product, Profile, ShopFor } from '../src/domain/types';
import { useReduceMotion } from '../src/hooks/useReduceMotion';
import { useFormStore } from '../src/state/store';
import { colors, layout } from '../src/theme/tokens';
import { eyebrow, family } from '../src/theme/typography';
import { formatMoney as formatPrice } from '../src/domain/selectors';

type Phase = 'department' | 'taste' | 'fit' | 'composing' | 'reveal' | 'tryon' | 'save';
const SILHOUETTES: { value: Silhouette; title: string; note: string }[] = [
  { value: 'fitted', title: 'Close', note: 'Defined, less room' },
  { value: 'regular', title: 'Easy', note: 'Shape and comfort' },
  { value: 'relaxed', title: 'Relaxed', note: 'Room to move' },
];

/** First run: what you shop for, what you'd wear, what you own, how it should fit; then your first edit. Account last. */
export default function Start() {
  const router = useRouter(), insets = useSafeAreaInsets();
  const base = useFormStore(s => s.profile), finishOnboarding = useFormStore(s => s.finishOnboarding);
  const [phase, setPhase] = useState<Phase>('department');
  const [shopFor, setShopFor] = useState<ShopFor | null>(null);
  const [liked, setLiked] = useState<Product[]>([]), [passed, setPassed] = useState<Product[]>([]), [answered, setAnswered] = useState(0), [decision, setDecision] = useState<'yes' | 'no' | null>(null);
  const [size, setSize] = useState<string | null>(null), [silhouette, setSilhouette] = useState<Silhouette>('regular');
  const deck = useMemo(() => shopFor ? tasteDeck(shopFor) : [], [shopFor]);
  const chips = useMemo(() => tasteChips(liked), [liked]);
  const profile = useMemo<Profile>(() => {
    const tasted = applyTaste(firstRunProfile(base, shopFor ?? 'both'), liked, passed);
    return size ? applyFit(tasted, size, silhouette) : { ...tasted, topSize: '', fitting: { units: 'imperial', ...tasted.fitting, fitPreference: silhouette } };
  }, [base, shopFor, liked, passed, size, silhouette]);
  const looks = useMemo(() => phase === 'composing' || phase === 'reveal' || phase === 'tryon' || phase === 'save' ? completeLooks(profile, { liked, passed }) : [], [phase, profile, liked, passed]);

  const decide = (yes: boolean) => {
    const product = deck[answered];
    if (!product || decision) return;
    setDecision(yes ? 'yes' : 'no');
    setTimeout(() => {
      if (yes) setLiked(previous => [...previous, product]); else setPassed(previous => [...previous, product]);
      setDecision(null);
      if (answered + 1 >= deck.length) setPhase('fit');
      setAnswered(answered + 1);
    }, 240);
  };
  const finish = () => {
    if (finishOnboarding(profile, [])) return true;
    showToast('Check your details and try again', 'warning');
    return false;
  };
  // Without sign-in there is no account step: the edit is already kept on this phone.
  const save = () => { if (!signInAvailable) { if (finish()) router.replace('/home'); } else setPhase('save'); };
  const top = insets.top + 6, bottom = insets.bottom + 18;
  const pad = { paddingTop: top, paddingBottom: bottom };

  if (phase === 'department') return <View style={[styles.screen, pad]}>
    <StepHeader step={1} total={3} onBack={() => router.canGoBack() ? router.back() : router.replace('/welcome')} />
    <View style={styles.intro}><Headline kicker="Let’s begin" title={'What do you\n'} italic="shop for?" /><Text style={styles.lede}>This sets your feed and your sizes. Change it anytime.</Text></View>
    <Departments value={shopFor} onChange={setShopFor} />
    <View style={{ flex: 1 }} />
    <RaisedButton label="Continue" showArrow={false} disabled={!shopFor} onPress={() => { setLiked([]); setPassed([]); setAnswered(0); setPhase('taste'); }} />
  </View>;

  if (phase === 'taste') {
    const product = deck[answered];
    return <View style={[styles.screen, pad]}>
      <StepHeader step={2} total={3} onBack={() => setPhase('department')} onSkip={() => setPhase('fit')} />
      <View style={styles.intro}><Headline kicker="Your taste" title="Would you" italic="wear this?" aside={<Text style={styles.counter}>{String(Math.min(answered + 1, deck.length)).padStart(2, '0')} <Text style={{ color: colors.faint }}>/</Text> {String(deck.length).padStart(2, '0')}</Text>} /></View>
      <View accessibilityLiveRegion="polite" style={styles.chips}>
        <Text numberOfLines={1} style={styles.soFar}>So far:</Text>
        {chips.length ? chips.map(chip => <View key={chip} style={styles.chip}><Text style={styles.chipText}>{chip}</Text></View>) : <Text style={styles.soFarEmpty}>your yeses will show here</Text>}
      </View>
      <View style={styles.deck}>
        <DeckBacking />
        {product && <TasteCard key={product.id} product={product} index={answered} total={deck.length} decision={decision} onDecide={decide} />}
      </View>
      <View style={styles.answers}>
        <Answer label="Not for me" onPress={() => decide(false)} />
        <Answer yes label="I’d wear it" onPress={() => decide(true)} />
      </View>
      <Text style={styles.hint}>Swipe or tap. There are no wrong answers.</Text>
    </View>;
  }

  if (phase === 'fit') return <View style={[styles.screen, pad]}>
    <StepHeader step={3} total={3} onBack={() => { setAnswered(0); setLiked([]); setPassed([]); setPhase('taste'); }} onSkip={() => { setSize(null); setPhase('composing'); }} />
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 16 }} showsVerticalScrollIndicator={false}>
      <View style={styles.intro}><Headline kicker="Your fit" title={'How should things\n'} italic="fit you?" /></View>
      <Text style={[eyebrow, styles.label]}>USUAL SIZE</Text>
      <View accessibilityRole="radiogroup" accessibilityLabel="Usual size" style={styles.sizes}>
        {DEFAULT_SIZES.map(value => <MotionPressable key={value} glass={false} accessibilityRole="radio" accessibilityState={{ checked: size === value }} onPress={() => setSize(value)} style={[styles.size, size === value && styles.sizeOn]}><Text style={[styles.sizeText, size === value && { color: colors.paper, fontFamily: family.sansMedium }]}>{value}</Text></MotionPressable>)}
      </View>
      <Text style={[eyebrow, styles.label]}>SILHOUETTE</Text>
      <View accessibilityRole="radiogroup" accessibilityLabel="Silhouette" style={styles.fits}>
        {SILHOUETTES.map(option => <MotionPressable key={option.value} glass={false} accessibilityRole="radio" accessibilityState={{ checked: silhouette === option.value }} onPress={() => setSilhouette(option.value)} style={[styles.fit, silhouette === option.value && { borderColor: colors.ink }]}>
          <Trouser kind={option.value} />
          <View><Text style={styles.fitTitle}>{option.title}</Text><Text style={styles.fitNote}>{option.note}</Text></View>
        </MotionPressable>)}
      </View>
      <View style={styles.measure}><Text style={styles.measureTitle}>Height and measurements</Text><Text style={styles.measureNote}>Optional. Add them in You for sharper sizing.</Text></View>
      <Text style={styles.reassure}>No judgments, no ideal body. Just your fit.</Text>
    </ScrollView>
    <RaisedButton label="Compose my edit" showArrow={false} disabled={!size} onPress={() => setPhase('composing')} />
  </View>;

  if (phase === 'composing') return <Composing look={looks[0]} count={liked.length} onDone={() => setPhase('reveal')} />;

  const look = looks[0];
  if (phase === 'tryon') return <TryOnInvite insets={{ top, bottom }} onClose={() => setPhase('reveal')} onTake={() => { if (finish()) { router.replace('/home'); router.push({ pathname: '/capture-person', params: { role: 'body' } }); } }} onLater={save} />;
  return <View style={{ flex: 1, backgroundColor: colors.paper }}>
    {look ? <Reveal look={look} count={looks.length} chips={chips} profile={profile} insets={{ top, bottom }} onTry={() => setPhase('tryon')} onAll={save} />
      : <View style={[styles.screen, pad, { justifyContent: 'center' }]}><Headline kicker="Almost" title="Nothing fits" italic="those limits yet." /><Text style={styles.lede}>Try a different department or fewer no’s.</Text><View style={{ height: 24 }} /><RaisedButton label="Start again" showArrow={false} onPress={() => { setLiked([]); setPassed([]); setAnswered(0); setPhase('department'); }} /></View>}
    {phase === 'save' && <SaveSheet count={looks.length} size={profile.topSize} bottom={bottom} onDone={destination => { if (finish()) router.replace(destination); }} />}
  </View>;
}

function Departments({ value, onChange }: { value: ShopFor | null; onChange: (value: ShopFor) => void }) {
  const { height } = useScreenSize();
  const panel = Math.max(180, Math.min(300, height * 0.34));
  const options: { value: 'womens' | 'mens'; name: string; note: string; photo: ImageSourcePropType; label: string }[] = [
    { value: 'womens', name: 'Womenswear', note: 'Oxfords, knits, tailoring', photo: previewAssets.womens, label: 'A woman in a camel coat, white oxford shirt and khaki chinos' },
    { value: 'mens', name: 'Menswear', note: 'Oxfords, chinos, knits', photo: previewAssets.weekend, label: 'A man in a cream knit and cream trousers' },
  ];
  return <View accessibilityRole="radiogroup" accessibilityLabel="Department">
    <View style={styles.depts}>{options.map(option => {
      const on = value === option.value || value === 'both';
      return <MotionPressable key={option.value} glass={false} accessibilityRole="radio" accessibilityState={{ checked: value === option.value }} accessibilityLabel={option.name + ', ' + option.note} onPress={() => onChange(option.value)} style={{ flex: 1, gap: 12 }}>
        <View style={[styles.deptPhoto, { height: panel, backgroundColor: colors.plate }]}>
          <Image accessibilityLabel={option.label} source={option.photo} resizeMode="cover" style={{ width: '100%', height: '100%' }} />
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderWidth: 1, borderColor: on ? colors.ink : 'transparent', borderRadius: 2 }]} />
          <View style={[styles.check, on ? { backgroundColor: colors.ink } : { borderWidth: 1, borderColor: colors.paper }]}>{on && <FormIcon name="check" size={14} color={colors.paper} />}</View>
        </View>
        <View><Text style={styles.deptName}>{option.name}</Text><Text style={styles.deptNote}>{option.note}</Text></View>
      </MotionPressable>;
    })}</View>
    <MotionPressable glass={false} accessibilityRole="radio" accessibilityState={{ checked: value === 'both' }} onPress={() => onChange('both')} style={[styles.both, value === 'both' && { borderColor: colors.ink }]}>
      <Text style={styles.bothText}><Text style={{ fontFamily: family.sansMedium, color: colors.ink }}>Both</Text> · one feed, every department</Text>
      <View style={[styles.radio, value === 'both' && { backgroundColor: colors.ink, borderColor: colors.ink }]}>{value === 'both' && <FormIcon name="check" size={12} color={colors.paper} />}</View>
    </MotionPressable>
  </View>;
}

function Answer({ label, yes = false, onPress }: { label: string; yes?: boolean; onPress: () => void }) {
  return <View style={{ alignItems: 'center', gap: 8 }}>
    <MotionPressable glass={false} accessibilityRole="button" accessibilityLabel={yes ? 'I would wear this' : 'Not for me'} onPress={onPress} style={[styles.round, yes ? { backgroundColor: colors.ink } : { borderWidth: 1, borderColor: colors.line2 }]}>
      <FormIcon name={yes ? 'check' : 'close'} size={22} color={yes ? colors.paper : colors.ink} />
    </MotionPressable>
    <Text style={[styles.answer, yes && { color: colors.ink, fontFamily: family.sansMedium }]}>{label}</Text>
  </View>;
}

/** Line drawings of three trouser cuts; the silhouette, not a body. */
function Trouser({ kind }: { kind: Silhouette }) {
  const d = kind === 'fitted' ? 'M14 4h28l-2 60h-9l-3-38-3 38h-9z' : kind === 'regular' ? 'M12 4h32l1 60h-12l-5-38-5 38H11z' : 'M10 4h36l6 60H35l-7-38-7 38H4z';
  return <Svg width={56} height={68} viewBox="0 0 56 68" style={{ alignSelf: 'center' }}><Path d={d} fill="none" stroke={colors.ink} strokeWidth={1.2} strokeLinejoin="round" /></Svg>;
}

function Plate({ product, style }: { product?: Product; style?: object }) {
  const source = product ? retailerPhotography[product.id]?.source ?? (product.imageUri ? { uri: product.imageUri } : undefined) : undefined;
  return <View style={[styles.plate, style]}>{source && <PlateImage source={source} softEdge={product?.slot === 'shoes'} style={{ flex: 1 }} />}</View>;
}

function Composing({ look, count, onDone }: { look?: Look; count: number; onDone: () => void }) {
  const reduced = useReduceMotion(), insets = useSafeAreaInsets();
  const done = useRef(onDone);
  useEffect(() => { done.current = onDone; }, [onDone]);
  const progress = useSharedValue(0), [stage, setStage] = useState(0);
  const pieces = (look?.products ?? []).slice(0, 3);
  useEffect(() => {
    progress.set(withTiming(1, { duration: reduced ? 400 : 3200, easing: Easing.bezier(0.4, 0, 0.2, 1) }));
    const timers = [setTimeout(() => setStage(1), reduced ? 0 : 1100), setTimeout(() => setStage(2), reduced ? 0 : 2100), setTimeout(() => done.current(), reduced ? 700 : 3700)];
    return () => timers.forEach(clearTimeout);
  }, [progress, reduced]);
  const bar = useAnimatedStyle(() => ({ transform: [{ scaleX: progress.get() }] }));
  const steps = [['Reading your ' + (count === 1 ? 'yes' : count + ' yeses'), 'Palette and style words'], ['Sizing to you', 'Your size and silhouette'], ['Pairing pieces', 'From the MUJI pieces saved in FORM']];
  const spots = [{ left: '20%', top: '9%', width: '76%', height: '83%' }, { left: '-5%', top: '4%', width: '57%', height: '46%' }, { left: '-2%', top: '64%', width: '47%', height: '38%' }] as const;
  return <View style={[styles.ink, { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 24 }]}>
    <Text style={styles.inkMark}>FORM</Text>
    <View accessible accessibilityRole="image" accessibilityLabel={'Your first look coming together: ' + pieces.map(p => p.name).join(', ')} style={styles.composePlate}>
      {pieces.map((product, i) => <Rise key={product.id} delay={reduced ? 0 : 300 + i * 1000} style={[{ position: 'absolute' }, spots[i]]}><Plate product={product} style={{ flex: 1, backgroundColor: 'transparent' }} /></Rise>)}
    </View>
    <View style={{ alignItems: 'center', marginTop: 30 }}><Text style={[eyebrow, { color: '#9C978C' }]}>ONE MOMENT</Text><Text accessibilityRole="header" style={[styles.revealTitle, { color: colors.paper, textAlign: 'center' }]}>Composing <Text style={{ fontFamily: family.serifItalic }}>your edit</Text></Text></View>
    <View style={styles.composeBar}><Animated.View style={[styles.composeFill, { transformOrigin: 'left' }, bar]} /></View>
    <View accessibilityLiveRegion="polite" style={styles.composeSteps}>{steps.map(([title, note], i) => <View key={title} style={[styles.composeStep, { opacity: i <= stage ? 1 : 0.28 }]}>
      <View style={[styles.dot, i < stage && { backgroundColor: colors.paper, borderColor: colors.paper }]}>{i < stage && <FormIcon name="check" size={11} color={colors.ink} />}</View>
      <View><Text style={styles.stepTitle}>{title}</Text><Text style={styles.stepNote}>{note}</Text></View>
    </View>)}</View>
  </View>;
}

function Rise({ delay, style, children }: { delay: number; style: object; children: React.ReactNode }) {
  const v = useSharedValue(0);
  useEffect(() => { v.set(withDelay(delay, withTiming(1, { duration: 900, easing: Easing.bezier(0.2, 0.7, 0.2, 1) }))); }, [delay, v]);
  const motion = useAnimatedStyle(() => ({ opacity: v.get(), transform: [{ translateY: 14 * (1 - v.get()) }] }));
  return <Animated.View style={[style, motion]}>{children}</Animated.View>;
}

const SLOT_WORDS: Record<string, string> = { top: 'top', dress: 'dress', outerwear: 'layer', accessory: 'accessory' };
function Reveal({ look, count, chips, profile, insets, onTry, onAll }: { look: Look; count: number; chips: string[]; profile: Profile; insets: { top: number; bottom: number }; onTry: () => void; onAll: () => void }) {
  // The first edit leads with the pieces themselves, not the retailer's model.
  const [lead, ...sides] = look.products;
  const total = look.products.reduce((sum, p) => sum + p.priceCents, 0);
  const [first, second] = chips.length >= 2 ? [chips[0], chips[1].toLowerCase()] : look.title.split(', ');
  const fit = SILHOUETTES.find(s => s.value === profile.fitting?.fitPreference)?.title.toLowerCase();
  const why = (chips.length ? 'You said yes to ' + chips.slice(0, 2).map(c => c.toLowerCase()).join(' and ') + '. ' : 'A considered place to start. ') + (fit ? 'Cut ' + (fit === 'close' ? 'close' : fit) : 'Cut to you') + (profile.topSize ? ', in your size ' + profile.topSize + '.' : '.');
  const names = look.products.map(p => pieceWord(p, SLOT_WORDS));
  return <View style={{ flex: 1, paddingHorizontal: layout.gutter, paddingTop: insets.top + 8, paddingBottom: insets.bottom }}>
    <View style={styles.revealHead}><Text style={styles.mark}>FORM</Text><Text style={styles.counter}>Look 01 <Text style={{ color: colors.faint }}>/</Text> {String(count).padStart(2, '0')}</Text></View>
    <Rise delay={0} style={{ marginTop: 18 }}><Text style={eyebrow}>YOUR EDIT IS READY</Text><Text accessibilityRole="header" style={styles.revealTitle}>{first}{second ? ',\n' : ''}{second ? <Text style={{ fontFamily: family.serifItalic }}>{second}</Text> : null}</Text></Rise>
    <Rise delay={120} style={styles.revealBoard}>
      <View style={[styles.revealHero, { backgroundColor: colors.plate }]}>
        <Plate product={lead} style={{ flex: 1, padding: 16 }} />
      </View>
      {sides.length > 0 && <View style={styles.revealSides}>{sides.map(p => <View key={p.id} style={{ flex: 1 }}><Plate product={p} style={{ flex: 1, padding: 8 }} /><Text style={styles.plateLabel}>{pieceWord(p, SLOT_WORDS).toUpperCase()}</Text></View>)}</View>}
    </Rise>
    <Rise delay={240} style={{ marginTop: 16 }}>
      <Text style={styles.why}>{why}</Text>
      <View style={styles.sum}><Text style={styles.sumText}>{names.map((n, i) => i ? n : n[0].toUpperCase() + n.slice(1)).join(', ')} · {lead.brand}</Text><Text style={[styles.sumText, { color: colors.ink }]}>{formatPrice(total)}</Text></View>
    </Rise>
    <View style={{ height: 20 }} />
    <RaisedButton label="See it on you" showArrow={false} icon={<FormIcon name="tryon" size={19} color={colors.paper} />} onPress={onTry} />
    <MotionPressable glass={false} accessibilityRole="button" onPress={onAll} style={styles.textButton}><Text style={styles.underline}>See all {count} looks</Text></MotionPressable>
  </View>;
}

function TryOnInvite({ insets, onClose, onTake, onLater }: { insets: { top: number; bottom: number }; onClose: () => void; onTake: () => void; onLater: () => void }) {
  const reduced = useReduceMotion(), scan = useSharedValue(0), [h, setH] = useState(0);
  useEffect(() => { if (!reduced) { const loop = () => { scan.set(0); scan.set(withTiming(1, { duration: 3200, easing: Easing.bezier(0.5, 0, 0.5, 1) })); }; loop(); const id = setInterval(loop, 3400); return () => clearInterval(id); } }, [reduced, scan]);
  const line = useAnimatedStyle(() => ({ opacity: reduced ? 0 : Math.min(1, scan.get() * 10, (1 - scan.get()) * 10), transform: [{ translateY: scan.get() * Math.max(0, h - 40) }] }));
  return <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
    <MotionPressable glass={false} accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={[styles.close]}><FormIcon name="close" size={18} /></MotionPressable>
    <View style={{ marginTop: 10 }}><Headline kicker="Try-on" title="See it" italic="on you." /><Text style={styles.lede}>One full-length photo, and you can try on every look in your edit.</Text></View>
    <View accessible accessibilityRole="image" accessibilityLabel="Framing guide: stand so your whole body fits inside the frame" onLayout={e => setH(e.nativeEvent.layout.height)} style={styles.frame}>
      {(['tl', 'tr', 'bl', 'br'] as const).map(c => <View key={c} style={[styles.corner, c[0] === 't' ? { top: 18, borderTopWidth: 1.5 } : { bottom: 18, borderBottomWidth: 1.5 }, c[1] === 'l' ? { left: '27%', borderLeftWidth: 1.5 } : { right: '27%', borderRightWidth: 1.5 }]} />)}
      <Svg width={120} height="82%" viewBox="0 0 120 240" style={{ alignSelf: 'center', marginTop: '6%' }}>
        <Circle cx={60} cy={24} r={16} fill="none" stroke={colors.muted} strokeWidth={1.25} strokeDasharray="3 4" />
        <Path d="M44 50c-12 3-20 8-22 20l-6 62M76 50c12 3 20 8 22 20l6 62M38 62l2 66c0 6 2 10 4 14l2 94M82 62l-2 66c0 6-2 10-4 14l-2 94M60 150v86" fill="none" stroke={colors.muted} strokeWidth={1.25} strokeDasharray="3 4" strokeLinecap="round" />
      </Svg>
      <Animated.View style={[styles.scan, line]} />
    </View>
    <View style={{ gap: 10, marginTop: 20 }}>{['Head to toe, phone at chest height', 'Daylight and a plain wall', 'Everyday, close-fitting clothes'].map((tip, i) => <View key={tip} style={styles.tip}><Text style={styles.tipNo}>0{i + 1}</Text><Text style={styles.tipText}>{tip}</Text></View>)}</View>
    <Text style={styles.private}>Your photos stay on this device until you ask for a try-on.</Text>
    <View style={{ flex: 1, minHeight: 16 }} />
    <RaisedButton label="Take a photo" showArrow={false} onPress={onTake} />
    <MotionPressable glass={false} accessibilityRole="button" onPress={onLater} style={styles.textButton}><Text style={[styles.underline, { color: colors.muted, textDecorationLine: 'none' }]}>Not now</Text></MotionPressable>
  </View>;
}

function SaveSheet({ count, size, bottom, onDone }: { count: number; size: string; bottom: number; onDone: (destination: '/home' | '/login') => void }) {
  const ready = useAuth(s => s.ready), [busy, setBusy] = useState<string | null>(null);
  const rise = useSharedValue(0), drag = useSharedValue(0), height = useSharedValue(440), reduced = useReduceMotion();
  useEffect(() => { rise.set(withTiming(1, { duration: reduced ? 0 : 500, easing: Easing.bezier(0.2, 0.8, 0.2, 1) })); }, [reduced, rise]);
  // Dragging the sheet down, or tapping behind it, is the same as Not now.
  const dismiss = () => { if (!busy) onDone('/home'); };
  const pan = usePanGesture({
    activeOffsetY: [-12, 8], failOffsetX: [-24, 24], maxPointers: 1,
    onUpdate: event => { 'worklet'; drag.set(event.translationY > 0 ? event.translationY : event.translationY / 6); },
    onDeactivate: event => {
      'worklet';
      if (!event.canceled && (event.translationY > height.get() * 0.28 || event.velocityY > 900)) { drag.set(withTiming(height.get(), { duration: 200 })); scheduleOnRN(dismiss); }
      else drag.set(withSpring(0, { damping: 24, stiffness: 280 }));
    },
  });
  const sheet = useAnimatedStyle(() => ({ transform: [{ translateY: (1 - rise.get()) * height.get() + drag.get() }] }));
  const scrim = useAnimatedStyle(() => ({ opacity: rise.get() * (1 - Math.min(1, Math.max(0, drag.get()) / height.get())) }));
  async function provider(kind: 'apple' | 'google') {
    if (busy) return; setBusy(kind);
    try { if (await signInProvider(kind)) { showToast('You’re signed in'); onDone('/home'); } } catch (error) { showToast(authMessage(error), 'warning'); } finally { setBusy(null); }
  }
  return <>
    <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim }, scrim]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Not now" onPress={dismiss} style={StyleSheet.absoluteFill} />
    </Animated.View>
    <GestureDetector gesture={pan}>
    <Animated.View accessibilityViewIsModal onLayout={event => height.set(event.nativeEvent.layout.height)} style={[styles.sheet, { paddingBottom: bottom + 8 }, sheet]}>
      <View style={styles.grabberHit}><View style={styles.grabber} /></View>
      <Text style={[eyebrow, { marginTop: 26 }]}>{count} LOOKS{size ? ' · SIZED ' + size : ''}</Text>
      <Text accessibilityRole="header" style={[styles.revealTitle, { marginTop: 8 }]}>Keep your <Text style={{ fontFamily: family.serifItalic }}>edit.</Text></Text>
      <Text style={styles.lede}>Your looks and sizes are already kept on this phone. Sign in to set up your account; syncing between devices isn’t available yet.</Text>
      <View style={{ gap: 10, marginTop: 24 }}>
        <RaisedButton label={busy === 'apple' ? 'Connecting to Apple' : 'Continue with Apple'} icon={<ProviderMark provider="apple" />} showArrow={false} busy={busy === 'apple'} disabled={!!busy || !ready} onPress={() => provider('apple')} />
        <RaisedButton label={busy === 'google' ? 'Connecting to Google' : 'Continue with Google'} icon={<ProviderMark provider="google" />} light showArrow={false} busy={busy === 'google'} disabled={!!busy || !ready} onPress={() => provider('google')} />
        <View style={styles.sheetLinks}>
          <MotionPressable glass={false} accessibilityRole="button" disabled={!!busy} onPress={() => onDone('/login')} style={styles.textButton}><Text style={styles.underline}>Continue with email</Text></MotionPressable>
          <MotionPressable glass={false} accessibilityRole="button" disabled={!!busy} onPress={() => onDone('/home')} style={styles.textButton}><Text style={[styles.underline, { color: colors.muted, textDecorationLine: 'none' }]}>Not now</Text></MotionPressable>
        </View>
      </View>
      <Text style={styles.terms}>By continuing you agree to the Terms and Privacy Policy.</Text>
    </Animated.View>
    </GestureDetector>
  </>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper, paddingHorizontal: layout.gutter },
  intro: { marginTop: 18, marginBottom: 22 },
  lede: { fontFamily: family.sans, fontSize: 14.5, lineHeight: 21, color: colors.ink2, marginTop: 10 },
  counter: { fontFamily: family.sans, fontSize: 12, letterSpacing: 0.7, color: colors.muted, fontVariant: ['tabular-nums'] },
  depts: { flexDirection: 'row', gap: 12 },
  deptPhoto: { borderRadius: 2, overflow: 'hidden' },
  check: { position: 'absolute', right: 10, top: 10, width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  deptName: { fontFamily: family.serif, fontSize: 25, lineHeight: 27, color: colors.ink },
  deptNote: { fontFamily: family.sans, fontSize: 12.5, color: colors.muted, marginTop: 3 },
  both: { marginTop: 20, height: 52, paddingHorizontal: 16, borderWidth: 1, borderColor: colors.line2, borderRadius: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bothText: { fontFamily: family.sans, fontSize: 14, color: colors.muted },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 1, borderColor: colors.line2, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 28, overflow: 'hidden', marginTop: -8, marginBottom: 14 },
  soFar: { fontFamily: family.serifItalic, fontSize: 15, color: colors.ink2, marginRight: 4, flexShrink: 0 },
  soFarEmpty: { fontFamily: family.sans, fontSize: 12, color: colors.faint },
  chip: { height: 26, flexShrink: 0, paddingHorizontal: 10, borderWidth: 1, borderColor: colors.line2, borderRadius: 999, justifyContent: 'center' },
  chipText: { fontFamily: family.sans, fontSize: 12, color: colors.ink },
  deck: { flex: 1, marginBottom: 30 },
  answers: { flexDirection: 'row', justifyContent: 'center', gap: 40 },
  round: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  answer: { fontFamily: family.sans, fontSize: 12, color: colors.muted },
  hint: { fontFamily: family.sans, fontSize: 12, color: colors.muted, textAlign: 'center', marginTop: 14 },
  label: { marginBottom: 12 },
  sizes: { flexDirection: 'row', gap: 8, marginBottom: 28 },
  size: { flex: 1, height: 46, borderRadius: 2, borderWidth: 1, borderColor: colors.line2, alignItems: 'center', justifyContent: 'center' },
  sizeOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  sizeText: { fontFamily: family.sans, fontSize: 14, color: colors.ink },
  fits: { flexDirection: 'row', gap: 8 },
  fit: { flex: 1, height: 168, borderWidth: 1, borderColor: colors.line2, borderRadius: 2, padding: 12, paddingTop: 14, justifyContent: 'space-between' },
  fitTitle: { fontFamily: family.serif, fontSize: 20, lineHeight: 22, color: colors.ink },
  fitNote: { fontFamily: family.sans, fontSize: 11.5, color: colors.muted, marginTop: 2 },
  measure: { marginTop: 24, paddingVertical: 14, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.line, gap: 2 },
  measureTitle: { fontFamily: family.sansMedium, fontSize: 14, color: colors.ink },
  measureNote: { fontFamily: family.sans, fontSize: 12.5, color: colors.muted },
  reassure: { fontFamily: family.serifItalic, fontSize: 17, lineHeight: 22, color: colors.ink2, marginTop: 22 },
  ink: { flex: 1, backgroundColor: colors.ink, alignItems: 'center', paddingHorizontal: 32 },
  inkMark: { fontFamily: family.sansMedium, fontSize: 13, letterSpacing: 5.5, paddingLeft: 5.5, color: colors.paper },
  composePlate: { width: 264, height: 324, marginTop: 56, backgroundColor: colors.plate, borderRadius: 2, overflow: 'hidden' },
  composeBar: { width: 264, height: 1, backgroundColor: colors.ink2, marginTop: 24, overflow: 'hidden' },
  composeFill: { flex: 1, backgroundColor: colors.paper },
  composeSteps: { width: 264, gap: 16, marginTop: 26 },
  composeStep: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  dot: { width: 18, height: 18, borderRadius: 9, borderWidth: 1, borderColor: colors.muted, alignItems: 'center', justifyContent: 'center' },
  stepTitle: { fontFamily: family.sans, fontSize: 14, lineHeight: 20, color: colors.paper },
  stepNote: { fontFamily: family.sans, fontSize: 12, color: '#9C978C' },
  revealHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 8 },
  mark: { fontFamily: family.sansMedium, fontSize: 13, letterSpacing: 5.5, color: colors.ink },
  revealTitle: { fontFamily: family.serif, fontSize: 38, lineHeight: 40, letterSpacing: -0.4, color: colors.ink, marginTop: 8 },
  revealBoard: { flexDirection: 'row', gap: 8, marginTop: 18, flex: 1, maxHeight: 440, minHeight: 220 },
  revealHero: { flex: 1, borderRadius: 2, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' },
  revealSides: { width: 104, gap: 8 },
  plate: { backgroundColor: colors.plate, borderRadius: 2, overflow: 'hidden' },
  plateLabel: { ...eyebrow, position: 'absolute', left: 8, bottom: 7, fontSize: 9.5, letterSpacing: 1.5 },
  why: { fontFamily: family.serifItalic, fontSize: 17, lineHeight: 22, color: colors.ink2 },
  sum: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.line },
  sumText: { fontFamily: family.sans, fontSize: 14, color: colors.ink2 },
  textButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  underline: { fontFamily: family.sansMedium, fontSize: 13.5, color: colors.ink, textDecorationLine: 'underline' },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: -10, marginTop: 6 },
  frame: { flex: 1, maxHeight: 290, minHeight: 180, marginTop: 22, backgroundColor: colors.plate, borderRadius: 2, overflow: 'hidden' },
  corner: { position: 'absolute', width: 22, height: 22, borderColor: colors.ink },
  scan: { position: 'absolute', left: '27%', right: '27%', top: 20, height: 1, backgroundColor: colors.ink },
  tip: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  tipNo: { width: 22, fontFamily: family.sansMedium, fontSize: 11, letterSpacing: 0.6, color: colors.muted },
  tipText: { fontFamily: family.sans, fontSize: 14, color: colors.ink2 },
  private: { fontFamily: family.sans, fontSize: 12.5, color: colors.muted, marginTop: 18 },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: layout.gutter, paddingTop: 12, backgroundColor: colors.paper, borderTopLeftRadius: 22, borderTopRightRadius: 22 },
  grabberHit: { alignSelf: 'stretch', height: 20, marginTop: -12, alignItems: 'center', justifyContent: 'center' },
  grabber: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.line2 },
  sheetLinks: { flexDirection: 'row', justifyContent: 'center', gap: 28 },
  terms: { fontFamily: family.sans, fontSize: 11, lineHeight: 16, color: colors.muted, textAlign: 'center', marginTop: 10 },
});
