import { memo } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CUTOUT_PAD, cutouts } from '../data/cutouts';
import { productPhotography } from '../data/photography';
import { isUserUpload } from '../domain/garments';
import { layoutOutfit } from '../domain/outfitLayout';
import { stagePieceFor } from '../domain/outfitRead';
import type { Product } from '../domain/types';
import { colors } from '../theme/tokens';
import { family } from '../theme/typography';
import { FormIcon } from './FormIcon';
import { MotionPressable } from './MotionPressable';

/** The stage, small and still: the same layout as the big one, no motion, no shadows. */
export const OutfitThumb = memo(function OutfitThumb({ products, tucked = false, width, height }: { products: readonly Product[]; tucked?: boolean; width: number; height: number }) {
  const pieces = products.map(p => [p, stagePieceFor(p, cutouts)] as const).filter((x): x is readonly [Product, NonNullable<typeof x[1]>] => !!x[1]);
  const layout = layoutOutfit(pieces.map(x => x[1]), tucked, { width, height }, 5);
  const of = (id: string) => products.find(p => p.id === id)!;
  return <View style={{ width, height }}>
    {layout.boxes.map(box => {
      const p = of(box.id), cut = cutouts[p.id];
      const m = (cut ? CUTOUT_PAD : 0) * box.w;
      const frame = { position: 'absolute' as const, left: box.x - m, top: box.y - m, width: box.w + 2 * m, height: box.h + 2 * m };
      if (cut) return <Image key={box.slot} source={cut.source} style={frame} />;
      if (p.cutoutUri) return <Image key={box.slot} source={{ uri: p.cutoutUri }} style={frame} />;
      const photo = isUserUpload(p) ? (p.localUri ? { uri: p.localUri } : undefined) : productPhotography[p.id]?.source;
      return <View key={box.slot} style={[frame, styles.plate]}>{photo && <Image source={photo} resizeMode="contain" style={styles.fill} />}</View>;
    })}
  </View>;
});

export interface ShelfItem { id: string; name: string; products: readonly Product[]; tucked?: boolean }

const CARD_W = 84, THUMB_H = 104;

/**
 * Your outfits, then FORM's ideas, in one sideways row. Tap to put one on the stage; long-press one of yours for
 * Rename, Duplicate and Delete. `+ New` comes first so a new outfit is always one tap away.
 */
export function OutfitShelf({ mine, ideas, activeId, ideasLabel, onNew, onOpen, onManage, onIdeas }: {
  mine: readonly ShelfItem[]; ideas: readonly ShelfItem[]; activeId: string | undefined; ideasLabel: string;
  onNew: () => void; onOpen: (id: string, idea: boolean) => void; onManage: (id: string) => void; onIdeas: () => void;
}) {
  const card = (item: ShelfItem, idea: boolean) => {
    const active = item.id === activeId;
    return <MotionPressable key={item.id} glass={false} accessibilityRole="button" accessibilityState={{ selected: active }}
      accessibilityLabel={(idea ? 'Idea: ' : 'Your outfit: ') + item.name + (active ? ', on the stage' : '')}
      accessibilityHint={idea ? undefined : 'Long-press to rename, duplicate or delete'}
      onPress={() => onOpen(item.id, idea)} onLongPress={idea ? undefined : () => onManage(item.id)} style={styles.card}>
      <View style={[styles.thumb, idea && styles.ideaThumb, active && styles.active]}><OutfitThumb products={item.products} tucked={item.tucked} width={CARD_W - 4} height={THUMB_H - 4} /></View>
      <Text numberOfLines={1} style={[styles.name, active && styles.nameActive]}>{item.name}</Text>
    </MotionPressable>;
  };
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.shelf} contentContainerStyle={styles.row}>
    <MotionPressable glass={false} accessibilityRole="button" accessibilityLabel="New outfit, starting from this one" onPress={onNew} style={styles.card}>
      <View style={[styles.thumb, styles.newThumb]}><Text style={styles.plus}>+</Text></View>
      <Text style={styles.name}>New</Text>
    </MotionPressable>
    {mine.map(item => card(item, false))}
    <MotionPressable glass={false} accessibilityRole="button" accessibilityLabel={'Ideas for ' + ideasLabel + '. Choose another occasion'} onPress={onIdeas} style={styles.divider}>
      <Text style={styles.ideas}>IDEAS</Text><Text numberOfLines={2} style={styles.ideasFor}>{ideasLabel}</Text><FormIcon name="chevron" size={12} color={colors.muted} />
    </MotionPressable>
    {ideas.map(item => card(item, true))}
  </ScrollView>;
}

const styles = StyleSheet.create({
  shelf: { marginHorizontal: -24, marginBottom: 18 },
  row: { paddingHorizontal: 24, gap: 10, alignItems: 'flex-start' },
  card: { width: CARD_W, gap: 6 },
  thumb: { width: CARD_W, height: THUMB_H, borderRadius: 6, padding: 2, backgroundColor: colors.paper2, borderWidth: 1.5, borderColor: 'transparent', overflow: 'hidden' },
  ideaThumb: { backgroundColor: colors.card },
  active: { borderColor: colors.ink },
  newThumb: { alignItems: 'center', justifyContent: 'center', borderStyle: 'dashed', borderColor: colors.faint, backgroundColor: 'transparent' },
  plus: { fontFamily: family.sans, fontSize: 28, color: colors.ink2 },
  name: { fontFamily: family.sans, fontSize: 11, color: colors.muted },
  nameActive: { fontFamily: family.sansMedium, color: colors.ink },
  divider: { width: 64, height: THUMB_H, justifyContent: 'center', gap: 4, paddingLeft: 8, borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: colors.line2 },
  ideas: { fontFamily: family.sansMedium, fontSize: 9, letterSpacing: 1.6, color: colors.muted },
  ideasFor: { fontFamily: family.sans, fontSize: 10, lineHeight: 13, color: colors.ink2 },
  plate: { borderRadius: 3, backgroundColor: colors.card, overflow: 'hidden' },
  fill: { width: '100%', height: '100%' },
});
