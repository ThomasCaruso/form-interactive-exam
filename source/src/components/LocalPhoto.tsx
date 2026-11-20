import { useState } from 'react';
import { Image, StyleSheet, Text, View, type ImageProps } from 'react-native';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { colors, image } from '../theme/tokens';
import { family } from '../theme/typography';
import { FormIcon } from './FormIcon';
/** Uploaded imagery retains its source identity even if a device file becomes unavailable. */
export function LocalPhoto({ uri, label, onLoad, fit = 'contain' }: { uri?: string; label: string; onLoad?: ImageProps['onLoad']; fit?: 'contain' | 'cover' }) {
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const reduced = useReduceMotion();
  if (!uri || failedUri === uri) return <View accessibilityLabel={label + ', photo unavailable'} style={styles.fallback}><FormIcon name="edits" color={colors.muted} /><Text style={styles.message}>Photo unavailable</Text></View>;
  return <Image source={{ uri }} resizeMode={fit} style={styles.image} fadeDuration={reduced ? 0 : image.transition} onLoad={onLoad} onError={() => setFailedUri(uri)} accessibilityLabel={label} />;
}
const styles = StyleSheet.create({ image: { width: '100%', height: '100%' }, fallback: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 10, backgroundColor: colors.paper2 }, message: { fontFamily: family.sans, fontSize: 12, lineHeight: 18, color: colors.muted, textAlign: 'center' } });
