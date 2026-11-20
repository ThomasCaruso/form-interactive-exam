import { Redirect } from 'expo-router';
import { onboardingEntry } from '../src/domain/onboarding';
import { useFormStore } from '../src/state/store';
export default function Index() {
  const complete = useFormStore(s => s.onboardingComplete);
  const existing = useFormStore(s => s.saved.length + s.savedPieces.length + s.sessions.length + s.closet.length > 0);
  return <Redirect href={onboardingEntry(complete, existing)} />;
}
