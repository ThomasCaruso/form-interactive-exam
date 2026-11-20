type Storage = { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<unknown>; removeItem(key: string): Promise<unknown> };
type Manifest = { generation: string; count: number };
/** Atomic manifest: interrupted writes never replace a previously valid session. All parts are encrypted by the supplied native adapter. */
export function createSecureStorage(raw: Storage) {
  let queue: Promise<unknown> = Promise.resolve(); let serial = 0;
  function run<T>(task: () => Promise<T>): Promise<T> { const next = queue.then(task, task); queue = next.catch(() => {}); return next; }
  const partKey = (key: string, m: Manifest, i: number) => `${key}.part.${m.generation}.${i}`;
  async function manifest(key: string): Promise<Manifest | null> {
    const data = await raw.getItem(`${key}.manifest`); if (!data) return null;
    const m = JSON.parse(data) as Manifest;
    if (!/^[a-z0-9-]+$/.test(m.generation) || !Number.isInteger(m.count) || m.count < 1 || m.count > 1000) throw new Error('Invalid secure session storage');
    return m;
  }
  async function discard(key: string, m: Manifest) { await Promise.all(Array.from({ length: m.count }, (_, i) => raw.removeItem(partKey(key, m, i)))); }
  return {
    getItem: (key: string) => run(async () => { const m = await manifest(key); if (!m) return null; const parts = await Promise.all(Array.from({ length: m.count }, (_, i) => raw.getItem(partKey(key, m, i)))); if (parts.some(p => p === null)) throw new Error('Incomplete secure session storage'); return parts.join(''); }),
    setItem: (key: string, value: string) => run(async () => {
      const old = await manifest(key); const chars = Array.from(value); const parts: string[] = [];
      for (let i = 0; i < chars.length; i += 350) parts.push(chars.slice(i, i + 350).join(''));
      if (!parts.length) parts.push(''); if (parts.length > 1000) throw new Error('Secure session too large');
      const m = { generation: `${Date.now().toString(36)}-${(++serial).toString(36)}`, count: parts.length };
      try { for (let i = 0; i < parts.length; i++) await raw.setItem(partKey(key, m, i), parts[i]); await raw.setItem(`${key}.manifest`, JSON.stringify(m)); }
      catch (error) { await discard(key, m).catch(() => {}); throw error; }
      if (old) await discard(key, old).catch(() => {});
    }),
    removeItem: (key: string) => run(async () => { const m = await manifest(key); await raw.removeItem(`${key}.manifest`); if (m) await discard(key, m); }),
  };
}
