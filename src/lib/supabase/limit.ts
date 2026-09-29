// Bounded parallelism for chunked Supabase reads: the instance's PostgREST
// pool is small, and firing every chunk at once queues requests for seconds
// (observed 2026-09-26). A few at a time keeps latency low.
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let next = 0
  const worker = async () => {
    while (next < items.length) {
      const i = next++
      out[i] = await fn(items[i])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return out
}
