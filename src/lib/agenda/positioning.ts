/**
 * Pure positioning helpers for the agenda grid (week / day views).
 *
 * Coordinate system:
 *  - Y axis : minutes since midnight, mapped to pixels via `slotHeight / 30`.
 *    A 30-min slot is the unit. `slotHeight = 32px` by default → 64px/heure.
 *  - X axis (week view) : 7 columns equal width, plus a fixed gutter for hours.
 *
 * All functions are pure and side-effect-free — testable in isolation via the
 * companion `positioning.test.ts`.
 */

import { differenceInMinutes, parseISO } from 'date-fns'
import type { AgendaEvent } from '@/types/agenda'

export interface GridGeometry {
  /** Hauteur d'un slot 30min en pixels. Défaut 32. */
  slotHeight: number
  /** Heure de début visible (inclusif). Défaut 7 → 7h00. */
  startHour: number
  /** Heure de fin visible (exclusif). Défaut 22 → ne montre rien à 22h00. */
  endHour: number
}

export const DEFAULT_GEOMETRY: GridGeometry = {
  slotHeight: 32,
  startHour: 0,
  endHour: 24,
}

/** Espace vertical entre événements adjacents (ressenti Google Cal). Soustrait
 *  de la hauteur retournée par `eventToPosition`. */
export const EVENT_VERTICAL_GAP_PX = 2

/** Pixels par minute, dérivé de la géométrie. */
export function pxPerMinute(g: GridGeometry = DEFAULT_GEOMETRY): number {
  return g.slotHeight / 30
}

/** Hauteur totale en pixels d'une colonne de jour. */
export function totalGridHeight(g: GridGeometry = DEFAULT_GEOMETRY): number {
  return (g.endHour - g.startHour) * 2 * g.slotHeight
}

/**
 * Convertit un `start` ISO + `durationMinutes` en `{ top, height }` pixels
 * relatifs au début de la grille (top = 0 ↔ startHour:00).
 *
 * Si l'event commence avant `startHour` ou se termine après `endHour`, on
 * clip aux bords (top ≥ 0, top+height ≤ totalGridHeight).
 *
 * Renvoie `null` si l'event est entièrement hors de la plage visible.
 */
export function eventToPosition(
  start: string,
  durationMinutes: number,
  g: GridGeometry = DEFAULT_GEOMETRY,
): { top: number; height: number } | null {
  const date = parseISO(start)
  const minutesSinceMidnight = date.getHours() * 60 + date.getMinutes()
  const startMin = g.startHour * 60
  const endMin = g.endHour * 60

  const eventEndMin = minutesSinceMidnight + durationMinutes

  // Entièrement hors plage
  if (eventEndMin <= startMin) return null
  if (minutesSinceMidnight >= endMin) return null

  const clippedStart = Math.max(minutesSinceMidnight, startMin)
  const clippedEnd = Math.min(eventEndMin, endMin)

  const ppm = pxPerMinute(g)
  const rawHeight = (clippedEnd - clippedStart) * ppm
  // Soustrait un micro-gap pour aérer les events adjacents (style Google Cal).
  // On garde une hauteur minimum pour les events très courts.
  const height = Math.max(8, rawHeight - EVENT_VERTICAL_GAP_PX)
  return {
    top: (clippedStart - startMin) * ppm,
    height,
  }
}

/**
 * Détecte les chevauchements et calcule les colonnes pour un layout 50/50
 * (ou 1/n) horizontal.
 *
 * Algorithme : sweep par start ascending. Pour chaque event, on lui assigne la
 * première "colonne" libre (= sans event encore en cours sur cet index). Le
 * "groupe" est l'ensemble des events qui se chevauchent transitivement —
 * tous partagent le même `groupSize` (= max(column)+1 dans le groupe).
 *
 * Sortie : pour chaque event, `{ column, groupSize }`. La largeur affichée se
 * calcule ensuite côté React : `width = 100% / groupSize`, `left = column * width`.
 */
export interface OverlapLayout {
  column: number
  groupSize: number
}

