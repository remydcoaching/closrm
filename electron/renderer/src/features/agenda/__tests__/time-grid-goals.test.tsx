import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TimeGridView, type AgendaGoal } from '../TimeGridView'
import { PX_PER_MINUTE } from '../agenda-utils'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const day = new Date(2026, 9, 19) // lundi 19 oct.
const goals: AgendaGoal[] = [
  { id: 'a', title: 'Ecriture reels', done: false, day: '2026-10-19', scheduledAt: null, durationMinutes: 60 },
  { id: 'b', title: 'Tournage', done: false, day: '2026-10-19', scheduledAt: new Date(2026, 9, 19, 14, 0).toISOString(), durationMinutes: 90 },
]

let root: Root
let el: HTMLDivElement
beforeEach(() => {
  el = document.createElement('div')
  document.body.appendChild(el)
  root = createRoot(el)
})
afterEach(() => {
  act(() => root.unmount())
  el.remove()
})

function render(props: Partial<Parameters<typeof TimeGridView>[0]> = {}) {
  return act(async () =>
    root.render(
      <TimeGridView
        days={[day]}
        events={[]}
        highlightedId={null}
        onEventClick={() => {}}
        onSlotCreate={() => {}}
        onEventMove={() => {}}
        onEventResize={() => {}}
        goals={goals}
        {...props}
      />,
    ),
  )
}

describe('TimeGridView — objectifs du jour', () => {
  it('bandeau = objectifs sans heure, grille = objectifs placés', async () => {
    await render()
    expect(el.querySelector('.agenda-goal-strip')?.textContent).toContain('Ecriture reels')
    expect(el.querySelector('.agenda-goal-strip')?.textContent).not.toContain('Tournage')
    const block = el.querySelector('.agenda-goal-block') as HTMLElement
    expect(block.textContent).toContain('Tournage')
    expect(block.style.top).toBe(`${14 * 60 * PX_PER_MINUTE}px`)
  })

  it('cocher dans le bandeau', async () => {
    const onGoalToggle = vi.fn()
    await render({ onGoalToggle })
    await act(async () => (el.querySelector('.agenda-goal-strip .agenda-goal-check') as HTMLButtonElement).click())
    expect(onGoalToggle).toHaveBeenCalledWith('a')
  })

  it('glisser du bandeau vers 9:00 place l’objectif', async () => {
    const onGoalSchedule = vi.fn()
    await render({ onGoalSchedule })
    const columns = el.querySelector('.agenda-columns') as HTMLElement
    const strip = el.querySelector('.agenda-goal-strip') as HTMLElement
    columns.getBoundingClientRect = () => ({ left: 0, top: 100, width: 300, height: 1536, right: 300, bottom: 1636, x: 0, y: 100, toJSON() {} })
    strip.getBoundingClientRect = () => ({ left: 0, top: 50, width: 300, height: 40, right: 300, bottom: 90, x: 0, y: 50, toJSON() {} })
    const chip = el.querySelector('.agenda-goal-chip') as HTMLElement
    await act(async () => chip.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0, clientX: 50, clientY: 70 })))
    const y9 = 100 + 9 * 60 * PX_PER_MINUTE
    await act(async () => window.dispatchEvent(new MouseEvent('mousemove', { clientX: 60, clientY: y9 })))
    await act(async () => window.dispatchEvent(new MouseEvent('mouseup', { clientX: 60, clientY: y9 })))
    expect(onGoalSchedule).toHaveBeenCalledWith('a', '2026-10-19', new Date(2026, 9, 19, 9, 0).toISOString(), 60)
  })
})
