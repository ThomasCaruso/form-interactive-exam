import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { dayKey } from '../domain/plans';
import type { DayKey } from '../domain/types';
import { useFormStore } from '../state/store';

/** Today as a local day key. It rolls over when the screen regains focus or the app returns from the background, and
 * passed days are settled into history at the same moment. */
export function useToday(): DayKey {
  const [today, setToday] = useState(() => dayKey(new Date()));
  const refresh = useCallback(() => {
    const now = dayKey(new Date());
    setToday(now);
    useFormStore.getState().settlePlans(now);
  }, []);
  useFocusEffect(refresh);
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => { if (state === 'active') refresh(); });
    return () => sub.remove();
  }, [refresh]);
  return today;
}
