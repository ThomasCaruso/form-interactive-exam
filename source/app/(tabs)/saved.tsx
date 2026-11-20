import { useDesktop, useScreenSize } from '../../src/web/desktop';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { FlatList, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { setStatusBarStyle } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useShallow } from 'zustand/react/shallow';
import { GlassAtmosphere } from '../../src/components/GlassSurface';
import { editorial } from '../../src/components/Editorial';
import { ContextSheet } from '../../src/components/ContextSheet';
import { TextAction } from '../../src/components/DetailHeader';
import { FormIcon } from '../../src/components/FormIcon';
import { MotionPressable } from '../../src/components/MotionPressable';
import { RaisedButton } from '../../src/components/RaisedButton';
import { LocalPhoto } from '../../src/components/LocalPhoto';
import { ProductVisual } from '../../src/components/ProductVisual';
import { showToast } from '../../src/components/Toast';
import { SavedHeader, savedGutter, sorts, type SavedTab } from '../../src/components/saved/SavedHeader';
import { PieceTile } from '../../src/components/saved/PieceTile';
import { LookBoard } from '../../src/components/saved/LookBoard';
import { QuietLink } from '../../src/components/saved/QuietLink';
import { SavedLookShopSheet } from '../../src/components/SavedLookShopSheet';
import { closetPieceToProduct, isPhotoPiece, slotLabel } from '../../src/domain/closet';
import { addGarmentToLook } from '../../src/domain/garments';
import { savedWishlist, shoppingSummary, type WishlistCategory, type WishlistSort } from '../../src/domain/savedShopping';
import { retailerProductUrl } from '../../src/domain/retailer';
import type { ClosetPiece, Product, SavedLook } from '../../src/domain/types';
import { formatMoney } from '../../src/domain/selectors';
import { cutoutQueue } from '../../src/domain/cutoutQueue';
import { useCurrentEdit } from '../../src/hooks/useCurrentEdit';
import { useFormStore } from '../../src/state/store';
import { retailerDestination } from '../../src/providers/retailerDestination';
import { removeGarmentWithFile } from '../../src/storage/garmentFiles';
import { colors } from '../../src/theme/tokens';
import { family } from '../../src/theme/typography';

type CollectionItem = { kind: 'look'; value: SavedLook } | { kind: 'piece'; value: Product } | { kind: 'upload'; value: ClosetPiece };
const retailerNote = 'Prices are a guide. Confirm size, current price and availability at the retailer. Taxes and shipping extra.';
const columnGap = 12;

