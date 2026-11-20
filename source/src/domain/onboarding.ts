import type { Profile } from './types';
export function createOnboardingProfile(existing?: Profile): Profile {
  const profile: Profile = existing ?? { name: '', height: '', topSize: '', waist: '', inseam: '', shoe: '', budgetCents: 30000, styles: [], priority: 'Best overall look', brands: [], favoriteColors: [], avoidedColors: [], avoidedBrands: [] };
  return { ...profile, styles: [...profile.styles], brands: [...profile.brands], favoriteColors: [...(profile.favoriteColors ?? [])], avoidedColors: [...(profile.avoidedColors ?? [])], avoidedBrands: [...(profile.avoidedBrands ?? [])] };
}
export function togglePreference(values: string[], value: string): string[] { return values.includes(value) ? values.filter(item => item !== value) : [...values, value]; }
export function onboardingStep(value: number): number { return Number.isFinite(value) ? Math.max(0, Math.min(7, Math.floor(value))) : 0; }
export function onboardingEntry(complete: boolean, hasWardrobe = false): '/home' | '/welcome' { return complete || hasWardrobe ? '/home' : '/welcome'; }

export function fitIssue(key: 'waist' | 'inseam' | 'shoe', value: string): string | null {
  if (!value.trim()) return null;
  const number = Number(value);
  const max = key === 'waist' ? 80 : key === 'inseam' ? 50 : 25;
  return /^\d+(\.\d+)?$/.test(value) && Number.isFinite(number) && number > 0 && number <= max ? null : 'Add a valid ' + key + ' size, or leave it for later.';
}
