// Supabase-compatible storage adapter backed by OS-level encryption
// (Keychain/Credential Manager/libsecret) via the main process, never
// localStorage. Supabase's SDK only ever needs one key in practice (its own
// session key) — this adapter stores the whole session blob under that key
// and ignores any other key it might try (there shouldn't be one, since
// detectSessionInUrl is off and we only use signInWithOAuth + setSession).
export const secureSessionStorage = {
  async getItem(_key: string): Promise<string | null> {
    return window.closrm.secureStorage.get()
  },
  async setItem(_key: string, value: string): Promise<void> {
    await window.closrm.secureStorage.set(value)
  },
  async removeItem(_key: string): Promise<void> {
    await window.closrm.secureStorage.clear()
  },
}
