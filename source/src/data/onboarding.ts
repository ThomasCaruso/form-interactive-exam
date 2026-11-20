import { realCatalogProducts } from './realCatalog';
export const onboardingMoods = [
  { name: 'Minimal', note: 'Quiet lines. Easy confidence.', tag: 'Minimal', product: realCatalogProducts.find(p => p.id === 'muji-8743682048190-white')! },
  { name: 'Classic', note: 'Familiar. Always considered.', tag: 'Classic', product: realCatalogProducts.find(p => p.id === 'muji-8654640513214-navy')! },
  { name: 'Elevated casual', note: 'Off-duty, with intention.', tag: 'Elevated casual', product: realCatalogProducts.find(p => p.id === 'muji-8958259790014-brown')! },
  { name: 'Relaxed', note: 'A little room to breathe.', tag: 'Streetwear', product: realCatalogProducts.find(p => p.id === 'muji-8830601658558-beige')! },
 ];
export const onboardingPalette = [
  { name: 'Soft black', value: 'Black', hex: '#29231D' }, { name: 'Taupe', value: 'Beige', hex: '#9A8A79' }, { name: 'Bone', value: 'White', hex: '#E4DACE' }, { name: 'Grey', value: 'Medium Gray', hex: '#91918E' }, { name: 'Navy', value: 'Navy', hex: '#29313F' },
];
