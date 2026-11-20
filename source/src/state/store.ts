import type { TryOnScene } from '../domain/tryOnScene';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { fittingProfileIssue, fittingStep, reconcileFittingDraft } from '../domain/fitting';
import { fitIssue } from '../domain/onboarding';
import { createSavedSnapshot } from '../domain/transforms';
import { closetPieceToProduct, fromLegacyGarment } from '../domain/closet';
import { selectionKey, type TryOnSelectionItem } from '../domain/garments';
import { slotResolver, withPiece, withPieces } from '../domain/trying';
import { clearOutfitFromPlans, dayKey, fillWeek, settlePlans, type Plans } from '../domain/plans';
import type { DayContext, DayEvents, WeatherCache } from '../domain/context';
import type { ClosetPiece, DayKey, DayPlan, Look, PassedLook, Product, Profile, ReviewStatus, SavedLook, SavedPiece, Session, UserGarment, PersonReference, PersonPhotoRole } from '../domain/types';
export const DEFAULT_PROFILE: Profile = {
  styleBrief: '', hiddenProfileSections: [],
  name: 'Thomas', height: '6′0″', topSize: 'M', waist: '30', inseam: '32', shoe: '10',
  budgetCents: 50000, styles: ['Minimal', 'Elevated casual', 'Classic'],
  priority: 'Best overall look', brands: ['COS', 'Uniqlo', 'New Balance'],
  favoriteColors: ['Soft black', 'Taupe', 'Bone', 'Grey', 'Navy'], avoidedColors: [], avoidedBrands: [],
};
interface DiscoveryUndo { productId: string; session: number; }
interface FormState {
  tryOnScene: TryOnScene; setTryOnScene: (scene: TryOnScene) => void;
  lookRecommendationReview: Record<string, ReviewStatus>; lookDiscoveryUndo: {lookId:string;session:number} | null;
  reviewLook: (look: Look, status: ReviewStatus) => boolean; undoLookReview: () => string | null;

