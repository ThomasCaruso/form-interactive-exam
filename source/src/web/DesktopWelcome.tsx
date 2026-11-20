import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, cancelAnimation, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { CoverLoop, CoverProgress, useCoverLoop } from '../components/CoverLoop';
import { onModelPhotography } from '../data/editorial';
import { realCatalogProducts } from '../data/realCatalog';
import { formatMoney } from '../domain/selectors';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { colors } from '../theme/tokens';
import { family } from '../theme/typography';
import { HEADER_HEIGHT } from './desktop';
import { ScrollDressing } from './ScrollDressing';
import { HeaderAction, SiteHeader } from './SiteHeader';

type Props = { returning: boolean; onStart: () => void; onReturn: () => void };

function CTA({ label, onPress, dark = false }: { label: string; onPress: () => void; dark?: boolean }) {
  const [hover, setHover] = useState(false);
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} onHoverIn={() => setHover(true)} onHoverOut={() => setHover(false)}
    style={[styles.cta, dark ? styles.ctaDark : styles.ctaLight, hover && (dark ? { backgroundColor: colors.ink2 } : { borderColor: colors.ink, backgroundColor: colors.card })]}>
    <Text style={[styles.ctaText, dark && { color: colors.paper }]}>{label}</Text>
    <Text style={[styles.ctaArrow, dark && { color: colors.paper }, hover && { transform: [{ translateX: 4 }] }]}>→</Text>
  </Pressable>;
}

/** Catalogue pieces that MUJI photographed on a model, alternating womenswear and menswear. */
function onModelPieces(count: number) {
  const shot = realCatalogProducts.filter(p => onModelPhotography[p.id]);
  const women = shot.filter(p => p.department === 'womens'), men = shot.filter(p => p.department !== 'womens');
  const picked: typeof shot = [];
  for (let i = 0; picked.length < count && (i < women.length || i < men.length); i++) {
    if (women[i * 3]) picked.push(women[i * 3]);
    if (men[i * 3]) picked.push(men[i * 3]);
  }
  return picked.slice(0, count);
}

