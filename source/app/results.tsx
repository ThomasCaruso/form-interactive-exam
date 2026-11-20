import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { EditorialScreen, SectionLabel, editorial } from '../src/components/Editorial';
import { DetailHeader } from '../src/components/DetailHeader';
import { CollageBoard } from '../src/components/CollageBoard';
import { LookActions, LookPieces } from '../src/components/LookControls';
import { showToast } from '../src/components/Toast';
import { findByRouteId } from '../src/domain/lookRouting';
import { fixtureLooks } from '../src/data/catalog';
import { refinementBudget, swapFixturePiece } from '../src/domain/stylingEngine';
import { removePieceFromLook } from '../src/domain/garments';
import { formatMoney, lookTotalCents } from '../src/domain/selectors';
import { useFormStore } from '../src/state/store';
import { useShallow } from 'zustand/react/shallow';
import { colors } from '../src/theme/tokens';
import { family } from '../src/theme/typography';
export default function LookDetailsScreen() {
  const router = useRouter();
  const { lookId, savedId } = useLocalSearchParams<{ lookId?: string; savedId?: string }>();
  const state = useFormStore(useShallow(s => ({ profile: s.profile, replaceLook: s.replaceLook, saved: s.saved, selectedLook: s.selectedLook, sessions: s.sessions })));
  const saved = findByRouteId(state.saved, savedId);
  const match = findByRouteId(state.sessions.flatMap(session => session.looks.map(look => ({ id: look.id, session, look }))), lookId);
  const session = match?.session;
  const look = saved?.look ?? match?.look ?? findByRouteId(fixtureLooks, lookId) ?? (!lookId ? state.selectedLook : findByRouteId(state.selectedLook ? [state.selectedLook] : [], lookId));
  if (!look) return <EditorialScreen><DetailHeader title="Your edit" /><Text style={editorial.title}>This edit is no longer available.</Text></EditorialScreen>;
  const request = saved?.request ?? session?.request;
  const occasion = saved?.occasion ?? session?.occasion ?? 'Curated for you';
  return <EditorialScreen><DetailHeader title="Your edit" />
    <View style={{ marginTop: 20 }}><CollageBoard look={look} boardHeight={380} onSwap={piece => {
      const next = swapFixturePiece(look, piece.id, state.profile, refinementBudget(look.id, state.profile, state.sessions, state.saved));
      if (!next) { showToast('No alternative within your preferences', 'warning'); return; }
      const added = next.products.find(p => !look.products.some(q => q.id === p.id));
      state.replaceLook(look, next, occasion); router.setParams({ lookId: next.id, savedId: '' }); showToast('Swapped in ' + (added?.name ?? 'a new piece'));
    }} onRemovePiece={piece => {
      const next = removePieceFromLook(look, piece.id);
      if (next === look) return;
      state.replaceLook(look, next, occasion); router.setParams({ lookId: next.id, savedId: '' }); showToast('Removed from this board', 'passed');
    }} /></View>
    <Text style={[editorial.heading, { marginTop: 16 }]}>{look.title}</Text><Text style={[editorial.secondary, { marginTop: 8 }]}>{look.description}</Text>
    <View style={styles.totalRow}><Text style={editorial.label}>Total ({look.products.length} {look.products.length === 1 ? 'piece' : 'pieces'})</Text><Text style={styles.totalPrice}>{formatMoney(lookTotalCents(look))}</Text></View>
    {request && <View style={{ marginTop: 20 }}><SectionLabel>Your request</SectionLabel><Text style={editorial.body}>{request.occasion} · {request.dressCode}</Text><Text style={editorial.secondary}>{request.location}{request.location ? ' · ' : ''}Budget {formatMoney(request.budgetCents)}</Text>{!!request.notes && <Text style={editorial.secondary}>{request.notes}</Text>}</View>}
    <View style={{ marginTop: 24 }}><LookPieces look={look} /></View><View style={editorial.rule} /><SectionLabel>Why this edit</SectionLabel><Text style={[editorial.body, { marginTop: 8 }]}>{look.why}</Text><Text style={editorial.secondary}>Curated styling · current retailer prices may vary</Text>
    <LookActions look={look} occasion={occasion} onAdjusted={next => router.setParams({ lookId: next.id, savedId: '' })} />
  </EditorialScreen>;
}
const styles = StyleSheet.create({
  totalRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, marginTop: 20, paddingBottom: 4 },
  totalPrice: { fontFamily: family.serif, fontSize: 27, lineHeight: 31, color: colors.ink },
});
