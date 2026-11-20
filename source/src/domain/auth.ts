export const AUTH_CALLBACK = 'form://auth/callback';
export function callbackCode(value: string): string | null {
  try { const u = new URL(value); return u.protocol === 'form:' && u.hostname === 'auth' && u.pathname === '/callback' && !u.username && !u.password && !u.port && !u.hash && !u.searchParams.has('error') && u.searchParams.getAll('code').length === 1 ? u.searchParams.get('code') || null : null; } catch { return null; }
}
export function callbackFlowId(value: string): string | null {
  try { const u = new URL(value); const values = u.searchParams.getAll('sb_flow_id'); return callbackCode(value) && values.length === 1 && /^[a-zA-Z0-9_-]{8,64}$/.test(values[0]) ? values[0] : null; } catch { return null; }
}
export function validEmail(value: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()); }
export function authMessage(error: unknown): string {
  const text = error && typeof error === 'object' && 'message' in error ? String(error.message).toLowerCase() : '';
  if (text.includes('provider') && (text.includes('enabled') || text.includes('unsupported'))) return 'This sign-in option is still being connected. Try email for now.';
  if (text.includes('email') && text.includes('not authorized')) return 'Email sign-in is still being connected for this address. Please try again once email delivery is ready.';
  if (text.includes('rate') || text.includes('too many')) return 'A few too many attempts. Give it a moment and try again.';
  if (text.includes('expired') || text.includes('invalid') || text.includes('verifier')) return 'That sign-in link has expired or belongs to another device. Request a fresh link here.';
  if (text.includes('fetch') || text.includes('network')) return 'Could not reach sign-in. Check your connection and try again.';
  return 'Sign-in could not finish. Please try again.';
}