/** A slow, endless strip of real pieces from the catalogue, shown as worn. */
function Marquee() {
  const reduced = useReduceMotion();
  const pieces = useMemo(() => onModelPieces(16), []);
  const TILE = 220, GAP = 20, span = pieces.length * (TILE + GAP);
  const x = useSharedValue(0);
  useEffect(() => {
    if (reduced || !span) return;
    x.value = withRepeat(withTiming(-span, { duration: span * 32, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(x);
  }, [reduced, span, x]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  return <View style={styles.marquee} accessibilityLabel="Pieces from the catalogue, shown worn">
    <Animated.View style={[styles.strip, style]}>
      {[...pieces, ...pieces].map((p, i) => <View key={p.id + i} style={{ width: TILE }}>
        <View style={styles.stripPhoto}><Image source={onModelPhotography[p.id]} resizeMode="cover" style={fill} /></View>
        <Text numberOfLines={1} style={styles.stripBrand}>{(p.brand ?? '').toUpperCase()}</Text>
        <Text numberOfLines={1} style={styles.stripName}>{p.name} · {formatMoney(p.priceCents)}</Text>
      </View>)}
    </Animated.View>
  </View>;
}

const quietConfidence = require('../../assets/placeholders/quiet-confidence.jpg');
const nightOut = require('../../assets/placeholders/night-out.jpg');
const weekendEase = require('../../assets/placeholders/weekend-ease.jpg');
const womensWeekend = require('../../assets/placeholders/womens-weekend.jpg');
/** The app's own look photography, named the way the app names the looks. */
const lookbook = [
  { image: nightOut, title: 'Night out', note: 'Dark layers, one sharp jacket' },
  { image: womensWeekend, title: 'Camel & white', note: 'Tailored, easy, all day' },
  { image: weekendEase, title: 'Weekend ease', note: 'Soft knit, relaxed trousers' },
  { image: quietConfidence, title: 'Quiet confidence', note: 'Suede, cream and charcoal' },
];

/** The cover as a website: the promise on the left, the photographs looping on the right, then how it works. */
export function DesktopWelcome({ returning, onStart, onReturn }: Props) {
  const { width, height } = useWindowDimensions();
  const reduced = useReduceMotion(), t = useCoverLoop(reduced);
  const heroHeight = Math.max(620, height - HEADER_HEIGHT);
  const coverHeight = Math.min(heroHeight - 120, 760), coverWidth = Math.round(coverHeight * 390 / 604 * 1.12);
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler(e => { scrollY.value = e.contentOffset.y; });
  return <View style={styles.root}>
    <SiteHeader right={<>{returning && <HeaderAction label="Back to my wardrobe" onPress={onReturn} />}<HeaderAction dark label="Get started" onPress={onStart} /></>} />
    <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} showsVerticalScrollIndicator={false} contentContainerStyle={{ alignItems: 'center' }}>
      <View style={[styles.hero, { minHeight: heroHeight }]}>
        <View style={styles.copy}>
          <Text style={styles.eyebrow}>PERSONAL STYLING, QUIETLY DONE</Text>
          <Text accessibilityRole="header" style={[styles.headline, width < 1200 && { fontSize: 64, lineHeight: 64 }]}>A stylist that{'\n'}<Text style={styles.italic}>actually knows you.</Text></Text>
          <Text style={styles.lede}>FORM learns your taste, fit and budget, then builds complete outfits from real pieces. Two minutes to your first edit. No account, no checkout.</Text>
          <View style={styles.ctas}>
            <CTA dark label="Get started" onPress={onStart} />
            {returning && <CTA label="Back to my wardrobe" onPress={onReturn} />}
          </View>
          <View style={styles.facts}>
            {[['8', 'pieces to learn your taste'], ['100', 'real pieces in your feed'], ['6', 'looks composed for you']].map(([big, small]) => <View key={small} style={styles.fact}>
              <Text style={styles.factBig}>{big}</Text><Text style={styles.factSmall}>{small}</Text>
            </View>)}
          </View>
        </View>
        <View style={{ width: coverWidth }}>
          <View style={styles.coverFrame}><CoverLoop t={t} width={coverWidth} height={coverHeight} /></View>
          <View style={{ marginTop: 16 }}><CoverProgress t={t} reduced={reduced} /></View>
          <View style={styles.coverCaption}><Text style={styles.captionText}>The pieces you choose</Text><Text style={styles.captionText}>The look, worn</Text></View>
        </View>
      </View>

      <ScrollDressing scrollY={scrollY} width={width} height={height - HEADER_HEIGHT} onStart={onStart} />

      <View style={styles.lookbookWrap}>
        <View style={styles.section}>
          <Text style={styles.eyebrow}>THE LOOKBOOK</Text>
          <Text style={styles.sectionTitle}>Complete looks, <Text style={styles.italic}>not just pieces.</Text></Text>
          <View style={styles.lookbook}>
            {lookbook.map(look => <View key={look.title} style={styles.look}>
              <View style={styles.lookPhoto}><Image source={look.image} resizeMode="cover" style={fill} /></View>
              <Text style={styles.lookTitle}>{look.title}</Text>
              <Text style={styles.lookNote}>{look.note}</Text>
            </View>)}
          </View>
        </View>
      </View>

      <View style={styles.marqueeWrap}>
        <View style={styles.section}>
          <Text style={styles.eyebrow}>IN TODAY’S CATALOGUE</Text>
          <Text style={styles.sectionTitle}>Real pieces, <Text style={styles.italic}>real prices.</Text></Text>
        </View>
        <Marquee />
      </View>

      <View style={styles.closing}>
        <Text style={styles.closingTitle}>Your wardrobe, <Text style={styles.italic}>considered.</Text></Text>
        <View style={{ marginTop: 28 }}><CTA dark label="Start your edit" onPress={onStart} /></View>
        <Text style={styles.footnote}>Everything stays in your browser. Prices are a guide from the retailer; nothing is purchased here.</Text>
      </View>
    </Animated.ScrollView>
  </View>;
}

/** Fills its frame. Width and height are explicit because React Native Web otherwise sizes a bundled image to its pixel size. */
const fill = { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' } as const;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  hero: { width: '100%', maxWidth: 1320, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 64, paddingHorizontal: 64, paddingVertical: 48 },
  copy: { flex: 1, maxWidth: 600 },
  eyebrow: { fontFamily: family.sansMedium, fontSize: 11, letterSpacing: 2.6, color: colors.muted },
  headline: { fontFamily: family.serif, fontSize: 84, lineHeight: 82, letterSpacing: -1.4, color: colors.ink, marginTop: 22 },
  italic: { fontFamily: family.serifItalic },
  lede: { fontFamily: family.sans, fontSize: 18, lineHeight: 29, color: colors.ink2, marginTop: 26, maxWidth: 500 },
  ctas: { flexDirection: 'row', gap: 12, marginTop: 36 },
  cta: { height: 54, paddingHorizontal: 28, borderRadius: 999, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, transitionProperty: 'background-color, border-color', transitionDuration: '160ms' } as object,
  ctaDark: { backgroundColor: colors.ink, borderColor: colors.ink },
  ctaLight: { borderColor: colors.line2 },
  ctaText: { fontFamily: family.sansMedium, fontSize: 15, color: colors.ink, letterSpacing: 0.2 },
  ctaArrow: { fontFamily: family.sans, fontSize: 17, color: colors.ink, transitionProperty: 'transform', transitionDuration: '180ms' } as object,
  facts: { flexDirection: 'row', gap: 40, marginTop: 56, paddingTop: 26, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line2 },
  fact: { maxWidth: 140 },
  factBig: { fontFamily: family.serif, fontSize: 40, lineHeight: 42, color: colors.ink },
  factSmall: { fontFamily: family.sans, fontSize: 12.5, lineHeight: 18, color: colors.muted, marginTop: 4 },
  coverFrame: { overflow: 'hidden', borderRadius: 3, boxShadow: '0 30px 60px -30px rgba(40,34,24,0.35)' } as object,
  coverCaption: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  captionText: { fontFamily: family.serifItalic, fontSize: 14, color: colors.muted },
  section: { width: '100%', maxWidth: 1320, paddingHorizontal: 64 },
  sectionTitle: { fontFamily: family.serif, fontSize: 48, lineHeight: 52, letterSpacing: -0.6, color: colors.ink, marginTop: 14 },
  marqueeWrap: { width: '100%', alignItems: 'center', paddingVertical: 96 },
  marquee: { width: '100%', overflow: 'hidden', marginTop: 44 },
  strip: { flexDirection: 'row', gap: 20, paddingLeft: 20 },
  stripPhoto: { height: 290, backgroundColor: colors.plate, borderRadius: 2, overflow: 'hidden' },
  lookbookWrap: { width: '100%', alignItems: 'center', paddingTop: 96 },
  lookbook: { flexDirection: 'row', gap: 20, marginTop: 44 },
  look: { flex: 1 },
  lookPhoto: { aspectRatio: 0.72, backgroundColor: colors.plate, overflow: 'hidden', borderRadius: 2 },
  lookTitle: { fontFamily: family.serif, fontSize: 26, lineHeight: 30, color: colors.ink, marginTop: 16 },
  lookNote: { fontFamily: family.sans, fontSize: 13.5, color: colors.muted, marginTop: 4 },
  stripBrand: { fontFamily: family.sansMedium, fontSize: 9.5, letterSpacing: 1.4, color: colors.muted, marginTop: 10 },
  stripName: { fontFamily: family.sans, fontSize: 13, color: colors.ink, marginTop: 3 },
  closing: { width: '100%', alignItems: 'center', paddingVertical: 110, backgroundColor: colors.paper2, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  closingTitle: { fontFamily: family.serif, fontSize: 64, lineHeight: 66, color: colors.ink, textAlign: 'center' },
  footnote: { fontFamily: family.sans, fontSize: 12.5, color: colors.muted, marginTop: 28, textAlign: 'center' },
});
