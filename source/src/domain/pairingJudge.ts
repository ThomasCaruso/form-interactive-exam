import type { JudgePiece } from './judgePiece';
import { pairKeys } from './stylistPairs';
import * as stylistPairs from './stylistPairLifts.json';

/** How much each rule matters. Positive marks an outfit down, negative is a bonus, 0 ignores the rule.
 * A person's taste is a different set of weights on the same rules. */
export interface JudgeWeights {
  formalityGap: number; formalityClash: number; shoesBelow: number; accentArea: number; contrast: number; tonal: number;
  redStrict: number; undertone: number; proportion: number; patternMix: number; season: number; texture: number; stylistPairs: number;
}
/** Fitted 2026-10-09 by scripts/stylists/fit.cjs on 25,333 Mytheresa stylist looks against swapped-piece
 * negatives; held-out paired AUC 0.579, 95.9% of held-out stylist looks pass.
 * The data sets strength, the research sets direction (only tonal may be a bonus). No soft rule exceeds 0.45,
 * so none can fail an outfit alone. Rules a random swap rarely triggers keep a research floor of 0.1. */
export const DEFAULT_WEIGHTS: JudgeWeights = {
  formalityGap: 0.32, formalityClash: 0.11, shoesBelow: 0, accentArea: 0.1, contrast: 0.45, tonal: -0.45,
  redStrict: 0, undertone: 0.07, proportion: 0.1, patternMix: 0.1, season: 0.45, texture: 0.28, stylistPairs: 0.45,
};
/** The owner's blind labels (2026-10-09): fine with formality gaps and trainers with tailoring; flat
 * same-colour outfits are a penalty for them where stylists treat them as a bonus. */
export const OWNER_WEIGHTS: JudgeWeights = { ...DEFAULT_WEIGHTS, formalityGap: 0, formalityClash: 0, tonal: 0.4 };
export const PASS_SCORE = 0.5;

export type Rule = keyof JudgeWeights;
export interface Reason { rule: Rule; penalty: number; text: string }
export type Gate = 'incomplete' | 'patterns';
export interface Verdict { verdict: 'pass' | 'fail'; score: number; gates: Gate[]; reasons: Reason[] }

// Share of the eye each slot takes, after the 60/30/10 rule.
const AREA: Record<JudgePiece['slot'], number> = { bottom: 0.5, dress: 0.6, outerwear: 0.4, top: 0.3, shoes: 0.1 };
const CORE = new Set(['top', 'bottom', 'dress', 'shoes']);
const clamp = (x: number) => Math.max(0, Math.min(1, x));
// What a rule means for someone whose weight makes it a bonus.
const BONUS: Partial<Record<Rule, string>> = {
  tonal: 'One colour at close depths reads deliberate and calm',
  accentArea: 'A confident amount of colour',
  formalityGap: 'Mixes dressy and casual pieces',
  shoesBelow: 'Casual shoes relax the tailoring',
};

