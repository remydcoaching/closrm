import { describe, it, expect } from 'vitest'
import { pickTemplate } from '../templates'

describe('pickTemplate', () => {
  it('returns the first-message template for premier_message category', () => {
    const result = pickTemplate('premier_message', { firstName: 'Marie', daysSinceLastContact: null })
    expect(result.label).toBe('Premier message')
    expect(result.text).toContain('Marie')
  })

  it('returns the standard relaunch template for relance_en_retard', () => {
    const result = pickTemplate('relance_en_retard', { firstName: 'Karim', daysSinceLastContact: 8 })
    expect(result.label).toBe('Relance')
    expect(result.text).toContain('Karim')
  })

  it('returns the long-absence template with day count for jamais_recontacte', () => {
    const result = pickTemplate('jamais_recontacte', { firstName: 'Karim', daysSinceLastContact: 61 })
    expect(result.label).toBe('Reprise après 61 jours')
    expect(result.text).toContain('Karim')
  })
})
