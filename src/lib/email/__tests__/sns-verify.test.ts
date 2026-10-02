import { describe, expect, it } from 'vitest'
import { createSign, generateKeyPairSync } from 'crypto'
import { isSnsUrl, snsStringToSign, verifySnsSignature, type SnsSignedEnvelope } from '../sns-verify'

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
const pem = publicKey.export({ type: 'spki', format: 'pem' }).toString()
const certUrl = 'https://sns.eu-west-1.amazonaws.com/SimpleNotificationService-abc.pem'

function signed(e: SnsSignedEnvelope, version: '1' | '2' = '2'): SnsSignedEnvelope {
  const s = createSign(version === '2' ? 'RSA-SHA256' : 'RSA-SHA1').update(snsStringToSign(e) as string, 'utf8').sign(privateKey, 'base64')
  return { ...e, Signature: s, SignatureVersion: version, SigningCertURL: certUrl }
}

const notif: SnsSignedEnvelope = { Type: 'Notification', Message: '{"notificationType":"Received"}', MessageId: 'm1', Timestamp: '2026-10-01T10:00:00.000Z', TopicArn: 'arn:aws:sns:eu-west-1:1:ses' }
const fetchCert = async () => pem

describe('SNS signature', () => {
  it('canonical string: Subject only when present, subscription fields for confirmations', () => {
    expect(snsStringToSign(notif)).toBe('Message\n{"notificationType":"Received"}\nMessageId\nm1\nTimestamp\n2026-10-01T10:00:00.000Z\nTopicArn\narn:aws:sns:eu-west-1:1:ses\nType\nNotification\n')
    expect(snsStringToSign({ ...notif, Subject: 'Hi' })).toContain('Subject\nHi\nTimestamp')
    expect(snsStringToSign({ ...notif, Type: 'SubscriptionConfirmation' })).toBeNull() // missing SubscribeURL / Token
  })
  it('accepts a genuine message (v1 and v2), rejects any tampering', async () => {
    expect(await verifySnsSignature(signed(notif, '2'), fetchCert)).toBe(true)
    expect(await verifySnsSignature(signed(notif, '1'), fetchCert)).toBe(true)
    const forged = { ...signed(notif), Message: '{"notificationType":"Bounce"}' }
    expect(await verifySnsSignature(forged, fetchCert)).toBe(false)
    expect(await verifySnsSignature({ ...signed(notif), SigningCertURL: 'https://evil.example.com/cert.pem' }, fetchCert)).toBe(false)
    expect(await verifySnsSignature({ ...notif }, fetchCert)).toBe(false)
  })
  it('SubscribeURL / cert URL must be https on sns.<region>.amazonaws.com', () => {
    expect(isSnsUrl('https://sns.eu-west-1.amazonaws.com/?Action=ConfirmSubscription')).toBe(true)
    expect(isSnsUrl('http://sns.eu-west-1.amazonaws.com/')).toBe(false)
    expect(isSnsUrl('https://sns.eu-west-1.amazonaws.com.evil.com/')).toBe(false)
    expect(isSnsUrl('https://169.254.169.254/latest/meta-data')).toBe(false)
  })
})
