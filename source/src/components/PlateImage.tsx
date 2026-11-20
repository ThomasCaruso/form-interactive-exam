import { useId } from 'react';
import { Image, StyleSheet, View, type ImageSourcePropType, type ImageStyle, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { colors } from '../theme/tokens';
/**
 * A photograph multiplied onto its ground, so a retailer's white studio
 * backdrop takes on the paper or plate. The ground is painted inside this
 * component: on web every View is its own stacking context, so a blend only
 * sees colour painted by its direct parent.
 */
export function PlateImage({ source, ground = colors.plate, softEdge = false, resizeMode = 'contain', style, imageStyle, accessibilityLabel }: { source: ImageSourcePropType; ground?: string; softEdge?: boolean; resizeMode?: 'contain' | 'cover'; style?: StyleProp<ViewStyle>; imageStyle?: StyleProp<ImageStyle>; accessibilityLabel?: string }) {
  return <View style={[styles.frame, { backgroundColor: ground }, style]}>
    <View style={[StyleSheet.absoluteFill, styles.multiply]}><Image accessibilityLabel={accessibilityLabel} accessibilityIgnoresInvertColors source={source} resizeMode={resizeMode} style={[styles.image, imageStyle]} /></View>
    {/* Some studio grounds are grey, not white: fade the frame edge into the ground rather than alter the photograph. */}
    {softEdge && <SoftEdge ground={ground} />}
  </View>;
}
/** Fades a frame's edge into its ground, for studio photos shot on grey rather than white. */
export function SoftEdge({ ground = colors.plate }: { ground?: string }) {
  const id = 'soft' + useId().replace(/[^a-zA-Z0-9]/g, '');
  return <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width="100%" height="100%"><Defs><RadialGradient id={id} cx="50%" cy="50%" r="50%"><Stop offset="0.72" stopColor={ground} stopOpacity={0} /><Stop offset="1" stopColor={ground} stopOpacity={1} /></RadialGradient></Defs><Rect width="100%" height="100%" fill={`url(#${id})`} /></Svg>;
}
const styles = StyleSheet.create({ frame: { overflow: 'hidden' }, image: { width: '100%', height: '100%' }, multiply: { mixBlendMode: 'multiply' } });
