import { Asset } from 'expo-asset';
import type { ImageSourcePropType } from 'react-native';

/** Resolve bundled native IDs and web URI sources without native-only Image APIs. */
export function photoAsset(source: ImageSourcePropType) {
  const value = Array.isArray(source) ? source[0] : source;
  if (typeof value === 'number') return Asset.fromModule(value);
  if (!value?.uri) return undefined;
  const asset = Asset.fromModule(value.uri);
  return { uri: asset.uri, width: value.width ?? asset.width, height: value.height ?? asset.height };
}
