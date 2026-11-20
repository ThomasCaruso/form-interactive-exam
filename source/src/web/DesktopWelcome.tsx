import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { colors } from '../theme/tokens';
import { HEADER_HEIGHT } from './desktop';
import { HeaderAction, SiteHeader } from './SiteHeader';
import { StyleLab } from './StyleLab';

type Props = { returning: boolean; onStart: () => void; onReturn: () => void };

/** The cover as a website: no sections to scroll, one live scene that styles the visitor while they play. */
export function DesktopWelcome({ returning, onStart, onReturn }: Props) {
  const { width, height } = useWindowDimensions();
  return <View style={styles.root}>
    <SiteHeader right={<>{returning && <HeaderAction label="Back to my wardrobe" onPress={onReturn} />}<HeaderAction dark label="Get started" onPress={onStart} /></>} />
    <StyleLab width={width} height={Math.max(640, height - HEADER_HEIGHT)} onStart={onStart} />
  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper, overflow: 'auto' as 'hidden' },
});
