import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { EditorialScreen, SectionLabel, editorial } from '../src/components/Editorial';
import { DetailHeader, TextAction } from '../src/components/DetailHeader';
import { LocalPhoto } from '../src/components/LocalPhoto';
import { showToast } from '../src/components/Toast';
import { displayName, slotLabel } from '../src/domain/closet';
import { CUTOUT_PROMPT, canBeTransparent, cutoutQueue } from '../src/domain/cutoutQueue';
import type { ClosetPiece } from '../src/domain/types';
import { useFormStore } from '../src/state/store';
import { importGarmentPhoto } from '../src/storage/garmentFiles';
import { colors } from '../src/theme/tokens';

/**
 * Needs a cut-out: your own photos can't go on the Try On stage until the garment is cut out of its background.
 * Each piece goes to ChatGPT (or any image tool) with a ready prompt, and the transparent PNG comes back here.
 * Both files stay on this device; the share sheet is the only way a photo leaves it, and only when you choose.
 */
export default function CutoutQueueScreen() {
  const closet = useFormStore(s => s.closet);
  const queue = cutoutQueue(closet);
  return <View style={editorial.root}>
    <EditorialScreen>
      <DetailHeader title="Try On" />
      <Text style={editorial.heading}>Needs a cut-out</Text>
      <Text style={[editorial.body, { marginTop: 12 }]}>These photos still have their background, so they can’t go on the stage yet.</Text>
      <Text style={[editorial.secondary, { marginTop: 6 }]}>Send one to ChatGPT with the prompt we copy for you, save the picture it makes, then add it here.</Text>
      {queue.length ? queue.map(piece => <QueueRow key={piece.id} piece={piece} />)
        : <Text style={[editorial.body, styles.done]}>All done. Every piece you added can go on the stage.</Text>}
    </EditorialScreen>
  </View>;
}

function QueueRow({ piece }: { piece: ClosetPiece & { localUri?: string } }) {
  const updateClosetPiece = useFormStore(s => s.updateClosetPiece);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const name = displayName(piece);

  async function sendToChatGPT() {
    setError('');
    try {
      await Clipboard.setStringAsync(CUTOUT_PROMPT);
      if (!piece.localUri || !(await Sharing.isAvailableAsync())) { showToast('Prompt copied · share the photo from your gallery'); return; }
      showToast('Prompt copied · paste it in ChatGPT with the photo');
      await Sharing.shareAsync(piece.localUri, { dialogTitle: 'Send to ChatGPT', mimeType: 'image/*' });
    } catch {
      setError('The share sheet could not open. The prompt is copied; share the photo from your gallery instead.');
    }
  }

  async function addFixed() {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) { setError('Photo library access is off for FORM. Enable it in Settings to add the cut-out.'); return; }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
      const asset = result.canceled ? undefined : result.assets[0];
      if (!asset?.uri) return;
      if (!canBeTransparent(asset.mimeType, asset.fileName, asset.uri)) {
        setError('That picture is a JPEG, so its background came with it. Ask ChatGPT for a PNG with a transparent background.');
        return;
      }
      const kept = await importGarmentPhoto(asset.uri, asset.mimeType, asset.fileName);
      updateClosetPiece(piece.id, { cutoutUri: kept.localUri, cutoutAspect: asset.width && asset.height ? asset.height / asset.width : undefined });
      showToast(name + ' can go on the stage now');
    } catch {
      setError('This picture could not be kept on this device. Please try another.');
    } finally { setBusy(false); }
  }

  return <View style={styles.row}>
    <View style={styles.thumb}><LocalPhoto uri={piece.localUri} label={name + ', your uploaded photo'} /></View>
    <View style={styles.side}>
      <SectionLabel>{slotLabel(piece.slot).toUpperCase()}</SectionLabel>
      <Text style={editorial.body} numberOfLines={2}>{name}</Text>
      <View style={styles.actions}>
        <TextAction dark label="Fix in ChatGPT" onPress={() => { void sendToChatGPT(); }} />
        <TextAction disabled={busy} label={busy ? 'Adding…' : 'Add the fixed photo'} onPress={() => { void addFixed(); }} />
      </View>
      {!!error && <Text accessibilityRole="alert" style={[editorial.secondary, styles.error]}>{error}</Text>}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 16, marginTop: 26, paddingTop: 22, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line2 },
  thumb: { width: 104, aspectRatio: 4 / 5, borderRadius: 4, overflow: 'hidden', backgroundColor: colors.paper2 },
  side: { flex: 1 },
  actions: { marginTop: 12, gap: 10 },
  error: { marginTop: 10, color: colors.ink },
  done: { marginTop: 28 },
});
