import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { EditorialScreen, editorial } from '../../src/components/Editorial';
import { RaisedButton } from '../../src/components/RaisedButton';
import { finishAuthCallback } from '../../src/auth/client';
import { AUTH_CALLBACK, authMessage } from '../../src/domain/auth';
import { useFormStore } from '../../src/state/store';
import { colors } from '../../src/theme/tokens';
export default function AuthCallback() {
  const { code, error, sb_flow_id: flowId } = useLocalSearchParams<{ code?: string | string[]; error?: string; sb_flow_id?: string | string[] }>(); const router = useRouter(); const [failure, setIssue] = useState('');
  const issue = typeof code !== 'string' || typeof flowId !== 'string' || error ? 'Sign-in was not completed. You can try again.' : failure;
  useEffect(() => {
    let alive = true;
    if (typeof code !== 'string' || typeof flowId !== 'string' || error) return;
    finishAuthCallback(`${AUTH_CALLBACK}?code=${encodeURIComponent(code)}&sb_flow_id=${encodeURIComponent(flowId)}`).then(() => {
      if (!alive) return; const s = useFormStore.getState(); const existing = s.onboardingComplete || s.saved.length + s.savedPieces.length + s.sessions.length + s.closet.length > 0;
      router.replace(existing ? '/home' : '/onboarding');
    }).catch(e => { if (alive) setIssue(authMessage(e)); });
    return () => { alive = false; };
  }, [code, error, flowId, router]);
  return <EditorialScreen><View style={{ flex: 1, justifyContent: 'center', gap: 24 }}><Text style={editorial.heading}>{issue ? 'Let’s try that again.' : 'Making yourself at home.'}</Text>{issue ? <><Text accessibilityRole="alert" style={editorial.body}>{issue}</Text><RaisedButton label="Back to sign-in" onPress={() => router.replace('/login')} /></> : <ActivityIndicator color={colors.ink} />}</View></EditorialScreen>;
}
