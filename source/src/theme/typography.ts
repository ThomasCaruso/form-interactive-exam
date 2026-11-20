import type { TextStyle } from 'react-native';
import { colors } from './tokens';

export const family = {
  serif: 'InstrumentSerif_400Regular',
  serifItalic: 'InstrumentSerif_400Regular_Italic',
  sans: 'DMSans_400Regular',
  sansMedium: 'DMSans_500Medium',
  sansSemiBold: 'DMSans_600SemiBold',
  sansBold: 'DMSans_700Bold',
} as const;

export const type = {
  display: { fontFamily: family.serif, fontSize: 46, lineHeight: 48, letterSpacing: -0.6, color: colors.ink },
  title: { fontFamily: family.serif, fontSize: 38, lineHeight: 40, letterSpacing: -0.4, color: colors.ink },
  editorial: { fontFamily: family.serif, fontSize: 30, lineHeight: 33, letterSpacing: -0.2, color: colors.ink },
  body: { fontFamily: family.sans, fontSize: 15, lineHeight: 23, color: colors.ink2 },
  caption: { fontFamily: family.sans, fontSize: 13, lineHeight: 20, color: colors.muted },
} satisfies Record<string, TextStyle>;

export const eyebrow: TextStyle = {
  fontFamily: family.sansMedium,
  fontSize: 10.5,
  lineHeight: 15,
  letterSpacing: 1.9,
  textTransform: 'uppercase',
  color: colors.muted,
};
export const micro: TextStyle = { ...eyebrow, fontSize: 9.5, letterSpacing: 1.5 };
/** The FORM wordmark: wide-tracked sans, never over a face. */
export const wordmark: TextStyle = { fontFamily: family.sansMedium, fontSize: 13, letterSpacing: 5.5, color: colors.ink };
/** Italic serif emphasis inside a serif headline. */
export const emphasis: TextStyle = { fontFamily: family.serifItalic };