  personPhotos: PersonReference[];
  setPersonPhoto: (photo: PersonReference) => void; removePersonPhoto: (role: PersonPhotoRole) => void;
  fittingStep: number; fittingFlowVersion: number;
  saveFittingDraft: (profile: Profile, step: number) => void;
  onboardingDraft: Profile | null; onboardingStep: number;
  saveOnboardingDraft: (profile: Profile, step: number) => void;
  /** Grid picks join the closet only when onboarding actually finishes. */
  finishOnboarding: (profile: Profile, picks?: ClosetPiece[]) => boolean;
  onboardingComplete: boolean; profile: Profile; sessions: Session[]; activeSessionId: string | null;
  saved: SavedLook[]; passed: PassedLook[]; savedPieces: SavedPiece[];
  /** What the person owns. Photo images stay in app document storage; URIs only here. */
  closet: ClosetPiece[];
  /** Raw store-v1 uploads, kept untouched for one version in case the migration needs replaying. */
  legacyUserGarments: UserGarment[];
  /** Temporary try-on selection — deliberately NOT persisted; a selection is never a stored try-on. */
  tryOnSelection: TryOnSelectionItem[];
  recommendationReview: Record<string, ReviewStatus>; recommendationSession: number;
  discoveryUndo: DiscoveryUndo | null;
  reviewPiece: (product: Product, status: ReviewStatus) => boolean; undoPieceReview: () => string | null;
  selectedLook: Look | null; hasHydrated: boolean; storageError: boolean;
  addSession: (session: Session) => void; setActiveSession: (id: string | null) => void;
  selectLook: (look: Look) => void; replaceLook: (before: Look, after: Look, occasion: string) => void;
  toggleSaved: (look: Look, occasion: string) => boolean; removeSaved: (id: string) => void;
  /** Your outfits are your saved looks (see src/domain/outfits.ts). `activeOutfitId` is the one on the Edits stage;
   * null means a FORM idea is. */
  activeOutfitId: string | null;
  addOutfit: (entry: SavedLook) => void; setActiveOutfit: (id: string | null) => void;
  updateOutfit: (id: string, patch: { name?: string; products?: Product[]; tucked?: boolean }) => void;
  /** Puts a removed outfit back where it was (Undo). */
  restoreSaved: (entry: SavedLook, index: number) => void;
  /** Puts a removed saved piece back where it was, with its original savedAt (Undo). */
  restoreSavedPiece: (entry: SavedPiece, index: number) => void;
  markPassed: (look: Look, occasion: string) => void;
  togglePiece: (product: Product) => boolean; passPiece: (product: Product) => void; refreshSelection: () => void;
  addClosetPieces: (pieces: ClosetPiece[]) => void;
  updateClosetPiece: (id: string, patch: Partial<Pick<ClosetPiece, 'name' | 'color' | 'slot' | 'type' | 'formality' | 'relaxed' | 'warmth' | 'cutoutUri' | 'cutoutAspect'>>) => void;
  removeClosetPiece: (id: string) => void;
  tryPiece: (item: TryOnSelectionItem) => void; trySet: (items: TryOnSelectionItem[]) => void; removeTrying: (key: string) => void; clearTryOnSelection: () => void;
  updateProfile: (profile: Profile) => void;
  /** Your week: one plan per local day (src/domain/plans.ts). */
  plans: Plans;
  /** Days an outfit's deletion took off the calendar, so its Undo can put them back. Not persisted. */
  lastRemovedPlans: { outfitId: string; days: Plans } | null;
  planDay: (day: DayKey, outfitId: string) => void;
  setDayDetails: (day: DayKey, patch: Pick<DayPlan, 'occasion' | 'note'>) => void;
  /** Returns what the day held, for Undo. */
  clearDay: (day: DayKey) => DayPlan | undefined;
  /** Puts days back as they were (Undo); `undefined` empties a day. */
  restoreDays: (days: Record<DayKey, DayPlan | undefined>) => void;
  /** You're wearing today's outfit (Today's card or the morning note); `false` takes it back. */
  confirmWorn: (day: DayKey, on?: boolean) => void;
  /** Plans the empty days of the week starting `today`, using the calendar and forecast when connected;
   * returns the filled days and what they held before. */
  fillWeek: (today: DayKey, context?: Record<DayKey, DayContext>) => { filled: DayKey[]; before: Record<DayKey, DayPlan | undefined> };
  /** Calendar, weather and the morning note — each off until you turn it on (src/services/dayContext.ts). */
  contextPrefs: { calendar: boolean; weather: boolean; morning: boolean };
  setContextPref: (key: 'calendar' | 'weather' | 'morning', on: boolean) => void;
  /** When the morning note arrives, in minutes after midnight. */
  morningAt: number;
  setMorningAt: (minutes: number) => void;
  /** "Not now" on the Plan around your day strip. The sources stay reachable from the week card's footer. */
  connectDismissed: boolean;
  dismissConnect: () => void;
  /** The last forecast from the weather relay, kept so the morning note and an offline open can use it. */
  weather: WeatherCache | null;
  setWeather: (weather: WeatherCache | null) => void;
  /** This fortnight's calendar grouped by day. Read on the phone each time the app opens; never persisted. */
  dayEvents: Record<DayKey, DayEvents>;
  /** Whether the calendar has been read since the app opened (dayEvents is {} until then). */
  eventsRead: boolean;
  setDayEvents: (events: Record<DayKey, DayEvents>) => void;
  settlePlans: (today: DayKey) => void;
  setOnboardingComplete: (complete: boolean) => void; setHasHydrated: (hydrated: boolean) => void;
}
/** New pieces first; a piece already in the closet (same id) is not added twice. */
const mergeCloset = (closet: ClosetPiece[], add: ClosetPiece[]) => {
  const ids = new Set(closet.map(p => p.id)), fresh: ClosetPiece[] = [];
  for (const p of add) if (!ids.has(p.id)) { ids.add(p.id); fresh.push(p); }
  return [...fresh, ...closet];
};
export const useFormStore = create<FormState>()(persist((set, get) => ({
  tryOnScene: {id:'original'}, setTryOnScene: tryOnScene => set({tryOnScene}),
  lookRecommendationReview: {}, lookDiscoveryUndo: null,
  reviewLook: (look,status) => {
    const current=get();
    if(current.lookRecommendationReview[look.id]||current.saved.some(s=>s.id===look.id))return false;
    set(state=>({lookRecommendationReview:{...state.lookRecommendationReview,[look.id]:status},lookDiscoveryUndo:{lookId:look.id,session:state.recommendationSession},
      saved:status==='saved'?[createSavedSnapshot(look,'For you, today'),...state.saved]:state.saved}));
    return true;
  },
  undoLookReview: () => {
    const undo=get().lookDiscoveryUndo;
    if(!undo||undo.session!==get().recommendationSession)return null;
    set(state=>{const review={...state.lookRecommendationReview};delete review[undo.lookId];return {lookRecommendationReview:review,lookDiscoveryUndo:null,saved:state.saved.filter(s=>s.id!==undo.lookId)};});
    return undo.lookId;
  },
  personPhotos: [], fittingStep: 0, fittingFlowVersion: 1,
  setPersonPhoto: photo => set(state => ({ personPhotos: [...state.personPhotos.filter(p => p.role !== photo.role), photo] })),
  removePersonPhoto: role => set(state => ({ personPhotos: state.personPhotos.filter(p => p.role !== role) })),
  saveFittingDraft: (profile, step) => set({ onboardingDraft: profile, fittingStep: fittingStep(step), fittingFlowVersion: 1 }),
  onboardingDraft: null, onboardingStep: 0,
  saveOnboardingDraft: (profile, step) => set({ onboardingDraft: profile, onboardingStep: step }),
  finishOnboarding: (profile, picks) => {
    if (fittingProfileIssue(profile)) return false;
    if ((['waist', 'inseam', 'shoe'] as const).some(key => fitIssue(key, profile[key]))) return false;
    set(state => ({ profile, onboardingComplete: true, onboardingDraft: null, onboardingStep: 0, fittingStep: 0, discoveryUndo: null,
      closet: picks?.length ? mergeCloset(state.closet, picks) : state.closet }));
    return true;
  },
  onboardingComplete: false, profile: DEFAULT_PROFILE, sessions: [], activeSessionId: null, activeOutfitId: null,
  saved: [], passed: [], savedPieces: [], closet: [], legacyUserGarments: [], tryOnSelection: [], recommendationReview: {}, recommendationSession: 1,
  discoveryUndo: null,
  selectedLook: null, hasHydrated: false, storageError: false,
  addSession: session => set(state => ({ sessions: [session, ...state.sessions].slice(0, 8), activeSessionId: session.id, selectedLook: session.looks[0] ?? null })),
  setActiveSession: id => set({ activeSessionId: id }),
  selectLook: look => set({ selectedLook: look }),
  replaceLook: (before, after, occasion) => {
    const active = get().sessions.find(s => s.id === get().activeSessionId);
    if (active?.looks.some(l => l.id === before.id)) {
      set(state => ({ selectedLook: after, sessions: state.sessions.map(s => s.id === active.id ? { ...s, looks: s.looks.map(l => l.id === before.id ? after : l) } : s) }));
    } else {
      const sourceRequest = get().sessions.find(s => s.looks.some(l => l.id === before.id))?.request ?? get().saved.find(s => s.id === before.id)?.request;
      const session: Session = { id: 'adjusted-' + Date.now(), occasion, request: sourceRequest, createdAt: Date.now(), looks: [after] };
      get().addSession(session);
    }
  },
  toggleSaved: (look, occasion) => {
    const exists = get().saved.some(entry => entry.id === look.id);
    set(state => ({ lookDiscoveryUndo: state.lookDiscoveryUndo?.lookId===look.id?null:state.lookDiscoveryUndo, saved: exists ? state.saved.filter(entry => entry.id !== look.id) : [{ ...createSavedSnapshot(look, occasion), request: state.sessions.find(s => s.looks.some(l => l.id === look.id))?.request }, ...state.saved] }));
    return !exists;
  },
  removeSaved: id => set(state => {
    const { plans, cleared } = clearOutfitFromPlans(state.plans, id, dayKey(new Date()));
    return { plans, lastRemovedPlans: Object.keys(cleared).length ? { outfitId: id, days: cleared } : null,
      lookDiscoveryUndo: state.lookDiscoveryUndo?.lookId === id ? null : state.lookDiscoveryUndo, saved: state.saved.filter(entry => entry.id !== id), activeOutfitId: state.activeOutfitId === id ? null : state.activeOutfitId };
  }),
  addOutfit: entry => set(state => ({ saved: [entry, ...state.saved.filter(s => s.id !== entry.id)], activeOutfitId: entry.id })),
  setActiveOutfit: id => set({ activeOutfitId: id }),
  updateOutfit: (id, patch) => set(state => ({ saved: state.saved.map(s => s.id !== id ? s : {
    ...s, tucked: patch.tucked ?? s.tucked,
    look: { ...s.look, title: patch.name?.trim() || s.look.title, products: patch.products ? patch.products.map(p => ({ ...p })) : s.look.products },
  }) })),
  restoreSaved: (entry, index) => set(state => state.saved.some(s => s.id === entry.id) ? {} : {
    saved: [...state.saved.slice(0, index), entry, ...state.saved.slice(index)],
    ...(state.lastRemovedPlans?.outfitId === entry.id ? { plans: { ...state.plans, ...state.lastRemovedPlans.days }, lastRemovedPlans: null } : {}),
  }),
  restoreSavedPiece: (entry, index) => set(state => state.savedPieces.some(p => p.id === entry.id) ? {} : {
    savedPieces: [...state.savedPieces.slice(0, index), entry, ...state.savedPieces.slice(index)],
    recommendationReview: { ...state.recommendationReview, [entry.id]: 'saved' },
  }),
  markPassed: (look, occasion) => set(state => ({ passed: [{ lookId: look.id, title: look.title, occasion, passedAt: Date.now() }, ...state.passed.filter(p => p.lookId !== look.id)].slice(0, 100) })),
  togglePiece: product => {
    const exists = get().savedPieces.some(p => p.id === product.id);
    set(state => ({
      discoveryUndo: null,
      savedPieces: exists ? state.savedPieces.filter(p => p.id !== product.id) : [{ id: product.id, product: { ...product }, savedAt: Date.now() }, ...state.savedPieces],
      recommendationReview: { ...state.recommendationReview, [product.id]: exists ? 'passed' : 'saved' },
    }));
    return !exists;
  },
  reviewPiece: (product, status) => {
    const current = get();
    if (current.recommendationReview[product.id] || current.savedPieces.some(p => p.id === product.id)) return false;
    set(state => ({
      discoveryUndo: { productId: product.id, session: state.recommendationSession },
      recommendationReview: { ...state.recommendationReview, [product.id]: status },
      savedPieces: status === 'saved' ? [{ id: product.id, product: { ...product }, savedAt: Date.now() }, ...state.savedPieces] : state.savedPieces,
    }));
    return true;
  },
  undoPieceReview: () => {
    const undo = get().discoveryUndo;
    if (!undo || undo.session !== get().recommendationSession) return null;
    set(state => {
      const review = { ...state.recommendationReview };
      delete review[undo.productId];
      return { discoveryUndo: null, recommendationReview: review, savedPieces: state.savedPieces.filter(p => p.id !== undo.productId) };
    });
    return undo.productId;
  },
  passPiece: product => set(state => ({
    discoveryUndo: null,
    recommendationReview: { ...state.recommendationReview, [product.id]: 'passed' },
    savedPieces: state.savedPieces.filter(p => p.id !== product.id),
  })),
  // A refresh deals the catalog again but keeps what the swipes taught.
  refreshSelection: () => set(state => {
    const answers = state.profile.tasteAnswers ?? { liked: [], passed: [] }, review = Object.entries(state.recommendationReview);
    const keep = (ids: string[], add: string[]) => [...new Set([...add, ...ids])].slice(0, 300);
    const liked = keep(answers.liked, review.filter(([, s]) => s === 'saved').map(([id]) => id));
    const passed = keep(answers.passed, review.filter(([, s]) => s === 'passed').map(([id]) => id)).filter(id => !liked.includes(id));
    return { profile: { ...state.profile, tasteAnswers: { liked, passed } }, lookRecommendationReview: {}, lookDiscoveryUndo: null, discoveryUndo: null, recommendationReview: {}, recommendationSession: state.recommendationSession + 1 };
  }),
  addClosetPieces: pieces => set(state => ({ closet: mergeCloset(state.closet, pieces) })),
  // Edits re-derive the embedded Product view so boards already carrying the
  // piece stay live. Saved looks are frozen snapshots and deliberately keep what they saved.
  updateClosetPiece: (id, patch) => set(state => {
    const piece = state.closet.find(p => p.id === id);
    if (!piece) return {};
    const updated = { ...piece, ...patch };
    const view = closetPieceToProduct(updated);
    const refresh = (look: Look): Look => look.products.some(p => p.id === id) ? { ...look, products: look.products.map(p => p.id === id ? view : p) } : look;
    return {
      closet: state.closet.map(p => p.id === id ? updated : p),
      selectedLook: state.selectedLook ? refresh(state.selectedLook) : null,
      sessions: state.sessions.map(s => ({ ...s, looks: s.looks.map(refresh) })),
    };
  }),
  // Metadata removal only — a photo file is deleted by removeGarmentWithFile() at the UI edge.
  removeClosetPiece: id => set(state => ({
    closet: state.closet.filter(p => p.id !== id),
    tryOnSelection: state.tryOnSelection.filter(item => !(item.source === 'user_upload' && item.id === id)),
  })),
  tryPiece: item => set(state => ({ tryOnSelection: withPiece(state.tryOnSelection, item, slotResolver(state.closet)) })),
  trySet: items => set(state => ({ tryOnSelection: withPieces(items, slotResolver(state.closet)) })),
  removeTrying: key => set(state => ({ tryOnSelection: state.tryOnSelection.filter(entry => selectionKey(entry) !== key) })),
  clearTryOnSelection: () => set({ tryOnSelection: [] }),
  updateProfile: profile => set(state => ({ lookDiscoveryUndo:null, discoveryUndo: null, profile: { ...profile }, onboardingDraft: state.onboardingDraft ? reconcileFittingDraft(state.onboardingDraft, state.profile, profile) : null })),
  plans: {}, lastRemovedPlans: null,
  planDay: (day, outfitId) => set(state => {
    const prev = state.plans[day], next: DayPlan = { ...prev, outfitId };
    // A different outfit is a new plan: Wearing it has to be said again.
    if (prev?.outfitId !== outfitId) delete next.confirmed;
    return { plans: { ...state.plans, [day]: next } };
  }),
  confirmWorn: (day, on = true) => set(state => {
    const p = state.plans[day];
    if (!p?.outfitId || !!p.confirmed === on) return {};
    const next: DayPlan = { ...p, confirmed: true };
    if (!on) delete next.confirmed;
    return { plans: { ...state.plans, [day]: next } };
  }),
  setDayDetails: (day, patch) => set(state => {
    const next: DayPlan = { ...(state.plans[day] ?? { outfitId: null }), ...patch };
    if (!next.occasion) delete next.occasion;
    if (!next.note?.trim()) delete next.note;
    const plans = { ...state.plans };
    if (!next.outfitId && !next.worn && !next.occasion && !next.note) delete plans[day]; else plans[day] = next;
    return { plans };
  }),
  clearDay: day => {
    const before = get().plans[day];
    if (before) set(state => { const plans = { ...state.plans }; delete plans[day]; return { plans }; });
    return before;
  },
  restoreDays: days => set(state => {
    const plans = { ...state.plans };
    for (const [day, plan] of Object.entries(days)) { if (plan) plans[day] = plan; else delete plans[day]; }
    return { plans };
  }),
  fillWeek: (today, context) => {
    const state = get(), r = fillWeek(state.plans, state.saved, today, context);
    const before = Object.fromEntries(r.filled.map(day => [day, state.plans[day]]));
    if (r.filled.length) set({ plans: r.plans });
    return { filled: r.filled, before };
  },
  settlePlans: today => { const state = get(), plans = settlePlans(state.plans, state.saved, today); if (plans !== state.plans) set({ plans }); },
  contextPrefs: { calendar: false, weather: false, morning: false },
  setContextPref: (key, on) => set(state => ({ contextPrefs: { ...state.contextPrefs, [key]: on }, ...(key === 'weather' && !on ? { weather: null } : {}), ...(key === 'calendar' && !on ? { dayEvents: {} } : {}) })),
  morningAt: 7 * 60, setMorningAt: morningAt => set({ morningAt }),
  connectDismissed: false, dismissConnect: () => set({ connectDismissed: true }),
  weather: null, setWeather: weather => set({ weather }),
  dayEvents: {}, eventsRead: false, setDayEvents: dayEvents => set({ dayEvents, eventsRead: true }),
  setOnboardingComplete: complete => set({ onboardingComplete: complete }),
  setHasHydrated: hydrated => set({ hasHydrated: hydrated }),
}), {
  name: 'form-mobile-v1', version: 3,
  storage: createJSONStorage(() => ({
    getItem: key => AsyncStorage.getItem(key),
    setItem: async (key, value) => { try { await AsyncStorage.setItem(key, value); } catch (error) { if (!useFormStore.getState().storageError) useFormStore.setState({ storageError: true }); console.warn('FORM local save failed', error); } },
    removeItem: key => AsyncStorage.removeItem(key),
  })),
  // v2: uploads became photo closet pieces. The raw v1 array is kept as legacyUserGarments. v3 adds `plans`, which
  // defaults to {} — nothing to migrate.
  migrate: (persisted, version) => {
    const state = (persisted ?? {}) as Record<string, unknown>;
    if (version >= 2) return state;
    const legacy = Array.isArray(state.userGarments) ? state.userGarments as UserGarment[] : [];
    const { userGarments: _v1, ...rest } = state;
    return { ...rest, closet: legacy.map(fromLegacyGarment), legacyUserGarments: legacy };
  },
  merge: (persisted, current) => {
    const previous = persisted as Partial<FormState>;
    return { ...current, ...previous, profile: { ...DEFAULT_PROFILE, ...previous?.profile }, contextPrefs: { ...current.contextPrefs, ...previous?.contextPrefs } };
  },
  partialize: state => ({
    personPhotos: state.personPhotos, fittingStep: state.fittingStep, fittingFlowVersion: state.fittingFlowVersion,
    onboardingDraft: state.onboardingDraft, onboardingStep: state.onboardingStep,
    onboardingComplete: state.onboardingComplete, profile: state.profile, sessions: state.sessions,
    activeSessionId: state.activeSessionId, activeOutfitId: state.activeOutfitId, saved: state.saved, passed: state.passed,
    savedPieces: state.savedPieces, closet: state.closet, legacyUserGarments: state.legacyUserGarments, recommendationReview: state.recommendationReview,
    tryOnScene: state.tryOnScene, lookRecommendationReview: state.lookRecommendationReview,
    recommendationSession: state.recommendationSession, selectedLook: state.selectedLook, plans: state.plans,
    contextPrefs: state.contextPrefs, weather: state.weather, morningAt: state.morningAt, connectDismissed: state.connectDismissed,
  }),
  onRehydrateStorage: () => (state, error) => {
    if (state) { state.settlePlans(dayKey(new Date())); state.setHasHydrated(true); }
    if (error) queueMicrotask(() => useFormStore.setState({ hasHydrated: true, storageError: true }));
  },
}));
