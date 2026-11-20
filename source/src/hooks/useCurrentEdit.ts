import { useMemo } from 'react';
import { buildFixtureSession } from '../domain/stylingEngine';
import { useFormStore } from '../state/store';
export function useCurrentEdit() {
  const sessions = useFormStore(s => s.sessions);
  const activeSessionId = useFormStore(s => s.activeSessionId);
  const profile = useFormStore(s => s.profile);
  const selectedLookId = useFormStore(s => s.selectedLook?.id);
  const session = sessions.find(s => s.id === activeSessionId);
  const looks = useMemo(() => session ? session.looks : buildFixtureSession({ occasion: 'Curated for you', dressCode: 'Smart casual', budgetCents: profile.budgetCents }, profile, 'curated', 0).looks, [session, profile]);
  const look = looks.find(l => l.id === selectedLookId) ?? looks[0];
  return { session, looks, look, occasion: session?.occasion ?? 'Curated for you' };
}
