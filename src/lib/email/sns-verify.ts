/**
 * Vérification des notifications SNS (webhooks SES).
 *
 *   1. verifySnsSignature : signature cryptographique AWS (certificat de
 *      sns.<region>.amazonaws.com, RSA-SHA1 v1 / RSA-SHA256 v2 sur les champs
 *      canonicalisés) — sans elle, quiconque connaît le TopicArn forgeait des
 *      e-mails entrants, des bounces (suppressions) ou faisait GET une URL.
 *      Coupable en urgence avec SNS_VERIFY=off.
 *   2. isAllowedSnsTopic : nos topics connus (SES_EXPECTED_TOPIC_ARNS, CSV).
 */
import { createVerify } from 'crypto'

export interface SnsNotificationLike {
  TopicArn?: string
  Type?: string
}

/**
 * Retourne true si la notification provient d'un topic attendu, ou si aucun
 * filtre n'est configuré (rétro-compat — on laisse passer mais on pourrait
 * durcir plus tard).
 */
export function isAllowedSnsTopic(envelope: SnsNotificationLike): boolean {
  const allowed = process.env.SES_EXPECTED_TOPIC_ARNS
  if (!allowed) {
    // Pas de filtre configuré → rétro-compat, on accepte. Log une fois au boot.
    return true
  }
  const topicArn = envelope.TopicArn
  if (!topicArn) return false
  const allowedList = allowed.split(',').map((s) => s.trim()).filter(Boolean)
  return allowedList.includes(topicArn)
}

export interface SnsSignedEnvelope extends SnsNotificationLike {
  Message?: string
  MessageId?: string
  Subject?: string
  Timestamp?: string
  Token?: string
  SubscribeURL?: string
  Signature?: string
  SignatureVersion?: string
  SigningCertURL?: string
}

const AWS_SNS_HOST = /^sns\.[a-z0-9-]+\.amazonaws\.com(\.cn)?$/

/** An https URL served by SNS itself (signing certificate, subscription confirmation). */
export function isSnsUrl(raw: string | undefined): boolean {
  if (!raw) return false
  try {
    const u = new URL(raw)
    return u.protocol === 'https:' && AWS_SNS_HOST.test(u.hostname)
  } catch {
    return false
  }
}

/** Pure: the canonical string AWS signs, per message type. */
export function snsStringToSign(e: SnsSignedEnvelope): string | null {
  const keys =
    e.Type === 'Notification'
      ? ['Message', 'MessageId', ...(e.Subject !== undefined ? ['Subject'] : []), 'Timestamp', 'TopicArn', 'Type']
      : e.Type === 'SubscriptionConfirmation' || e.Type === 'UnsubscribeConfirmation'
        ? ['Message', 'MessageId', 'SubscribeURL', 'Timestamp', 'Token', 'TopicArn', 'Type']
        : null
  if (!keys) return null
  let out = ''
  for (const k of keys) {
    const v = e[k as keyof SnsSignedEnvelope]
    if (typeof v !== 'string') return null
    out += `${k}\n${v}\n`
  }
  return out
}

const certCache = new Map<string, string>()

export async function verifySnsSignature(e: SnsSignedEnvelope, fetchCert: (url: string) => Promise<string> = defaultFetchCert): Promise<boolean> {
  if (process.env.SNS_VERIFY === 'off') return true
  const toSign = snsStringToSign(e)
  if (!toSign || !e.Signature || !isSnsUrl(e.SigningCertURL)) return false
  const algo = e.SignatureVersion === '2' ? 'RSA-SHA256' : e.SignatureVersion === '1' ? 'RSA-SHA1' : null
  if (!algo) return false
  try {
    const url = e.SigningCertURL as string
    let cert = certCache.get(url)
    if (!cert) {
      cert = await fetchCert(url)
      certCache.set(url, cert)
    }
    return createVerify(algo).update(toSign, 'utf8').verify(cert, e.Signature, 'base64')
  } catch {
    return false
  }
}

async function defaultFetchCert(url: string): Promise<string> {
  const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
  if (!res.ok) throw new Error(`cert ${res.status}`)
  return res.text()
}
