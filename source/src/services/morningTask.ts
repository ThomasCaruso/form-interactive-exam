import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { CONTEXT_SUPPORTED, readCalendar, refreshWeather, writeMornings } from './dayContext';
import { useFormStore } from '../state/store';

/**
 * Keeps the morning notes current when FORM isn't opened: every few hours (the system decides when) it re-reads the
 * calendar, refreshes the forecast and rewrites the week's notes. Defined at module scope, as expo-task-manager
 * requires, by importing this file from the root layout.
 */
export const MORNING_TASK = 'form-morning-refresh';

const hydrated = () => new Promise<void>(done => {
  if (useFormStore.persist.hasHydrated()) done();
  else { const off = useFormStore.persist.onFinishHydration(() => { off(); done(); }); }
});

if (CONTEXT_SUPPORTED) {
  TaskManager.defineTask(MORNING_TASK, async () => {
    try {
      await hydrated();
      await readCalendar().catch(() => {});
      await refreshWeather().catch(() => {});
      await writeMornings();
      return BackgroundTask.BackgroundTaskResult.Success;
    } catch {
      return BackgroundTask.BackgroundTaskResult.Failed;
    }
  });
}

/** Registers the refresh while the morning note is on, and removes it when it's off. */
export async function syncMorningTask(on: boolean) {
  if (!CONTEXT_SUPPORTED) return;
  const registered = await TaskManager.isTaskRegisteredAsync(MORNING_TASK);
  if (on && !registered) await BackgroundTask.registerTaskAsync(MORNING_TASK, { minimumInterval: 4 * 60 });
  else if (!on && registered) await BackgroundTask.unregisterTaskAsync(MORNING_TASK);
}
