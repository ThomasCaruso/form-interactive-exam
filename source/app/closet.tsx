import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ClosetGrid } from '../src/components/ClosetGrid';
import { DetailHeader } from '../src/components/DetailHeader';
import { RaisedButton } from '../src/components/RaisedButton';
import { showToast } from '../src/components/Toast';
import { picksToPieces, type ClosetPicks } from '../src/domain/closet';
import { useFormStore } from '../src/state/store';
import { colors, layout } from '../src/theme/tokens';
import { family } from '../src/theme/typography';

/** The closet grid after onboarding. Pieces already in the closet are not added twice. */
export default function ClosetScreen() {
  const router = useRouter(), insets = useSafeAreaInsets();
  const shopFor = useFormStore(s => s.profile.shopFor ?? 'both'), addClosetPieces = useFormStore(s => s.addClosetPieces);
  const [picks, setPicks] = useState<ClosetPicks>({});
  const count = Object.keys(picks).length;
  const done = () => {
    if (count) { addClosetPieces(picksToPieces(picks)); showToast(count === 1 ? 'Added to your closet' : count + ' pieces added to your closet'); }
    if (router.canGoBack()) router.back(); else router.replace('/(tabs)/saved');
  };
  return <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom + 18 }]}>
    <DetailHeader title="WHAT YOU WEAR" />
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 18 }} showsVerticalScrollIndicator={false}>
      <Text style={styles.lede}>Tap a colour on the things you wear most, up to three a row. FORM styles new pieces around them.</Text>
      <ClosetGrid shopFor={shopFor} picks={picks} onChange={setPicks} />
    </ScrollView>
    <RaisedButton label={count ? 'Add ' + count + (count === 1 ? ' piece' : ' pieces') : 'Done'} showArrow={false} onPress={done} />
  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper, paddingHorizontal: layout.gutter },
  lede: { fontFamily: family.sans, fontSize: 14.5, lineHeight: 21, color: colors.ink2, marginTop: 6, marginBottom: 22 },
});