/** Each rule that applies, with its unweighted penalty 0–1. Exported for weight fitting. */
export function findRules(pieces: JudgePiece[]): { gates: Gate[]; found: [Rule, number, string][] } {
  const of = (slot: JudgePiece['slot']) => pieces.find(p => p.slot === slot);
  const top = of('top'), bottom = of('bottom'), dress = of('dress'), shoes = of('shoes');
  const core = pieces.filter(p => CORE.has(p.slot));
  const patterned = pieces.filter(p => p.slot !== 'shoes' && p.colour.pattern !== 'solid');

  const gates: Gate[] = [];
  if (!shoes || !(dress || (top && bottom))) gates.push('incomplete');
  const forms = core.map(p => p.formality);
  const spread = forms.length ? Math.max(...forms) - Math.min(...forms) : 0;
  if (patterned.length >= 3) gates.push('patterns');

  const found: [Rule, number, string][] = [];
  // Not a gate: stylists span the whole scale (heels with jeans) in 6% of their looks.
  if (spread >= 3) found.push(['formalityClash', 1, 'The dressiest and most casual pieces are as far apart as they can be']);
  if (spread === 2) found.push(['formalityGap', 1, 'One piece is much dressier than the rest']);
  const lower = bottom ?? dress;
  if (lower && shoes && lower.formality - shoes.formality >= 2) found.push(['shoesBelow', 1, 'The shoes are much more casual than the ' + lower.type]);

  const load = pieces.reduce((s, p) => s + AREA[p.slot] * (p.colour.role === 'accent' ? 1 : p.colour.role === 'soft' ? 0.4 : 0), 0);
  const accentFamilies = new Set(pieces.filter(p => p.colour.role === 'accent').map(p => p.colour.family));
  const accentPenalty = accentFamilies.size >= 3 ? 1 : clamp((load - 0.5) / 0.5);
  if (accentPenalty > 0) found.push(['accentArea', accentPenalty, 'Too much bright colour; let neutrals carry most of the outfit']);

  if (top && bottom) {
    const dL = Math.abs(top.colour.lightness - bottom.colour.lightness);
    const same = top.colour.family === bottom.colour.family;
    if (dL < 0.15 && !same && top.colour.family !== 'denim' && bottom.colour.family !== 'denim')
      found.push(['contrast', clamp(1 - dL / 0.15), 'Top and bottom are too close in depth to separate']);
    if (dL < 0.15 && same) found.push(['tonal', clamp(1 - dL / 0.15), 'Top and bottom are the same colour at the same depth, which can read flat']);
    if (dL < 0.12 && top.colour.role === 'neutral' && bottom.colour.role === 'neutral'
      && top.colour.undertone !== 'none' && bottom.colour.undertone !== 'none' && top.colour.undertone !== bottom.colour.undertone)
      found.push(['undertone', 1, 'Warm and cool neutrals at the same depth sit uneasily']);
    if (top.relaxed && bottom.relaxed) found.push(['proportion', 1, 'Loose on loose; one fitted piece would give the outfit shape']);
  }
  if (pieces.some(p => (p.slot === 'bottom' || p.slot === 'dress' || p.slot === 'outerwear') && p.colour.role === 'accent' && (p.colour.family === 'red' || p.colour.family === 'orange')))
    found.push(['redStrict', 1, 'Red and orange are hardest to pair in a large piece']);

  if (patterned.length === 2) {
    const [a, b] = patterned;
    const samePattern = a.colour.pattern === b.colour.pattern;
    if (!(samePattern && a.colour.family === b.colour.family))
      found.push(['patternMix', samePattern ? 1 : 0.5, samePattern ? 'Two ' + a.colour.pattern + ' patterns compete' : 'Two patterns; keep their scales different']);
  }
  // Clothes only: shoes say little about the season (white trainers with a sweater is normal).
  const warmths = core.filter(p => p.slot !== 'shoes').map(p => p.warmth);
  if (warmths.includes(0) && warmths.includes(2)) found.push(['season', 1, 'Summer and winter fabrics in the same outfit']);
  const textures = pieces.map(p => p.texture);
  if (textures.includes('fine') && textures.includes('rough')) found.push(['texture', 1, 'Very fine and very rough fabrics side by side']);

  // Pairings stylists choose at under half the chance rate (log-lift below -0.7).
  const lifts = stylistPairs.pairs as Record<string, number>;
  const rare = pairKeys(pieces).map(([kind, a, b]) => [lifts[kind + ':' + a + '|' + b], a, b] as const)
    .filter(([lift]) => lift !== undefined && lift < -0.7).sort((x, y) => x[0] - y[0]);
  if (rare.length) found.push(['stylistPairs', clamp(-rare[0][0] / 1.5), 'Stylists rarely pair ' + rare[0][1] + ' with ' + rare[0][2]]);
  return { gates, found };
}

export function judgeOutfit(pieces: JudgePiece[], weights: JudgeWeights = DEFAULT_WEIGHTS): Verdict {
  const { gates, found } = findRules(pieces);
  const reasons = found.filter(([rule]) => weights[rule] !== 0)
    .map(([rule, p, text]) => ({ rule, penalty: weights[rule] * p, text: weights[rule] < 0 ? BONUS[rule] ?? text : text }));
  const score = clamp(1 - reasons.reduce((s, r) => s + r.penalty, 0));
  return { verdict: gates.length || score < PASS_SCORE ? 'fail' : 'pass', score, gates, reasons };
}
