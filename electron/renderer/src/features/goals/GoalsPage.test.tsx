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

  it('compteur 3/10 : + envoie 4, − envoie 2', async () => {
    get.mockImplementation(async (url: string) => ({
      goals: url.includes('horizon=week') ? [{ ...weekGoal, series_id: weekGoal.id, repeats: true, target: 10, progress: 3 }, monthGoal] : [monthGoal],
    }))
    await act(async () => root.render(<GoalsPage />))
    await flush()
    expect(el.querySelector('.goal-counter-value')?.textContent).toBe('3/10')
    expect(el.textContent).toContain('↻')
    await act(async () => (el.querySelector('[aria-label="Ajouter 1"]') as HTMLButtonElement).click())
    expect(patch).toHaveBeenCalledWith('/api/goals/w1', { progress: 4 })
  })

  it('arrêter la répétition retire le ↻', async () => {
    let repeats = true
    get.mockImplementation(async (url: string) => ({
      goals: url.includes('horizon=week') ? [{ ...weekGoal, series_id: weekGoal.id, repeats, target: 4, progress: 1 }, monthGoal] : [monthGoal],
    }))
    patch.mockImplementation(async (_url: string, body: { repeats?: boolean }) => {
      if (body.repeats !== undefined) repeats = body.repeats
      return { goal: {} }
    })
    await act(async () => root.render(<GoalsPage />))
    await flush()
    const item = [...el.querySelectorAll('.goal-item')].find((i) => i.textContent?.includes('Ecriture + tournage'))!
    expect(item.querySelector('.goal-repeat')).not.toBeNull()
    await act(async () => (item.querySelector('.goal-more') as HTMLButtonElement).click())
    const stop = [...item.querySelectorAll('.goal-menu button')].find((b) => b.textContent === 'Arrêter la répétition') as HTMLButtonElement
    await act(async () => stop.click())
    expect(patch).toHaveBeenCalledWith('/api/goals/w1', { repeats: false })
    const after = [...el.querySelectorAll('.goal-item')].find((i) => i.textContent?.includes('Ecriture + tournage'))!
    expect(after.querySelector('.goal-repeat')).toBeNull()
  })

  it('menu : répéter chaque semaine avec un nombre', async () => {
    await act(async () => root.render(<GoalsPage />))
    await flush()
    const item = [...el.querySelectorAll('.goal-item')].find((i) => i.textContent?.includes('Ecriture + tournage'))!
    await act(async () => (item.querySelector('.goal-more') as HTMLButtonElement).click())
    const repeat = [...item.querySelectorAll('.goal-menu button')].find((b) => b.textContent === 'Répéter chaque semaine') as HTMLButtonElement
    await act(async () => repeat.click())
    const input = item.querySelector('.goal-repeat-form input') as HTMLInputElement
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, '10')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await act(async () => (item.querySelector('.goal-repeat-form') as HTMLFormElement).requestSubmit())
    expect(patch).toHaveBeenCalledWith('/api/goals/w1', { repeats: true, target: 10, repeat_until: null })
  })

  it('menu : 4 posts par semaine pendant 8 semaines', async () => {
    await act(async () => root.render(<GoalsPage />))
    await flush()
    const item = [...el.querySelectorAll('.goal-item')].find((i) => i.textContent?.includes('Ecriture + tournage'))!
    await act(async () => (item.querySelector('.goal-more') as HTMLButtonElement).click())
    const repeat = [...item.querySelectorAll('.goal-menu button')].find((b) => b.textContent === 'Répéter chaque semaine') as HTMLButtonElement
    await act(async () => repeat.click())
    const [target, count] = [...item.querySelectorAll('.goal-repeat-form input')] as HTMLInputElement[]
    const type = (input: HTMLInputElement, v: string) => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, v)
      input.dispatchEvent(new Event('input', { bubbles: true }))
    }
    await act(async () => { type(target, '4'); type(count, '8') })
    await act(async () => (item.querySelector('.goal-repeat-form') as HTMLFormElement).requestSubmit())
    // S42 (12 oct.) + 7 semaines = S49, qui finit le 6 déc.
    expect(patch).toHaveBeenCalledWith('/api/goals/w1', { repeats: true, target: 4, repeat_until: '2026-12-06' })
  })

  it('un objectif déjà planifié plus bas affiche « → S43 »', async () => {
    const slice = { ...monthGoal, id: 'm1-w', parent_id: 'm1', horizon: 'week', period_start: '2026-10-19' }
    get.mockImplementation(async (url: string) => ({
      goals: url.includes('horizon=week') ? [weekGoal, monthGoal, slice] : [monthGoal, slice],
    }))
    await act(async () => root.render(<GoalsPage />))
    await flush()
    const month = el.querySelector('.goals-parent-column .goal-item')!
    expect(month.querySelector('.goal-planned')?.textContent?.trim()).toBe('→ S43')
    expect(month.querySelector('.goal-planned')?.getAttribute('title')).toContain('S43 · 19–25 oct.')
  })

  it('Horizons : les copies restent visibles, en discret avec ↳', async () => {
    localStorage.removeItem('closrm.goals.tab')
    const base = { description: null, position: 1024, done_at: null, color: null, created_at: '2026-10-01T00:00:00Z' }
    const chain = [
      { ...base, id: 'q', parent_id: null, title: 'Permis', horizon: 'quarter', period_start: '2026-10-01' },
      { ...base, id: 'qm', parent_id: 'q', title: 'Permis', horizon: 'month', period_start: '2026-10-01' },
      { ...base, id: 'qw', parent_id: 'qm', title: 'Permis', horizon: 'week', period_start: '2026-10-12' },
    ]
    get.mockImplementation(async () => ({ goals: chain }))
    await act(async () => root.render(<GoalsPage />))
    await flush()
    const cols = el.querySelectorAll('.goals-column')
    expect(cols[2].querySelector('.goal-item--copy')?.textContent).toContain('Permis') // Octobre still shows it
    expect(cols[3].querySelector('.goal-item--copy')).toBeNull() // the original
    expect(cols[3].querySelector('.goal-planned')?.textContent?.trim()).toBe('→ oct.')
  })

  it('« Auj. » pose un objectif de la semaine sur aujourd’hui', async () => {
    await act(async () => root.render(<GoalsPage />))
    await flush()
    const item = [...el.querySelectorAll('.goal-item')].find((i) => i.textContent?.includes('Ecriture + tournage'))!
    await act(async () => (item.querySelector('.goal-quickplan') as HTMLButtonElement).click())
    expect(post).toHaveBeenCalledWith('/api/goals', expect.objectContaining({ title: 'Ecriture + tournage', horizon: 'day', period_start: '2026-10-15', parent_id: 'w1' }))
  })

  it('cocher la copie du jour d’un objectif à compteur ajoute 1 au compteur de la semaine', async () => {
    const counter = { ...weekGoal, series_id: 'w1', repeats: true, target: 4, progress: 1 }
    const daySlice = { ...weekGoal, id: 'd1', parent_id: 'w1', horizon: 'day', period_start: '2026-10-15' }
    get.mockImplementation(async () => ({ goals: [counter, monthGoal, daySlice] }))
    localStorage.removeItem('closrm.goals.tab')
    await act(async () => root.render(<GoalsPage />))
    await flush()
    const today = el.querySelectorAll('.goals-column')[0]
    let resolve: (v: unknown) => void = () => {}
    patch.mockImplementation(() => new Promise((r) => { resolve = r }))
    await act(async () => (today.querySelector('.goal-check') as HTMLButtonElement).click())
    // optimistic, before the server answers
    expect(el.querySelectorAll('.goals-column')[1].querySelector('.goal-counter-value')?.textContent).toBe('2/4')
    // the day copy shows the week's counter too
    expect(today.querySelector('.goal-counter-value')?.textContent).toBe('2/4')
    expect(today.querySelector('.goal-counter-scope')?.textContent).toBe('cette semaine')
    resolve({ goal: {} })
  })

  it('montre le message quand la migration manque', async () => {
    get.mockRejectedValue(new ApiError(503, "La table des objectifs n'existe pas encore : applique la migration 127_goals.sql dans Supabase."))
    await act(async () => root.render(<GoalsPage />))
    await flush()
    expect(el.textContent).toContain('127_goals.sql')
  })
})
