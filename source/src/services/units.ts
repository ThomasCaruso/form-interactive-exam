import { getCalendars, getLocales, useCalendars, useLocales } from 'expo-localization';
import type { Units } from '../domain/context';

const read = (locale: { temperatureUnit: string | null } | undefined, calendar: { uses24hourClock: boolean | null } | undefined): Units => ({
  fahrenheit: locale?.temperatureUnit === 'fahrenheit',
  h24: calendar?.uses24hourClock ?? true,
});

/** This phone's temperature unit and clock, now (for notifications and other non-React code). */
export const currentUnits = () => read(getLocales()[0], getCalendars()[0]);

/** This phone's temperature unit and clock; follows a change in the phone's settings. */
export function useUnits(): Units {
  const locale = useLocales()[0], calendar = useCalendars()[0];
  return read(locale, calendar);
}
