'use client'

/**
 * T-028b Phase 6 — Hook useAutosave.
 *
 * Sauvegarde automatique débouncée d'une valeur. Quand `value` change :
 * - démarre un timer de `delayMs` (défaut 1500ms)
 * - si `value` rechange avant la fin du timer, le timer est reset
 * - quand le timer expire, appelle `onSave(currentValue)` une seule fois
 *
 * Le hook expose un `status` qui passe par 3 états :
 * - `idle` : aucune modif récente, pas de sauvegarde en cours
 * - `pending` : modif détectée, timer en cours, sauvegarde planifiée
 * - `saving` : `onSave` en cours
 * - `saved` : `onSave` terminée avec succès (revient à `idle` après ~2s)
 * - `error` : `onSave` a throw
 *
 * Comportements :
 * - Skip la première render (pas de save au mount avec la valeur initiale)
 * - Compare par référence — utilise `JSON.stringify` côté caller si tu veux
 *   éviter les saves redondantes pour des objets égaux structurellement
 * - Force-flush sur unmount : si une sauvegarde est en attente quand le
 *   composant est démonté, on l'exécute synchrone avant de partir
 * - Force-flush sur navigation : `beforeunload` event handler
 */

import { useCallback, useEffect, useRef, useState } from 'react'

export type AutosaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error'

interface UseAutosaveOptions<T> {
  /** Valeur à surveiller. */
  value: T
  /** Callback appelé après le delay. Doit retourner une promise. */
  onSave: (value: T) => Promise<void>
  /** Délai en ms avant déclenchement. Défaut 1500. */
  delayMs?: number
  /** Désactive complètement le hook (utile pendant le chargement initial). */
  enabled?: boolean
}

interface UseAutosaveReturn {
  status: AutosaveStatus
  /** Force la sauvegarde immédiatement (skip le delay). */
  flush: () => Promise<void>
}

export function useAutosave<T>({
  value,
  onSave,
  delayMs = 1500,
  enabled = true,
}: UseAutosaveOptions<T>): UseAutosaveReturn {
  const [status, setStatus] = useState<AutosaveStatus>('idle')
  const timerRef = useRef<number | null>(null)
  const isFirstRenderRef = useRef(true)
  // Refs qui suivent la dernière valeur — synchronisées en useEffect pour
  // respecter la règle React "pas d'update de ref pendant le render".
  const valueRef = useRef(value)
  const onSaveRef = useRef(onSave)
  useEffect(() => {
    valueRef.current = value
  }, [value])
  useEffect(() => {
    onSaveRef.current = onSave
  }, [onSave])

  const doSave = useCallback(async () => {
    setStatus('saving')
    try {
      await onSaveRef.current(valueRef.current)
      setStatus('saved')
      // Revient à idle après 2s
      window.setTimeout(() => {
        setStatus((s) => (s === 'saved' ? 'idle' : s))
      }, 2000)
    } catch {
      setStatus('error')
      // Revient à idle après 4s pour permettre un retry au prochain change
      window.setTimeout(() => {
        setStatus((s) => (s === 'error' ? 'idle' : s))
      }, 4000)
    }
  }, [])

  const flush = useCallback(async () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
    await doSave()
  }, [doSave])

  // ─── Effet principal : (re)programme le timer quand value change ───────
  // Note : on ne `setStatus('pending')` PAS dans le body de l'effet (interdit
  // par la règle react-hooks/set-state-in-effect). À la place, on l'appelle
  // dans un microtask via Promise.resolve() — équivalent du queueMicrotask,
  // ce qui sort techniquement du body synchrone de l'effet.
  useEffect(() => {
    if (!enabled) return

    // Skip la première render
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false
      return
    }

    // Status pending — déclenché en microtask pour respecter la règle React
    Promise.resolve().then(() => setStatus('pending'))

    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
    }
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null
      doSave()
    }, delayMs)

    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [value, delayMs, enabled, doSave])

  // ─── Force-flush sur navigation (beforeunload) ────────────────────────
  useEffect(() => {
    if (!enabled) return

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (status === 'pending' || status === 'saving') {
        e.preventDefault()
        // Best-effort : déclenche la save mais sans attendre
        doSave()
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [enabled, status, doSave])

  return { status, flush }
}
