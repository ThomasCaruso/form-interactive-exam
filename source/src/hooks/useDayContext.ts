import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { showToast } from '../components/Toast';
import { dayKey, outfitOn } from '../domain/plans';
import { CONTEXT_SUPPORTED, readCalendar, refreshWeather, scheduleMornings, SUGGEST_CATEGORY, WEAR_ACTION, WEAR_SUGGESTION } from '../services/dayContext';
import { syncMorningTask } from '../services/morningTask';
import { useFormStore } from '../state/store';

// The web build has no local notifications (getLastNotificationResponse throws there), so none of this runs on it.
if (CONTEXT_SUPPORTED) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldPlaySound: false, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true }),
  });
}

/** Answers a tap on a morning note. Wearing it confirms the day; Wear that plans the suggested outfit and confirms
 * it; a tap on the note itself opens the You page. */
function answer(r: Notifications.NotificationResponse | null, open: () => void) {
  if (!r) return;
  const content = r.notification.request.content, data = content.data as { day?: string; kind?: string; suggest?: string } | undefined;
  if (data?.kind !== 'morning' || !data.day) return;
  const day = data.day;
  Notifications.clearLastNotificationResponse();
  Notifications.dismissNotificationAsync(r.notification.request.identifier).catch(() => {});
  const store = useFormStore.getState();
  if (r.actionIdentifier === WEAR_SUGGESTION && content.categoryIdentifier === SUGGEST_CATEGORY && data.suggest && store.saved.some(s => s.id === data.suggest)) {
    // Only an empty day takes the suggestion; one planned since the note was written keeps its outfit.
    if (!outfitOn(store.plans, store.saved, day)) store.planDay(day, data.suggest);
  }
  if (r.actionIdentifier === WEAR_ACTION || r.actionIdentifier === WEAR_SUGGESTION) {
    const s = useFormStore.getState(), o = outfitOn(s.plans, s.saved, day);
    s.confirmWorn(day);
    if (o && day === dayKey(new Date())) showToast('Wearing ' + o.name + ' today', 'success', { label: 'Undo', onPress: () => useFormStore.getState().confirmWorn(day, false) });
  }
  open();
}

/** Keeps the calendar and forecast current while the app is open, keeps the morning notes in step with your plans,
 * and answers the morning note. Mounted once, at the root. Does nothing on the web. */
export function useDayContext() {
  const router = useRouter();
  useEffect(() => {
    if (!CONTEXT_SUPPORTED) return;
    const refresh = () => {
      readCalendar().catch(e => console.warn('FORM calendar', e));
      refreshWeather().catch(e => console.warn('FORM weather', e));
    };
    refresh();
    const app = AppState.addEventListener('change', state => { if (state === 'active') refresh(); });
    const sync = (on: boolean) => syncMorningTask(on).catch(e => console.warn('FORM morning task', e));
    sync(useFormStore.getState().contextPrefs.morning);
    // Any change that alters a morning note re-schedules them (debounced in scheduleMornings).
    const unsub = useFormStore.subscribe((s, prev) => {
      if (s.contextPrefs.morning !== prev.contextPrefs.morning) sync(s.contextPrefs.morning);
      if (s.plans !== prev.plans || s.saved !== prev.saved || s.dayEvents !== prev.dayEvents || s.weather !== prev.weather || s.contextPrefs !== prev.contextPrefs || s.morningAt !== prev.morningAt) scheduleMornings();
    });
    scheduleMornings();
    const open = () => router.navigate('/profile');
    answer(Notifications.getLastNotificationResponse(), open);
    const tapped = Notifications.addNotificationResponseReceivedListener(r => answer(r, open));
    return () => { app.remove(); unsub(); tapped.remove(); };
  }, [router]);
}
