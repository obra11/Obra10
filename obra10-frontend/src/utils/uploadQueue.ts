/**
 * Executa tarefas async com no máximo `concurrency` em paralelo.
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
  onProgress?: (done: number, total: number) => void,
): Promise<R[]> {
  const limit = Math.max(1, Math.min(concurrency, items.length || 1));
  const results: R[] = new Array(items.length);
  let nextIndex = 0;
  let completed = 0;

  async function runOne(): Promise<void> {
    while (nextIndex < items.length) {
      const i = nextIndex++;
      results[i] = await worker(items[i], i);
      completed += 1;
      onProgress?.(completed, items.length);
    }
  }

  const runners = Array.from({ length: Math.min(limit, items.length) }, () =>
    runOne(),
  );
  await Promise.all(runners);
  return results;
}

/** Upload de mídia RDO: no máximo 2 em paralelo no aparelho. */
export const RDO_UPLOAD_CONCURRENCY = 2;
