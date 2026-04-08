'use client'

/**
 * T-028b Phase 6 — Hook useUndoRedo générique.
 *
 * Maintient un historique des états passés/futurs d'une valeur, avec
 * undo/redo + raccourcis clavier Cmd+Z / Cmd+Shift+Z.
 *
 * Usage typique dans le builder pour les pages :
 *   const { state, setState, undo, redo, canUndo, canRedo } = useUndoRedo(initialPages)
 *   // Quand l'utilisateur édite : setState(newPages)
 *   // Quand il fait Cmd+Z : undo() — restore les pages précédentes
 *
 * Limitations volontaires V1 :
 * - Stack en mémoire (perdue si refresh) — pas de persistance
 * - Limite à 50 états en arrière (au-delà, on shift)
 * - Compare par référence (les setState avec la même ref ne créent pas d'entrée)
 * - Pas de coalesce des typings rapides en un seul step (chaque setState = entrée)
 *   → polissage en V2 si nécessaire (genre debounce 300ms avant push history)
 */

import { useCallback, useEffect, useRef, useState } from 'react'

const MAX_HISTORY = 50

interface UseUndoRedoOptions {
  /** Activer le binding Cmd+Z / Cmd+Shift+Z. Défaut : true */
  keyboardShortcuts?: boolean
}

interface UseUndoRedoReturn<T> {
  state: T
  setState: (next: T) => void
  /** Annule le dernier setState. */
  undo: () => void
  /** Rejoue un état annulé. */
  redo: () => void
  canUndo: boolean
  canRedo: boolean
  /** Reset complet de l'historique avec une nouvelle valeur initiale (utile au reload du funnel). */
  reset: (next: T) => void
}

export function useUndoRedo<T>(
  initial: T,
  options: UseUndoRedoOptions = {},
): UseUndoRedoReturn<T> {
  const { keyboardShortcuts = true } = options

  const [state, setStateInternal] = useState<T>(initial)
  // Stack des états passés (le plus récent en dernier) — n'inclut PAS l'état actuel
  const pastRef = useRef<T[]>([])
  // Stack des états futurs (poppé sur redo)
  const futureRef = useRef<T[]>([])
  // Versions reactive pour can{Undo,Redo}
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)

  const refreshFlags = useCallback(() => {
    setCanUndo(pastRef.current.length > 0)
    setCanRedo(futureRef.current.length > 0)
  }, [])

  const setState = useCallback(
    (next: T) => {
      setStateInternal((current) => {
        if (next === current) return current
        // Push current dans past, vider future
        pastRef.current.push(current)
        if (pastRef.current.length > MAX_HISTORY) {
          pastRef.current.shift()
        }
        futureRef.current = []
        // Schedule update flags après le set
        Promise.resolve().then(refreshFlags)
        return next
      })
    },
    [refreshFlags],
  )

  const undo = useCallback(() => {
    setStateInternal((current) => {
      const previous = pastRef.current.pop()
      if (previous === undefined) return current
      futureRef.current.push(current)
      if (futureRef.current.length > MAX_HISTORY) {
        futureRef.current.shift()
      }
      Promise.resolve().then(refreshFlags)
      return previous
    })
  }, [refreshFlags])

  const redo = useCallback(() => {
    setStateInternal((current) => {
      const next = futureRef.current.pop()
      if (next === undefined) return current
      pastRef.current.push(current)
      if (pastRef.current.length > MAX_HISTORY) {
        pastRef.current.shift()
      }
      Promise.resolve().then(refreshFlags)
      return next
    })
  }, [refreshFlags])

  const reset = useCallback(
    (next: T) => {
      pastRef.current = []
      futureRef.current = []
      setStateInternal(next)
      Promise.resolve().then(refreshFlags)
    },
    [refreshFlags],
  )

  // ─── Keyboard shortcuts ─────────────────────────────────────────────────
  useEffect(() => {
    if (!keyboardShortcuts) return

    const handleKey = (e: KeyboardEvent) => {
      // Skip si on est dans un input/textarea/contenteditable
      const target = e.target as HTMLElement | null
      if (target) {
        const tag = target.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
        if (target.isContentEditable) return
      }

      const isCmd = e.metaKey || e.ctrlKey
      if (!isCmd) return

      // Cmd+Z (undo)
      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
        return
      }
      // Cmd+Shift+Z OR Cmd+Y (redo)
      if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
        e.preventDefault()
        redo()
        return
      }
    }

    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [keyboardShortcuts, undo, redo])

  return { state, setState, undo, redo, canUndo, canRedo, reset }
}
