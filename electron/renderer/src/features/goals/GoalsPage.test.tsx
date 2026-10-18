import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const get = vi.fn()
const post = vi.fn()
const patch = vi.fn()
const del = vi.fn()
vi.mock('../../lib/api-client', () => ({
  api: {
    get: (...a: unknown[]) => get(...a),
    post: (...a: unknown[]) => post(...a),
    patch: (...a: unknown[]) => patch(...a),
    delete: (...a: unknown[]) => del(...a),
  },
  ApiError: class ApiError extends Error {
    constructor(public status: number, message: string) {
      super(message)
    }
  },
}))

import { GoalsPage } from './GoalsPage'
import { ApiError } from '../../lib/api-client'
import { setCachePartition } from '../../lib/query-cache'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const monthGoal = {
  id: 'm1', parent_id: null, title: 'Poster 3-5 contenus par jour', description: null, horizon: 'month',
  period_start: '2026-10-01', position: 1024, done_at: null, color: null, created_at: '2026-10-01T00:00:00Z',
}
const weekGoal = {
  ...monthGoal, id: 'w1', parent_id: 'm1', title: 'Ecriture + tournage', horizon: 'week', period_start: '2026-10-12',
}

let root: Root
let el: HTMLDivElement
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)) })

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-15T10:00:00'))
  localStorage.clear()
  localStorage.setItem('closrm.goals.tab', 'week')
  setCachePartition(`test-${Math.random()}`)
  for (const f of [get, post, patch, del]) f.mockReset()
  const created: Record<string, unknown>[] = []
  get.mockImplementation(async (url: string) => ({ goals: url.includes('horizon=week') ? [weekGoal, monthGoal, ...created] : [monthGoal] }))
  post.mockImplementation(async (url: string, body: { title: string; position: number }) => {
    if (url === '/api/goals/rollover') return { moved: 0 }
    const goal = { ...weekGoal, ...body, id: `srv-${created.length}`, parent_id: null }
    created.push(goal)
    return { goal }
  })
  patch.mockResolvedValue({ goal: {} })
  el = document.createElement('div')
  document.body.appendChild(el)
  root = createRoot(el)
})

afterEach(() => {
  act(() => root.unmount())
  el.remove()
  vi.useRealTimers()
})

