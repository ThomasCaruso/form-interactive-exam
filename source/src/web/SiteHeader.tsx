import { useGlobalSearchParams, useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Image, Pressable, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import { onModelPhotography } from '../data/editorial';
import { useFormStore } from '../state/store';
import { colors } from '../theme/tokens';
import { family } from '../theme/typography';
import { ColumnProvider, HEADER_HEIGHT } from './desktop';

export type SiteLink = { key: string; label: string; active: boolean; count?: number; onPress: () => void };

/** Clears everything FORM keeps in this browser and opens the cover again. */
export async function startOver() {
  try { localStorage.clear(); sessionStorage.clear(); } catch {}
  try {
    const dbs = indexedDB.databases ? await indexedDB.databases() : [];
    await Promise.all(dbs.map(db => db.name && new Promise(done => {
      const request = indexedDB.deleteDatabase(db.name!);
      request.onsuccess = request.onerror = request.onblocked = done;
    })));
  } catch {}
  const base = location.pathname.replace(/\/app\/.*$/, '/app/');
  location.replace(base);
}

function HoverLink({ label, active, count, onPress }: Omit<SiteLink, 'key'>) {
  const [hover, setHover] = useState(false);
  return <Pressable accessibilityRole="tab" accessibilityState={{ selected: active }} accessibilityLabel={label}
    onHoverIn={() => setHover(true)} onHoverOut={() => setHover(false)} onPress={onPress} style={styles.link}>
    <Text style={[styles.linkText, (active || hover) && styles.linkOn]}>{label}{!!count && <Text style={styles.count}> {count}</Text>}</Text>
    <View style={[styles.underline, { transform: [{ scaleX: active ? 1 : hover ? 0.5 : 0 }] }]} />
  </Pressable>;
}

/** The website's top bar: wordmark, the sections, and a quiet way to start over. */
export function SiteHeader({ links, right }: { links?: SiteLink[]; right?: ReactNode }) {
  const router = useRouter();
  const onboarded = useFormStore(s => s.onboardingComplete);
  return <View style={styles.bar}>
    <View style={styles.inner}>
      <Pressable accessibilityRole="link" accessibilityLabel="FORM home" onPress={() => onboarded ? router.navigate('/home') : router.navigate('/welcome')} style={styles.brand}>
        <Text style={styles.wordmark}>FORM</Text>
        <Text style={styles.tag}>Your personal stylist</Text>
      </Pressable>
      <View accessibilityRole="tablist" style={styles.links}>
        {links?.map(({ key, ...link }) => <HoverLink key={key} {...link} />)}
      </View>
      <View style={styles.right}>{right}</View>
    </View>
  </View>;
}

export function HeaderAction({ label, onPress, dark = false }: { label: string; onPress: () => void; dark?: boolean }) {
  const [hover, setHover] = useState(false);
  return <Pressable accessibilityRole="button" onHoverIn={() => setHover(true)} onHoverOut={() => setHover(false)} onPress={onPress}
    style={[styles.action, dark && styles.actionDark, hover && (dark ? styles.actionDarkHover : styles.actionHover)]}>
    <Text style={[styles.actionText, dark && { color: colors.paper }]}>{label}</Text>
  </Pressable>;
}

/** Fills its frame. Width and height are explicit because React Native Web otherwise sizes a bundled image to its pixel size. */
const fill = { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' } as const;

const styles = StyleSheet.create({
  bar: { height: HEADER_HEIGHT, backgroundColor: 'rgba(243,240,234,0.92)', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line2, zIndex: 10, backdropFilter: 'blur(14px)' } as object,
  inner: { flex: 1, flexDirection: 'row', alignItems: 'center', width: '100%', maxWidth: 1360, alignSelf: 'center', paddingHorizontal: 40 },
  brand: { flex: 1, flexDirection: 'row', alignItems: 'baseline', gap: 14 },
  wordmark: { fontFamily: family.sansMedium, fontSize: 17, letterSpacing: 6, color: colors.ink },
  tag: { fontFamily: family.serifItalic, fontSize: 15, color: colors.muted },
  links: { flexDirection: 'row', gap: 6 },
  link: { height: HEADER_HEIGHT, paddingHorizontal: 16, justifyContent: 'center', alignItems: 'center' },
  linkText: { fontFamily: family.sansMedium, fontSize: 13.5, letterSpacing: 0.2, color: colors.muted, transitionProperty: 'color', transitionDuration: '160ms' } as object,
  linkOn: { color: colors.ink },
  count: { fontFamily: family.sans, fontSize: 11, color: colors.faint },
  underline: { position: 'absolute', bottom: -0.5, left: 16, right: 16, height: 1.5, backgroundColor: colors.ink, transitionProperty: 'transform', transitionDuration: '200ms' } as object,
  right: { flex: 1, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 10 },
  action: { height: 38, paddingHorizontal: 18, borderRadius: 999, borderWidth: 1, borderColor: colors.line2, justifyContent: 'center', transitionProperty: 'background-color, border-color', transitionDuration: '160ms' } as object,
  actionHover: { borderColor: colors.ink, backgroundColor: colors.card },
  actionDark: { backgroundColor: colors.ink, borderColor: colors.ink },
  actionDarkHover: { backgroundColor: colors.ink2 },
  actionText: { fontFamily: family.sansMedium, fontSize: 12.5, color: colors.ink },
});

const quietConfidence = require('../../assets/placeholders/quiet-confidence.jpg');
const outfit = require('../../assets/placeholders/outfit.jpg');
const womens = require('../../assets/placeholders/womens-weekend.jpg');
const nightOut = require('../../assets/placeholders/night-out.jpg');
const weekend = require('../../assets/placeholders/weekend-ease.jpg');
/** What the photograph beside each step says. */
const panels: Record<string, { image: ImageSourcePropType; eyebrow: string; title: string; italic: string; body: string }> = {
  start: { image: womens, eyebrow: 'GETTING TO KNOW YOU', title: 'Two minutes,', italic: 'then it knows.', body: 'Pick a department, react to eight pieces and tell FORM how you like things to fit. That is all it needs to compose your first edit.' },
  onboarding: { image: womens, eyebrow: 'GETTING TO KNOW YOU', title: 'Two minutes,', italic: 'then it knows.', body: 'A few quick questions shape your feed, your sizes and your budget.' },
  results: { image: outfit, eyebrow: 'YOUR EDIT', title: 'Composed', italic: 'for you.', body: 'Every look is built in your size from pieces you can buy today, and explained in a sentence.' },
  product: { image: quietConfidence, eyebrow: 'THE PIECE', title: 'A closer', italic: 'look.', body: 'Details, colour and fit for one piece, and how it works with what you already like.' },
  plan: { image: weekend, eyebrow: 'YOUR WEEK', title: 'Dressed', italic: 'ahead of time.', body: 'Plan outfits around your calendar and the weather.' },
};
const fallback = { image: nightOut, eyebrow: 'FORM', title: 'Your wardrobe,', italic: 'considered.', body: 'Personal styling from real pieces, in your size and budget.' };

/** Every screen outside the main sections (the quiz, a look, a piece) is a split page under the site bar:
 * a photograph and a line of context on the left, the screen itself on the right. */
export function FlowFrame({ route, children }: { route: string; children: ReactNode }) {
  const router = useRouter();
  const onboarded = useFormStore(s => s.onboardingComplete);
  const { id } = useGlobalSearchParams<{ id?: string }>();
  const base = panels[route] ?? fallback;
  // A piece's page shows that piece as the retailer photographed it on a model, when there is such a photo.
  const worn = route.startsWith('product') && typeof id === 'string' ? onModelPhotography[id] : undefined;
  const panel = worn ? { ...base, image: worn } : base;
  return <View style={{ flex: 1, backgroundColor: colors.paper }}>
    <SiteHeader right={onboarded ? <HeaderAction label="Back to For You" onPress={() => router.navigate('/home')} /> : undefined} />
    <View style={flow.row}>
      <View style={flow.panel}>
        <Image source={panel.image} resizeMode="cover" style={fill} />
        <View style={flow.scrim} />
        <View style={flow.caption}>
          <Text style={flow.eyebrow}>{panel.eyebrow}</Text>
          <Text style={flow.title}>{panel.title}{'\n'}<Text style={{ fontFamily: family.serifItalic }}>{panel.italic}</Text></Text>
          <Text style={flow.body}>{panel.body}</Text>
        </View>
      </View>
      <View style={flow.screen}><ColumnProvider width={620}>{children}</ColumnProvider></View>
    </View>
  </View>;
}
const flow = StyleSheet.create({
  row: { flex: 1, flexDirection: 'row' },
  panel: { flex: 1, overflow: 'hidden', backgroundColor: colors.plate, justifyContent: 'flex-end' },
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundImage: 'linear-gradient(180deg, rgba(22,21,18,0) 45%, rgba(22,21,18,0.62) 100%)' } as object,
  caption: { padding: 56, maxWidth: 560 },
  eyebrow: { fontFamily: family.sansMedium, fontSize: 10.5, letterSpacing: 2.4, color: 'rgba(243,240,234,0.8)' },
  title: { fontFamily: family.serif, fontSize: 56, lineHeight: 56, letterSpacing: -0.8, color: colors.paper, marginTop: 14 },
  body: { fontFamily: family.sans, fontSize: 15, lineHeight: 24, color: 'rgba(243,240,234,0.88)', marginTop: 16, maxWidth: 420 },
  screen: { width: 620, borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: colors.line2, backgroundColor: colors.paper },
});
