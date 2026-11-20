import { useRouter } from 'expo-router';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useShallow } from 'zustand/react/shallow';
import { ContextSheet } from '../ContextSheet';
import { FormIcon } from '../FormIcon';
import { LocalPhoto } from '../LocalPhoto';
import { MotionPressable } from '../MotionPressable';
import { displayMeasurement, fittingFromProfile, referenceGuidance } from '../../domain/fitting';
import type { PersonPhotoRole } from '../../domain/types';
import { useFormStore } from '../../state/store';
import { deletePersonPhoto } from '../../storage/personFiles';
import { colors } from '../../theme/tokens';
import { family } from '../../theme/typography';

const MAIN: PersonPhotoRole[] = ['body', 'portrait'], EXTRA: PersonPhotoRole[] = ['face-left', 'face-right', 'head'];

/** Photos are taken once; this is where you change them. */
export function YourPhotos({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const router = useRouter();
  const s = useFormStore(useShallow(st => ({ photos: st.personPhotos, profile: st.profile, draft: st.onboardingDraft, step: st.fittingStep, saveFittingDraft: st.saveFittingDraft })));
  const fit = fittingFromProfile(s.profile), unit = fit.units === 'metric' ? ' cm' : ' in';
  const height = displayMeasurement('heightCm', fit.heightCm, fit.units), waist = displayMeasurement('waistCm', fit.waistCm, fit.units);
  const fitLine = [height && height + unit, waist && 'Waist ' + waist + unit, s.profile.topSize && 'Top ' + s.profile.topSize].filter(Boolean).join(' · ');
  const capture = (role: PersonPhotoRole) => { onClose(); router.push({ pathname: '/capture-person', params: { role } }); };
  const editFit = () => { onClose(); s.saveFittingDraft(s.draft ?? { ...s.profile, fitting: fit }, Math.max(3, s.step)); router.push({ pathname: '/onboarding', params: { from: 'tryon' } }); };
  function remove(role: PersonPhotoRole) { const photo = useFormStore.getState().personPhotos.find(p => p.role === role); if (!photo) return; Alert.alert('Delete this photo?', 'Remove the copy kept by FORM on this device. Your original stays in your library.', [{ text: 'Keep', style: 'cancel' }, { text: 'Delete photo', style: 'destructive', onPress: () => { const current = useFormStore.getState().personPhotos.find(p => p.role === role); if (!current || current.id !== photo.id) return; useFormStore.getState().removePersonPhoto(role); void deletePersonPhoto(photo.localUri); } }]); }
  function reset() { Alert.alert('Reset photos & fit?', 'Remove FORM’s photos of you and the sizes and measurements you supplied. Your style, clothes and saved collection stay.', [{ text: 'Keep', style: 'cancel' }, { text: 'Reset', style: 'destructive', onPress: () => { const state = useFormStore.getState(), previous = [...state.personPhotos]; state.updateProfile({ ...state.profile, fitting: undefined, height: '', topSize: '', waist: '', inseam: '', shoe: '' }); for (const photo of previous) { state.removePersonPhoto(photo.role); void deletePersonPhoto(photo.localUri); } useFormStore.setState({ onboardingDraft: null, fittingStep: 0 }); onClose(); } }]); }
  const tile = (role: PersonPhotoRole, big: boolean) => { const photo = s.photos.find(p => p.role === role), label = referenceGuidance[role].label;
    return <View key={role} style={big ? styles.big : styles.small}>
      <MotionPressable glass={false} accessibilityRole="button" accessibilityLabel={(photo ? 'Change ' : 'Add ') + label} onPress={() => capture(role)} style={[styles.tile, !big && { height: 92 }, !photo && styles.emptyTile]}>
        {photo ? <LocalPhoto uri={photo.localUri} label={label} fit="cover" /> : <Text style={styles.emptyText}>{big ? 'Add' : 'optional'}</Text>}
      </MotionPressable>
      {photo && <MotionPressable glass={false} hitSlop={8} accessibilityRole="button" accessibilityLabel={'Delete ' + label} onPress={() => remove(role)} style={styles.remove}><FormIcon name="close" size={12} color={colors.paper} /></MotionPressable>}
      <Text style={styles.label}>{label}</Text>
    </View>; };
  return <ContextSheet visible={visible} title="Your photos" onClose={onClose}>
    <View style={styles.row}>{MAIN.map(role => tile(role, true))}</View>
    <View style={[styles.row, { marginTop: 12 }]}>{EXTRA.map(role => tile(role, false))}</View>
    <View style={styles.fit}><Text style={styles.fitText}>{fitLine || 'No sizes yet'}</Text>
      <MotionPressable glass={false} accessibilityRole="button" onPress={editFit} style={styles.link}><Text style={styles.linkText}>Edit fit</Text></MotionPressable></View>
    <Text style={styles.privacy}>Kept on this device. Sent only when you try something on.</Text>
    <MotionPressable glass={false} accessibilityRole="button" onPress={reset} style={styles.link}><Text style={styles.resetText}>Reset photos & fit</Text></MotionPressable>
  </ContextSheet>;
}
const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10 }, big: { flex: 1 }, small: { flex: 1 },
  tile: { height: 190, borderRadius: 14, overflow: 'hidden', backgroundColor: colors.paper2 },
  emptyTile: { backgroundColor: 'transparent', borderWidth: 1, borderStyle: 'dashed', borderColor: colors.line2, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontFamily: family.sans, fontSize: 11, color: colors.faint },
  remove: { position: 'absolute', right: 6, top: 6, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.scrim, alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: family.sans, fontSize: 11, color: colors.ink2, marginTop: 6 },
  fit: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 18, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line, paddingTop: 8 },
  fitText: { fontFamily: family.sans, fontSize: 13, color: colors.ink2, flex: 1 },
  link: { minHeight: 44, justifyContent: 'center' }, linkText: { fontFamily: family.sansMedium, fontSize: 13, color: colors.ink, textDecorationLine: 'underline' },
  privacy: { fontFamily: family.sans, fontSize: 11, lineHeight: 17, color: colors.muted, marginTop: 4 },
  resetText: { fontFamily: family.sans, fontSize: 12, color: colors.muted },
});
