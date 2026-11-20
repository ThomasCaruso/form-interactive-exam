import { Tabs } from 'expo-router';
import { FormTabBar } from '../../src/components/FormTabBar';
import { useDayContext } from '../../src/hooks/useDayContext';
import { DesktopColumn, useDesktop } from '../../src/web/desktop';
/** How wide each section runs on a desktop browser. For You lays itself out. */
const columns: Record<string, number> = { home: 1680, edits: 1180, tryon: 760, saved: 1280, profile: 760 };
export default function TabsLayout() {
  useDayContext();
  const desktop = useDesktop();
  // Render an element: SDK 57 calls the tabBar function outside React rendering.
  return <Tabs tabBar={props => <FormTabBar {...props} />} screenOptions={{ headerShown: false, tabBarPosition: desktop ? 'top' : 'bottom' }}
    screenLayout={({ route, children }) => <DesktopColumn max={columns[route.name] ?? 1180}>{children}</DesktopColumn>}>
    <Tabs.Screen name="home" options={{ title: 'For You' }} />
    <Tabs.Screen name="edits" options={{ title: 'Edits' }} />
    <Tabs.Screen name="tryon" options={{ title: 'Try On' }} />
    <Tabs.Screen name="saved" options={{ title: 'Saved' }} />
    <Tabs.Screen name="profile" options={{ title: 'You' }} />
  </Tabs>;
}
