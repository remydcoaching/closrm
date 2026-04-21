/**
 * Retry avec exponential backoff pour les appels AWS SES qui peuvent échouer
 * sur des erreurs transitoires :
 *   - ThrottlingException (tu dépasses le rate limit SES du compte)
 *   - ServiceUnavailable / InternalServiceError (AWS a un souci côté infra)
 *   - TooManyRequestsException
 *
 * Les autres erreurs (MessageRejected, MailFromDomainNotVerified, etc.)
 * ne sont PAS retry — elles sont définitives et un retry ne changera rien.
 *
 * Délais : 1s → 4s → 16s (~21s total pour 3 tentatives). Gardé court pour
 * ne pas bloquer les routes Vercel (timeout 300s par défaut, mais on veut
 * rester loin du bord).
 */

const RETRY_DELAYS_MS = [1000, 4000, 16000] // 3 retries total

const TRANSIENT_ERROR_NAMES = new Set([
  'ThrottlingException',
  'TooManyRequestsException',
  'ServiceUnavailable',
  'InternalServiceError',
  'InternalServerError',
  'RequestThrottled',
])

function isTransientSesError(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  // Le SDK AWS v3 met le code d'erreur dans `name`
  if (TRANSIENT_ERROR_NAMES.has(err.name)) return true
  // Fallback : check le message (au cas où le SDK serait mis à jour)
  const msg = err.message.toLowerCase()
  return msg.includes('throttl') || msg.includes('rate exceeded') || msg.includes('try again')
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Exécute une fonction async avec retry sur erreurs SES transitoires.
 * Throw l'erreur finale si toutes les tentatives échouent.
 */
export async function retrySesCall<T>(fn: () => Promise<T>, label = 'ses-call'): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      if (!isTransientSesError(err) || attempt === RETRY_DELAYS_MS.length) {
        throw err
      }
      const delay = RETRY_DELAYS_MS[attempt]
      console.warn(
        `[${label}] transient SES error, retry in ${delay}ms (attempt ${attempt + 1}/${RETRY_DELAYS_MS.length + 1})`,
        err instanceof Error ? err.name : err,
      )
      await sleep(delay)
    }
  }
  throw lastError
}
