/**
 * Tests purs pour `positioning.ts`. Pas de framework — exécution manuelle :
 *
 *   npx tsx src/lib/agenda/positioning.test.ts
 *
 * Sortie : "OK 12/12" en cas de succès, sinon liste des tests cassés et
 * `process.exit(1)` pour intégration CI éventuelle plus tard.
 *
 * Si on installe Vitest plus tard (Phase 5+), ces fonctions `assertEqual` et
 * la table de tests seront triviales à porter.
 */

import {
  computeOverlapLayout,
  DEFAULT_GEOMETRY,
  EVENT_VERTICAL_GAP_PX,
  eventToPosition,
  isoToHHmm,
  nowIndicatorTop,
  pixelToHour,
  pxPerMinute,
  snapToHalf,
  snapToQuarter,
  totalGridHeight,
} from './positioning'
import type { AgendaEvent } from '@/types/agenda'

let passed = 0
let failed = 0
const failures: string[] = []

function assert(name: string, condition: boolean, detail?: string) {
  if (condition) {
    passed++
  } else {
    failed++
    failures.push(`✗ ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

function assertEqual<T>(name: string, actual: T, expected: T) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  assert(name, ok, ok ? undefined : `got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`)
}

function makeEvent(id: string, start: string, durationMinutes: number): AgendaEvent {
  return {
    id,
    kind: 'booking',
    start,
    durationMinutes,
    color: '#000',
    title: id,
    subtitle: null,
    lead: null,
    booking: {} as never,
  }
}

/* ─── Geometry basics ─────────────────────────────────────────────────────── */

assertEqual('pxPerMinute default = 32/30', pxPerMinute(), 32 / 30)
assertEqual('totalGridHeight 0→24', totalGridHeight(), (24 - 0) * 2 * 32)

/* ─── eventToPosition ─────────────────────────────────────────────────────── */
// Note : la hauteur retournée intègre EVENT_VERTICAL_GAP_PX soustrait pour
// aérer les events adjacents.

// Event simple : 9h00 durée 30min → top = 9*60*ppm, height = 30*ppm − gap
{
  const r = eventToPosition('2026-05-02T09:00:00', 30)
  assertEqual('eventToPosition 9h00 30min .top', r?.top, 9 * 60 * pxPerMinute())
  assertEqual('eventToPosition 9h00 30min .height', r?.height, 30 * pxPerMinute() - EVENT_VERTICAL_GAP_PX)
}

// Event durée 1h commence à 8h30 → top = 8.5*60*ppm, height = 60*ppm − gap
{
  const r = eventToPosition('2026-05-02T08:30:00', 60)
  assertEqual('eventToPosition 8h30 60min .top', r?.top, 8.5 * 60 * pxPerMinute())
  assertEqual('eventToPosition 8h30 60min .height', r?.height, 60 * pxPerMinute() - EVENT_VERTICAL_GAP_PX)
}

// Avec startHour=0, plus de clipping en début/fin pour des heures normales.
// On garde des cas de test pour les events vraiment hors-jour (jamais en pratique).

/* ─── computeOverlapLayout ───────────────────────────────────────────────── */

// Aucun overlap : tous column=0 groupSize=1
{
  const evs = [
    makeEvent('a', '2026-05-02T09:00:00', 30),
    makeEvent('b', '2026-05-02T10:00:00', 30),
  ]
  const layout = computeOverlapLayout(evs)
  assertEqual('no-overlap a column', layout.get('a')?.column, 0)
  assertEqual('no-overlap a groupSize', layout.get('a')?.groupSize, 1)
  assertEqual('no-overlap b column', layout.get('b')?.column, 0)
  assertEqual('no-overlap b groupSize', layout.get('b')?.groupSize, 1)
}

// Deux events overlap → 50/50
{
  const evs = [
    makeEvent('a', '2026-05-02T09:00:00', 60),
    makeEvent('b', '2026-05-02T09:30:00', 60),
  ]
  const layout = computeOverlapLayout(evs)
  assertEqual('overlap-2 a column', layout.get('a')?.column, 0)
  assertEqual('overlap-2 b column', layout.get('b')?.column, 1)
  assertEqual('overlap-2 a groupSize', layout.get('a')?.groupSize, 2)
  assertEqual('overlap-2 b groupSize', layout.get('b')?.groupSize, 2)
}

// Trois events overlap → 33/33/33
{
  const evs = [
    makeEvent('a', '2026-05-02T09:00:00', 90),
    makeEvent('b', '2026-05-02T09:15:00', 90),
    makeEvent('c', '2026-05-02T09:30:00', 90),
  ]
  const layout = computeOverlapLayout(evs)
  assertEqual('overlap-3 a column', layout.get('a')?.column, 0)
  assertEqual('overlap-3 b column', layout.get('b')?.column, 1)
  assertEqual('overlap-3 c column', layout.get('c')?.column, 2)
  for (const id of ['a', 'b', 'c']) {
    assertEqual(`overlap-3 ${id} groupSize`, layout.get(id)?.groupSize, 3)
  }
}

// Réutilisation de colonne : a (9-10), b (9-10), c (10:15-11)
// → a col0, b col1, c reuse col0 (active vide après 10:00)
{
  const evs = [
    makeEvent('a', '2026-05-02T09:00:00', 60),
    makeEvent('b', '2026-05-02T09:00:00', 60),
    makeEvent('c', '2026-05-02T10:15:00', 45),
  ]
  const layout = computeOverlapLayout(evs)
  assertEqual('reuse-col c column', layout.get('c')?.column, 0)
  assertEqual('reuse-col c groupSize', layout.get('c')?.groupSize, 1)
  assertEqual('reuse-col a groupSize', layout.get('a')?.groupSize, 2)
}

/* ─── nowIndicator ───────────────────────────────────────────────────────── */

{
  const noon = new Date('2026-05-02T12:00:00')
  const top = nowIndicatorTop(noon)
  assertEqual('now at noon', top, 12 * 60 * pxPerMinute())
}

/* ─── pixelToHour / snap ─────────────────────────────────────────────────── */

assertEqual('pixelToHour 0px = startHour', pixelToHour(0), DEFAULT_GEOMETRY.startHour)
assertEqual('pixelToHour 64px = startHour+1', pixelToHour(64), DEFAULT_GEOMETRY.startHour + 1)
assertEqual('snapToQuarter 9.4 → 9.5', snapToQuarter(9.4), 9.5)
assertEqual('snapToQuarter 9.13 → 9.25', snapToQuarter(9.13), 9.25)
assertEqual('snapToHalf 9.4 → 9.5', snapToHalf(9.4), 9.5)
assertEqual('snapToHalf 9.2 → 9.0', snapToHalf(9.2), 9.0)

/* ─── isoToHHmm ──────────────────────────────────────────────────────────── */

assertEqual('isoToHHmm 9h05', isoToHHmm('2026-05-02T09:05:00'), '09:05')
assertEqual('isoToHHmm 14h30', isoToHHmm('2026-05-02T14:30:00'), '14:30')

/* ─── Récap ──────────────────────────────────────────────────────────────── */

const total = passed + failed
if (failed > 0) {
  console.error(`\nFAIL ${failed}/${total}\n`)
  for (const f of failures) console.error(f)
  process.exit(1)
} else {
  console.log(`OK ${passed}/${total}`)
}
