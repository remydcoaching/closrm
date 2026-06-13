'use client'

import { useEffect, useState } from 'react'
import { Copy, Check, ChevronDown, ChevronUp } from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import type { Call } from '@/types'

const CONFIRMATION_TEMPLATE_KEY = 'closrm.confirmation-message-template'
const DEFAULT_CONFIRMATION_TEMPLATE = `Salut {{first_name}},
C'est {{coach_name}}, merci d'avoir pris rendez-vous 😃


Le but est de faire un point sur ta situation, comprendre où tu en es actuellement et voir si on peut t'aider.


Ton rendez-vous est planifié le {{date}} à {{time}}.


À très vite.`

function fillTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`)
}

interface Props {
  lead: { first_name: string; last_name: string }
  call: Call
}

/**
 * Sous chaque appel planifié (outcome='pending'), affiche un bouton
 * "Voir message de confirmation" qui déplie un bloc avec le message
 * pré-rempli (date/heure du call) + bouton Copier. Coach récupéré via
 * /api/auth/me. Template stocké en localStorage (commun avec la version
 * précédente du composant ConfirmationMessageBlock).
 */
export default function CallConfirmationToggle({ lead, call }: Props) {
  const [open, setOpen] = useState(false)
  const [coachName, setCoachName] = useState<string>('le coach')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!open) return
    fetch('/api/auth/me')
      .then(r => r.ok ? r.json() : null)
      .then(j => {
        const name = j?.data?.full_name as string | undefined
        if (name) setCoachName(name)
      })
      .catch(() => { /* fallback */ })
  }, [open])

  const template = typeof window !== 'undefined'
    ? window.localStorage.getItem(CONFIRMATION_TEMPLATE_KEY) ?? DEFAULT_CONFIRMATION_TEMPLATE
    : DEFAULT_CONFIRMATION_TEMPLATE

  const scheduledAt = new Date(call.scheduled_at)
  const message = fillTemplate(template, {
    first_name: lead.first_name,
    last_name: lead.last_name,
    coach_name: coachName,
    date: format(scheduledAt, 'd MMMM yyyy', { locale: fr }),
    time: format(scheduledAt, 'HH:mm', { locale: fr }),
  })

  async function copy() {
    try {
      await navigator.clipboard.writeText(message)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* ignore */ }
  }

  return (
    <div style={{ marginTop: 8 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '4px 10px', borderRadius: 7, fontSize: 11, fontWeight: 600,
          border: '1px solid rgba(168,85,247,0.25)',
          background: 'rgba(168,85,247,0.06)',
          color: '#a855f7',
          cursor: 'pointer',
        }}
      >
        {open ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
        Message de confirmation
      </button>
      {open && (
        <div style={{
          marginTop: 8,
          background: 'var(--bg-subtle)',
          border: '1px solid var(--border-primary)',
          borderRadius: 10,
          padding: 12,
        }}>
          <div style={{
            fontSize: 12, color: 'var(--text-primary)',
            lineHeight: 1.55, whiteSpace: 'pre-wrap',
            marginBottom: 10,
          }}>
            {message}
          </div>
          <button
            onClick={copy}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '5px 12px', borderRadius: 7, fontSize: 11, fontWeight: 600,
              border: copied ? '1px solid rgba(56,161,105,0.4)' : '1px solid rgba(168,85,247,0.35)',
              background: copied ? 'rgba(56,161,105,0.1)' : 'rgba(168,85,247,0.08)',
              color: copied ? '#38A169' : '#a855f7',
              cursor: 'pointer',
            }}
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? 'Copié !' : 'Copier'}
          </button>
        </div>
      )}
    </div>
  )
}
