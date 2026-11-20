import { useDesktop, useScreenSize } from '../src/web/desktop';
import { DesktopWelcome } from '../src/web/DesktopWelcome';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CoverLoop, CoverProgress, useCoverLoop } from '../src/components/CoverLoop';
import { MotionPressable } from '../src/components/MotionPressable';
import { signInAvailable } from '../src/auth/client';
import { RaisedButton } from '../src/components/RaisedButton';
import { useReduceMotion } from '../src/hooks/useReduceMotion';
import { useFormStore } from '../src/state/store';
import { colors, layout } from '../src/theme/tokens';
import { family } from '../src/theme/typography';

/** The cover. The loop explains the app; the wordmark sits below the photograph, never over a face. */
export default function Welcome() {
  const router = useRouter(), insets = useSafeAreaInsets(), window = useScreenSize();
  const reduced = useReduceMotion(), t = useCoverLoop(reduced);
  const returning = useFormStore(s => s.onboardingComplete || s.saved.length + s.savedPieces.length + s.sessions.length + s.closet.length > 0);
  const width = Math.min(window.width, layout.maxContent);
  // The photograph takes whatever the footer leaves, below a quiet margin under the status bar.
  const [stage, setStage] = useState(0);
  const desktop = useDesktop();
  if (desktop) return <DesktopWelcome returning={returning} onStart={() => router.push('/start')} onReturn={() => router.replace('/home')} />;
  return <View style={[styles.root, { paddingTop: insets.top + 12 }]}>
    <View style={{ width, alignSelf: 'center', flex: 1 }}>
      <View style={{ flex: 1 }} onLayout={event => setStage(Math.round(event.nativeEvent.layout.height))}>
        {stage > 0 && <CoverLoop t={t} width={width} height={stage} />}
      </View>
      <View style={[styles.footer, { paddingBottom: insets.bottom + 18 }]}>
        <CoverProgress t={t} reduced={reduced} />
        <View style={styles.brand}>
          <Text accessibilityRole="header" style={styles.wordmark}>FORM</Text>
          <Text style={styles.tagline}>Your personal stylist</Text>
        </View>
        <RaisedButton label="Get started" onPress={() => router.push('/start')} />
        {(returning || signInAvailable) && <MotionPressable glass={false} accessibilityRole="button" onPress={() => returning ? router.replace('/home') : router.push('/login')} style={styles.secondary}>
          <Text style={styles.link}>{returning ? 'Back to my wardrobe' : 'Sign in'}</Text>
        </MotionPressable>}
      </View>
    </View>
  </View>;
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  footer: { paddingHorizontal: layout.gutter, paddingTop: 16 },
  brand: { alignItems: 'center', marginTop: 26, marginBottom: 22 },
  wordmark: { fontFamily: family.sansMedium, fontSize: 40, lineHeight: 44, letterSpacing: 16.8, paddingLeft: 16.8, color: colors.ink },
  tagline: { fontFamily: family.serifItalic, fontSize: 17, lineHeight: 22, color: colors.ink2, marginTop: 4 },
  secondary: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  link: { fontFamily: family.sansMedium, fontSize: 13.5, color: colors.ink },
});
