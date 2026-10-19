import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const post = vi.fn()
vi.mock('../../lib/api-client', () => ({
  api: { post: (...a: unknown[]) => post(...a) },
  ApiError: class ApiError extends Error {},
}))

import { QuickGoalHost } from '../QuickGoal'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let root: Root
let el: HTMLDivElement
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-19T09:00:00'))
  post.mockReset()
  post.mockResolvedValue({ goal: {} })
  el = document.createElement('div')
  document.body.appendChild(el)
  root = createRoot(el)
})
afterEach(() => {
  act(() => root.unmount())
  el.remove()
  vi.useRealTimers()
})

const type = (input: HTMLInputElement, v: string) => {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, v)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

describe('Saisie rapide (N)', () => {
  it('N ouvre la fenêtre, Entrée range l’idée dans Idées', async () => {
    await act(async () => root.render(<QuickGoalHost />))
    expect(el.querySelector('.quick-goal-modal')).toBeNull()
    await act(async () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'n' })))
    const input = el.querySelector('.quick-goal-input') as HTMLInputElement
    expect(input).not.toBeNull()
    await act(async () => type(input, 'Reel avant/après de Lucas'))
    await act(async () => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })))
    expect(post).toHaveBeenCalledWith('/api/goals', { title: 'Reel avant/après de Lucas', horizon: 'inbox', period_start: null })
  })

  it('« Cette semaine » range sur le lundi de la semaine', async () => {
    await act(async () => root.render(<QuickGoalHost />))
    await act(async () => window.dispatchEvent(new Event('closrm:quick-goal')))
    const chip = [...el.querySelectorAll('.quick-goal-chip')].find((b) => b.textContent === 'Cette semaine') as HTMLButtonElement
    await act(async () => chip.click())
    const input = el.querySelector('.quick-goal-input') as HTMLInputElement
    await act(async () => type(input, 'Relancer Paul'))
    await act(async () => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })))
    expect(post).toHaveBeenCalledWith('/api/goals', { title: 'Relancer Paul', horizon: 'week', period_start: '2026-10-19' })
  })

  it('N ne s’ouvre pas pendant qu’on tape dans un champ', async () => {
    await act(async () => root.render(<QuickGoalHost />))
    const field = document.createElement('input')
    document.body.appendChild(field)
    field.focus()
    await act(async () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'n' })))
    expect(el.querySelector('.quick-goal-modal')).toBeNull()
    field.remove()
  })
})
