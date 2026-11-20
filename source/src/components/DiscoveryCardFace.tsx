import { OutfitFlatLay } from './OutfitFlatLay';
import { productPhotography } from '../data/photography';
import type { ComponentProps, ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import type { Look, Product, ReviewStatus } from '../domain/types';
import { formatMoney } from '../domain/selectors';
import { colors } from '../theme/tokens';
import { family } from '../theme/typography';
import { CardUndoButton } from './CardUndoButton';
import { FormIcon } from './FormIcon';
import { MotionPressable } from './MotionPressable';
import { ProductVisual } from './ProductVisual';
import { GlassFill, GlassRim, GlassSurface, glassStyle } from './GlassSurface';

interface Props {
  look?: Look; onTry?: () => void;
  product: Product; reason: string; cardHeight: number; interactive?: boolean;
  busy?: boolean; canUndo?: boolean; onUndo?: () => void;
  onTouch?: () => void; onOpen?: () => void; onReview?: (status: ReviewStatus) => void;
  onStageLayout?: (event: { nativeEvent: { layout: { height: number } } }) => void;
  onLayout?: (event: { nativeEvent: { layout: { height: number } } }) => void; children?: ReactNode;
}
function CardControl({ interactive, staticPress = false, children, style, ...props }: ComponentProps<typeof MotionPressable> & { interactive: boolean; staticPress?: boolean }) {
  const flat = StyleSheet.flatten(style);
  const radius = typeof flat?.borderRadius === 'number' ? flat.borderRadius : 0;
  const tone = flat?.backgroundColor === colors.ink ? 'dark' : 'light';
  const layers = <><GlassFill tone={tone} radius={radius} />{children}<GlassRim tone={tone} radius={radius} /></>;
  // Photograph and title touches remain bare; the decision buttons are glass.
  if (!interactive) return <View style={[style, radius > 0 && glassStyle(tone, radius)]}>{radius > 0 ? layers : children}</View>;
  if (staticPress) {
    const { haptic, dimWhenDisabled, glass, ...pressProps } = props;
    void haptic; void dimWhenDisabled; void glass;
    return <Pressable {...pressProps} style={({ pressed }) => [style, radius > 0 && glassStyle(tone, radius), { opacity: pressed ? 0.72 : 1 }]}>{radius > 0 ? layers : children}</Pressable>;
  }
  return <MotionPressable {...props} dimWhenDisabled={false} style={style}>{children}</MotionPressable>;
}
/** One clipped, rounded card keeps the photo, caption and controls together during a swipe. */
export function DiscoveryCardFace({ look, onTry, product, reason, cardHeight, interactive = false, busy = false, canUndo = false, onUndo, onTouch, onOpen, onReview, onLayout, onStageLayout, children }: Props) {
  const compact = cardHeight < 470;
  return <View collapsable={false} accessibilityElementsHidden={!interactive} importantForAccessibility={interactive ? 'auto' : 'no-hide-descendants'} onLayout={onLayout} style={[styles.card, { height: cardHeight }]}>
      <GlassSurface backing={colors.plate} onLayout={onStageLayout} style={styles.stage}>
        <CardControl staticPress interactive={interactive} haptic={false} disabled={!interactive || busy} onPressIn={onTouch} onPress={onOpen}
          accessibilityRole="button" accessibilityLabel={'View ' + product.name + ' details'}
          accessibilityHint="Tap for details. Swipe right to save or left to pass."
          style={styles.visualTouch}>
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, { margin: look ? 0 : product.slot === 'shoes' ? 36 : 24 }]}>{look ? <OutfitFlatLay look={look} /> : <ProductVisual product={product} fit="contain" transition={false} />}</View>
        </CardControl>
        {children}
        {interactive && <CardUndoButton disabled={!canUndo || busy} onPressIn={onTouch} onPress={() => onUndo?.()} />}
      </GlassSurface>
      <View style={styles.copy}>
        <Text style={styles.brand}>{look ? 'COMPLETE LOOK / '+look.products.length+' PIECES' : product.brand.toUpperCase()}{!look && product.retailer ? ' / ONLINE PIECE' : !look && productPhotography[product.id]?.illustrative ? " / DEMO IMAGE" : ""}</Text>
        <CardControl staticPress interactive={interactive} haptic={false} disabled={!interactive || busy} accessibilityRole="button" accessibilityLabel={'View ' + product.name + ' details'} onPressIn={onTouch} onPress={onOpen} style={styles.titleTouch}>
          <Text maxFontSizeMultiplier={1.25} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={[styles.name, compact && { fontSize: 25, lineHeight: 29 }]}>{product.name}</Text>
        </CardControl>
        <Text maxFontSizeMultiplier={1.2} numberOfLines={1} style={styles.meta}>{look ? 'Total ' : ''}{formatMoney(product.priceCents)} · {look ? look.vibe : product.color}</Text>
        <Text maxFontSizeMultiplier={1.25} numberOfLines={compact ? 1 : 2} style={styles.reason}>{reason}</Text>
      </View>
      <View style={styles.actions}>
      <CardControl staticPress interactive={interactive} haptic={false} disabled={!interactive || busy} accessibilityRole="button" accessibilityLabel={'Pass on ' + product.name} accessibilityState={{ disabled: !interactive || busy }} onPressIn={onTouch} onPress={() => onReview?.('passed')} style={styles.circle}>
        <FormIcon name="close" size={20} />{!look && <Text style={styles.actionText}>Pass</Text>}
      </CardControl>
      {!look && <CardControl staticPress interactive={interactive} haptic={false} disabled={!interactive || busy} accessibilityRole="button" accessibilityLabel={'Try ' + product.name + ' on'} accessibilityState={{ disabled: !interactive || busy }} onPressIn={onTouch} onPress={onTry} style={styles.tryPiece}>
        <FormIcon name="tryon" size={19} />
      </CardControl>}
      <CardControl staticPress interactive={interactive} haptic={false} disabled={!interactive || busy} accessibilityRole="button" accessibilityLabel={'Save ' + product.name} accessibilityState={{ disabled: !interactive || busy }} onPressIn={onTouch} onPress={() => onReview?.('saved')} style={[styles.circle, styles.save]}>
        <FormIcon name="heart" size={20} color={colors.paper} /><Text style={[styles.actionText, { color: colors.paper }]}>{look ? 'Save look' : 'Save piece'}</Text>
      </CardControl>
      {look && <CardControl staticPress interactive={interactive} haptic={false} disabled={!interactive || busy} accessibilityRole="button" accessibilityLabel={'Try '+look.title+' on'} onPressIn={onTouch} onPress={onTry} style={[styles.circle,{flex:1.3}]}><Text style={[styles.actionText,{fontSize:12}]}>Try this look</Text><FormIcon name="arrow" size={16}/></CardControl>}
      </View>
  </View>;
}
const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: 4, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, overflow: 'hidden', paddingBottom: 12 },
  stage: { flex: 1, overflow: 'hidden', borderRadius: 4, backgroundColor: colors.paper2 },
  visualTouch: { flex: 1 },
  copy: { paddingTop: 14, paddingHorizontal: 18 },
  brand: { fontFamily: family.sansMedium, fontSize: 10, letterSpacing: 1.8, color: colors.muted },
  titleTouch: { minHeight: 44, justifyContent: 'center' },
  name: { fontFamily: family.sansMedium, fontSize: 23, lineHeight: 29, letterSpacing: -0.3, color: colors.ink },
  meta: { fontFamily: family.sans, fontSize: 13, lineHeight: 19, color: colors.muted, marginTop: 3 },
  reason: { fontFamily: family.sans, fontSize: 12, lineHeight: 19, color: colors.muted, marginTop: 8 },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 14, paddingHorizontal: 18 },
  actionText: { fontFamily: family.sansMedium, fontSize: 14, color: colors.ink },
  save: { flex: 1.4, backgroundColor: colors.ink, borderColor: colors.ink },
  tryPiece: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card, borderWidth: 1.25, borderColor: colors.ink },
  circle: { flex: 1, flexDirection: 'row', gap: 8, height: 54, borderRadius: 27,  alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card },
});
