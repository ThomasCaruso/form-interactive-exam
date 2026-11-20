import type { JudgePiece } from './judgePiece';

export type PairKind = 'colour' | 'colourShoes' | 'type' | 'typeShoes';
/** The pairings an outfit contains, as [kind, left, right]. Shared by the judge and the script that counts them. */
export function pairKeys(pieces: JudgePiece[]): [PairKind, string, string][] {
  const of = (slot: JudgePiece['slot']) => pieces.find(p => p.slot === slot);
  const top = of('top'), lower = of('bottom') ?? of('dress'), shoes = of('shoes');
  const keys: [PairKind, string, string][] = [];
  if (top && lower) keys.push(['colour', top.colour.family, lower.colour.family], ['type', top.type, lower.type]);
  if (lower && shoes) keys.push(['colourShoes', lower.colour.family, shoes.colour.family], ['typeShoes', lower.type, shoes.type]);
  return keys;
}
