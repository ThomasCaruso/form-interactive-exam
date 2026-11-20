/** Old content IDs contained percent-encoded sizes that native routes decode.
 * Resolve existing snapshots without rewriting them; exact identity always wins.
 */
export function findByRouteId<T extends { id: string }>(items: readonly T[], routeId?: string): T | undefined {
  if (!routeId) return undefined;
  const exact = items.find(item => item.id === routeId);
  if (exact) return exact;
  const matches = items.filter(item => {
    try { return decodeURIComponent(item.id) === routeId; }
    catch { return false; }
  });
  const first = matches[0];
  // Reject aliases that could refer to two different stored identities.
  return first && matches.every(item => item.id === first.id) ? first : undefined;
}
