import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DetailHeader } from '../src/components/DetailHeader';
import { EditorialScreen, editorial } from '../src/components/Editorial';
import { FormIcon } from '../src/components/FormIcon';
import { GlassSurface } from '../src/components/GlassSurface';
import { MotionPressable } from '../src/components/MotionPressable';
import { showToast } from '../src/components/Toast';
import { briefSignalLabel, parseStyleBrief, STYLE_BRIEF_LIMIT } from '../src/domain/styleBrief';
import { rankProducts } from '../src/domain/stylingEngine';
import { useFormStore } from '../src/state/store';
import { colors } from '../src/theme/tokens';
import { family } from '../src/theme/typography';
const startingPoints = [
  { label: 'Understated', text: 'Minimal, refined outfits in neutral colors.' },
  { label: 'Room to move', text: 'Relaxed silhouettes and cotton pieces.' },
  { label: 'Timeless', text: 'Classic tailoring. Navy, white and understated details.' },
];
export default function EditStyleBriefScreen() {
  const router = useRouter(); const insets = useSafeAreaInsets();
  const profile = useFormStore(s => s.profile);
  const [draft, setDraft] = useState(profile.styleBrief ?? '');
  const signals = useMemo(() => parseStyleBrief(draft).signals, [draft]);
  const available = useMemo(() => rankProducts({ ...profile, styleBrief: draft }).length, [profile, draft]);
  const changed = draft.trim() !== (profile.styleBrief ?? '').trim();
  function save() {
    if (!changed) return;
    const live = useFormStore.getState();
    live.updateProfile({ ...live.profile, styleBrief: draft.trim().slice(0, STYLE_BRIEF_LIMIT) });
    Keyboard.dismiss(); showToast(draft.trim() ? 'Style brief saved · your next selection is personal' : 'Style brief cleared · your preferences still apply');
    if (router.canGoBack()) router.back(); else router.replace('/profile');
  }
  const footer = <GlassSurface backing={colors.paper} style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}><MotionPressable accessibilityRole="button" accessibilityState={{ disabled: !changed }} disabled={!changed} onPress={save} style={styles.save}><Text style={styles.saveText}>Save my brief</Text><FormIcon name="check" size={18} color={colors.paper} /></MotionPressable></GlassSurface>;
  return <KeyboardAvoidingView style={editorial.root} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}><EditorialScreen footer={footer}>
    <DetailHeader title="YOUR STYLE BRIEF" />
    <Text style={styles.heading}>In your own words.</Text><Text style={styles.intro}>What feels like you? Tell us the pieces, colors and silhouettes you reach for—and what you’d rather skip.</Text>
    <GlassSurface backing={colors.card} style={styles.inputCard}><TextInput accessibilityLabel="Personal style brief" multiline value={draft} onChangeText={setDraft} maxLength={STYLE_BRIEF_LIMIT} textAlignVertical="top" placeholder="I like understated outfits, relaxed tailoring and navy. Avoid white. Keep it easy from class to dinner." placeholderTextColor={colors.muted} style={styles.input} /><View style={styles.inputFoot}><Text style={editorial.secondary}>Your direction, always editable</Text><Text style={editorial.secondary}>{draft.length}/{STYLE_BRIEF_LIMIT}</Text></View></GlassSurface>
    <Text style={[editorial.label, { marginTop: 24 }]}>A STARTING POINT, IF YOU NEED ONE</Text><View style={styles.pills}>{startingPoints.map(point => <MotionPressable key={point.label} accessibilityRole="button" accessibilityLabel={'Add starting point: ' + point.label} disabled={draft.length + point.text.length + (draft.trim() ? 1 : 0) > STYLE_BRIEF_LIMIT} onPress={() => setDraft(current => (current.trim() ? current.trim() + '\n' : '') + point.text)} style={styles.pill}><Text style={styles.pillText}>{point.label}</Text><Text style={styles.plus}>+</Text></MotionPressable>)}</View>
    <GlassSurface style={styles.preview}><Text style={editorial.label}>WHAT FORM CAN APPLY</Text>{signals.length ? <View style={styles.pills}>{signals.map(signal => <View key={signal.kind + signal.value} style={styles.signal}><Text style={styles.pillText}>{briefSignalLabel(signal)}</Text></View>)}</View> : <Text style={[editorial.secondary, { marginTop: 12 }]}>{draft.trim() ? 'No supported terms found yet. Your existing preferences will still guide the selection.' : 'Your style, color, material and fit preferences will appear here.'}</Text>}<Text style={[editorial.secondary, { marginTop: 14 }]}>{available ? available + ' catalog pieces remain within your budget and exclusions.' : 'No catalog pieces currently match these exclusions and your budget. You can still save your brief or adjust it.'}</Text></GlassSurface>
    <Text style={styles.note}>This version matches supported words to the catalog; it doesn’t interpret every sentence with AI. Your complete brief stays on this device. Budget and exclusions come first. Saved outfits stay as you saved them.</Text>
  </EditorialScreen></KeyboardAvoidingView>;
}
const styles = StyleSheet.create({
  heading: { ...editorial.heading, fontSize: 38, lineHeight: 43 }, intro: { ...editorial.secondary, marginTop: 12, marginBottom: 22 },
  inputCard: { padding: 18, borderRadius: 4 }, input: { fontFamily: family.serif, fontSize: 24, lineHeight: 31, color: colors.ink, minHeight: 190, padding: 0 }, inputFoot: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginTop: 16, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }, pill: { minHeight: 48, borderRadius: 24, paddingHorizontal: 14, flexDirection: 'row', gap: 10, alignItems: 'center', backgroundColor: colors.card }, pillText: { fontFamily: family.sans, fontSize: 12, lineHeight: 19, color: colors.ink2 }, plus: { fontFamily: family.sans, fontSize: 18, color: colors.muted }, signal: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: 4, backgroundColor: colors.paper2 },
  preview: { marginTop: 24, padding: 18, borderRadius: 4 }, note: { ...editorial.secondary, fontSize: 11, lineHeight: 18, marginTop: 18 },
  footer: { paddingTop: 14, paddingHorizontal: 24, borderRadius: 0 }, save: { backgroundColor: colors.ink, minHeight: 54, borderRadius: 27, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 12 }, saveText: { fontFamily: family.sansMedium, fontSize: 15, color: colors.paper },
});
