import { describe, expect, it } from 'vitest'
import {
  addSequenceEmail,
  emailStepNumber,
  formatDuration,
  formatPercent,
  htmlToPlainLine,
  htmlToText,
  normalizeWorkspaceSlug,
  percent,
  publicFunnelPath,
  removeSequenceStep,
  shortAgo,
  stepLabel,
  textToEmailHtml,
  triggerLabel,
} from '../format'

describe('percent / formatPercent', () => {
  it('returns null on empty denominator', () => {
    expect(percent(3, 0)).toBeNull()
    expect(formatPercent(null)).toBe('—')
  })
  it('rounds to one decimal', () => {
    expect(percent(1, 3)).toBe(33.3)
    expect(formatPercent(12.5)).toMatch(/^12,5\s%$/)
  })
})

describe('shortAgo', () => {
  const now = new Date('2026-09-25T12:00:00Z').getTime()
  it('matches the web ConversationList buckets', () => {
    expect(shortAgo('2026-09-25T11:59:40Z', now)).toBe("à l'instant")
    expect(shortAgo('2026-09-25T11:55:00Z', now)).toBe('5m')
    expect(shortAgo('2026-09-25T09:00:00Z', now)).toBe('3h')
    expect(shortAgo('2026-09-23T12:00:00Z', now)).toBe('2j')
    expect(shortAgo('2026-09-04T12:00:00Z', now)).toBe('3sem')
    expect(shortAgo(null, now)).toBe('')
    expect(shortAgo('2026-09-26T12:00:00Z', now)).toBe('')
  })
})

describe('formatDuration', () => {
  it('ms / s / pending', () => {
    expect(formatDuration('2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.850Z')).toBe('850ms')
    expect(formatDuration('2026-01-01T00:00:00Z', '2026-01-01T00:00:02.400Z')).toBe('2.4s')
    expect(formatDuration('2026-01-01T00:00:00Z', null)).toBe('-')
  })
})

describe('workspace slug + public funnel path', () => {
  it('normalizes like the web WorkspaceNameModal', () => {
    expect(normalizeWorkspaceSlug('  Rémy Coaching!! ')).toBe('remy-coaching')
  })
  it('needs every slug', () => {
    expect(publicFunnelPath('ws', 'f', 'p')).toBe('/f/ws/f/p')
    expect(publicFunnelPath(null, 'f', 'p')).toBeNull()
    expect(publicFunnelPath('ws', 'f', null)).toBeNull()
  })
})

describe('email text helpers', () => {
  it('textToEmailHtml escapes and builds paragraphs', () => {
    expect(textToEmailHtml('Salut <b>\nligne 2\n\nParagraphe')).toBe('<p>Salut &lt;b&gt;<br>ligne 2</p><p>Paragraphe</p>')
  })
  it('htmlToText / htmlToPlainLine', () => {
    expect(htmlToText('<p>A&amp;B</p><p>C<br>D</p>')).toBe('A&B\n\nC\nD')
    expect(htmlToPlainLine('<p>A</p><p>B</p>')).toBe('A B')
  })
})

describe('sequence timeline', () => {
  it('adds a 1-day delay before every email but the first', () => {
    const one = addSequenceEmail([])
    expect(one).toHaveLength(1)
    const two = addSequenceEmail(one)
    expect(two.map((s) => s.step_type)).toEqual(['action', 'delay', 'action'])
    expect(two[1]).toMatchObject({ delay_value: 1, delay_unit: 'days' })
    expect(emailStepNumber(two, 2)).toBe(2)
  })
  it('removing an email also removes its preceding delay', () => {
    const three = addSequenceEmail(addSequenceEmail(addSequenceEmail([])))
    expect(removeSequenceStep(three, 2).map((s) => s.step_type)).toEqual(['action', 'delay', 'action'])
    expect(removeSequenceStep(three, 0).map((s) => s.step_type)).toEqual(['delay', 'action', 'delay', 'action'])
  })
})

describe('labels', () => {
  it('trigger and step labels', () => {
    expect(triggerLabel('new_lead')).toBe('Nouveau lead')
    expect(triggerLabel('unknown_x')).toBe('unknown_x')
    expect(stepLabel({ step_type: 'delay', delay_value: 2, delay_unit: 'days' })).toBe('Attendre 2 jours')
    expect(stepLabel({ step_type: 'action', action_type: 'send_email' })).toBe('Envoyer un email')
    expect(stepLabel({ step_type: 'action', action_type: null })).toBe('Action non configurée')
  })
})
