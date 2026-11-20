import { useScreenSize } from '../../src/web/desktop';
import { useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { EditorialScreen, editorial } from '../../src/components/Editorial';
import { MotionPressable } from '../../src/components/MotionPressable';
import { RaisedButton } from '../../src/components/RaisedButton';
import { ContextSheet } from '../../src/components/ContextSheet';
import { LookActions } from '../../src/components/LookControls';
import { OutfitShelf } from '../../src/components/OutfitShelf';
import { PieceSheet } from '../../src/components/PieceSheet';
import { OutfitStage, type StageNeighbours } from '../../src/components/tryOn/OutfitStage';
import { cutouts } from '../../src/data/cutouts';
import { closetPieceToProduct, isPhotoPiece } from '../../src/domain/closet';
import { cutoutQueue, hasStageCutout } from '../../src/domain/cutoutQueue';
import { describeChange, dressPieces, restylePieces, swapPieces, undressPieces } from '../../src/domain/lookEdit';
import type { StageSlot } from '../../src/domain/outfitLayout';
import { buildRails, readOutfit, shuffleOutfit, stepRail, upperRail } from '../../src/domain/outfitRead';
import { makeOutfit, outfitNames, uniqueName } from '../../src/domain/outfits';
import { ProductVisual } from '../../src/components/ProductVisual';
import { LocalPhoto } from '../../src/components/LocalPhoto';
import { FormIcon } from '../../src/components/FormIcon';
import { showToast } from '../../src/components/Toast';
import { useCurrentEdit } from '../../src/hooks/useCurrentEdit';
import { formatMoney, lookTotalCents } from '../../src/domain/selectors';
import { rankProducts, refinementBudget, swapFixturePiece } from '../../src/domain/stylingEngine';
import { isUserUpload, removePieceFromLook, slotLabel } from '../../src/domain/garments';
import type { Look, Product } from '../../src/domain/types';
import { useFormStore } from '../../src/state/store';
import { colors } from '../../src/theme/tokens';
import { family } from '../../src/theme/typography';
import { tryableFromProducts } from '../../src/domain/trying';
import { DayPicker } from '../../src/components/plan/DayPicker';
import { useToday } from '../../src/hooks/useToday';

const MISSING: { slot: StageSlot; label: string }[] = [{ slot: 'top', label: 'Top' }, { slot: 'pants', label: 'Bottom' }, { slot: 'shoes', label: 'Shoes' }];
/** A new outfit, stamped now. */
const outfitNow = (from: Look | null, products: readonly Product[], name: string, occasion: string, tucked: boolean | undefined) => ({ ...makeOutfit(from, products, name, occasion, Date.now(), Math.random().toString(36).slice(2, 6)), tucked });

/**
 * Edits: your outfits, made on the stage. The shelf holds your outfits (saved looks) and FORM's ideas; every change to
 * one of yours saves at once with an Undo, and changing an idea makes it yours. See
 * docs/superpowers/specs/2026-10-12-edits-your-outfits-design.md.
 */
export default function EditsScreen() {
  const router = useRouter();
  const { height } = useScreenSize();
  const { session, looks, look, occasion } = useCurrentEdit();
  const outfits = useFormStore(s => s.saved);
  const activeOutfitId = useFormStore(s => s.activeOutfitId);
  const sessions = useFormStore(s => s.sessions);
  const [changingEdit, setChangingEdit] = useState(false);
  const [managingId, setManagingId] = useState<string | null>(null);
  const [inspectedPieceId, setInspectedPieceId] = useState<string | null>(null);
  const [ideaTucked, setIdeaTucked] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState('');
  const [freshId, setFreshId] = useState<string | null>(null);
  const [planning, setPlanning] = useState(false);
  const today = useToday();
  const closet = useFormStore(s => s.closet), savedPieces = useFormStore(s => s.savedPieces), profile = useFormStore(s => s.profile);
  const ranked = useMemo(() => rankProducts(profile), [profile]);
  const owned = useMemo(() => closet.filter(isPhotoPiece).map(closetPieceToProduct), [closet]);
  const savedProducts = useMemo(() => savedPieces.map(p => p.product), [savedPieces]);
  const staged = (p: Product) => hasStageCutout(p, cutouts);

  const outfit = useFormStore(s => s.saved.find(o => o.id === s.activeOutfitId) ?? null);
  const view: Look | null = outfit ? outfit.look : look;
  const tucked = outfit ? !!outfit.tucked : ideaTucked;
  const name = view?.title ?? '';
  const current = useMemo(() => view?.products.filter(p => p.slot !== 'accessory') ?? [], [view]);
  const rails = useMemo(() => buildRails(current, savedProducts, owned, ranked, staged), [current, savedProducts, owned, ranked]);
  const read = useMemo(() => readOutfit(current), [current]);
  // What one swipe brings on each slot, both ways: the stage lays these out and decodes them before you swipe.
  // The top and a dress share one rail; bottoms keep their own.
  const upper = useMemo(() => upperRail(rails), [rails]);
  const railFor = (slot: StageSlot) => slot === 'top' || slot === 'dress' ? upper : rails[slot];
  const neighbours = useMemo(() => Object.fromEntries(current.filter(p => p.slot !== 'accessory').map(p => [p.slot, { prev: stepRail(railFor(p.slot as StageSlot), p.id, -1), next: stepRail(railFor(p.slot as StageSlot), p.id, 1) }])) as StageNeighbours, [current, rails, upper]); // eslint-disable-line react-hooks/exhaustive-deps
  // The bottoms a dress took off, so swiping on to a top puts the same ones back.
  const parkedBottoms = useRef<{ outfit: string; piece: Product } | null>(null);
  const queued = useMemo(() => cutoutQueue(closet).length, [closet]);
  const mine = useMemo(() => outfits.map(o => ({ id: o.id, name: o.look.title, products: o.look.products, tucked: o.tucked })), [outfits]);
  const ideas = useMemo(() => looks.map(l => ({ id: l.id, name: l.title, products: l.products })), [looks]);
  const stageHeight = Math.round(Math.min(540, Math.max(380, height * 0.56)));
  const store = () => useFormStore.getState();

  /** Every change goes through here: your outfit saves in place; an idea becomes an outfit of yours. Both can be undone. */
  function apply(products: Product[], kept = false, said?: string) {
    if (!view || (!kept && products === view.products)) return;
    setInspectedPieceId(null); setFreshId(null);
    if (outfit) {
      const before = outfit.look.products, id = outfit.id;
      store().updateOutfit(id, { products });
      showToast(said ?? describeChange(before, products), 'success', { label: 'Undo', onPress: () => store().updateOutfit(id, { products: before }) });
      return;
    }
    const entry = outfitNow(view, products, uniqueName(view.title, outfitNames(store().saved)), occasion, ideaTucked);
    store().addOutfit(entry);
    showToast((kept ? 'Kept as “' : 'Saved as “') + entry.look.title + '”', 'success', { label: 'Undo', onPress: () => store().removeSaved(entry.id) });
  }
  function openOutfit(id: string, idea: boolean) {
    setInspectedPieceId(null); setRenaming(false); setFreshId(null);
    if (!idea) { store().setActiveOutfit(id); return; }
    const next = looks.find(l => l.id === id);
    store().setActiveOutfit(null);
    if (next) store().selectLook(next);
  }
  function changeEdit(id: string | null) {
    setInspectedPieceId(null); setRenaming(false);
    store().setActiveSession(id);
    store().setActiveOutfit(null);
    const next = sessions.find(item => item.id === id)?.looks[0];
    if (next) store().selectLook(next);
    setChangingEdit(false);
  }
  /** + New: a copy of what is on the stage, named `<name> 2`, with the name open for typing. */
  function newOutfit() {
    const previous = activeOutfitId;
    const entry = outfitNow(view, view?.products ?? [], uniqueName(view?.title || 'Outfit', outfitNames(store().saved)), occasion, tucked);
    store().addOutfit(entry);
    setInspectedPieceId(null); setFreshId(entry.id); setDraft(entry.look.title); setRenaming(true);
    showToast('New outfit', 'success', { label: 'Undo', onPress: () => { store().removeSaved(entry.id); store().setActiveOutfit(previous); } });
  }
  function startRename() { if (!outfit) return; setDraft(outfit.look.title); setRenaming(true); }
  function commitName() {
    setRenaming(false);
    if (!outfit) return;
    const typed = draft.trim();
    if (!typed || typed === outfit.look.title) return;
    store().updateOutfit(outfit.id, { name: uniqueName(typed, outfitNames(store().saved.filter(o => o.id !== outfit.id))) });
  }
  function duplicate(id: string) {
    const from = store().saved.find(o => o.id === id);
    if (!from) return;
    const entry = outfitNow(from.look, from.look.products, uniqueName(from.look.title, outfitNames(store().saved)), from.occasion, from.tucked);
    store().addOutfit(entry);
    showToast('Duplicated as “' + entry.look.title + '”', 'success', { label: 'Undo', onPress: () => { store().removeSaved(entry.id); store().setActiveOutfit(id); } });
  }
  function remove(id: string) {
    const all = store().saved, index = all.findIndex(o => o.id === id), entry = all[index];
    if (!entry) return;
    const wasActive = store().activeOutfitId === id;
    store().removeSaved(id);
    const days = store().lastRemovedPlans?.outfitId === id ? Object.keys(store().lastRemovedPlans!.days).length : 0;
    showToast('Deleted “' + entry.look.title + '”' + (days ? ' · also from ' + days + (days === 1 ? ' planned day' : ' planned days') : ''), 'passed', { label: 'Undo', onPress: () => { store().restoreSaved(entry, index); if (wasActive) store().setActiveOutfit(id); } });
  }
  function toggleTuck() {
    if (outfit) store().updateOutfit(outfit.id, { tucked: !outfit.tucked });
    else setIdeaTucked(t => !t);
  }
  function swapPiece(piece: Product) {
    if (!view) return;
    const state = store();
    const next = swapFixturePiece(view, piece.id, state.profile, refinementBudget(view.id, state.profile, state.sessions, state.saved));
    if (!next) { showToast('No alternative within your preferences', 'warning'); return; }
    apply(next.products);
  }
  function removePiece(piece: Product) {
    if (!view) return;
    const next = removePieceFromLook(view, piece.id);
    if (next !== view) apply(next.products);
  }
  function stageSwap(slot: StageSlot, dir: 1 | -1): boolean {
    if (!view) return false;
    const now = current.find(p => p.slot === slot), next = stepRail(railFor(slot), now?.id, dir);
    if (!next || next.id === now?.id) return false;
    const key = view.id.split('~')[0], kept = parkedBottoms.current?.outfit === key ? parkedBottoms.current.piece : undefined;
    const swap = swapPieces(view.products, next, kept, rails.pants[0]);
    parkedBottoms.current = swap.parked ? { outfit: key, piece: swap.parked } : null;
    apply(swap.products);
    return true;
  }
  function stageRemove(slot: StageSlot) { if (view) apply(undressPieces(view.products, slot)); }
  function addSlot(slot: StageSlot) { const first = rails[slot][0]; if (view && first) apply(dressPieces(view.products, first)); }
  function shuffle() {
    if (!view) return;
    const next = shuffleOutfit(rails, current, Math.random, staged);
    if (!next) { showToast('Save a few pieces and shuffle again'); return; }
    apply(restylePieces(view.products, next));
  }
  const hasDress = current.some(p => p.slot === 'dress');
  const missing = MISSING.filter(m => !current.some(p => p.slot === m.slot) && !(hasDress && m.slot !== 'shoes'));
  const managing = outfits.find(o => o.id === managingId) ?? null;
  const ideasLabel = session ? occasion : 'Curated for you';

  const footer = view ? <View style={styles.footer}>
    <View style={styles.footerButton}><RaisedButton label="Try it on" light showArrow={false} icon={<FormIcon name="tryon" size={18} />} onPress={() => { if (!outfit) store().selectLook(view); store().trySet(tryableFromProducts(view.products)); router.navigate('/tryon'); }} /></View>
    <View style={styles.footerButton}><RaisedButton label="New outfit" showArrow={false} icon={<Text style={styles.footerPlus}>+</Text>} onPress={newOutfit} /></View>
  </View> : undefined;

  return <EditorialScreen footer={footer}>
    <View style={styles.header}>
      <View><Text style={editorial.label}>YOUR STYLE, IN PRACTICE</Text><Text style={styles.heading}>The edit</Text></View>
      <MotionPressable accessibilityRole="button" accessibilityLabel="Ask FORM for outfit ideas" onPress={() => router.push('/create-edit')} style={styles.newButton}><Text style={styles.buttonText}>Ask for ideas</Text></MotionPressable>
    </View>
    {(mine.length > 0 || ideas.length > 0) && <OutfitShelf mine={mine} ideas={ideas} activeId={outfit?.id ?? look?.id} ideasLabel={ideasLabel}
      onNew={newOutfit} onOpen={openOutfit} onManage={setManagingId} onIdeas={() => setChangingEdit(true)} />}
    {view ? <>
      {outfit && renaming
        ? <TextInput autoFocus selectTextOnFocus value={draft} onChangeText={setDraft} onSubmitEditing={commitName} onBlur={commitName} returnKeyType="done" maxLength={40}
            accessibilityLabel="Outfit name" placeholder="Name this outfit" placeholderTextColor={colors.faint} style={[styles.title, styles.titleInput]} />
        : <MotionPressable glass={false} haptic={false} dimWhenDisabled={false} disabled={!outfit} accessibilityRole={outfit ? 'button' : 'header'} accessibilityLabel={outfit ? name + '. Rename' : name} onPress={startRename} style={styles.titleRow}>
            <Text numberOfLines={2} style={[styles.title, styles.titleText]}>{name}</Text>{outfit && <Text style={styles.pencil}>✎</Text>}
          </MotionPressable>}
      <View style={styles.meta}>
        <Text style={styles.quiet}>{outfit ? 'Your outfit · saves as you go' : 'An idea from FORM'} · {formatMoney(lookTotalCents(view))}</Text>
        {!outfit && <MotionPressable glass={false} accessibilityRole="button" accessibilityLabel={'Keep ' + name + ' as your outfit'} onPress={() => apply(view.products, true)} style={styles.keep}><FormIcon name="saved" size={14} /><Text style={styles.buttonText}>Keep</Text></MotionPressable>}
      </View>
      {outfit && freshId === outfit.id && <View style={styles.freshRow}>
        <Text style={styles.quiet}>Copied from what was on the stage.</Text>
        <MotionPressable glass={false} accessibilityRole="button" accessibilityLabel="Start this outfit blank" onPress={() => apply([], false, 'Started blank')} style={styles.link}><Text style={styles.linkText}>Start blank</Text></MotionPressable>
        <MotionPressable glass={false} accessibilityRole="button" accessibilityLabel="Shuffle this outfit" onPress={shuffle} style={styles.link}><Text style={styles.linkText}>Shuffle</Text></MotionPressable>
      </View>}
      <View style={[styles.stage, { height: stageHeight }]}>
        <OutfitStage scrollable neighbours={neighbours} products={current} tucked={tucked} onToggleTuck={toggleTuck} onSwap={stageSwap} onRemove={stageRemove} />
        {!!missing.length && <View style={styles.chips}>{missing.map(m => <MotionPressable key={m.slot} glass={false} accessibilityRole="button" accessibilityLabel={'Add ' + m.label.toLowerCase()} onPress={() => addSlot(m.slot)} style={styles.chip}><Text style={styles.chipText}>+ {m.label}</Text></MotionPressable>)}</View>}
      </View>
      <Text accessibilityLiveRegion="polite" style={styles.read}>{current.length ? read.line : 'An empty stage. Add a top, a bottom and shoes.'}</Text>
      <View style={styles.stageTools}>
        <Text style={styles.hint}>{outfit ? 'Swipe a piece sideways to change it.' : 'Swipe a piece to make this idea yours.'}</Text>
        {outfit && <MotionPressable glass={false} accessibilityRole="button" accessibilityLabel={'Plan ' + name + ' for a day'} onPress={() => setPlanning(true)} style={styles.tool}><View style={styles.toolRow}><FormIcon name="calendar" size={14} /><Text style={styles.buttonText}>Plan it</Text></View></MotionPressable>}
        <MotionPressable glass={false} accessibilityRole="button" accessibilityLabel="Shuffle the outfit" onPress={shuffle} style={styles.tool}><Text style={styles.buttonText}>⟳ Shuffle</Text></MotionPressable>
      </View>
      {outfit && <DayPicker outfitId={outfit.id} name={name} today={today} visible={planning} onClose={() => setPlanning(false)} />}
      {queued > 0 && <MotionPressable accessibilityRole="button" accessibilityLabel={queued + (queued === 1 ? ' piece needs' : ' pieces need') + ' a cut-out before it can go on the stage'} onPress={() => router.push('/cutout-queue')} style={styles.queue}>
        <Text style={styles.queueText}>{queued} {queued === 1 ? 'piece needs' : 'pieces need'} a cut-out ›</Text></MotionPressable>}
      <PieceSheet piece={view.products.find(p => p.id === inspectedPieceId) ?? null} onClose={() => setInspectedPieceId(null)} onSwap={swapPiece} onRemove={removePiece} removeAny />
      {view.products.length > 0 && <View style={styles.piecesHeader}><Text style={styles.sectionTitle}>The pieces</Text><Text style={styles.quiet}>{view.products.length} pieces</Text></View>}
      {view.products.map(piece => <MotionPressable key={piece.id} accessibilityRole="button" accessibilityLabel={'Inspect ' + piece.name + (isUserUpload(piece) ? ', your piece' : ', ' + formatMoney(piece.priceCents))} onPress={() => setInspectedPieceId(piece.id)} style={styles.piece}>
        <View pointerEvents="none" style={styles.thumbnail}>{isUserUpload(piece) ? <LocalPhoto uri={piece.localUri} label={piece.name + ", your uploaded photo"} /> : <ProductVisual product={piece} transition={false} />}</View>
        <View style={styles.pieceInfo}><Text numberOfLines={2} style={styles.pieceName}>{piece.name}</Text><Text style={styles.quiet}>{slotLabel(piece.slot)} · {isUserUpload(piece) ? 'Your piece' : formatMoney(piece.priceCents)}</Text></View>
        <FormIcon name="chevron" size={16} color={colors.muted} />
      </MotionPressable>)}
      {view.products.length > 0 && <LookActions look={view} occasion={occasion} adjustmentsOnly prominent onApply={next => apply(next.products)} />}
      <MotionPressable accessibilityRole="button" onPress={() => router.push('/add-piece')} style={styles.add}><FormIcon name="edits" size={18} /><Text style={styles.buttonText}>Add your own piece</Text><FormIcon name="arrow" size={17} /></MotionPressable>
      {!outfit && !!(view.why || view.description) && <View style={styles.explanation}><Text style={editorial.label}>WHY THIS LOOK</Text><Text style={styles.description}>{view.why || view.description}</Text></View>}
      <Text style={styles.priceNote}>Prices are a guide. Check the retailer for current price and availability.</Text>
    </> : <View style={styles.empty}>
      <Text style={styles.title}>Let’s find your next look.</Text><Text style={styles.description}>Start an outfit from scratch, or ask FORM for ideas for your plans.</Text>
      <RaisedButton label="Start an outfit" onPress={newOutfit} />
      <MotionPressable accessibilityRole="button" onPress={() => router.push('/create-edit')} style={styles.add}><Text style={styles.buttonText}>Ask for ideas</Text><FormIcon name="arrow" size={18} /></MotionPressable>
    </View>}
    <ContextSheet visible={!!managing} title={managing?.look.title ?? ''} onClose={() => setManagingId(null)}>
      <MotionPressable accessibilityRole="button" onPress={() => { const id = managingId; setManagingId(null); if (id) { openOutfit(id, false); setDraft(managing?.look.title ?? ''); setRenaming(true); } }} style={styles.session}><Text style={styles.pieceName}>Rename</Text></MotionPressable>
      <MotionPressable accessibilityRole="button" onPress={() => { const id = managingId; setManagingId(null); if (id) duplicate(id); }} style={styles.session}><Text style={styles.pieceName}>Duplicate</Text></MotionPressable>
      <MotionPressable accessibilityRole="button" onPress={() => { const id = managingId; setManagingId(null); if (id) remove(id); }} style={styles.session}><Text style={[styles.pieceName, styles.danger]}>Delete</Text></MotionPressable>
    </ContextSheet>
    <ContextSheet visible={changingEdit} title="Ideas for" onClose={() => setChangingEdit(false)}>
      <MotionPressable accessibilityRole="button" accessibilityState={{ selected: !session }} onPress={() => changeEdit(null)} style={styles.session}><View style={styles.pieceInfo}><Text style={styles.pieceName}>Curated for you</Text><Text style={styles.quiet}>Based on your style preferences</Text></View>{!session && <FormIcon name="check" size={18} />}</MotionPressable>
      {sessions.map(item => <MotionPressable key={item.id} accessibilityRole="button" accessibilityState={{ selected: session?.id === item.id }} onPress={() => changeEdit(item.id)} style={styles.session}><View style={styles.pieceInfo}><Text style={styles.pieceName}>{item.occasion}</Text><Text style={styles.quiet}>{item.request?.dressCode ?? 'Your edit'} · {item.looks.length} {item.looks.length === 1 ? 'idea' : 'ideas'}</Text></View>{session?.id === item.id && <FormIcon name="check" size={18} />}</MotionPressable>)}
      <MotionPressable accessibilityRole="button" onPress={() => { setChangingEdit(false); router.push('/create-edit'); }} style={styles.add}><Text style={styles.buttonText}>Ask for new ideas</Text><FormIcon name="arrow" size={18} /></MotionPressable>
    </ContextSheet>
  </EditorialScreen>;
}
const styles = StyleSheet.create({
  header: { ...editorial.row, gap: 12, marginBottom: 18 },
  heading: { fontFamily: family.serif, fontSize: 36, lineHeight: 40, color: colors.ink, marginTop: 4 },
  newButton: { minHeight: 48, paddingHorizontal: 14, justifyContent: 'center', borderRadius: 24, backgroundColor: colors.paper2 },
  buttonText: { fontFamily: family.sansMedium, fontSize: 13, color: colors.ink },
  quiet: { fontFamily: family.sans, fontSize: 11, lineHeight: 17, color: colors.muted },
  title: { fontFamily: family.serif, fontSize: 29, lineHeight: 34, color: colors.ink },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, minHeight: 44 },
  titleText: { flexShrink: 1 },
  titleInput: { minHeight: 44, padding: 0, borderBottomWidth: 1, borderBottomColor: colors.ink },
  pencil: { fontSize: 15, color: colors.muted, marginTop: 9 },
  meta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 36, marginBottom: 10 },
  keep: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36, paddingHorizontal: 14, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.ink },
  freshRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: 14, marginTop: -6, marginBottom: 8 },
  link: { minHeight: 36, justifyContent: 'center' },
  linkText: { fontFamily: family.sansMedium, fontSize: 12, color: colors.ink, textDecorationLine: 'underline' },
  stage: { marginHorizontal: -8, borderRadius: 4, overflow: 'hidden' },
  chips: { position: 'absolute', left: 12, top: 12, gap: 6 },
  chip: { minHeight: 32, paddingHorizontal: 12, borderRadius: 16, justifyContent: 'center', borderWidth: 1, borderStyle: 'dashed', borderColor: colors.faint, backgroundColor: 'rgba(248,246,241,0.7)' },
  chipText: { fontFamily: family.sansMedium, fontSize: 11, color: colors.ink2 },
  read: { fontFamily: family.serif, fontSize: 20, lineHeight: 25, color: colors.ink, marginTop: 14 },
  stageTools: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 8 },
  hint: { ...editorial.secondary, fontSize: 11, flex: 1 },
  toolRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tool: { minHeight: 40, paddingHorizontal: 14, borderRadius: 20, justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line2 },
  queue: { minHeight: 44, justifyContent: 'center' },
  queueText: { fontFamily: family.sansMedium, fontSize: 12, color: colors.ink2, textDecorationLine: 'underline' },
  piecesHeader: { ...editorial.row, marginTop: 30, marginBottom: 12 },
  sectionTitle: { fontFamily: family.serif, fontSize: 25, color: colors.ink },
  piece: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 78, paddingVertical: 9, paddingHorizontal: 10, marginBottom: 8, borderRadius: 4, backgroundColor: colors.paper2 },
  thumbnail: { width: 48, height: 58, borderRadius: 4, overflow: 'hidden', backgroundColor: colors.card },
  pieceInfo: { flex: 1, gap: 4 },
  pieceName: { fontFamily: family.sansMedium, fontSize: 13, lineHeight: 19, color: colors.ink },
  danger: { color: '#9A3A2E' },
  add: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 50, gap: 10, paddingHorizontal: 14, marginTop: 12, borderRadius: 4 },
  explanation: { marginTop: 30, gap: 10 },
  description: { ...editorial.secondary, lineHeight: 21 },
  priceNote: { ...editorial.secondary, fontSize: 10, lineHeight: 17, marginTop: 18 },
  footer: { flexDirection: 'row', gap: 12, paddingHorizontal: 24, paddingTop: 12, paddingBottom: 12, backgroundColor: colors.paper, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  footerButton: { flex: 1 },
  footerPlus: { fontFamily: family.sans, fontSize: 20, lineHeight: 22, color: colors.paper },
  session: { flexDirection: 'row', gap: 12, alignItems: 'center', minHeight: 56, paddingHorizontal: 14, marginBottom: 8, borderRadius: 4, backgroundColor: colors.paper2 },
  empty: { gap: 18, paddingTop: 40, paddingBottom: 30 },
});
