/**
 * Download files into the browser's HTTP cache ahead of need, a few at a time, so the loaders that ask for
 * them later (textures, models, the sky) get them at once. Skipped when the visitor asks to save data.
 */
export function warm(urls: readonly string[], parallel = 4, base = document.baseURI): Promise<void> {
  const nav = navigator as Navigator & { connection?: { saveData?: boolean } };
  if (nav.connection?.saveData) return Promise.resolve();
  const queue = urls.map((u) => new URL(u, base).href);
  const next = async (): Promise<void> => {
    for (let url = queue.shift(); url; url = queue.shift()) {
      try {
        const r = await fetch(url, { priority: 'low' } as RequestInit);
        await r.arrayBuffer();
      } catch {
        /* offline or blocked: the page loads it itself later */
      }
    }
  };
  return Promise.all(Array.from({ length: parallel }, next)).then(() => {});
}