export function computeOverlapLayout(events: AgendaEvent[]): Map<string, OverlapLayout> {
  if (events.length === 0) return new Map()

  // Sort par start ASC, puis par durée DESC pour stabilité
  const sorted = [...events].sort((a, b) => {
    const sa = parseISO(a.start).getTime()
    const sb = parseISO(b.start).getTime()
    if (sa !== sb) return sa - sb
    return b.durationMinutes - a.durationMinutes
  })

  interface Active {
    id: string
    column: number
    endMs: number
    groupId: number
  }

  const result = new Map<string, OverlapLayout>()
  let active: Active[] = []
  let nextGroupId = 0
  // groupId → events dans ce groupe (pour finaliser groupSize)
  const groups = new Map<number, string[]>()

  for (const ev of sorted) {
    const startMs = parseISO(ev.start).getTime()
    const endMs = startMs + ev.durationMinutes * 60_000

    // Purge les actifs terminés AVANT cet event
    active = active.filter((a) => a.endMs > startMs)

    let groupId: number
    let column: number

    if (active.length === 0) {
      // Nouveau groupe
      groupId = nextGroupId++
      column = 0
    } else {
      // Rejoint le groupe d'un actif (peu importe lequel — ils sont tous mergés
      // dès qu'on touche un overlap chain)
      groupId = active[0].groupId
      // Column = première libre
      const usedColumns = new Set(active.map((a) => a.column))
      column = 0
      while (usedColumns.has(column)) column++
    }

    active.push({ id: ev.id, column, endMs, groupId })
    result.set(ev.id, { column, groupSize: 1 }) // placeholder groupSize
    if (!groups.has(groupId)) groups.set(groupId, [])
    groups.get(groupId)!.push(ev.id)
  }

  // Finalize groupSize : pour chaque groupe, max(column)+1
  for (const [, ids] of groups) {
    let maxCol = 0
    for (const id of ids) {
      const r = result.get(id)
      if (r && r.column > maxCol) maxCol = r.column
    }
    const size = maxCol + 1
    for (const id of ids) {
      const r = result.get(id)!
      result.set(id, { column: r.column, groupSize: size })
    }
  }

  return result
}

/**
 * Position du now-indicator relatif au top de la grille. `null` si hors plage.
 */
export function nowIndicatorTop(
  now: Date = new Date(),
  g: GridGeometry = DEFAULT_GEOMETRY,
): number | null {
  const minutesSinceMidnight = now.getHours() * 60 + now.getMinutes()
  const startMin = g.startHour * 60
  const endMin = g.endHour * 60
  if (minutesSinceMidnight < startMin || minutesSinceMidnight >= endMin) return null
  return (minutesSinceMidnight - startMin) * pxPerMinute(g)
}

/**
 * Convertit un `clientY` (relatif au haut de la grille) en heure flottante
 * (ex 9.5 = 9h30). Utilisé par les handlers `onMouseDown` pour drag-to-create
 * et drop-to-reschedule.
 */
export function pixelToHour(
  pixelY: number,
  g: GridGeometry = DEFAULT_GEOMETRY,
): number {
  const minutesFromStart = pixelY / pxPerMinute(g)
  return g.startHour + minutesFromStart / 60
}

/**
 * Snap une heure flottante au quart d'heure le plus proche (00 / 15 / 30 / 45).
 * Utilisé après un drag pour aligner sur la grille fine.
 */
export function snapToQuarter(hour: number): number {
  return Math.round(hour * 4) / 4
}

/** Snap au demi (00 / 30) — slot height par défaut. */
export function snapToHalf(hour: number): number {
  return Math.round(hour * 2) / 2
}

/* ─── Helpers temporels divers ─────────────────────────────────────────────── */

/** Différence en minutes entre deux ISO. Helper pour calls et bookings. */
export function durationFromIsoRange(startIso: string, endIso: string): number {
  return differenceInMinutes(parseISO(endIso), parseISO(startIso))
}

/** Renvoie l'heure d'un ISO sous la forme "HH:mm" sans dépendance moment-like. */
export function isoToHHmm(iso: string): string {
  const d = parseISO(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