export default function SavedScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useScreenSize();
  const desktop = useDesktop();
  // A website has room for a proper grid: four across on desktop, two on a phone.
  const columns = desktop ? (width >= 1100 ? 4 : 3) : 2, gutter = desktop ? 40 : savedGutter, gap = desktop ? 24 : columnGap;
  const tileWidth = Math.floor((width - gutter * 2 - gap * (columns - 1)) / columns);
  const list = useRef<FlatList<CollectionItem>>(null);
  const state = useFormStore(useShallow(s => ({ saved: s.saved, savedPieces: s.savedPieces, closet: s.closet })));
  const [tab, setTab] = useState<SavedTab>(() => useFormStore.getState().savedPieces.length ? 'Pieces' : useFormStore.getState().saved.length ? 'Looks' : 'Pieces');
  const [category, setCategory] = useState<WishlistCategory>('all');
  const [sort, setSort] = useState<WishlistSort>('recent');
  const [sortOpen, setSortOpen] = useState(false);
  const [shoppingLookId, setShoppingLookId] = useState<string | null>(null);
  const [managed, setManaged] = useState<CollectionItem | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [removing, setRemoving] = useState(false);
  const removalLock = useRef(false);
  const { look: currentLook, occasion } = useCurrentEdit();
  useFocusEffect(useCallback(() => { setStatusBarStyle('dark'); }, []));
  const counts = { Pieces: state.savedPieces.length, Looks: state.saved.length, Wardrobe: state.closet.length };
  const wishlist = useMemo(() => savedWishlist(state.savedPieces, category, sort), [state.savedPieces, category, sort]);
  const entries = useMemo<CollectionItem[]>(() => tab === 'Pieces' ? wishlist.map(p => ({ kind: 'piece', value: p.product })) : tab === 'Looks' ? [...state.saved].sort((a, b) => b.savedAt - a.savedAt).map(value => ({ kind: 'look', value })) : [...state.closet].sort((a, b) => b.createdAt - a.createdAt).map(value => ({ kind: 'upload', value })), [tab, wishlist, state.saved, state.closet]);
  const shoppingLook = state.saved.find(s => s.id === shoppingLookId);
  const toTop = () => list.current?.scrollToOffset({ offset: 0, animated: false });
  const manage = (item: CollectionItem) => { setManaged(item); setConfirm(false); };
  const close = () => { if (removalLock.current) return; setManaged(null); setConfirm(false); };
  function chooseTab(value: SavedTab) { setTab(value); toTop(); }
  function openLook(entry: SavedLook) { setShoppingLookId(null); useFormStore.getState().selectLook(entry.look); router.push({ pathname: '/results', params: { lookId: entry.id, savedId: entry.id } }); }
  function openPiece(product: Product) { router.push({ pathname: '/product', params: { id: product.id } }); }
  function editPiece(garment: ClosetPiece) { router.push({ pathname: '/add-piece', params: { editId: garment.id } }); }
  function shop(product: Product) { if (retailerProductUrl(product)) void retailerDestination.viewProduct(product); }
  /** Saved pieces and looks leave at once, with Undo that puts them back where they were. */
  function unsave(item: CollectionItem) {
    const live = useFormStore.getState();
    if (item.kind === 'piece') {
      const index = live.savedPieces.findIndex(p => p.id === item.value.id); if (index < 0) return;
      const entry = live.savedPieces[index]; live.togglePiece(entry.product);
      showToast('Removed from saved', 'passed', { label: 'Undo', onPress: () => useFormStore.getState().restoreSavedPiece(entry, index) });
    } else if (item.kind === 'look') {
      const index = live.saved.findIndex(s => s.id === item.value.id); if (index < 0) return;
      const entry = live.saved[index]; live.removeSaved(entry.id);
      showToast('Removed from saved', 'passed', { label: 'Undo', onPress: () => useFormStore.getState().restoreSaved(entry, index) });
    }
  }
  /** Wardrobe pieces can't come back (the photo file is deleted), so they keep a confirmation. */
  async function removeOwned() {
    if (managed?.kind !== 'upload' || removalLock.current) return;
    removalLock.current = true; setRemoving(true);
    try {
      const piece = useFormStore.getState().closet.find(p => p.id === managed.value.id);
      if (piece) await removeGarmentWithFile(piece);
      setManaged(null); setConfirm(false); showToast('Removed from your wardrobe', 'passed');
    } finally { removalLock.current = false; setRemoving(false); }
  }
  const queued = cutoutQueue(state.closet).length;
  const header = <View style={styles.header}>
    <SavedHeader tab={tab} counts={counts} onTab={chooseTab} category={category} onCategory={value => { setCategory(value); toTop(); }} sort={sort} onSort={() => setSortOpen(true)} onAdd={() => router.push('/add-piece')} />
    {tab === 'Wardrobe' && queued > 0 && <QuietLink label={queued + (queued === 1 ? ' photo needs' : ' photos need') + ' a cut-out for Try On ›'} onPress={() => router.push('/cutout-queue')} />}
  </View>;
  const filtered = tab === 'Pieces' && category !== 'all';
  const empty = <View style={styles.empty}>
    <FormIcon name={tab === 'Wardrobe' ? 'edits' : 'saved'} size={26} />
    <Text style={styles.emptyTitle}>{filtered ? 'A little more room.' : tab === 'Pieces' ? 'Find something worth keeping.' : tab === 'Looks' ? 'Your next look starts here.' : 'Bring your wardrobe in.'}</Text>
    <Text style={styles.emptyBody}>{filtered ? 'No saved pieces in this category. See your full shortlist or keep exploring.' : tab === 'Pieces' ? 'Save pieces from For You, then come back to compare and shop.' : tab === 'Looks' ? 'Save an edit to keep the whole look together.' : 'Add a photo of a piece you own. It stays on this device.'}</Text>
    <View style={styles.emptyAction}><RaisedButton label={filtered ? 'See all saved pieces' : tab === 'Wardrobe' ? 'Add a piece' : tab === 'Looks' ? 'Explore edits' : 'Explore pieces'} onPress={() => filtered ? setCategory('all') : tab === 'Wardrobe' ? router.push('/add-piece') : router.navigate(tab === 'Looks' ? '/edits' : '/home')} /></View>
    {tab === 'Pieces' && !!state.saved.length && <QuietLink label="View your saved looks" onPress={() => chooseTab('Looks')} />}
    {tab === 'Wardrobe' && <QuietLink label="Or tap what you wear most" onPress={() => router.push('/closet')} />}
  </View>;
  const footer = <View style={styles.footer}>
    {tab === 'Pieces' && !!entries.length && !!state.saved.length && <QuietLink label="Make it a look: see your saved looks" onPress={() => chooseTab('Looks')} />}
    {tab === 'Wardrobe' && !!entries.length && <QuietLink label="Add what you wear most" onPress={() => router.push('/closet')} />}
    {tab !== 'Wardrobe' && !!entries.length && <Text style={styles.note}>{retailerNote}</Text>}
  </View>;
  const grid = tab !== 'Looks' || desktop;
  const perRow = tab === 'Looks' ? 2 : columns, lookWidth = Math.floor((width - gutter * 2 - gap) / 2);
  return <View style={[styles.root, { paddingTop: insets.top }]}><GlassAtmosphere />
    <FlatList ref={list} key={tab + perRow} data={entries} numColumns={grid ? perRow : 1} columnWrapperStyle={grid ? (desktop ? { gap } : styles.columns) : undefined} keyExtractor={item => item.kind + ':' + item.value.id}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 30 }, desktop && { paddingHorizontal: gutter, paddingTop: 36 }]} showsVerticalScrollIndicator={false} initialNumToRender={6} maxToRenderPerBatch={6} windowSize={5} removeClippedSubviews={false}
      ListHeaderComponent={header} ListEmptyComponent={empty} ListFooterComponent={footer} ItemSeparatorComponent={() => <View style={{ height: grid ? (desktop ? 36 : 24) : 36 }} />}
      renderItem={({ item }) => {
        if (item.kind === 'piece') {
          const product = item.value, shoppable = !!retailerProductUrl(product), price = shoppable ? formatMoney(product.priceCents) : 'Sample';
          return <PieceTile width={tileWidth} image={<ProductVisual product={product} fit="cover" transition={false} />} brand={product.brand} name={product.name} detail={price}
            label={product.brand + ', ' + product.name + ', ' + (shoppable ? price : 'sample piece')}
            onPress={() => openPiece(product)} onLongPress={() => manage(item)} onRemove={() => unsave(item)}
            actions={[...(shoppable ? [{ name: 'shop', label: 'Shop at ' + product.retailer!.name, run: () => shop(product) }] : []), { name: 'remove', label: 'Remove from saved', run: () => unsave(item) }, { name: 'more', label: 'More options', run: () => manage(item) }]} />;
        }
        if (item.kind === 'look') return desktop ? <View style={{ width: lookWidth }}><LookBoard entry={item.value} onOpen={() => openLook(item.value)} onManage={() => manage(item)} onRemove={() => unsave(item)} onShop={() => setShoppingLookId(item.value.id)} /></View> : <LookBoard entry={item.value} onOpen={() => openLook(item.value)} onManage={() => manage(item)} onRemove={() => unsave(item)} onShop={() => setShoppingLookId(item.value.id)} />;
        const garment = item.value, name = closetPieceToProduct(garment).name, photo = isPhotoPiece(garment);
        return <PieceTile width={tileWidth} brand="Your wardrobe" name={name} detail={photo ? garment.color || slotLabel(garment.slot) : slotLabel(garment.slot)}
          image={photo ? <LocalPhoto uri={garment.localUri} label={name} /> : <View style={{ flex: 1, backgroundColor: garment.hex || colors.plate }} />}
          label={name + ', ' + (photo ? 'your photo' : slotLabel(garment.slot) + ', no photo yet')}
          onPress={() => photo ? editPiece(garment) : manage(item)} onLongPress={() => manage(item)}
          actions={[...(photo ? [{ name: 'edit', label: 'Edit piece', run: () => editPiece(garment) }] : []), { name: 'more', label: 'More options', run: () => manage(item) }]} />;
      }} />
    <ContextSheet visible={sortOpen} title="Sort your shortlist" onClose={() => setSortOpen(false)}>
      {sorts.map(option => <MotionPressable key={option.value} accessibilityRole="button" accessibilityState={{ selected: option.value === sort }} onPress={() => { setSort(option.value); setSortOpen(false); toTop(); }} style={styles.option}><Text style={editorial.body}>{option.label}</Text>{option.value === sort && <FormIcon name="check" size={18} />}</MotionPressable>)}
    </ContextSheet>
    <SavedLookShopSheet entry={shoppingLook} onClose={() => setShoppingLookId(null)} onShop={shop} />
    <ContextSheet visible={!!managed} title={confirm ? 'Remove this piece?' : 'In your collection'} onClose={close}>
      {managed && <><Text style={styles.sheetTitle}>{managed.kind === 'look' ? managed.value.look.title : managed.kind === 'upload' ? closetPieceToProduct(managed.value).name : managed.value.name ?? 'Your piece'}</Text>
        {confirm && managed.kind === 'upload' ? <><Text style={editorial.body}>{isPhotoPiece(managed.value) ? 'This removes the piece and its photo from this device.' : 'This removes the piece from your closet.'}</Text><TextAction dark disabled={removing} haptic={false} label={removing ? 'Removing…' : 'Remove'} onPress={() => { void removeOwned(); }} /><TextAction disabled={removing} label="Keep it" onPress={() => setConfirm(false)} /></> : <>
          {managed.kind === 'look' && <>
            <TextAction label="View saved edit" onPress={() => { const entry = managed.value; close(); openLook(entry); }} />
            {!!shoppingSummary(managed.value.look).products.length && <TextAction label="Shop this look" onPress={() => { const id = managed.value.id; close(); setShoppingLookId(id); }} />}
          </>}
          {managed.kind === 'piece' && <>
            <TextAction label="View piece details" onPress={() => { const product = managed.value; close(); openPiece(product); }} />
            {!!retailerProductUrl(managed.value) && <TextAction label={'Shop at ' + managed.value.retailer!.name} onPress={() => { const product = managed.value; close(); shop(product); }} />}
          </>}
          {managed.kind === 'upload' && isPhotoPiece(managed.value) && <>
            <TextAction label="Edit piece" onPress={() => { const garment = managed.value; close(); editPiece(garment); }} />
            <TextAction label="Try on" onPress={() => { useFormStore.getState().trySet([{ source: 'user_upload', id: managed.value.id }]); close(); router.navigate('/tryon'); }} />
            <TextAction disabled={!currentLook} label="Add to your edit" onPress={() => { if (!currentLook) return; const next = addGarmentToLook(currentLook, managed.value); if (next === currentLook) { close(); showToast('Already on your edit', 'info'); return; } useFormStore.getState().replaceLook(currentLook, next, occasion); close(); showToast('Added to your edit'); }} />
          </>}
          {managed.kind === 'upload'
            ? <TextAction label="Remove from wardrobe" onPress={() => setConfirm(true)} />
            : <TextAction label="Remove from saved" onPress={() => { const item = managed; close(); unsave(item); }} />}
        </>}
      </>}
    </ContextSheet>
  </View>;
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  content: { paddingHorizontal: savedGutter, paddingTop: 18 },
  header: { marginBottom: 18 },
  columns: { justifyContent: 'space-between' },
  empty: { paddingTop: 48, alignItems: 'center', gap: 14 },
  emptyTitle: { fontFamily: family.serif, fontSize: 30, lineHeight: 35, color: colors.ink, textAlign: 'center' },
  emptyBody: { fontFamily: family.sans, fontSize: 13, lineHeight: 20, color: colors.muted, textAlign: 'center', maxWidth: 290 },
  emptyAction: { width: '100%', maxWidth: 360, marginTop: 8 },
  footer: { paddingTop: 28, gap: 4 },
  note: { fontFamily: family.sans, fontSize: 10, lineHeight: 17, color: colors.muted, marginTop: 10 },
  sheetTitle: { fontFamily: family.serif, fontSize: 26, lineHeight: 31, color: colors.ink },
  option: { minHeight: 54, paddingHorizontal: 16, borderRadius: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
});
