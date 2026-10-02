// A user's search text, made safe inside a PostgREST `or=(…)` ilike filter:
// the characters that would end the value or add a condition (, ( ) " \)
// become spaces, LIKE wildcards (% _) are escaped. Without it « Dupont, Jean »
// broke the query, and « x%,status.eq.dead » added a condition.
export function orSearchTerm(input: string): string {
  return input
    .replace(/[,()"\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100)
    .replace(/[%_]/g, '\\$&')
}
