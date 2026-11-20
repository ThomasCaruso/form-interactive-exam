import 'react-native-url-polyfill/auto';
import './pkceCrypto';
import { createClient, type Session } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import { AppState, Platform } from 'react-native';
import { create } from 'zustand';
import { AUTH_CALLBACK, callbackCode, callbackFlowId } from '../domain/auth';
import { createSecureStorage } from './secureStorage';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
// EXPO_PUBLIC_SIGN_IN=off builds FORM without sign-in (a device-only demo); it hides the client, nothing on a server.
const signInSwitch = process.env.EXPO_PUBLIC_SIGN_IN !== 'off';
const nativeStorage = createSecureStorage({ getItem: SecureStore.getItemAsync, setItem: (k, v) => SecureStore.setItemAsync(k, v, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }), removeItem: SecureStore.deleteItemAsync });
export const authClient = signInSwitch && url && key ? createClient(url, key, { auth: { storage: Platform.OS === 'web' ? undefined : nativeStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, flowType: 'pkce', experimental: { appendPkceFlowIdToRedirects: true } } }) : null;
export const signInAvailable = !!authClient;
export const useAuth = create<{ session: Session | null; ready: boolean; error: boolean }>(() => ({ session: null, ready: false, error: false }));
export function initializeAuth() {
  const client = authClient;
  if (!client) { useAuth.setState({ ready: true }); return () => {}; }
  let alive = true;
  client.auth.getSession().then(({ data, error }) => { if (alive) useAuth.setState({ session: data.session, ready: true, error: !!error }); }).catch(() => { if (alive) useAuth.setState({ ready: true, error: true }); });
  const { data } = client.auth.onAuthStateChange((_event, session) => { if (alive) useAuth.setState({ session, ready: true, error: false }); });
  if (AppState.currentState === 'active') client.auth.startAutoRefresh();
  const listener = AppState.addEventListener('change', state => { if (state === 'active') client.auth.startAutoRefresh(); else client.auth.stopAutoRefresh(); });
  return () => { alive = false; data.subscription.unsubscribe(); listener.remove(); client.auth.stopAutoRefresh(); };
}
function clientOrThrow() { if (!authClient) throw new Error('Sign-in is not configured'); return authClient; }
const exchanges = new Map<string, Promise<void>>();
export function finishAuthCallback(value: string): Promise<void> {
  const code = callbackCode(value); const flowId = callbackFlowId(value); if (!code || !flowId) return Promise.reject(new Error('Invalid callback'));
  const exchangeKey = `${flowId}:${code}`;
  const existing = exchanges.get(exchangeKey); if (existing) return existing;
  const task = (async () => { const { data, error } = await clientOrThrow().auth.exchangeCodeForSession(code, { flowId }); if (error) throw error; if (!data.session) throw new Error('Invalid session'); useAuth.setState({ session: data.session, ready: true, error: false }); })();
  exchanges.set(exchangeKey, task); if (exchanges.size > 8) exchanges.delete(exchanges.keys().next().value!); return task;
}
let signingIn = false;
export async function signInProvider(provider: 'google' | 'apple') {
  if (signingIn) return false; signingIn = true;
  try {
    const client = clientOrThrow();
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 12000);
    let settings: { external?: Record<string, boolean> };
    try { const response = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key! }, signal: controller.signal }); if (!response.ok) throw new Error('Network unavailable'); settings = await response.json(); } finally { clearTimeout(timeout); } if (!settings.external?.[provider]) throw new Error('Provider is not enabled');
    const { data, error } = await client.auth.signInWithOAuth({ provider, options: { redirectTo: AUTH_CALLBACK, skipBrowserRedirect: true } });
    if (error) throw error; if (!data.url) throw new Error('Invalid authorization');
    const result = await WebBrowser.openAuthSessionAsync(data.url, AUTH_CALLBACK);
    if (result.type !== 'success') return false;
    await finishAuthCallback(result.url); return true;
  } finally { signingIn = false; }
}
export async function sendEmailLink(email: string) {
  if (signingIn) throw new Error('Sign-in already in progress'); signingIn = true;
  try { const { error } = await clientOrThrow().auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: AUTH_CALLBACK } }); if (error) throw error; } finally { signingIn = false; }
}
