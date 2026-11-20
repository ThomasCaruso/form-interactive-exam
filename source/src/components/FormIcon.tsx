import Svg, { Circle, Path } from 'react-native-svg';
import { colors } from '../theme/tokens';
export type FormIconName = 'home' | 'edits' | 'tryon' | 'saved' | 'user' | 'arrow' | 'back' | 'close' | 'heart' | 'more' | 'chevron' | 'check' | 'rewind' | 'calendar' | 'sun' | 'cloud' | 'rain' | 'snow';
const paths: Partial<Record<FormIconName, string>> = {
  home: 'M3 10.5 12 3l9 7.5M5 9v11h5v-6h4v6h5V9',
  edits: 'M8 4 5 7v4l3 2-3 7h14l-3-7 3-2V7l-3-3M9 3c0 4 6 4 6 0M7 17l10-8',
  tryon: 'M10 3h4v4l3 3 3 9c-4 3-12 3-16 0l3-9 3-3V3Z',
  saved: 'M4 4c3-1 5-1 8 1 3-2 5-2 8-1v16c-3-1-5-1-8 1-3-2-5-2-8-1V4ZM12 5v16',
  user: 'M5 21v-2a7 7 0 0 1 14 0v2H5Z',
  arrow: 'M4 12h16M14 6l6 6-6 6',
  rewind: 'M3 10h5M3 10V5m0 5a9 9 0 1 1 1 8',
  back: 'M20 12H4m6-6-6 6 6 6',
  close: 'm5 5 14 14M19 5 5 19',
  heart: 'M12 21 3.7 13C-2 7.2 6 1 12 7c6-6 14 .2 8.3 6L12 21Z',
  chevron: 'm9 5 7 7-7 7',
  check: 'm5 12 4 4L19 6',
  calendar: 'M4 6h16v14H4zM4 10.5h16M8.5 3.5v4M15.5 3.5v4',
  sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4',
  cloud: 'M7 18h10a4 4 0 0 0 .5-7.97A5.5 5.5 0 0 0 7 9.5 4.25 4.25 0 0 0 7 18Z',
  rain: 'M7 14h10a3.5 3.5 0 0 0 .4-6.97A5 5 0 0 0 7.5 6.5 3.75 3.75 0 0 0 7 14ZM9 17l-1 3M13 17l-1 3M17 17l-1 3',
  snow: 'M7 14h10a3.5 3.5 0 0 0 .4-6.97A5 5 0 0 0 7.5 6.5 3.75 3.75 0 0 0 7 14ZM9 18h.01M12 20h.01M15 18h.01',
};
export function FormIcon({ name, size = 22, color = colors.ink, filled = false }: { name: FormIconName; size?: number; color?: string; filled?: boolean }) {
  return <Svg style={{ position: 'relative', zIndex: 1 }} width={size} height={size} viewBox="0 0 24 24" fill="none">
    {name === 'more' ? [5, 12, 19].map(x => <Circle key={x} cx={x} cy={12} r={1.3} fill={color} />) : <>
      {name === 'user' && <Circle cx={12} cy={7} r={3.6} stroke={color} strokeWidth={1.35} fill={filled ? color : 'none'} />}
      <Path d={paths[name]} stroke={color} strokeWidth={1.35} strokeLinecap="round" strokeLinejoin="round" fill={filled && ['home', 'user', 'heart', 'tryon', 'saved'].includes(name) ? color : 'none'} />
    </>}
  </Svg>;
}
