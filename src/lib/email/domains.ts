/**
 * AWS SES Domain Identity management.
 * Handles per-workspace custom email domains via SES Identity API.
 *
 * SES Easy DKIM creates 3 CNAME records (xxx._domainkey → xxx.dkim.amazonses.com)
 * que l'utilisateur doit ajouter chez son registrar. Une fois propagés, AWS
 * vérifie automatiquement (5 min – plusieurs heures).
 */

import {
  SESv2Client,
  CreateEmailIdentityCommand,
  GetEmailIdentityCommand,
  DeleteEmailIdentityCommand,
} from '@aws-sdk/client-sesv2'

let _client: SESv2Client | null = null

function getClient(): SESv2Client {
  if (_client) return _client
  const region = process.env.AWS_REGION || 'eu-west-3'
  _client = new SESv2Client({ region })
  return _client
}

// Forme normalisée d'un record DNS, identique à ce que la UI attend.
export interface SesDnsRecord {
  type: string // CNAME | TXT | MX
  name: string // sous-domaine OU domaine racine
  value: string
  status: string // verified | pending | failed
  priority?: number
}

export interface SesDomainResult {
  // Identifiant logique = le domaine lui-même côté SES (pas d'ID séparé).
  id: string
  name: string
  status: string // verified | pending | failed
  records: SesDnsRecord[]
}

function mapVerificationStatus(s: string | undefined): string {
  switch (s) {
    case 'SUCCESS':
      return 'verified'
    case 'FAILED':
      return 'failed'
    case 'TEMPORARY_FAILURE':
    case 'PENDING':
    case 'NOT_STARTED':
    default:
      return 'pending'
  }
}

/**
 * Crée une identité de domaine SES.
 * SES retourne immédiatement les tokens DKIM à configurer en DNS.
 */
export async function createDomain(domain: string): Promise<{
  ok: boolean
  domain?: SesDomainResult
  error?: string
}> {
  try {
    const cmd = new CreateEmailIdentityCommand({
      EmailIdentity: domain,
    })
    const res = await getClient().send(cmd)

    const tokens = res.DkimAttributes?.Tokens || []
    const records: SesDnsRecord[] = tokens.map((token) => ({
      type: 'CNAME',
      name: `${token}._domainkey.${domain}`,
      value: `${token}.dkim.amazonses.com`,
      status: 'pending',
    }))

    return {
      ok: true,
      domain: {
        id: domain,
        name: domain,
        status: res.VerifiedForSendingStatus ? 'verified' : 'pending',
        records,
      },
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (message.includes('AlreadyExistsException')) {
      return { ok: false, error: `Le domaine ${domain} est déjà enregistré dans AWS SES.` }
    }
    return { ok: false, error: message }
  }
}

/**
 * Récupère le statut + les records d'une identité existante.
 * SES n'a pas de "trigger verify" — on lit juste le statut courant
 * (AWS re-vérifie en background quand le DNS change).
 */
export async function getDomain(domain: string): Promise<{
  ok: boolean
  domain?: SesDomainResult
  error?: string
}> {
  try {
    const cmd = new GetEmailIdentityCommand({ EmailIdentity: domain })
    const res = await getClient().send(cmd)

    const tokens = res.DkimAttributes?.Tokens || []
    const dkimStatus = mapVerificationStatus(res.DkimAttributes?.Status)
    const overallStatus = res.VerifiedForSendingStatus ? 'verified' : dkimStatus

    const records: SesDnsRecord[] = tokens.map((token) => ({
      type: 'CNAME',
      name: `${token}._domainkey.${domain}`,
      value: `${token}.dkim.amazonses.com`,
      status: dkimStatus,
    }))

    return {
      ok: true,
      domain: {
        id: domain,
        name: domain,
        status: overallStatus,
        records,
      },
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (message.includes('NotFoundException')) {
      return { ok: false, error: 'Domaine introuvable côté AWS SES.' }
    }
    return { ok: false, error: message }
  }
}

/**
 * Alias getDomain : SES vérifie automatiquement, on lit juste le statut.
 */
export async function verifyDomain(domain: string): Promise<{
  ok: boolean
  domain?: SesDomainResult
  error?: string
}> {
  return getDomain(domain)
}

export async function deleteDomain(domain: string): Promise<{
  ok: boolean
  error?: string
}> {
  try {
    await getClient().send(new DeleteEmailIdentityCommand({ EmailIdentity: domain }))
    return { ok: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (message.includes('NotFoundException')) return { ok: true }
    return { ok: false, error: message }
  }
}
