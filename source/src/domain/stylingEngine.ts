import { realCatalogProducts } from '../data/realCatalog';
import * as fixture from './fixtureEngine';
import { diversify, type TasteSignals } from './learning';
import type { EditRequest, Look, Product, Profile, Refinement, Session } from './types';
export { eligibleProduct, fixtureReason, recommendedSize, refinementBudget, unseenProducts } from './fixtureEngine';
const contentIdentity = (look: Look): Look => ({ ...look,
  id: look.id + '-' + look.products.map(p => [p.id, p.priceCents, Array.from(p.size, character => character.codePointAt(0)!.toString(16)).join('-')].join('.')).join('_'),
});
/** Production selection explicitly uses real pieces; legacy fixtures remain isolated. */
export const rankProducts = (profile: Profile, signals?: TasteSignals) => fixture.rankProducts(profile, realCatalogProducts, signals);
/** The For You order: best-first by everything learned so far, varied so no kind of piece runs on. */
export function feedProducts(profile: Profile, signals?: TasteSignals): Product[] {
  const score = fixture.productScorer(profile, signals);
  return diversify(rankProducts(profile, signals), score);
}
/** Cards already on screen keep their place; learning reorders only what hasn't been dealt yet. */
export function keepDealt(dealt: readonly string[], ordered: Product[]): Product[] {
  const byId = new Map(ordered.map(p => [p.id, p]));
  const head = dealt.flatMap(id => byId.get(id) ?? []);
  return [...head, ...ordered.filter(p => !dealt.includes(p.id))];
}
export const buildFixtureSession = (request: EditRequest, profile: Profile, seed: string, createdAt = Date.now(), signals?: TasteSignals) => {
  const session = fixture.buildFixtureSession(request, profile, seed, createdAt, realCatalogProducts, signals);
  // The default daily edit has a stable seed. Its identity must also capture content,
  // so a preference or size change cannot alias a different immutable Saved look.
  return { ...session, looks: session.looks.map(contentIdentity) };
};
export const refineFixtureLook = (look: Look, action: Refinement, profile: Profile, budgetCents = profile.budgetCents) => fixture.refineFixtureLook(look, action, profile, budgetCents, realCatalogProducts);
export const swapFixturePiece = (look: Look, pieceId: string, profile: Profile, budgetCents = profile.budgetCents) => fixture.swapFixturePiece(look, pieceId, profile, budgetCents, realCatalogProducts);
/** Related pairing must obey this profile's exclusions and whole-look budget. */
export function relatedFixtureLook(product: Product, profile: Profile): Look | undefined {
  if (!product.retailer) return fixture.relatedFixtureLook(product);
  if (!fixture.eligibleProduct(product, profile)) return undefined;
  const session = fixture.buildFixtureSession({ occasion: 'A considered pairing', dressCode: 'Smart casual', budgetCents: profile.budgetCents }, profile, 'related-' + product.id, 0,
    realCatalogProducts.filter(p => p.slot !== product.slot || p.id === product.id));
  return session.looks[0] ? contentIdentity(session.looks[0]) : undefined;
}

/** Session factory invoked by the user action, never while deriving a board. */
export function createPairingSession(look: Look, profile: Profile, createdAt = Date.now()): Session {
  return { id: 'pairing-' + createdAt, occasion: 'A considered pairing', createdAt,
    request: { occasion: 'A considered pairing', dressCode: 'Smart casual', budgetCents: profile.budgetCents }, looks: [look] };
}
