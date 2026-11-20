import { GlassSurface } from '../src/components/GlassSurface';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Keyboard, StyleSheet, Text, TextInput, View } from 'react-native';
import { EditorialScreen, editorial } from '../src/components/Editorial';
import { FormIcon } from '../src/components/FormIcon';
import { RaisedButton } from '../src/components/RaisedButton';
import { ProviderMark } from '../src/components/ProviderMark';
import { MotionPressable } from '../src/components/MotionPressable';
import { showToast } from '../src/components/Toast';
import { signInProvider, sendEmailLink, useAuth, authClient } from '../src/auth/client';
import { authMessage, validEmail } from '../src/domain/auth';
import { colors } from '../src/theme/tokens';
import { family } from '../src/theme/typography';
import { useFormStore } from '../src/state/store';
export default function Login() {
  const router = useRouter(); const complete = useFormStore(s => s.onboardingComplete || s.saved.length + s.savedPieces.length + s.sessions.length + s.closet.length > 0);
  const session = useAuth(s => s.session), ready = useAuth(s => s.ready);
  const [emailOpen, setEmailOpen] = useState(false), [email, setEmail] = useState(''), [sent, setSent] = useState(false), [busy, setBusy] = useState<string | null>(null), [issue, setIssue] = useState('');
  const locked = useRef(false);
  const destination = () => router.replace(complete ? '/home' : '/onboarding');
  async function run(kind: string, task: () => Promise<void>) {
    if (locked.current) return; locked.current = true; setBusy(kind); setIssue(''); Keyboard.dismiss();
    try { await task(); } catch (error) { setIssue(authMessage(error)); showToast('Sign-in needs another try', 'warning'); } finally { locked.current = false; setBusy(null); }
  }
  function provider(kind: 'apple' | 'google') { void run(kind, async () => { if (await signInProvider(kind)) { showToast('You’re signed in'); destination(); } }); }
  function emailLink() {
    if (!validEmail(email)) { setIssue('Enter a valid email address.'); return; }
    void run('email', async () => { await sendEmailLink(email); setSent(true); showToast('Check your inbox'); });
  }
  return <EditorialScreen>
    <View style={styles.header}><Text style={styles.wordmark}>FORM</Text><MotionPressable accessibilityRole="button" accessibilityLabel="Back" disabled={!!busy} onPress={() => router.canGoBack() ? router.back() : router.replace('/welcome')} style={styles.headerBack}><FormIcon name="back" size={20} /></MotionPressable></View>
    <View style={[styles.hero, emailOpen && styles.emailHero]}><Text accessibilityRole="header" style={[styles.headline, emailOpen && styles.emailHeadline]}>{session ? 'Your FORM.\nReady.' : emailOpen ? 'Make it yours.' : 'Your style.\nNext.'}</Text>{!emailOpen && <Text style={styles.intro}>{session ? 'Your wardrobe is ready to explore.' : emailOpen ? 'One link. You’re in.' : 'Discover pieces. Build looks.'}</Text>}</View>
    <View style={styles.actions}>
    {session ? <View style={styles.providers}><Text style={editorial.body}>Signed in{session.user.email ? ` as ${session.user.email}` : ''}.</Text><RaisedButton label="Continue to my FORM" onPress={destination} /><MotionPressable accessibilityRole="button" disabled={!!busy} onPress={() => { void run('logout', async () => { const { error } = await authClient!.auth.signOut({ scope: 'local' }); if (error) throw error; showToast('Signed out', 'info'); }); }} style={styles.back}><Text style={editorial.secondary}>Sign out of this device</Text></MotionPressable></View> : <>
      {!emailOpen && <View style={styles.providers}>
        <RaisedButton label={busy === 'apple' ? 'Connecting to Apple' : 'Continue with Apple'} icon={<ProviderMark provider="apple" />} showArrow={false} busy={busy === 'apple'} disabled={!!busy || !ready} onPress={() => provider('apple')} />
        <RaisedButton label={busy === 'google' ? 'Connecting to Google' : 'Continue with Google'} icon={<ProviderMark provider="google" />} light showArrow={false} busy={busy === 'google'} disabled={!!busy || !ready} onPress={() => provider('google')} />
        <View style={styles.divider}><View style={styles.line} /><Text style={styles.or}>or</Text><View style={styles.line} /></View>
        <RaisedButton label="Continue with email" icon={<ProviderMark provider="email" />} light showArrow={false} disabled={!!busy || !ready} onPress={() => { setEmailOpen(v => !v); setIssue(''); }} />
      </View>}
      {emailOpen && <GlassSurface style={styles.emailCard}><Text style={editorial.title}>{sent ? 'Check your inbox.' : 'Your email.'}</Text><Text style={editorial.secondary}>{sent ? 'Your sign-in link is on its way. Open it on this device to continue.' : 'We’ll send a secure sign-in link. No password to remember.'}</Text>
        <TextInput accessibilityLabel="Email address" autoComplete="email" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} editable={!busy} autoFocus value={email} onChangeText={value => { setEmail(value); setSent(false); setIssue(''); }} placeholder="you@example.com" placeholderTextColor={colors.muted} style={styles.input} returnKeyType="send" onSubmitEditing={emailLink} />
        <RaisedButton label={sent ? 'Send another link' : 'Email me a sign-in link'} busy={busy === 'email'} disabled={!!busy} onPress={emailLink} />
      <MotionPressable accessibilityRole="button" disabled={!!busy} onPress={() => { Keyboard.dismiss(); setEmailOpen(false); setIssue(''); }} style={styles.back}><Text style={editorial.secondary}>Other sign-in options</Text></MotionPressable></GlassSurface>}
    </>}
    {!!issue && <Text accessibilityRole="alert" style={styles.issue}>{issue}</Text>}
    <Text style={styles.note}>Your wardrobe stays on this device.</Text>
    {!session && <MotionPressable accessibilityRole="button" disabled={!!busy} onPress={destination} style={styles.back}><Text style={editorial.secondary}>{complete ? 'Back to my wardrobe' : 'Explore on this device'}</Text></MotionPressable>}
    </View>
  </EditorialScreen>;
}
const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  wordmark: { fontFamily: family.sansMedium, fontSize: 18, letterSpacing: 6, color: colors.ink },
  headerBack: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  hero: { flex: 1, minHeight: 280, justifyContent: 'center', paddingVertical: 36 },
  headline: { fontFamily: family.serif, fontSize: 70, lineHeight: 72, letterSpacing: -1.8, color: colors.ink },
  intro: { fontFamily: family.sans, fontSize: 14, lineHeight: 22, color: colors.muted, marginTop: 22 },
  emailHero: { flex: 0, minHeight: 0, paddingTop: 16, paddingBottom: 4 },
  emailHeadline: { fontSize: 38, lineHeight: 42, letterSpacing: -0.7 },
  actions: { paddingTop: 12 },
  providers: { gap: 12, marginBottom: 18 }, divider: { flexDirection: 'row', alignItems: 'center', gap: 14, marginVertical: 5 }, line: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.line2 }, or: { fontFamily: family.sans, fontSize: 11, color: colors.muted }, emailCard: { backgroundColor: colors.paper2, borderRadius: 4, padding: 18, gap: 12, marginTop: 24, marginBottom: 18 }, input: { backgroundColor: colors.card, borderColor: colors.line2, borderWidth: StyleSheet.hairlineWidth, borderRadius: 4, paddingHorizontal: 16, minHeight: 54, fontFamily: family.sans, fontSize: 16, color: colors.ink }, issue: { fontFamily: family.sansMedium, color: colors.ink, fontSize: 13, lineHeight: 20, marginBottom: 18 }, note: { fontFamily: family.sans, fontSize: 11, lineHeight: 18, color: colors.muted, marginTop: 8, textAlign: 'center' }, back: { minHeight: 52, alignItems: 'center', justifyContent: 'center' } });
