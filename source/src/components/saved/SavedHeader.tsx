import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { editorial } from '../Editorial';
import { FormIcon } from '../FormIcon';
import { MotionPressable } from '../MotionPressable';
import type { WishlistCategory, WishlistSort } from '../../domain/savedShopping';
import { colors } from '../../theme/tokens';
import { family } from '../../theme/typography';

export type SavedTab = 'Pieces' | 'Looks' | 'Wardrobe';
export const savedGutter = 20;
const tabs: SavedTab[] = ['Pieces', 'Looks', 'Wardrobe'];
const categories: { value: WishlistCategory; label: string }[] = [{ value: 'all', label: 'All' }, { value: 'top', label: 'Tops' }, { value: 'pants', label: 'Bottoms' }, { value: 'dress', label: 'Dresses' }, { value: 'outerwear', label: 'Outerwear' }, { value: 'shoes', label: 'Shoes' }, { value: 'accessory', label: 'Accessories' }];
export const sorts: { value: WishlistSort; label: string; short: string }[] = [{ value: 'recent', label: 'Recently saved', short: 'Recent' }, { value: 'price-low', label: 'Price: low to high', short: 'Price ↑' }, { value: 'price-high', label: 'Price: high to low', short: 'Price ↓' }];

type Props = {
  tab: SavedTab; counts: Record<SavedTab, number>; onTab: (tab: SavedTab) => void;
  category: WishlistCategory; onCategory: (category: WishlistCategory) => void;
  sort: WishlistSort; onSort: () => void; onAdd: () => void;
};

/** Title, add button, underline tabs with counts, and (on Pieces) one row of filter chips ending in the sort. */
export function SavedHeader({ tab, counts, onTab, category, onCategory, sort, onSort, onAdd }: Props) {
  const current = sorts.find(s => s.value === sort)!;
  return <View>
    <View style={styles.top}>
      <View style={{ flex: 1 }}><Text style={editorial.label}>THE CONSIDERED COLLECTION</Text><Text accessibilityRole="header" style={styles.title}>Saved</Text></View>
      <MotionPressable glass={false} accessibilityRole="button" accessibilityLabel="Add your own piece" onPress={onAdd} style={styles.add}><FormIcon name="edits" size={19} /></MotionPressable>
    </View>
    <View accessibilityRole="tablist" style={styles.tabs}>
      {tabs.map(value => { const on = value === tab; return <MotionPressable key={value} glass={false} accessibilityRole="tab" accessibilityLabel={value + ', ' + counts[value] + (counts[value] === 1 ? ' item' : ' items')} accessibilityState={{ selected: on }} onPress={() => onTab(value)} style={[styles.tab, on && styles.tabOn]}>
        <Text style={[styles.tabText, on && styles.tabTextOn]}>{value}</Text><Text style={styles.count}>{counts[value]}</Text>
      </MotionPressable>; })}
    </View>
    {tab === 'Pieces' && <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow} contentContainerStyle={styles.chips}>
      {categories.map(option => { const on = option.value === category; return <MotionPressable key={option.value} glass={false} hitSlop={{ top: 6, bottom: 6 }} accessibilityRole="button" accessibilityLabel={'Show ' + option.label.toLowerCase()} accessibilityState={{ selected: on }} onPress={() => onCategory(option.value)} style={[styles.chip, on && styles.chipOn]}>
        <Text style={[styles.chipText, on && styles.chipTextOn]}>{option.label}</Text>
      </MotionPressable>; })}
      <MotionPressable glass={false} hitSlop={{ top: 6, bottom: 6 }} accessibilityRole="button" accessibilityLabel={'Sort: ' + current.label} onPress={onSort} style={styles.chip}>
        <Text style={styles.chipText}>{current.short}</Text><View style={{ transform: [{ rotate: '90deg' }] }}><FormIcon name="chevron" size={11} /></View>
      </MotionPressable>
    </ScrollView>}
  </View>;
}
const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 },
  title: { fontFamily: family.serif, fontSize: 36, lineHeight: 40, letterSpacing: -0.4, color: colors.ink, marginTop: 4 },
  add: { width: 44, height: 44, borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line2, alignItems: 'center', justifyContent: 'center' },
  tabs: { flexDirection: 'row', gap: 22, marginTop: 20, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  tab: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 5, borderBottomWidth: 1.5, borderBottomColor: 'transparent' },
  tabOn: { borderBottomColor: colors.ink },
  tabText: { fontFamily: family.sansMedium, fontSize: 13, color: colors.muted }, tabTextOn: { color: colors.ink },
  count: { fontFamily: family.sans, fontSize: 10, color: colors.faint },
  chipRow: { marginTop: 14, marginHorizontal: -savedGutter }, chips: { paddingHorizontal: savedGutter, gap: 8 },
  chip: { minHeight: 36, paddingHorizontal: 14, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line2, flexDirection: 'row', alignItems: 'center', gap: 5 },
  chipOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { fontFamily: family.sansMedium, fontSize: 12, color: colors.ink2 }, chipTextOn: { color: colors.paper },
});
