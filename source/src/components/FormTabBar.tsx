import { BottomTabBarHeightCallbackContext, type BottomTabBarProps } from 'expo-router/build/react-navigation/bottom-tabs';
import { useContext } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, layout } from '../theme/tokens';
import { family } from '../theme/typography';
import { FormIcon, type FormIconName } from './FormIcon';
import { MotionPressable } from './MotionPressable';
import { tactile } from '../utils/haptics';
import { useDesktop } from '../web/desktop';
import { HeaderAction, SiteHeader, startOver } from '../web/SiteHeader';
import { useFormStore } from '../state/store';
const icons: Record<string, FormIconName> = { home: 'home', edits: 'edits', tryon: 'tryon', saved: 'saved', profile: 'user' };
/** Atelier navigation: a flat paper bar under a hairline; the selected tab is ink with a short rule. */
export function FormTabBar({ state, navigation, descriptors, insets }: BottomTabBarProps) {
  const onHeightChange = useContext(BottomTabBarHeightCallbackContext);
  const desktop = useDesktop();
  const savedCount = useFormStore(s => s.saved.length + s.savedPieces.length);
  if (desktop) return <SiteHeader right={<HeaderAction label="Start over" onPress={() => { void startOver(); }} />} links={state.routes.map((route, index) => {
    const focused = index === state.index;
    const label = descriptors[route.key]?.options?.title ?? route.name;
    return { key: route.key, label, active: focused, count: route.name === 'saved' ? savedCount : undefined, onPress: () => {
      const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
      if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
    } };
  })} />;
  return <View onLayout={event => onHeightChange?.(event.nativeEvent.layout.height)} style={{ backgroundColor: colors.paper, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line2, paddingBottom: insets.bottom + 4, paddingHorizontal: Math.max(insets.left, insets.right) + 8 }}><View style={styles.container}>
    {state.routes.map((route, index) => {
      const focused = index === state.index;
      const options = descriptors[route.key]?.options;
      const label = options?.title ?? route.name;
      return <MotionPressable key={route.key} glass={false} haptic={false} onPress={() => {
        const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
        if (!focused && !event.defaultPrevented) { tactile('selection'); navigation.navigate(route.name); }
      }} onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })} style={[styles.tab, focused && styles.activeTab]} accessibilityRole="tab" accessibilityState={{ selected: focused }} accessibilityLabel={`${label}, tab ${index + 1} of 5`}>
        {focused && <View style={styles.rule} />}
        <FormIcon name={icons[route.name] ?? 'home'} size={22} color={focused ? colors.ink : colors.muted} filled={focused} />
        <Text style={[styles.label, focused && styles.selectedLabel]}>{label}</Text>
      </MotionPressable>;
    })}
  </View></View>;
}
const styles = StyleSheet.create({
  container: { flexDirection: 'row' },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 5, minHeight: layout.tabHeight, paddingVertical: 8, borderRadius: 0 },
  activeTab: {},
  rule: { position: 'absolute', top: 0, width: 18, height: 1.5, backgroundColor: colors.ink },
  label: { fontFamily: family.sans, fontSize: 10.5, lineHeight: 14, letterSpacing: 0.3, color: colors.muted, textAlign: 'center' },
  selectedLabel: { fontFamily: family.sansMedium, color: colors.ink },
});
