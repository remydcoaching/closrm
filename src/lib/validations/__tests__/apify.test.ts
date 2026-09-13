import { describe, it, expect } from 'vitest'
import { watchedPostCreateSchema } from '../apify'

describe('watchedPostCreateSchema', () => {
  it('accepts a valid Instagram post URL', () => {
    const result = watchedPostCreateSchema.safeParse({
      instagram_post_url: 'https://www.instagram.com/reel/CxYz123AbC/',
      label: 'Reel objection prix',
    })
    expect(result.success).toBe(true)
  })

  it('rejects a non-Instagram URL', () => {
    const result = watchedPostCreateSchema.safeParse({
      instagram_post_url: 'https://example.com/not-instagram',
    })
    expect(result.success).toBe(false)
  })

  it('rejects a missing instagram_post_url', () => {
    const result = watchedPostCreateSchema.safeParse({ label: 'no url' })
    expect(result.success).toBe(false)
  })

  it('allows label to be omitted', () => {
    const result = watchedPostCreateSchema.safeParse({
      instagram_post_url: 'https://www.instagram.com/p/CxYz123AbC/',
    })
    expect(result.success).toBe(true)
  })
})
