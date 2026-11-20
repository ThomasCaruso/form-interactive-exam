import { Easing } from 'react-native-reanimated';

/** FORM Atelier: clothing supplies the color; paper, plate and ink do the rest. Hairlines, never shadows. */
export const colors = {
  paper: '#F3F0EA', paper2: '#E9E4DB', plate: '#E9E4DB', card: '#F8F6F1',
  ink: '#161512', ink2: '#3B3A35', muted: '#6B675E', faint: '#A7A298',
  line: '#DDD7CC', line2: '#CFC8BB', accent: '#161512', onAccent: '#F3F0EA',
  skin: '#d9b28f', hair: '#2e2b26', scrim: 'rgba(22,21,18,0.46)',
  glass: '#F3F0EA', positive: '#50624B',
} as const;
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, section: 40 } as const;
export const layout = { gutter: 24, touch: 48, button: 54, icon: 22, tabHeight: 64, maxContent: 560 } as const;
export const radius = { image: 2, sm: 4, md: 6, lg: 8, sheet: 22, pill: 999 } as const;
export const motion = { press: 100, enter: 220, exit: 160, page: 260 } as const;
export const image = { productAspect: 4 / 5, shoeAspect: 1, transition: 180 } as const;
export const groundShadow = 'transparent' as const;
export const easing = { standard: Easing.out(Easing.cubic) } as const;
