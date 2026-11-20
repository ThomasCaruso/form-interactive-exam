import { AppState, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
export type TactileKind = 'selection' | 'soft' | 'saved' | 'passed' | 'undo' | 'warning' | 'error';
let revision = 0;
/** Native effects respect device settings; no delayed buzz can outlive an action. */
export function tactile(kind: TactileKind = 'selection'): void {
  revision += 1;
  if (AppState.currentState !== 'active') return;
  try {
    const task = kind === 'saved' ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      : kind === 'warning' ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
      : kind === 'error' ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      : Platform.OS === 'android' ? Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      : kind === 'selection' ? Haptics.selectionAsync()
      : Haptics.impactAsync(kind === 'undo' ? Haptics.ImpactFeedbackStyle.Rigid : Haptics.ImpactFeedbackStyle.Soft);
    void task.catch(() => {});
  } catch { /* Unsupported devices keep the interaction available. */ }
}
/** A synchronous outcome owns the cue, avoiding a second generic press impact. */
export function pressFeedback(action: () => void, kind: TactileKind | false = 'soft'): void {
  const before = revision;
  action();
  if (kind && revision === before) tactile(kind);
}
