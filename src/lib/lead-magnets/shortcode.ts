import { randomBytes } from 'crypto'

const ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
const LENGTH = 6

/**
 * Génère un short_code aléatoire en base62.
 * Longueur 6 → ~56 milliards de combinaisons.
 */
export function generateShortCode(): string {
  const bytes = randomBytes(LENGTH)
  let code = ''
  for (let i = 0; i < LENGTH; i++) {
    code += ALPHABET[bytes[i] % ALPHABET.length]
  }
  return code
}
