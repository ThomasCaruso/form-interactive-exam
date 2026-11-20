import { useScreenSize } from '../../src/web/desktop';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useShallow } from 'zustand/react/shallow';
import { CollageBoard } from '../../src/components/CollageBoard';
import { FormIcon } from '../../src/components/FormIcon';
import { MotionPressable } from '../../src/components/MotionPressable';
import { RaisedButton } from '../../src/components/RaisedButton';
import { showToast } from '../../src/components/Toast';
import { OnYou } from '../../src/components/tryOn/OnYou';
import { manualStudio, useStudioJob } from '../../src/components/tryOn/useStudioJob';
import { studioConfigured } from '../../src/providers/higgsfield';
import { YourPhotos } from '../../src/components/tryOn/YourPhotos';
import { nextRequiredRole } from '../../src/domain/fitting';
import { selectionFromProduct, selectionKey } from '../../src/domain/garments';
import { readOutfit } from '../../src/domain/outfitRead';
import { formatMoney } from '../../src/domain/selectors';
import type { Product } from '../../src/domain/types';
import { lookFromTrying, nextScene, sameOutfit, selectionProducts } from '../../src/domain/trying';
import { useFormStore } from '../../src/state/store';
import { colors } from '../../src/theme/tokens';
import { family } from '../../src/theme/typography';
import { pressFeedback } from '../../src/utils/haptics';

/** Try On: the outfit you put together in Edits, shown on its own, and one question: are you ready for your pictures?
 * Pieces change in Edits; here they can only come off. You, small, in the corner. */
