import { CameraView, useCameraPermissions, type CameraType } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Image, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MotionPressable } from '../src/components/MotionPressable';
import { GlassSurface } from '../src/components/GlassSurface';
import { FormIcon } from '../src/components/FormIcon';
import { RaisedButton } from '../src/components/RaisedButton';
import { photoRole, referenceGuidance, nextRequiredRole } from '../src/domain/fitting';
import { useFormStore } from '../src/state/store';
import { importPersonPhoto, deletePersonPhoto } from '../src/storage/personFiles';
import { colors } from '../src/theme/tokens';
import { family } from '../src/theme/typography';
import { showToast } from '../src/components/Toast';

export default function CapturePerson() {
  const router = useRouter(), insets = useSafeAreaInsets(), params = useLocalSearchParams<{ role?: string; guided?: string; autostart?: string }>();
  const role = photoRole(params.role), guidance = role ? referenceGuidance[role] : null;
  const [kept, setKept] = useState(false);
  const photos = useFormStore(s => s.personPhotos);
  const next = nextRequiredRole(photos);
  // A finished guided set goes straight on to the preview; closing early just goes back.
  function leave(done = false) { if (params.guided === '1') router.replace(done ? { pathname: '/tryon', params: { go: '1' } } : '/tryon'); else if (router.canGoBack()) router.back(); else router.replace('/tryon'); }
  function continueGuided(role = next) { if (!role) { leave(true); return; } setKept(false); setDraft(null); setReady(false); setOpened(false); setError(''); router.replace({ pathname: '/capture-person', params: { role, guided: '1', ...(params.autostart === '1' ? { autostart: '1' } : {}) } }); }
  const [permission, requestPermission] = useCameraPermissions();
  const timer = useRef<ReturnType<typeof setInterval> | null>(null), timerToken = useRef(0);
  const lifecycle = useRef({ focused: false, foreground: AppState.currentState === 'active' });
  const [countdown, setCountdown] = useState<number | null>(null);
  const camera = useRef<CameraView>(null), mounted = useRef(true), locked = useRef(false);
  const [focused, setFocused] = useState(false), [foreground, setForeground] = useState(AppState.currentState === 'active');
  const [facing, setFacing] = useState<CameraType>('front');
  const [ready, setReady] = useState(false), [opened, setOpened] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [draft, setDraft] = useState<{ uri: string; width: number; height: number; mimeType?: string | null; fileName?: string | null } | null>(null);
  const cancelTimer = useCallback(() => { timerToken.current += 1; if (timer.current) clearInterval(timer.current); timer.current = null; setCountdown(null); }, [setCountdown]);
  useEffect(() => { mounted.current = true; const subscription = AppState.addEventListener('change', state => { lifecycle.current.foreground = state === 'active'; setForeground(state === 'active'); setReady(false); if (state !== 'active') cancelTimer(); }); return () => { mounted.current = false; timerToken.current += 1; subscription.remove(); if (timer.current) clearInterval(timer.current); }; }, [cancelTimer]);
  useFocusEffect(useCallback(() => { lifecycle.current.focused = true; setFocused(true); return () => { lifecycle.current.focused = false; setFocused(false); setReady(false); cancelTimer(); }; }, [cancelTimer]));
  const portrait = role !== 'body';
  function beginCapture() {
    if (portrait) { void capture(); return; }
    if (!ready || timer.current || countdown !== null || locked.current || !lifecycle.current.focused || !lifecycle.current.foreground) return;
    let remaining = 5; const token = ++timerToken.current; setCountdown(remaining); timer.current = setInterval(() => { if (token !== timerToken.current || !lifecycle.current.focused || !lifecycle.current.foreground) return; remaining -= 1; if (remaining === 0) { cancelTimer(); void capture(); } else setCountdown(remaining); }, 1000);
  }
  async function openCamera() { setError(''); try { const granted = permission?.granted || (await requestPermission()).granted; if (mounted.current) { setOpened(granted); if (!granted) setError('Camera access is off. Choose a photo instead, or enable it in Settings.'); } } catch { if (mounted.current) setError('The camera could not open. Choose a photo instead.'); } }
  async function library() {
    if (locked.current) return; locked.current = true; setBusy(true); setError(''); setOpened(false);
    try { const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 }); const asset = result.canceled ? undefined : result.assets[0]; if (mounted.current && asset) setDraft(asset); }
    catch { if (mounted.current) setError('Could not open your library. Please try again.'); }
    finally { locked.current = false; if (mounted.current) setBusy(false); }
  }
  async function capture() {
    if (locked.current || !ready || !camera.current || !mounted.current || !lifecycle.current.focused || !lifecycle.current.foreground) return;
    locked.current = true; setBusy(true); setError('');
    try { const picture = await camera.current.takePictureAsync({ quality: 0.9, exif: false }); if (mounted.current && lifecycle.current.focused && lifecycle.current.foreground && picture) { setDraft(picture); setOpened(false); setReady(false); } }
    catch { if (mounted.current) setError('That photo could not be taken. Try again or choose from your library.'); }
    finally { locked.current = false; if (mounted.current) setBusy(false); }
  }
  async function keep() {
    if (!role || !draft || locked.current) return;
    locked.current = true; setBusy(true); setError('');
    let imported: string | undefined;
    try {
      const photo = await importPersonPhoto(draft.uri, draft.mimeType, draft.fileName); imported = photo.localUri;
      if (!mounted.current) { await deletePersonPhoto(imported); return; }
      const old = useFormStore.getState().personPhotos.find(p => p.role === role);
      useFormStore.getState().setPersonPhoto({ id: 'person-' + Date.now(), role, localUri: imported, width: draft.width, height: draft.height, createdAt: Date.now() });
      if (old) await deletePersonPhoto(old.localUri);
      showToast((guidance?.label ?? 'Reference') + ' kept on this device');
      // Said yes to taking pictures: no stop between photos, the next one opens on its own.
      if (params.guided === '1' && params.autostart === '1') continueGuided(nextRequiredRole(useFormStore.getState().personPhotos));
      else if (params.guided === '1') setKept(true); else leave();
    } catch { if (imported && !useFormStore.getState().personPhotos.some(p => p.localUri === imported)) await deletePersonPhoto(imported); if (mounted.current) setError('Could not keep this photo. Your previous reference is still available. Please try again.'); }
    finally { locked.current = false; if (mounted.current) setBusy(false); }
  }
  useEffect(() => { if (params.autostart === '1' && role && !draft && !opened && !kept) void openCamera(); }, [params.autostart, role]); // eslint-disable-line react-hooks/exhaustive-deps
  const activeCamera = role && opened && permission?.granted && focused && foreground && !draft;
  return <View style={[styles.root, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 14 }]}>
    <View style={styles.header}><MotionPressable accessibilityRole="button" accessibilityLabel="Close capture" disabled={busy} onPress={() => leave()} style={styles.icon}><FormIcon name="close" size={18} /></MotionPressable><Text style={styles.cue}>TRY ON / YOUR PHOTOS</Text><View style={styles.icon} /></View>
    <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
    <Text accessibilityRole="header" style={styles.title}>{kept ? 'A little more you.' : !role ? 'Choose a reference.' : draft ? 'Does this feel like you?' : guidance?.title}</Text>
    <Text style={styles.copy}>{kept ? (next ? 'Reference kept. Next, ' + referenceGuidance[next].label.toLowerCase() + '. Add it now, or come back whenever you like.' : 'You’re all set. Back to Try On.') : draft ? 'Check that you’re clear and fully in frame. Kept on this device. Used by your connected image studio only when you request a preview.' : guidance?.copy}</Text>
    <View style={styles.canvas}>
      {draft ? <Image source={{ uri: draft.uri }} style={StyleSheet.absoluteFill} resizeMode="contain" accessibilityLabel="Your photo for review" /> : activeCamera ? <CameraView ref={camera} style={StyleSheet.absoluteFill} facing={facing} mirror={false} mode="picture" onCameraReady={() => setReady(true)} onMountError={() => { setReady(false); setOpened(false); setError('Camera preview could not start. Choose a photo, or try opening it again.'); }} /> : <View style={styles.placeholder}><FormIcon name="user" size={26} color={colors.muted} /><Text style={styles.hint}>{guidance?.hint ?? 'Choose a reference in Try On'}</Text></View>}
      {countdown !== null && <View pointerEvents="none" style={styles.countdown}><Text style={styles.countdownText}>{countdown}</Text></View>}
      {!draft && role && <View pointerEvents="none" style={[styles.guide, portrait ? styles.faceGuide : styles.bodyGuide]} />}
      {activeCamera && <View style={styles.cameraActions}><MotionPressable accessibilityRole="button" accessibilityLabel="Switch camera" disabled={busy || countdown !== null} onPress={() => { setReady(false); setFacing(f => f === 'front' ? 'back' : 'front'); }} style={styles.flip}><Text style={styles.flipText}>Flip camera</Text></MotionPressable></View>}
    </View>
    {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
    <GlassSurface quiet style={styles.guidance}><Text style={styles.tip}>{draft ? 'You can replace or delete this reference anytime.' : 'Natural light · simple background · no filters'}</Text><Text style={styles.disclosure}>Guided capture. No facial scoring or automatic measurements.</Text></GlassSurface>
    <View style={styles.footer}>
      {role && <RaisedButton disabled={busy || countdown !== null || (!!activeCamera && !ready)} label={kept ? next ? 'Add ' + referenceGuidance[next].label.toLowerCase() : 'Back to Try On' : countdown !== null ? 'Hold your pose…' : busy ? 'One moment…' : draft ? 'Keep this photo' : activeCamera ? portrait ? 'Take photo' : 'Take photo in 5 seconds' : 'Open guided camera'} onPress={() => { if (kept) continueGuided(); else if (draft) void keep(); else if (activeCamera) beginCapture(); else void openCamera(); }} />}
      {countdown !== null && <MotionPressable accessibilityRole="button" onPress={cancelTimer} style={styles.secondary}><Text style={styles.secondaryText}>Cancel timer</Text></MotionPressable>}
      <MotionPressable accessibilityRole="button" disabled={busy || countdown !== null} onPress={() => kept ? leave() : draft ? (setDraft(null), setOpened(false), setReady(false), params.autostart === '1' && void openCamera()) : void library()} style={styles.secondary}><Text style={styles.secondaryText}>{kept ? 'Back to Try On' : draft ? params.autostart === '1' ? 'Retake' : 'Choose another photo' : 'Choose from my photos'}</Text></MotionPressable>
      {!!error && !permission?.granted && <MotionPressable accessibilityRole="button" onPress={() => void Linking.openSettings()} style={styles.secondary}><Text style={styles.secondaryText}>Open settings</Text></MotionPressable>}
    </View>
    </ScrollView>
  </View>;
}
const styles = StyleSheet.create({
  countdown: { position: 'absolute', alignSelf: 'center', top: '36%', width: 90, height: 90, borderRadius: 45, backgroundColor: 'rgba(28,29,25,0.65)', justifyContent: 'center', alignItems: 'center' }, countdownText: { fontFamily: family.serif, fontSize: 58, color: colors.paper },
  root: { flex: 1, backgroundColor: colors.paper, paddingHorizontal: 24 }, header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, icon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, cue: { fontFamily: family.sans, fontSize: 9, letterSpacing: 2, color: colors.muted }, title: { fontFamily: family.serif, fontSize: 32, lineHeight: 38, color: colors.ink, marginTop: 13 }, copy: { fontFamily: family.sans, fontSize: 12, lineHeight: 19, color: colors.muted, marginTop: 9, marginBottom: 18 }, canvas: { flex: 1, minHeight: 240, borderRadius: 4, overflow: 'hidden', backgroundColor: colors.paper2 }, placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 }, hint: { fontFamily: family.sans, fontSize: 12, color: colors.muted }, guide: { position: 'absolute', borderWidth: 1.5, borderColor: 'rgba(255,253,250,0.9)', alignSelf: 'center' }, faceGuide: { width: '63%', height: '70%', top: '12%', borderRadius: 120 }, bodyGuide: { width: '65%', height: '89%', top: '5%', borderRadius: 85 }, cameraActions: { position: 'absolute', bottom: 16, right: 16 }, flip: { padding: 12, borderRadius: 4, backgroundColor: colors.card }, flipText: { fontFamily: family.sans, fontSize: 11, color: colors.ink }, guidance: { paddingVertical: 14, paddingHorizontal: 10, borderRadius: 4, marginTop: 10 }, tip: { fontFamily: family.sansMedium, fontSize: 11, lineHeight: 18, color: colors.ink2, textAlign: 'center' }, disclosure: { fontFamily: family.sans, fontSize: 10, lineHeight: 16, color: colors.muted, textAlign: 'center', marginTop: 4 }, error: { fontFamily: family.sans, fontSize: 12, lineHeight: 18, color: colors.ink, paddingTop: 12 }, footer: { paddingTop: 12 }, secondary: { minHeight: 44, alignItems: 'center', justifyContent: 'center' }, secondaryText: { fontFamily: family.sans, fontSize: 12, color: colors.muted },
});
