import { createContext, useContext, type ReactNode } from 'react';
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import { colors } from '../theme/tokens';

/** At this width and up, the web build lays out as a website: a top bar, centred columns, wider grids. */
export const DESKTOP_MIN = 960;
export const HEADER_HEIGHT = 68;

export function useDesktop() {
  const { width } = useWindowDimensions();
  return Platform.OS === 'web' && width >= DESKTOP_MIN;
}

const ColumnWidth = createContext<number | null>(null);

/** The window as a screen should lay itself out: on the web, the column it sits in rather than the whole browser. */
export function useScreenSize() {
  const window = useWindowDimensions();
  const column = useContext(ColumnWidth);
  return { ...window, width: column ?? window.width };
}

/** A centred column on desktop; on a phone it adds nothing. */
export function DesktopColumn({ max, children, framed = false }: { max: number; children: ReactNode; framed?: boolean }) {
  const desktop = useDesktop();
  const { width } = useWindowDimensions();
  if (!desktop) return <>{children}</>;
  const column = Math.min(width, max);
  return <View style={[styles.outer, framed && styles.framedOuter]}>
    <View style={[styles.column, { width: column }, framed && styles.framed]}>
      <ColumnWidth.Provider value={column}>{children}</ColumnWidth.Provider>
    </View>
  </View>;
}

/** Tells what's inside how wide it is: the deck uses this for its swipe distances. */
export function ColumnProvider({ width, children }: { width: number; children: ReactNode }) {
  return <ColumnWidth.Provider value={width}>{children}</ColumnWidth.Provider>;
}

const styles = StyleSheet.create({
  outer: { flex: 1, alignItems: 'center', backgroundColor: colors.paper },
  framedOuter: { backgroundColor: colors.paper2 },
  column: { flex: 1 },
  framed: { backgroundColor: colors.paper, borderLeftWidth: StyleSheet.hairlineWidth, borderRightWidth: StyleSheet.hairlineWidth, borderColor: colors.line2 },
});
