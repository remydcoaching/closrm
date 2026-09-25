import { describe, expect, it } from 'vitest'
import { toCsv } from '../csv'

describe('toCsv', () => {
  it('joins with ; and quotes cells containing separators or quotes', () => {
    expect(toCsv([['a', 1, null], ['x;y', 'say "hi"', undefined]])).toBe('a;1;\n"x;y";"say ""hi""";')
  })
})
