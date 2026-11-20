import type { Profile, PersonPhotoRole } from './types';
export type MeasurementKey = 'heightCm' | 'weightKg' | 'waistCm' | 'inseamCm';
export type MeasurementUnits = 'metric' | 'imperial';
export const FITTING_LAST_STEP = 10;
export function fittingStep(value: number): number { return Number.isFinite(value) ? Math.max(0, Math.min(FITTING_LAST_STEP, Math.floor(value))) : 0; }
export function photoRole(value: unknown): PersonPhotoRole | null { return referenceRoles.includes(value as PersonPhotoRole) ? value as PersonPhotoRole : null; }
export function measurementIssue(key: MeasurementKey, value: string): string | null {
  if (!value.trim()) return null;
  const number = Number(value), max = key === 'heightCm' ? 280 : key === 'weightKg' ? 500 : key === 'waistCm' ? 250 : 150;
  return /^\d+(\.\d+)?$/.test(value) && Number.isFinite(number) && number > 0 && number <= max ? null : 'Check this measurement, or add it later.';
}
export function toMetric(key: MeasurementKey, value: string, units: MeasurementUnits): number | undefined {
  if (!value.trim()) return undefined;
  const number = Number(value);
  if (!Number.isFinite(number)) return undefined;
  return units === 'metric' ? number : key === 'weightKg' ? number * 0.45359237 : Math.round(number * 2.54 * 100000) / 100000;
}
export function displayMeasurement(key: MeasurementKey, value: number | undefined, units: MeasurementUnits): string {
  if (value === undefined) return '';
  const converted = units === 'metric' ? value : key === 'weightKg' ? value / 0.45359237 : value / 2.54;
  return String(Math.round(converted * 100) / 100);
}
export function legacyHeightCm(value: string): number | undefined {
  if (typeof value !== 'string') return undefined;
  const feet = value.match(/^(\d+)[′']\s*(\d+)[″"]?$/);
  if (feet) return Math.round((Number(feet[1]) * 12 + Number(feet[2])) * 2.54 * 100) / 100;
  const cm = value.match(/^(\d+(?:\.\d+)?)\s*cm$/i);
  return cm ? Number(cm[1]) : undefined;
}
export function fittingFromProfile(profile: Profile): NonNullable<Profile['fitting']> {
  return { units: 'imperial', heightCm: legacyHeightCm(profile.height), waistCm: profile.waist && !isNaN(Number(profile.waist)) ? Number(profile.waist) * 2.54 : undefined, inseamCm: profile.inseam && !isNaN(Number(profile.inseam)) ? Number(profile.inseam) * 2.54 : undefined, ...profile.fitting };
}
export function fittingProfileIssue(profile: Profile): string | null {
  for (const key of ['heightCm', 'weightKg', 'waistCm', 'inseamCm'] as const) { const value = profile.fitting?.[key]; if (value !== undefined && measurementIssue(key, String(value))) return 'Check your measurements before continuing.'; }
  return null;
}

/** Outside editors update only changed fields in a paused appointment; newest explicit edit wins. */
export function reconcileFittingDraft(draft: Profile, previous: Profile, next: Profile): Profile {
  const result = { ...draft };
  for (const key of new Set([...Object.keys(previous), ...Object.keys(next)])) {
    const field = key as keyof Profile;
    if (JSON.stringify(previous[field]) === JSON.stringify(next[field])) continue;
    if (field === 'fitting' && next.fitting) {
      const baseline = previous.fitting ?? fittingFromProfile(previous);
      const fit = { ...draft.fitting, units: draft.fitting?.units ?? next.fitting.units };
      for (const fitKey of new Set([...Object.keys(baseline), ...Object.keys(next.fitting)])) {
        const name = fitKey as keyof NonNullable<Profile['fitting']>;
        if (baseline[name] !== next.fitting[name]) Object.assign(fit, { [name]: next.fitting[name] });
      }
      result.fitting = fit;
    } else Object.assign(result, { [field]: next[field] });
  }
  return result;
}

export const referenceRoles: PersonPhotoRole[] = ['body', 'portrait', 'face-left', 'face-right', 'head'];
export const referenceGuidance: Record<PersonPhotoRole, { label: string; title: string; copy: string; hint: string; timer: boolean }> = {
 body: { label: 'Full body', title: 'Your silhouette.', copy: 'Wear everyday fitted clothing. Keep your whole body in view, arms slightly away from your sides.', hint: 'Head to toe, comfortably in frame', timer: true },
 portrait: { label: 'Face · front', title: 'Face the light.', copy: 'Look straight ahead. Keep your face clear, with a relaxed expression and no filters.', hint: 'A clear, front-facing portrait', timer: false },
 'face-left': { label: 'Left angle', title: 'A little to your left.', copy: 'Turn your head gently toward your left shoulder, about halfway to a side profile. Keep both eyes visible and your phone in front of you.', hint: 'Your face, from the left', timer: false },
 'face-right': { label: 'Right angle', title: 'Now, to your right.', copy: 'Turn your head gently toward your right shoulder, about halfway to a side profile. Keep both eyes visible and your phone in front of you.', hint: 'Your face, from the right', timer: false },
 head: { label: 'Head & hair', title: 'The whole picture.', copy: 'Step back a little. Include the top of your head, your hair and shoulders, with nothing cropped out.', hint: 'Your head, hair and shoulders', timer: false },
};
/** First-run capture asks only for these; the angle shots are optional extras in Your photos. */
export const requiredReferenceRoles: PersonPhotoRole[] = ['body', 'portrait'];
export function nextRequiredRole(photos: readonly { role: PersonPhotoRole }[]): PersonPhotoRole | null {
  return requiredReferenceRoles.find(role => !photos.some(photo => photo.role === role)) ?? null;
}
export function nextReferenceRole(photos: readonly { role: PersonPhotoRole }[]): PersonPhotoRole | null {
 return referenceRoles.find(role => !photos.some(photo => photo.role === role)) ?? null;
}