export default function TryOnScreen() {
  const router = useRouter(), insets = useSafeAreaInsets(), { height } = useScreenSize(), params = useLocalSearchParams<{ go?: string }>();
  const s = useFormStore(useShallow(st => ({ photos: st.personPhotos, selection: st.tryOnSelection, closet: st.closet, scene: st.tryOnScene, setScene: st.setTryOnScene, removeTrying: st.removeTrying, toggleSaved: st.toggleSaved, saved: st.saved })));
  const studio = useStudioJob();
  const [photosOpen, setPhotosOpen] = useState(false), [onYou, setOnYou] = useState(false), [inspected, setInspected] = useState<string | null>(null);
  const products = useMemo(() => selectionProducts(s.selection, s.closet), [s.selection, s.closet]);
  const read = useMemo(() => readOutfit(products), [products]);
  const body = s.photos.find(p => p.role === 'body');

  const job = studio.job;
  const showResult = !!body && job?.status === 'done' && !!job.imageUri && job.bodyReferenceId === body.id && job.scene?.id === s.scene.id && sameOutfit(job.outfit, products);
  const working = studio.running || studio.busy;
  const problem = studio.error || (studio.checked && !studio.ready && products.length ? studio.health : '') || (job?.status === 'unknown' ? job.message ?? 'Check progress before trying again.' : '') || (!studio.running && job?.status === 'failed' && sameOutfit(job.outfit, products) ? job.message ?? 'That didn’t work. Try again.' : '');
  const title = products.length === 1 ? products[0].name : 'Your try-on';
  const look = lookFromTrying(products), isSaved = s.saved.some(x => x.id === look.id);
  // The outfit fills whatever room is left above the question, so all of it shows without scrolling.
  const [room, setRoom] = useState(0);
  const boardHeight = Math.round(Math.min(560, Math.max(220, room ? room - 84 : height * 0.4)));

  function remove(piece: Product) { s.removeTrying(selectionKey(selectionFromProduct(piece))); showToast('Taken off', 'passed'); }
  function saveLook() {
    if (!products.length) return;
    pressFeedback(() => { s.toggleSaved(look, 'Try on'); showToast(isSaved ? 'Removed from Saved' : 'Look saved'); }, 'saved');
  }
  function seeItOnMe() {
    if (!body) { takePictures(); return; }
    if (!showResult && !working && !problem) void studio.create(s.photos, products, title, s.scene);
    setOnYou(true);
  }
  function takePictures(camera = true) { router.push({ pathname: '/capture-person', params: { role: nextRequiredRole(s.photos) ?? 'body', guided: '1', ...(camera ? { autostart: '1' } : {}) } }); }
  // Back from the guided pictures: go straight to the preview instead of asking again.
  useEffect(() => {
    if (params.go !== '1' || !body || !studio.hydrated) return;
    router.setParams({ go: undefined });
    if (products.length) setTimeout(seeItOnMe, 0);
  }, [params.go, body, studio.hydrated]); // eslint-disable-line react-hooks/exhaustive-deps
  const corner = showResult ? job!.imageUri! : body?.localUri;

  return <View style={[styles.root, { paddingTop: insets.top + 12 }]}>
    <View style={styles.top}>
      <Text style={styles.kicker}>TRY ON</Text>
      <MotionPressable glass={false} accessibilityRole="button" accessibilityLabel={showResult ? 'See the preview on you' : body ? 'Your photos' : 'Add your photos'} onPress={() => showResult ? setOnYou(true) : body ? setPhotosOpen(true) : seeItOnMe()} style={styles.you}>
        {corner ? <Image source={{ uri: corner }} resizeMode="cover" style={StyleSheet.absoluteFill} /> : <FormIcon name="user" size={18} />}
        {showResult && <View style={styles.ready} />}
      </MotionPressable>
    </View>
    {products.length ? <ScrollView style={styles.scroll} onLayout={e => setRoom(e.nativeEvent.layout.height)} contentContainerStyle={{ paddingBottom: 16 }} showsVerticalScrollIndicator={false}>
      <Text accessibilityRole="header" numberOfLines={2} style={styles.title}>{title}</Text>
      <Text style={styles.total}>{products.length + (products.length === 1 ? ' piece' : ' pieces') + ' · ' + formatMoney(products.reduce((t, p) => t + (p.priceCents ?? 0), 0))}</Text>
      <View style={{ marginTop: 14 }}><CollageBoard look={look} boardHeight={boardHeight} inspectedPieceId={inspected} onInspectPiece={setInspected} onRemovePiece={remove} /></View>
      <Text accessibilityLiveRegion="polite" style={styles.verdict}>{read.line}</Text>
      <MotionPressable accessibilityRole="button" accessibilityLabel="Change the outfit in Edits" onPress={() => router.navigate('/edits')} style={styles.change}><Text style={styles.changeText}>Change the outfit in Edits</Text><FormIcon name="arrow" size={17} /></MotionPressable>
    </ScrollView> : <View style={styles.empty}>
      <Text style={styles.emptyTitle}>Nothing to try on yet.</Text>
      <Text style={styles.emptyBody}>Put an outfit together in Edits, then tap Try it on.</Text>
      <View style={styles.emptyAction}><RaisedButton label="Go to Edits" onPress={() => router.navigate('/edits')} /></View>
    </View>}
    {!!products.length && <>
      {!body && <View style={styles.ask}>
        <Text style={styles.askTitle}>Ready to take your pictures?</Text>
        <Text style={styles.askBody}>Two quick photos: head to toe, then your face. They stay on this phone until you ask for a try-on.</Text>
      </View>}
      <View style={styles.actions}>
        <MotionPressable glass={false} accessibilityRole="button" accessibilityLabel={isSaved ? 'Remove look from Saved' : 'Save this look'} accessibilityState={{ selected: isSaved }} onPress={saveLook} style={[styles.heart, isSaved && styles.heartOn]}>
          <FormIcon name="heart" size={18} color={isSaved ? colors.paper : colors.ink} />
        </MotionPressable>
        <View style={{ flex: 1 }}>
          <RaisedButton label={!body ? 'Take my pictures' : working ? 'Trying it on…' : 'See it on me'} showArrow={false} busy={working && job?.status !== 'queued'} disabled={!!body && !studio.hydrated} onPress={seeItOnMe} />
        </View>
      </View>
      {!body && <MotionPressable accessibilityRole="button" onPress={() => takePictures(false)} style={styles.library}><Text style={styles.libraryText}>Use photos I already have</Text></MotionPressable>}
      <View style={styles.fineRow}>
        {working && <ActivityIndicator size="small" color={colors.muted} />}
        <Text numberOfLines={1} style={styles.fine}>{working ? job?.message ?? 'Preparing your photos' : showResult ? 'Ready. Tap your photo to see it.' : !studioConfigured ? 'Try-on isn’t connected in this build' : manualStudio ? 'Manual test mode · made by hand, not automatically' : 'Sends your photos to Higgsfield · up to 20 credits'}</Text>
      </View>
    </>}
    <YourPhotos visible={photosOpen} onClose={() => setPhotosOpen(false)} />
    {body && <OnYou visible={onYou} onClose={() => setOnYou(false)} body={body} resultUri={showResult ? job!.imageUri : undefined} resultLabel={'Preview of you wearing ' + title} active={working} message={job?.message}
      problem={problem} onRetry={studio.retry} scene={s.scene} onScene={() => s.setScene(nextScene(s.scene))} onPhotos={() => { setOnYou(false); setPhotosOpen(true); }} />}
  </View>;
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper, paddingHorizontal: 18, paddingBottom: 8 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  kicker: { fontFamily: family.sans, fontSize: 10, letterSpacing: 2.1, color: colors.muted },
  you: { width: 44, height: 60, borderRadius: 12, overflow: 'hidden', borderWidth: 2, borderColor: colors.card, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper2 },
  ready: { position: 'absolute', right: 4, top: 4, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.ink, borderWidth: 1.5, borderColor: colors.card },
  scroll: { flex: 1 },
  title: { fontFamily: family.serif, fontSize: 29, lineHeight: 34, color: colors.ink },
  total: { fontFamily: family.sans, fontSize: 12, color: colors.muted, marginTop: 2 },
  verdict: { fontFamily: family.serif, fontSize: 20, lineHeight: 25, color: colors.ink, marginTop: 14, marginBottom: 14 },
  ask: { paddingTop: 12, gap: 4 },
  askTitle: { fontFamily: family.serif, fontSize: 22, lineHeight: 27, color: colors.ink },
  askBody: { fontFamily: family.sans, fontSize: 12, lineHeight: 18, color: colors.muted },
  library: { minHeight: 36, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  libraryText: { fontFamily: family.sans, fontSize: 12, color: colors.muted, textDecorationLine: 'underline' },
  change: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 50, paddingHorizontal: 14, marginTop: 4 },
  changeText: { fontFamily: family.sansMedium, fontSize: 13, color: colors.ink },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  emptyTitle: { fontFamily: family.serif, fontSize: 26, color: colors.ink, textAlign: 'center' },
  emptyBody: { fontFamily: family.sans, fontSize: 13, lineHeight: 19, color: colors.muted, textAlign: 'center', marginTop: 8 },
  emptyAction: { marginTop: 20, alignSelf: 'stretch' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 10 },
  heart: { width: 52, height: 52, borderRadius: 26, borderWidth: 1, borderColor: colors.line2, alignItems: 'center', justifyContent: 'center' },
  heartOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  fineRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 8 },
  fine: { fontFamily: family.sans, fontSize: 10.5, color: colors.faint, textAlign: 'center' },
});
