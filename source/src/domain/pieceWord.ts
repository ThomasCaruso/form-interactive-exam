/** The everyday word for one piece. The bottoms slot also holds skirts, jeans and shorts; the shoes slot holds boots. */
export function pieceWord(p: { slot: string; name?: string }, words: Record<string, string> = {}): string {
  const n = (p.name ?? '').toLowerCase();
  if (p.slot === 'pants') return /\bskirt\b/.test(n) ? 'skirt' : /\bshorts\b/.test(n) ? 'shorts' : /\b(jeans|denim)\b/.test(n) ? 'jeans' : 'trousers';
  if (p.slot === 'shoes') return /\bboots?\b/.test(n) ? 'boots' : /\bsneakers?\b/.test(n) ? 'sneakers' : 'shoes';
  return words[p.slot] ?? p.slot;
}
