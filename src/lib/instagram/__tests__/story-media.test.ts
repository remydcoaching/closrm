import { describe, expect, it } from 'vitest'
import { isAllowedMediaUrl } from '../story-media'

describe('isAllowedMediaUrl', () => {
  it('accepts Instagram CDN https URLs only', () => {
    expect(isAllowedMediaUrl('https://scontent-cdg4-1.cdninstagram.com/v/t51/x.jpg?a=1')).toBe(true)
    expect(isAllowedMediaUrl('https://video.xx.fbcdn.net/v/x.mp4')).toBe(true)
    expect(isAllowedMediaUrl('http://scontent.cdninstagram.com/x.jpg')).toBe(false)
    expect(isAllowedMediaUrl('https://evil.com/cdninstagram.com.jpg')).toBe(false)
    expect(isAllowedMediaUrl('https://cdninstagram.com.evil.com/x')).toBe(false)
    expect(isAllowedMediaUrl('https://169.254.169.254/latest/meta-data')).toBe(false)
    expect(isAllowedMediaUrl('https://user:pw@scontent.cdninstagram.com/x')).toBe(false)
    expect(isAllowedMediaUrl('not a url')).toBe(false)
  })
})
