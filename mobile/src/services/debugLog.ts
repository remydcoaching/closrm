import * as SecureStore from 'expo-secure-store'

const KEY = 'closrm.debug.log'
const MAX_LINES = 200
// SecureStore plafonne à 2KB par valeur — on garde une marge large.
const MAX_CHARS = 1800

let buffer: string[] = []
let loaded = false

async function ensureLoaded() {
  if (loaded) return
  try {
    const raw = await SecureStore.getItemAsync(KEY)
    buffer = raw ? raw.split('\n') : []
  } catch {
    buffer = []
  }
  loaded = true
}

async function persist() {
  try {
    let joined = buffer.join('\n')
    while (joined.length > MAX_CHARS && buffer.length > 0) {
      buffer.shift()
      joined = buffer.join('\n')
    }
    await SecureStore.setItemAsync(KEY, joined)
  } catch {
    // best-effort — ne doit jamais faire planter l'app lui-même
  }
}

export async function logDebug(message: string) {
  await ensureLoaded()
  const line = `${new Date().toLocaleTimeString('fr-FR')} — ${message}`
  buffer.push(line)
  if (buffer.length > MAX_LINES) buffer.shift()
  await persist()
}

export async function readDebugLog(): Promise<string> {
  await ensureLoaded()
  return buffer.length ? buffer.join('\n') : 'Aucun log pour le moment.'
}

export async function clearDebugLog() {
  buffer = []
  loaded = true
  try {
    await SecureStore.deleteItemAsync(KEY)
  } catch {
    // ignore
  }
}
