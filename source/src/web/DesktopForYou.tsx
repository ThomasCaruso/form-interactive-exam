import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { useShallow } from 'zustand/react/shallow';
import { ProductVisual } from '../components/ProductVisual';
import { formatMoney } from '../domain/selectors';
import type { Product } from '../domain/types';
import { useFormStore } from '../state/store';
import { colors } from '../theme/tokens';
import { family } from '../theme/typography';
import { ColumnProvider } from './desktop';

type Props = {
  deck: ReactNode; deckWidth: number; modeSwitch: ReactNode; position: number; total: number; mode: 'Pieces' | 'Looks';
  onLayout: (event: LayoutChangeEvent) => void; onNavigate: (path: string) => void; onOpenPiece: (id: string) => void;
};
const keys: [string, string][] = [['←', 'Pass'], ['→', 'Save'], ['↵', 'Details'], ['Z', 'Undo']];

function Recent({ product, onPress }: { product: Product; onPress: () => void }) {
  const [hover, setHover] = useState(false);
  return <Pressable accessibilityRole="link" accessibilityLabel={product.brand + ', ' + product.name} onPress={onPress} onHoverIn={() => setHover(true)} onHoverOut={() => setHover(false)} style={styles.recent}>
    <View style={[styles.recentPhoto, hover && styles.recentHover]}><ProductVisual product={product} fit="cover" transition={false} /></View>
    <Text numberOfLines={1} style={styles.recentName}>{product.name}</Text>
    <Text style={styles.recentPrice}>{formatMoney(product.priceCents)}</Text>
  </Pressable>;
}

/** For You on a desktop: the page on the left explains and keeps score; the deck stands on the right. */
export function DesktopForYou({ deck, deckWidth, modeSwitch, position, total, mode, onLayout, onNavigate, onOpenPiece }: Props) {
  const { savedPieces, savedLooks } = useFormStore(useShallow(s => ({ savedPieces: s.savedPieces, savedLooks: s.saved.length })));
  const recent = [...savedPieces].sort((a, b) => b.savedAt - a.savedAt).slice(0, 4);
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const progress = total ? Math.min(1, position / total) : 0;
  return <View style={styles.root} onLayout={onLayout}>
    <ScrollView style={styles.side} contentContainerStyle={styles.sideContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.eyebrow}>{today.toUpperCase()}</Text>
      <Text accessibilityRole="header" style={styles.title}>Chosen for you,{'\n'}<Text style={styles.italic}>today.</Text></Text>
      <Text style={styles.lede}>{mode === 'Looks' ? 'Complete looks, composed in your size and budget. Save the ones you would actually wear.' : 'Pieces picked for your taste, fit and budget. Every yes and no teaches FORM a little more about you.'}</Text>
      <View style={styles.progressRow}>
        <Text style={styles.big}>{String(position).padStart(2, '0')}</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.progressLabel}>of {total} {mode === 'Looks' ? 'looks' : 'pieces'} in today’s selection</Text>
          <View style={styles.track}><View style={[styles.fill, { width: `${progress * 100}%` }]} /></View>
        </View>
      </View>
      <View style={styles.switch}>{modeSwitch}</View>
      <View style={styles.keys}>
        {keys.map(([k, label]) => <View key={k} style={styles.key}><View style={styles.cap}><Text style={styles.capText}>{k}</Text></View><Text style={styles.keyLabel}>{label}</Text></View>)}
      </View>
      <Text style={styles.keyHint}>Deck shortcuts work when focus is off any control.</Text>
      <View style={styles.rule} />
      <View style={styles.recentHead}>
        <Text style={styles.eyebrow}>RECENTLY SAVED</Text>
        <Pressable accessibilityRole="link" onPress={() => onNavigate('/saved')}><Text style={styles.link}>{savedPieces.length} {savedPieces.length === 1 ? 'piece' : 'pieces'} · {savedLooks} {savedLooks === 1 ? 'look' : 'looks'}  →</Text></Pressable>
      </View>
      {recent.length ? <View style={styles.recentRow}>
        {recent.map(entry => <Recent key={entry.id} product={entry.product} onPress={() => onOpenPiece(entry.product.id)} />)}
      </View> : <Text style={styles.emptyRecent}>Nothing yet. Press → or Save on a piece you like and it lands here.</Text>}
    </ScrollView>
    <View style={styles.stage}>
      <View style={{ width: deckWidth }}><ColumnProvider width={deckWidth}>{deck}</ColumnProvider></View>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row', backgroundColor: colors.paper },
  side: { flex: 1 },
  sideContent: { paddingHorizontal: 56, paddingTop: 60, paddingBottom: 48, maxWidth: 620 },
  eyebrow: { fontFamily: family.sansMedium, fontSize: 10.5, letterSpacing: 2.2, color: colors.muted },
  title: { fontFamily: family.serif, fontSize: 62, lineHeight: 62, letterSpacing: -0.9, color: colors.ink, marginTop: 18 },
  italic: { fontFamily: family.serifItalic },
  lede: { fontFamily: family.sans, fontSize: 16, lineHeight: 26, color: colors.ink2, marginTop: 20, maxWidth: 440 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 18, marginTop: 34 },
  big: { fontFamily: family.serif, fontSize: 64, lineHeight: 64, color: colors.ink, fontVariant: ['tabular-nums'] },
  progressLabel: { fontFamily: family.sans, fontSize: 13, color: colors.muted },
  track: { height: 2, backgroundColor: colors.line, marginTop: 10, maxWidth: 260 },
  fill: { height: 2, backgroundColor: colors.ink, transitionProperty: 'width', transitionDuration: '300ms' } as object,
  switch: { marginTop: 28, maxWidth: 380 },
  keys: { flexDirection: 'row', flexWrap: 'wrap', gap: 18, marginTop: 4 },
  key: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cap: { minWidth: 28, height: 28, paddingHorizontal: 6, borderRadius: 6, borderWidth: 1, borderColor: colors.line2, borderBottomWidth: 2, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card },
  capText: { fontFamily: family.sansMedium, fontSize: 12, color: colors.ink },
  keyLabel: { fontFamily: family.sans, fontSize: 12.5, color: colors.muted },
  keyHint: { fontFamily: family.sans, fontSize: 12.5, color: colors.muted, marginTop: 8 },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: colors.line2, marginVertical: 32 },
  recentHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  link: { fontFamily: family.sansMedium, fontSize: 12.5, color: colors.ink },
  recentRow: { flexDirection: 'row', gap: 14, marginTop: 16 },
  recent: { flex: 1, maxWidth: 120 },
  recentPhoto: { aspectRatio: 0.8, backgroundColor: colors.plate, borderRadius: 2, overflow: 'hidden', transitionProperty: 'transform', transitionDuration: '200ms' } as object,
  recentHover: { transform: [{ translateY: -3 }] },
  recentName: { fontFamily: family.sans, fontSize: 11.5, color: colors.ink, marginTop: 8 },
  recentPrice: { fontFamily: family.sansMedium, fontSize: 11.5, color: colors.ink2, marginTop: 2 },
  emptyRecent: { fontFamily: family.serifItalic, fontSize: 17, lineHeight: 24, color: colors.muted, marginTop: 14, maxWidth: 380 },
  stage: { width: '50%', maxWidth: 680, alignItems: 'center', justifyContent: 'center', borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: colors.line, backgroundColor: colors.paper2, paddingVertical: 32 },
});
