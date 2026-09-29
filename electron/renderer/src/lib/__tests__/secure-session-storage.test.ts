import { describe, it, expect, vi, beforeEach } from 'vitest'
import { secureSessionStorage } from '../secure-session-storage'

describe('secureSessionStorage', () => {
  beforeEach(() => {
    // @ts-expect-error test shim for the preload-exposed bridge
    window.closrm = {
      secureStorage: {
        get: vi.fn().mockResolvedValue('encrypted-session-blob'),
        set: vi.fn().mockResolvedValue(undefined),
        clear: vi.fn().mockResolvedValue(undefined),
      },
    }
  })

  it('delegates getItem to the IPC-backed secure storage, never localStorage', async () => {
    const result = await secureSessionStorage.getItem('any-key')
    expect(result).toBe('encrypted-session-blob')
    expect(window.closrm.secureStorage.get).toHaveBeenCalled()
  })

  it('delegates setItem to secure storage with the raw session value', async () => {
    await secureSessionStorage.setItem('any-key', 'session-json')
    expect(window.closrm.secureStorage.set).toHaveBeenCalledWith('session-json')
  })

  it('delegates removeItem to secure storage clear (logout path)', async () => {
    await secureSessionStorage.removeItem('any-key')
    expect(window.closrm.secureStorage.clear).toHaveBeenCalled()
  })

  it('never touches window.localStorage for session data', async () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem')
    await secureSessionStorage.setItem('any-key', 'session-json')
    expect(setItemSpy).not.toHaveBeenCalled()
    setItemSpy.mockRestore()
  })
})
