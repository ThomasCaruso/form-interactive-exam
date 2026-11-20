import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { colors, radius } from '../theme/tokens';
import { family } from '../theme/typography';
import { FormIcon, type FormIconName } from './FormIcon';
import { tactile } from '../utils/haptics';
type FeedbackKind = 'success' | 'info' | 'passed' | 'undo' | 'warning' | 'error';
/** `action`: one button on the toast (Undo). The toast then takes touches and stays a little longer. */
type ToastAction = { label: string; onPress: () => void };
type Feedback = { message: string; kind: FeedbackKind; action?: ToastAction };
const icons: Record<FeedbackKind, FormIconName> = { success: 'check', info: 'more', passed: 'close', undo: 'rewind', warning: 'more', error: 'close' };
type Listener = (feedback: Feedback) => void;
let listener: Listener | null = null;
export function showToast(message: string, kind: FeedbackKind = 'success', action?: ToastAction): void {
  if (!listener) return;
  tactile(kind === 'success' ? 'saved' : kind === 'info' ? 'selection' : kind);
  listener({ message, kind, action });
}
export function Toast() {
  const insets = useSafeAreaInsets();
  const reduced = useReduceMotion();
  const motionPreference = useRef(reduced);
  useEffect(() => { motionPreference.current = reduced; }, [reduced]);
  const [opacity] = useState(() => new Animated.Value(0));
  const [message, setMessage] = useState<Feedback | null>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let generation = 0;
    listener = feedback => {
      const token = ++generation;
      if (timer) clearTimeout(timer);
      opacity.stopAnimation();
      setMessage(feedback);
      AccessibilityInfo.announceForAccessibility(feedback.message);
      opacity.setValue(motionPreference.current ? 1 : 0);
      if (!motionPreference.current) Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }).start();
      timer = setTimeout(() => {
        if (generation !== token) return;
        if (motionPreference.current) { setMessage(null); return; }
        Animated.timing(opacity, { toValue: 0, duration: 140, useNativeDriver: true }).start(({ finished }) => { if (finished && generation === token) setMessage(null); });
      }, feedback.action ? 6000 : feedback.kind === 'warning' || feedback.kind === 'error' ? 3200 : 2200);
    };
    return () => { generation += 1; listener = null; if (timer) clearTimeout(timer); opacity.stopAnimation(); };
  }, [opacity]);
  if (!message) return null;
  const action = message.action;
  return <View pointerEvents="box-none" style={[styles.root, { top: insets.top + 74 }]}><Animated.View pointerEvents={action ? 'auto' : 'none'} style={[styles.pill, { opacity: reduced ? 1 : opacity, transform: [{ translateY: reduced ? 0 : opacity.interpolate({ inputRange: [0, 1], outputRange: [-7, 0] }) }] }]}><View style={styles.seal}><FormIcon name={icons[message.kind]} size={15} color={colors.paper} /></View><Text style={styles.text}>{message.message}</Text>
    {action && <Pressable accessibilityRole="button" accessibilityLabel={action.label} hitSlop={12} onPress={() => { setMessage(null); action.onPress(); }} style={styles.action}><Text style={styles.actionText}>{action.label}</Text></Pressable>}
  </Animated.View></View>;
}
const styles = StyleSheet.create({
  root: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 100, elevation: 100 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.ink2, elevation: 0, backgroundColor: colors.ink, borderRadius: radius.pill, paddingVertical: 10, paddingLeft: 10, paddingRight: 18, maxWidth: '88%' },
  seal: { width: 28, height: 28, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.muted, alignItems: 'center', justifyContent: 'center' },
  action: { marginLeft: 4, paddingLeft: 12, borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: colors.muted, minHeight: 28, justifyContent: 'center' },
  actionText: { fontFamily: family.sansMedium, fontSize: 13, color: colors.paper, textDecorationLine: 'underline' },
  text: { fontFamily: family.sansMedium, fontSize: 13, lineHeight: 19, color: colors.paper, textAlign: 'center', flexShrink: 1 },
});
