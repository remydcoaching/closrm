'use client'

import { useState, useEffect } from 'react'
import type { EmailDomain } from '@/types'
import DomainWizard from '@/components/emails/DomainWizard'

export default function DomainWizardCard() {
  const [emailDomains, setEmailDomains] = useState<EmailDomain[]>([])

  async function fetchEmailDomains() {
    // cache: 'no-store' : Next.js peut sinon servir une réponse périmée après
    // création/suppression d'un domaine dans la même session.
    const res = await fetch('/api/emails/domains', { cache: 'no-store' })
    if (!res.ok) {
      console.error('[DomainWizardCard] GET /api/emails/domains failed', res.status)
      return
    }
    const json = await res.json()
    const list = Array.isArray(json) ? json : (json.data ?? [])
    setEmailDomains(list)
  }

  useEffect(() => { fetchEmailDomains() }, [])

  return (
    <DomainWizard
      existingDomain={emailDomains[0] ?? null}
      onDomainChange={fetchEmailDomains}
    />
  )
}
