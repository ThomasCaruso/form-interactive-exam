import { useDesktop, useScreenSize } from '../../src/web/desktop';
import { DesktopForYou } from '../../src/web/DesktopForYou';
import { DiscoveryModeSwitch, type DiscoveryMode } from '../../src/components/DiscoveryModeSwitch';
import { completeLooks } from '../../src/domain/completeLooks';
import { selectionFromProduct } from '../../src/domain/garments';
import { tryableFromProducts } from '../../src/domain/trying';
import type { Look, Product } from '../../src/domain/types';
import { useRouter } from 'expo-router';
import { startTransition, useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CardUndoButton } from '../../src/components/CardUndoButton';
import { DiscoveryCard, type DeckEntry } from '../../src/components/DiscoveryCard';
import { MotionPressable } from '../../src/components/MotionPressable';
import { FormIcon } from '../../src/components/FormIcon';
import { tactile } from '../../src/utils/haptics';
import { showToast } from '../../src/components/Toast';
import { feedProducts, keepDealt, unseenProducts, fixtureReason } from '../../src/domain/stylingEngine';
import { signalsFrom } from '../../src/domain/learning';
import { realCatalogProducts } from '../../src/data/realCatalog';
import { useFormStore } from '../../src/state/store';
import { colors } from '../../src/theme/tokens';
import { family } from '../../src/theme/typography';

/** How long after your last swipe the deck re-ranks. */
const LEARN_AFTER_MS = 900;

