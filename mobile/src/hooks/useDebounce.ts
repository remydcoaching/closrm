import { useEffect, useState } from 'react'

/** Debounce une valeur (string, etc) — retourne la valeur "stabilisée"
 *  après `delayMs` sans changement. Évite de spammer le backend en
 *  réagissant à chaque keystroke d'un input search. */
export function useDebounce<T>(value: T, delayMs: number = 300): T {
  const [debounced, setDebounced] = useState<T>(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(t)
  }, [value, delayMs])
  return debounced
}
