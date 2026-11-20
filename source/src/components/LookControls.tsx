import { MotionPressable } from './MotionPressable';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SectionLabel, editorial } from './Editorial';
import { ContextSheet } from './ContextSheet';
import { TextAction } from './DetailHeader';
import { showToast } from './Toast';
import { refineFixtureLook, refinementBudget } from '../domain/stylingEngine';
import { isUserUpload, slotLabel } from '../domain/garments';
import { formatMoney } from '../domain/selectors';
import type { Look, Refinement } from '../domain/types';
import { useFormStore } from '../state/store';
import { useShallow } from 'zustand/react/shallow';
import { tryableFromProducts } from '../domain/trying';
import { colors } from '../theme/tokens';
const adjustments: Refinement[] = ['Less formal', 'More formal', 'Lower price', 'Different shoes', 'Warmer', 'More relaxed'];
export function LookPieces({ look }: { look: Look }) {
  const router = useRouter();
  return <View><SectionLabel>The pieces</SectionLabel>{look.products.map((product, index) => {
    const uploaded = isUserUpload(product);
    return <MotionPressable key={product.id} accessibilityRole="button" accessibilityLabel={uploaded ? 'Edit ' + product.name + ', your uploaded ' + slotLabel(product.slot).toLowerCase() : 'Inspect ' + product.brand + ' ' + product.name} onPress={() => uploaded ? router.push({ pathname: '/add-piece', params: { editId: product.id } }) : router.push({ pathname: '/product', params: { id: product.id } })} style={styles.piece}><Text style={editorial.secondary}>{String(index + 1).padStart(2, '0')}</Text><View style={{ flex: 1 }}><Text style={editorial.body}>{product.name}</Text><Text style={editorial.secondary}>{uploaded ? 'Your upload · ' + slotLabel(product.slot) : product.brand + ' · ' + product.color}</Text></View><Text style={editorial.secondary}>{uploaded ? 'Edit' : formatMoney(product.priceCents)} →</Text></MotionPressable>;
  })}</View>;
}
/** `onApply`: the caller applies an adjustment itself (your outfits on Edits change in place), instead of the look
 * being replaced in its session. */
export function LookActions({ look, occasion, onAdjusted, onApply, adjustmentsOnly = false, prominent = false }: { look: Look; occasion: string; onAdjusted?: (look: Look) => void; onApply?: (look: Look, action: string) => void; adjustmentsOnly?: boolean; prominent?: boolean }) {
  const router = useRouter();
  const state = useFormStore(useShallow(s => ({ profile: s.profile, replaceLook: s.replaceLook, saved: s.saved, selectLook: s.selectLook, sessions: s.sessions, toggleSaved: s.toggleSaved })));
  const [adjusting, setAdjusting] = useState(false);
  const [feedback, setFeedback] = useState('');
  const saved = state.saved.some(s => s.id === look.id);

  return <View style={{ marginTop: 16 }}>
    {!adjustmentsOnly && <View style={editorial.row}><TextAction dark label="Try this on" onPress={() => { state.selectLook(look); useFormStore.getState().trySet(tryableFromProducts(look.products)); router.navigate('/tryon'); }} /><TextAction label={saved ? 'Saved look' : 'Save look'} onPress={() => { const nowSaved = state.toggleSaved(look, occasion); showToast(nowSaved ? 'Look saved' : 'Look removed', nowSaved ? 'success' : 'passed'); }} /></View>}
    <MotionPressable accessibilityRole="button" accessibilityState={{ expanded: adjusting }} onPress={() => { setFeedback(''); setAdjusting(!adjusting); }} style={[styles.adjust, prominent && styles.prominentAdjust]}><Text style={prominent ? editorial.body : editorial.secondary}>Adjust look</Text><Text style={editorial.secondary}>→</Text></MotionPressable>
    <ContextSheet visible={adjusting} title="Adjust your look" onClose={() => setAdjusting(false)}>{!!feedback && <Text accessibilityRole="alert" style={editorial.body}>{feedback}</Text>}{adjustments.map(action => <MotionPressable key={action} accessibilityRole="button" onPress={() => {
      const next = refineFixtureLook(look, action, state.profile, refinementBudget(look.id, state.profile, state.sessions, state.saved));
      if (next === look) { setFeedback('No matching adjustment within your preferences. Try another direction.'); showToast('Try another adjustment', 'warning'); return; }
      setAdjusting(false);
      if (onApply) { onApply(next, action); return; }
      state.replaceLook(look, next, occasion); onAdjusted?.(next); showToast(action + ' · look adjusted');
    }} style={styles.option}><Text style={editorial.body}>{action}</Text><Text style={editorial.secondary}>→</Text></MotionPressable>)}</ContextSheet>
  </View>;
}
const styles = StyleSheet.create({
  piece: { flexDirection: 'row', gap: 14, alignItems: 'center', minHeight: 64, paddingVertical: 12, paddingHorizontal: 14, marginBottom: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  prominentAdjust: { backgroundColor: colors.paper2, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 4 },
  adjust: { marginTop: 10, paddingHorizontal: 16, minHeight: 48, justifyContent: 'center', alignItems: 'flex-end' },
  option: { ...editorial.row, paddingHorizontal: 16, minHeight: 56, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
});