export default function ForYouScreen() {
  const router = useRouter();
  const [mode,setMode] = useState<DiscoveryMode>('Pieces');
  const state = useFormStore(useShallow(s => ({ lookRecommendationReview:s.lookRecommendationReview, lookDiscoveryUndo:s.lookDiscoveryUndo, saved:s.saved, profile: s.profile, recommendationReview: s.recommendationReview, savedPieces: s.savedPieces, recommendationSession: s.recommendationSession, discoveryUndo: s.discoveryUndo, undoPieceReview: s.undoPieceReview, refreshSelection: s.refreshSelection })));
  const insets = useSafeAreaInsets();
  const { height } = useScreenSize();
  // Every yes and no re-ranks what hasn't been dealt yet; cards already on screen hold still.
  // Re-ranking waits until you pause (it is the heaviest work on this screen, a few hundred ms on a mid-range phone),
  // so a run of swipes is never held up by it; the three dealt cards cover the wait.
  const [learned, setLearned] = useState({ review: state.recommendationReview, saves: state.savedPieces });
  useEffect(() => {
    if (learned.review === state.recommendationReview && learned.saves === state.savedPieces) return;
    const timer = setTimeout(() => startTransition(() => setLearned({ review: state.recommendationReview, saves: state.savedPieces })), LEARN_AFTER_MS);
    return () => clearTimeout(timer);
  }, [learned, state.recommendationReview, state.savedPieces]);
  const learnedReview = learned.review, learnedSaves = learned.saves;
  const signals = useMemo(() => signalsFrom({ profile: state.profile, recommendationReview: learnedReview, savedPieces: learnedSaves }, realCatalogProducts), [state.profile, learnedReview, learnedSaves]);
  const ranked = useMemo(() => feedProducts(state.profile, signals), [state.profile, signals]);
  const [dealt, setDealt] = useState<string[]>([]);
  const unseen = useMemo(() => keepDealt(dealt, unseenProducts(ranked, state.recommendationReview, state.savedPieces)), [dealt, ranked, state.recommendationReview, state.savedPieces]);
  const dealtKey = unseen.slice(0, 5).map(p => p.id).join(',');
  if (dealtKey !== dealt.join(',')) setDealt(dealtKey ? dealtKey.split(',') : []);
  // Looks learn too, but only between visits to the Looks deck, so a look never changes under your thumb.
  const [lookSignals, setLookSignals] = useState(signals);
  const looks=useMemo(()=>completeLooks(state.profile, lookSignals),[state.profile, lookSignals]);
  const unseenLooks=useMemo(()=>looks.filter(l=>!state.lookRecommendationReview[l.id]&&!state.saved.some(s=>s.id===l.id)),[looks,state.lookRecommendationReview,state.saved]);
  const asCard=(look:Look):Product=>({...look.products[0],id:look.id,name:look.title,priceCents:look.products.reduce((sum,p)=>sum+p.priceCents,0)});
  const look=mode==='Looks'?unseenLooks[0]:undefined;
  const piece=mode==='Looks'?(look?asCard(look):undefined):unseen[0];
  // The deck draws five cards: the front, three layered behind it and one waiting, so it can move on before the app redraws.
  const cards:DeckEntry[]=mode==='Looks'?unseenLooks.slice(0,5).map(l=>({product:asCard(l),look:l,reason:l.why})):unseen.slice(0,5).map(p=>({product:p,reason:fixtureReason(p,state.profile)}));
  const total=mode==='Looks'?looks.length:ranked.length;
  const reviewed=total-(mode==='Looks'?unseenLooks.length:unseen.length);
  const canUndo=mode==='Looks'?!!state.lookDiscoveryUndo:!!state.discoveryUndo;
  const open=()=>{if(look){useFormStore.getState().selectLook(look);router.push({pathname:'/results',params:{lookId:look.id}});}else if(piece)router.push({pathname:'/product',params:{id:piece.id}});};

  const [availableHeight, setAvailableHeight] = useState(0);
  const [hintSession, setHintSession] = useState<number | null>(null);
  // The tab navigator supplies the actual remaining scene height. Home never scrolls.
  const desktop = useDesktop();
  // On a desktop the deck stands in its own column beside the page, as tall as the window allows.
  const cardHeight = desktop ? Math.max(460, Math.min(780, (availableHeight || height - 68) - 72)) : Math.max(280, Math.min(720, (availableHeight || height - insets.bottom - 88) - insets.top - 144));
  const deckWidth = Math.round(Math.max(420, Math.min(560, cardHeight * 0.72)));
  const compact = cardHeight < 470;
  const undo = () => {
    if (mode==='Looks') { if (useFormStore.getState().undoLookReview()) showToast('Last decision undone', 'undo'); return; }
    const id = state.undoPieceReview();
    // The undone piece returns to the front of the deck.
    if (id) { setDealt(previous => [id, ...previous.filter(x => x !== id)]); showToast('Last decision undone', 'undo'); }
  };
  const modeSwitch = <DiscoveryModeSwitch value={mode} onChange={item=>{setMode(item);if(item==='Looks')setLookSignals(signals);setHintSession(null);useFormStore.setState({discoveryUndo:null,lookDiscoveryUndo:null});}}/>;
  const deck = piece ? <DiscoveryCard key={mode+state.recommendationSession} cards={cards} onTry={()=>{const st=useFormStore.getState();if(look)st.trySet(tryableFromProducts(look.products));else{st.reviewPiece(piece,'saved');st.trySet([selectionFromProduct(piece)]);showToast('Saved · in Try On');}router.navigate('/tryon');}} cardHeight={cardHeight}
        initialHintEligible={hintSession !== state.recommendationSession} onHintUsed={() => setHintSession(state.recommendationSession)}
        canUndo={canUndo} onUndo={undo}
        onOpen={open}
        onReview={(status, card) => { if (card.look?useFormStore.getState().reviewLook(card.look,status):useFormStore.getState().reviewPiece(card.product,status)) { if (status === 'saved') showToast(card.look?'Complete look saved':'Saved to your pieces'); else tactile('passed'); } }} />
        : <View style={[styles.complete, { height: cardHeight }, compact && { paddingVertical: 16 }]}>
          <CardUndoButton disabled={!canUndo} onPress={undo} />
          {!compact && <FormIcon name="check" size={22} color={colors.muted} />}
          <Text maxFontSizeMultiplier={1.2} style={[styles.completeTitle, compact && { fontSize: 28, lineHeight: 32 }]}>{total ? "A good place to pause." : 'Room to explore.'}</Text>
          <Text maxFontSizeMultiplier={1.2} numberOfLines={compact ? 2 : 3} style={styles.completeCopy}>{total ? 'You have seen today’s selection. Keep building with the pieces you saved.' : 'Try adjusting your preferences to discover more pieces.'}</Text>
          <MotionPressable accessibilityRole="button" onPress={() => router.navigate(total ? '/saved' : '/profile')} style={styles.completeLink}>
            <Text style={styles.completeLinkText}>{total ? 'View saved '+(mode==='Looks'?'looks':'pieces') : 'Your preferences'}</Text><FormIcon name="arrow" size={16} color={colors.ink} />
          </MotionPressable>
          <MotionPressable accessibilityRole="button" onPress={state.refreshSelection} style={styles.refresh}><Text style={styles.quietText}>Refresh selection</Text></MotionPressable>
        </View>;
  if (desktop) return <DesktopForYou onLayout={event => setAvailableHeight(event.nativeEvent.layout.height)} deck={deck} deckWidth={deckWidth} modeSwitch={modeSwitch}
    position={piece ? reviewed + 1 : reviewed} total={total} mode={mode} onNavigate={path => router.navigate(path)} onOpenPiece={id => router.push({ pathname: '/product', params: { id } })} />;
  return <View style={styles.root} onLayout={event => setAvailableHeight(event.nativeEvent.layout.height)}>
    <View style={[styles.content, { paddingTop: insets.top + 14 }]}>
      <View style={styles.masthead}><View><Text style={styles.wordmark}>FORM</Text><Text style={styles.subtitle}>For you, today</Text></View><Text style={styles.counter}>{String(piece ? reviewed + 1 : reviewed).padStart(2, '0')}<Text style={styles.counterTotal}> / {String(total).padStart(2, '0')}</Text></Text></View>
      {modeSwitch}
      {deck}
    </View>
  </View>;
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  content: { paddingHorizontal: 24, paddingBottom: 8, flex: 1 },
  masthead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 2, paddingBottom: 18 },
  subtitle: { fontFamily: family.sans, fontSize: 12, lineHeight: 18, color: colors.muted, marginTop: 4 },
  wordmark: { fontFamily: family.sansMedium, fontSize: 17, letterSpacing: 4.5, color: colors.ink },
  counter: { fontFamily: family.sans, fontSize: 12, color: colors.ink, fontVariant: ['tabular-nums'] },
  counterTotal: { color: colors.muted },
  complete: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 30 },
  completeTitle: { fontFamily: family.serif, fontSize: 34, lineHeight: 39, color: colors.ink, textAlign: 'center', marginTop: 18 },
  completeCopy: { fontFamily: family.sans, fontSize: 13, lineHeight: 21, color: colors.muted, textAlign: 'center', marginTop: 12, maxWidth: 260 },
  completeLink: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48, marginTop: 18, paddingHorizontal: 12 },
  completeLinkText: { fontFamily: family.sansMedium, fontSize: 13, color: colors.ink },
  refresh: { minHeight: 44, justifyContent: 'center', marginTop: 4 },
  quietText: { fontFamily: family.sans, fontSize: 12, color: colors.muted },
});
