'use client'

import { useState, useEffect } from 'react'
import type { EmailDomain } from '@/types'
import DomainWizard from '@/components/emails/DomainWizard'

export default function DomainWizardCard() {
  const [emailDomains, setEmailDomains] = useState<EmailDomain[]>([])

  async function fetchEmailDomains() {
    const res = await fetch('/api/emails/domains')
    if (res.ok) {
      const json = await res.json()
      setEmailDomains(json.data ?? json ?? [])
    }
  }

  useEffect(() => { fetchEmailDomains() }, [])

  return (
    <DomainWizard
      existingDomain={emailDomains[0] ?? null}
      onDomainChange={fetchEmailDomains}
    />
  )
}
