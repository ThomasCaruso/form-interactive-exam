import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DetailHeader } from '../src/components/DetailHeader';
import { EditorialScreen, editorial } from '../src/components/Editorial';
import { FormIcon } from '../src/components/FormIcon';
import { GlassSurface } from '../src/components/GlassSurface';
import { MotionPressable } from '../src/components/MotionPressable';
import { showToast } from '../src/components/Toast';
import type { ProfileSection } from '../src/domain/types';
import { useFormStore } from '../src/state/store';
import { colors } from '../src/theme/tokens';
import { family } from '../src/theme/typography';
const sections: { key: ProfileSection; title: string; detail: string }[] = [
  { key: 'week', title: 'Your week', detail: 'Plan what you’ll wear, day by day' },
  { key: 'direction', title: 'Your direction', detail: 'Style, colors and brands' },
  { key: 'budget', title: 'Spending comfort', detail: 'Your budget for a complete look' },
  { key: 'fit', title: 'Your fit', detail: 'Sizes and measurements' },
];
export default function CustomizeProfileScreen() {
  const router = useRouter(); const insets = useSafeAreaInsets(); const profile = useFormStore(s => s.profile);
  const [name, setName] = useState(profile.name); const [hidden, setHidden] = useState<ProfileSection[]>(profile.hiddenProfileSections ?? []);
  const changed = name.trim() !== profile.name || sections.some(section => hidden.includes(section.key) !== !!profile.hiddenProfileSections?.includes(section.key));
  function save() {
    if (!changed) return;
    const live = useFormStore.getState(); live.updateProfile({ ...live.profile, name: name.trim().slice(0, 60), hiddenProfileSections: [...hidden] });
    Keyboard.dismiss(); showToast('Your space, updated'); if (router.canGoBack()) router.back(); else router.replace('/profile');
  }
  const footer = <GlassSurface backing={colors.paper} style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}><MotionPressable accessibilityRole="button" disabled={!changed} accessibilityState={{ disabled: !changed }} onPress={save} style={styles.save}><Text style={styles.saveText}>Make it mine</Text><FormIcon name="check" size={18} color={colors.paper} /></MotionPressable></GlassSurface>;
  return <KeyboardAvoidingView style={editorial.root} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}><EditorialScreen footer={footer}><DetailHeader title="CUSTOMIZE YOU" /><Text style={editorial.heading}>A space of your own.</Text><Text style={[editorial.secondary, { marginTop: 12, marginBottom: 26 }]}>Keep the things you want close. Give the rest a little room.</Text>
    <Text style={editorial.label}>YOUR DISPLAY NAME · OPTIONAL</Text><GlassSurface backing={colors.card} style={styles.nameCard}><TextInput accessibilityLabel="Your display name" value={name} onChangeText={setName} maxLength={60} autoCapitalize="words" autoComplete="name" placeholder="Your name" placeholderTextColor={colors.muted} style={styles.name} /></GlassSurface>
    <Text style={[editorial.label, { marginTop: 28, marginBottom: 12 }]}>VISIBLE IN YOUR SPACE</Text>
    <GlassSurface style={styles.sections}>{sections.map((section, index) => <MotionPressable key={section.key} glass={false} accessibilityRole="checkbox" accessibilityLabel={'Show ' + section.title} accessibilityState={{ checked: !hidden.includes(section.key) }} onPress={() => setHidden(current => current.includes(section.key) ? current.filter(key => key !== section.key) : [...current, section.key])} style={[styles.row, index > 0 && styles.rowBorder]}><View style={{ flex: 1 }}><Text style={styles.rowTitle}>{section.title}</Text><Text style={editorial.secondary}>{section.detail}</Text></View><View style={[styles.check, !hidden.includes(section.key) && styles.checked]}>{!hidden.includes(section.key) && <FormIcon name="check" size={16} color={colors.paper} />}</View></MotionPressable>)}</GlassSurface>
    <Text style={[editorial.secondary, { marginTop: 16 }]}>Your brief and collection always stay within reach. Hiding a section doesn’t remove its preferences or change your recommendations. Bring it back here anytime.</Text>
  </EditorialScreen></KeyboardAvoidingView>;
}
const styles = StyleSheet.create({ nameCard: { borderRadius: 22, paddingHorizontal: 18, paddingVertical: 8, marginTop: 10 }, name: { fontFamily: family.serif, fontSize: 30, color: colors.ink, minHeight: 56 }, sections: { borderRadius: 24, paddingHorizontal: 18 }, row: { minHeight: 88, paddingVertical: 18, flexDirection: 'row', gap: 15, alignItems: 'center' }, rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line }, rowTitle: { fontFamily: family.sansMedium, fontSize: 15, lineHeight: 24, color: colors.ink }, check: { width: 26, height: 26, borderRadius: 13, borderWidth: 1, borderColor: colors.line2, alignItems: 'center', justifyContent: 'center' }, checked: { backgroundColor: colors.ink, borderColor: colors.ink }, footer: { borderRadius: 0, paddingTop: 14, paddingHorizontal: 24 }, save: { minHeight: 54, borderRadius: 27, backgroundColor: colors.ink, flexDirection: 'row', gap: 12, alignItems: 'center', justifyContent: 'center' }, saveText: { fontFamily: family.sansMedium, fontSize: 15, color: colors.paper } });
