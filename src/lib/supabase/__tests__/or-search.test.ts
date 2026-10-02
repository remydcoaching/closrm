import { describe, expect, it } from 'vitest'
import { orSearchTerm } from '../or-search'

describe('orSearchTerm', () => {
  it('keeps a normal search', () => expect(orSearchTerm('  Jean Dupont ')).toBe('Jean Dupont'))
  it('cannot close the value or add a condition', () => {
    const t = orSearchTerm('x%,status.eq.dead),(id.neq.1')
    expect(t).not.toMatch(/[,()]/)
    expect(t).toBe('x\\% status.eq.dead id.neq.1')
  })
  it('escapes LIKE wildcards, drops quotes and backslashes', () => expect(orSearchTerm('a_b "c" \\d')).toBe('a\\_b c d'))
  it('caps the length', () => expect(orSearchTerm('a'.repeat(300))).toHaveLength(100))
})
