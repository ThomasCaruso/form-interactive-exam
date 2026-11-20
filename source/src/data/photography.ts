import type { ImageSourcePropType } from 'react-native';

/**
 * The one mapping from catalog product id to bundled product photography.
 * Real imagery drops in by overwriting the file under
 * assets/placeholders/products/<category>/<productId>.<ext> and, if the
 * extension changes, updating the require path here — nothing else.
 *
 * `aspect` is the source image's width ÷ height. It steers CollageBoard
 * composition; the board re-measures each loaded image and corrects the
 * layout when the actual file differs, so a swapped-in photo pack with
 * different dimensions still composes correctly without touching code.
 * Photography always wins over the illustrated fallback, which now only
 * covers products with no photograph at all.
 */
export interface ProductPhotography {
  source: ImageSourcePropType;
  aspect: number;
  original?: ImageSourcePropType;
  isolated?: boolean;
  illustrative?: boolean;
}

const product = (source: ImageSourcePropType, aspect: number): ProductPhotography => ({ source, aspect });

/** Garment plates ship 4:5 portrait; shoes ship square. */
export const productPhotography: Record<string, ProductPhotography> = {
  jacket: product(require('../../assets/placeholders/products/outerwear/jacket.jpg'), 1200 / 1500),
  overshirt: product(require('../../assets/placeholders/products/outerwear/overshirt.jpg'), 2000 / 2500),
  crew: product(require('../../assets/placeholders/products/tops/crew.jpg'), 1080 / 1350),
  shirt: product(require('../../assets/placeholders/products/tops/shirt.jpg'), 2000 / 2500),
  'fine-knit': product(require('../../assets/placeholders/products/tops/fine-knit.jpg'), 1066 / 1333),
  'warm-knit': product(require('../../assets/placeholders/products/tops/warm-knit.jpg'), 1583 / 1976),
  pleat: product(require('../../assets/placeholders/products/bottoms/pleat.jpg'), 750 / 937),
  straight: product(require('../../assets/placeholders/products/bottoms/straight.jpg'), 800 / 1000),
  linen: product(require('../../assets/placeholders/products/bottoms/linen.jpg'), 567 / 708),
  relaxed: product(require('../../assets/placeholders/products/bottoms/relaxed.jpg'), 520 / 650),
  sneaker: product(require('../../assets/placeholders/products/shoes/sneaker.jpg'), 1),
  loafer: product(require('../../assets/placeholders/products/shoes/loafer.jpg'), 1),
  canvas: product(require('../../assets/placeholders/products/shoes/canvas.jpg'), 1),
  runner: product(require('../../assets/placeholders/products/shoes/runner.jpg'), 1),
};

/** Visually reviewed local U2NetP cutouts. Originals remain available in the inspector. */
productPhotography['linen'] = { ...productPhotography['linen'], original: productPhotography['linen'].source, source: require('../../assets/processed/linen.png'), aspect: 0.84710744, isolated: true };
productPhotography['pleat'] = { ...productPhotography['pleat'], original: productPhotography['pleat'].source, source: require('../../assets/processed/pleat.png'), aspect: 0.83870968, isolated: true };
productPhotography['straight'] = { ...productPhotography['straight'], original: productPhotography['straight'].source, source: require('../../assets/processed/straight.png'), aspect: 0.62154150, isolated: true };
productPhotography['jacket'] = { ...productPhotography['jacket'], original: productPhotography['jacket'].source, source: require('../../assets/processed/jacket.png'), aspect: 0.81083333, isolated: true };
productPhotography['crew'] = { ...productPhotography['crew'], original: productPhotography['crew'].source, source: require('../../assets/processed/crew.png'), aspect: 0.75000000, isolated: true };
productPhotography['warm-knit'] = { ...productPhotography['warm-knit'], original: productPhotography['warm-knit'].source, source: require('../../assets/processed/warm-knit.png'), aspect: 0.75500000, isolated: true };

/** AI-created illustrative shoe fixtures, not exact retailer SKU photography. */
productPhotography['loafer'] = { ...productPhotography['loafer'], original: productPhotography['loafer'].source, source: require('../../assets/fixtures/footwear-v2/loafer.png'), aspect: 1.5, isolated: true, illustrative: true };
productPhotography['sneaker'] = { ...productPhotography['sneaker'], original: productPhotography['sneaker'].source, source: require('../../assets/fixtures/footwear-v2/sneaker.png'), aspect: 1.5, isolated: true, illustrative: true };
productPhotography['canvas'] = { ...productPhotography['canvas'], original: productPhotography['canvas'].source, source: require('../../assets/fixtures/footwear-v2/canvas.png'), aspect: 1.5, isolated: true, illustrative: true };
productPhotography['runner'] = { ...productPhotography['runner'], original: productPhotography['runner'].source, source: require('../../assets/fixtures/footwear-v2/runner.png'), aspect: 1.5, isolated: true, illustrative: true };