describe('GoalsPage', () => {
  it('affiche les semaines, la semaine courante, la colonne du mois et le fil vers le parent', async () => {
    await act(async () => root.render(<GoalsPage />))
    await flush()
    const titles = [...el.querySelectorAll('.goals-column-title')].map((n) => n.textContent)
    expect(titles.slice(0, 3)).toEqual(['5–11 oct.', '12–18 oct.', '19–25 oct.'])
    expect(titles[titles.length - 1]).toBe('Octobre')
    expect(el.querySelector('.goals-column-head--current .goals-column-title')?.textContent).toBe('12–18 oct.')
    expect(el.textContent).toContain('Ecriture + tournage')
    expect(get).toHaveBeenCalledWith(expect.stringContaining('horizon=week&from=2026-10-05&to=2026-11-08'))
    expect(get).toHaveBeenCalledWith(expect.stringContaining('horizon=month&from=2026-10-01&to=2026-10-31'))
  })

  it('crée un objectif dans la bonne semaine avec Entrée et coche un objectif', async () => {
    await act(async () => root.render(<GoalsPage />))
    await flush()
    const s42 = el.querySelectorAll('.goals-column')[1]
    await act(async () => (s42.querySelector('.goal-add') as HTMLButtonElement).click())
    const input = s42.querySelector('.goal-input') as HTMLInputElement
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
      setter.call(input, 'Tourner 5 reels')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await act(async () => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })))
    expect(post).toHaveBeenCalledWith('/api/goals', expect.objectContaining({ title: 'Tourner 5 reels', horizon: 'week', period_start: '2026-10-12', position: 2048 }))
    expect(s42.textContent).toContain('Tourner 5 reels')
    expect(s42.querySelector('.goal-input')).not.toBeNull() // stays open for the next one

    await act(async () => (s42.querySelector('.goal-check') as HTMLButtonElement).click())
    expect(patch).toHaveBeenCalledWith('/api/goals/w1', { done: true })
  })

  it('vue Horizons : aujourd’hui, semaine, mois, trimestre, année, Vie', async () => {
    localStorage.removeItem('closrm.goals.tab')
    await act(async () => root.render(<GoalsPage />))
    await flush()
    const titles = [...el.querySelectorAll('.goals-column-title')].map((n) => n.textContent)
    expect(titles).toEqual(['15 octobre', '12–18 oct.', 'Octobre 2026', 'T4 2026', '2026', 'Vie'])
    expect(get).toHaveBeenCalledWith('/api/goals?horizon=life')
    const cols = el.querySelectorAll('.goals-column')
    expect(cols[1].textContent).toContain('Ecriture + tournage')
    expect(cols[2].textContent).toContain('Poster 3-5 contenus par jour')

    const vie = cols[5]
    await act(async () => (vie.querySelector('.goal-add') as HTMLButtonElement).click())
    const input = vie.querySelector('.goal-input') as HTMLInputElement
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'Vivre à Bali')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await act(async () => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })))
    expect(post).toHaveBeenCalledWith('/api/goals', expect.objectContaining({ title: 'Vivre à Bali', horizon: 'life', period_start: null }))
  })

  it('vue Horizons : glisser la colonne du mois fait suivre la semaine et le jour', async () => {
    localStorage.removeItem('closrm.goals.tab')
    await act(async () => root.render(<GoalsPage />))
    await flush()
    const month = el.querySelectorAll('.goals-column')[2]
    await act(async () => {
      month.dispatchEvent(new WheelEvent('wheel', { deltaX: 80, deltaY: 2, bubbles: true, cancelable: true }))
    })
    await flush()
    const titles = () => [...el.querySelectorAll('.goals-column-title')].map((n) => n.textContent)
    expect(titles()).toEqual(['1 novembre', '26 oct.–1 nov.', 'Novembre 2026', 'T4 2026', '2026', 'Vie'])
    expect(get).toHaveBeenCalledWith(expect.stringContaining('horizon=month&from=2026-11-01&to=2026-11-01'))

    // ‹ on the month column brings everything back to today.
    const prev = el.querySelectorAll('.goals-column')[2].querySelector('[aria-label="Période précédente"]') as HTMLButtonElement
    await act(async () => prev.click())
    await flush()
    expect(titles()).toEqual(['15 octobre', '12–18 oct.', 'Octobre 2026', 'T4 2026', '2026', 'Vie'])
  })

  it('lance le report des objectifs non faits à l’ouverture, avec la date du jour', async () => {
    await act(async () => root.render(<GoalsPage />))
    await flush()
    expect(post).toHaveBeenCalledWith('/api/goals/rollover', { today: '2026-10-15' })
  })

  it('survoler un objectif allume sa chaîne et estompe le reste', async () => {
    await act(async () => root.render(<GoalsPage />))
    await flush()
    const week = [...el.querySelectorAll('.goal-item')].find((i) => i.textContent?.includes('Ecriture + tournage'))!
    await act(async () => week.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })))
    const month = [...el.querySelectorAll('.goal-item')].find((i) => i.textContent?.includes('Poster 3-5'))!
    expect(week.classList.contains('goal-item--lit')).toBe(true)
    expect(month.classList.contains('goal-item--lit')).toBe(true)
    await act(async () => week.dispatchEvent(new MouseEvent('mouseout', { bubbles: true })))
    expect(month.classList.contains('goal-item--lit')).toBe(false)
  })

  it('montre le message quand la migration manque', async () => {
    get.mockRejectedValue(new ApiError(503, "La table des objectifs n'existe pas encore : applique la migration 127_goals.sql dans Supabase."))
    await act(async () => root.render(<GoalsPage />))
    await flush()
    expect(el.textContent).toContain('127_goals.sql')
  })
})
