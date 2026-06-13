'use client'

import { useEffect, useMemo, useState } from 'react'
import { Copy, Check, Pencil, RotateCcw, Save } from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import type { Lead, Call } from '@/types'

interface Props {
  lead: Pick<Lead, 'first_name' | 'last_name' | 'status'>
  calls: Call[]
}

const STORAGE_KEY = 'closrm.confirmation-message-template'

const DEFAULT_TEMPLATE = `Salut {{first_name}},
C'est Pierre Rebmann, merci d'avoir pris rendez-vous 😃


Le but est de faire un point sur ta situation, comprendre où tu en es actuellement et voir si on peut t'aider.


Ton rendez-vous est planifié le {{date}} à {{time}}.


À très vite.`

function loadTemplate(): string {
  if (typeof window === 'undefined') return DEFAULT_TEMPLATE
  return window.localStorage.getItem(STORAGE_KEY) ?? DEFAULT_TEMPLATE
}

function saveTemplate(t: string) {
  if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, t)
}

function fillTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`)
}

/**
 * Renvoie le call planifié à venir le plus proche (outcome=pending,
 * scheduled_at >= maintenant). Si rien à venir, prend le plus récent.
 */
function pickRelevantCall(calls: Call[]): Call | null {
  if (!calls || calls.length === 0) return null
  const now = Date.now()
  const pending = calls
    .filter(c => c.outcome === 'pending' && new Date(c.scheduled_at).getTime() >= now)
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
  if (pending.length > 0) return pending[0]
  // Fallback: dernier call planifié (même passé)
  return calls.sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime())[0] ?? null
}

export default function ConfirmationMessageBlock({ lead, calls }: Props) {
  const [template, setTemplate] = useState<string>(() => loadTemplate())
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(template)
  const [coachName, setCoachName] = useState<string>('le coach')
  const [copied, setCopied] = useState(false)

  // Récupère le nom du coach connecté pour le placeholder {{coach_name}}.
  useEffect(() => {
    let cancelled = false
    fetch('/api/auth/me')
      .then(r => r.ok ? r.json() : null)
      .then(j => {
        const name = j?.data?.full_name as string | undefined
        if (name && !cancelled) setCoachName(name)
      })
      .catch(() => { /* fallback déjà set */ })
    return () => { cancelled = true }
  }, [])

  const relevantCall = useMemo(() => pickRelevantCall(calls), [calls])

  const vars = useMemo<Record<string, string>>(() => {
    const scheduledAt = relevantCall?.scheduled_at ? new Date(relevantCall.scheduled_at) : null
    return {
      first_name: lead.first_name || '',
      last_name: lead.last_name || '',
      coach_name: coachName,
      date: scheduledAt ? format(scheduledAt, 'd MMMM yyyy', { locale: fr }) : '—',
      time: scheduledAt ? format(scheduledAt, 'HH:mm', { locale: fr }) : '—',
    }
  }, [lead.first_name, lead.last_name, coachName, relevantCall])

  const rendered = useMemo(() => fillTemplate(template, vars), [template, vars])

  async function copy() {
    try {
      await navigator.clipboard.writeText(rendered)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* ignore */ }
  }

  function saveDraft() {
    setTemplate(draft)
    saveTemplate(draft)
    setEditing(false)
  }

  function resetTemplate() {
    setDraft(DEFAULT_TEMPLATE)
    setTemplate(DEFAULT_TEMPLATE)
    saveTemplate(DEFAULT_TEMPLATE)
  }

  // N'affiche le bloc que pour les statuts pertinents (rdv planifié).
  if (lead.status !== 'setting_planifie' && lead.status !== 'closing_planifie') {
    return null
  }

  return (
    <div style={{
      background: 'var(--bg-elevated)',
      border: '1px solid var(--border-primary)',
      borderRadius: 14,
      padding: 20,
      marginTop: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-label)', textTransform: 'uppercase', letterSpacing: '0.12em', margin: 0 }}>
          Message de confirmation
        </p>
        <div style={{ display: 'flex', gap: 6 }}>
          {!editing ? (
            <>
              <button
                onClick={() => { setDraft(template); setEditing(true) }}
                title="Modifier le template"
                style={{
                  width: 28, height: 28, borderRadius: 7,
                  border: '1px solid var(--border-primary)',
                  background: 'transparent',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Pencil size={13} />
              </button>
              <button
                onClick={copy}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '6px 12px', borderRadius: 7,
                  border: copied ? '1px solid rgba(56,161,105,0.4)' : '1px solid rgba(168,85,247,0.35)',
                  background: copied ? 'rgba(56,161,105,0.1)' : 'rgba(168,85,247,0.08)',
                  color: copied ? '#38A169' : '#a855f7',
                  fontSize: 12, fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {copied ? <Check size={13} /> : <Copy size={13} />}
                {copied ? 'Copié !' : 'Copier'}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={resetTemplate}
                title="Réinitialiser au template par défaut"
                style={{
                  width: 28, height: 28, borderRadius: 7,
                  border: '1px solid var(--border-primary)',
                  background: 'transparent',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <RotateCcw size={12} />
              </button>
              <button
                onClick={() => setEditing(false)}
                style={{
                  padding: '6px 12px', borderRadius: 7,
                  border: '1px solid var(--border-primary)',
                  background: 'transparent',
                  color: 'var(--text-muted)',
                  fontSize: 12, fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Annuler
              </button>
              <button
                onClick={saveDraft}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '6px 12px', borderRadius: 7,
                  border: 'none',
                  background: 'var(--color-primary)',
                  color: 'var(--text-primary)',
                  fontSize: 12, fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <Save size={13} />
                Enregistrer
              </button>
            </>
          )}
        </div>
      </div>

      {!editing ? (
        <div style={{
          background: 'var(--bg-subtle)',
          border: '1px solid var(--border-primary)',
          borderRadius: 10,
          padding: 14,
          fontSize: 13,
          color: 'var(--text-primary)',
          lineHeight: 1.6,
          whiteSpace: 'pre-wrap',
        }}>
          {rendered}
        </div>
      ) : (
        <div>
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            rows={12}
            style={{
              width: '100%', boxSizing: 'border-box',
              background: 'var(--bg-input)',
              border: '1px solid var(--border-primary)',
              borderRadius: 10,
              padding: 12,
              color: 'var(--text-primary)',
              fontSize: 13, fontFamily: 'inherit',
              outline: 'none',
              resize: 'vertical',
              lineHeight: 1.6,
            }}
          />
          <p style={{ fontSize: 11, color: 'var(--text-label)', marginTop: 8, lineHeight: 1.55 }}>
            Variables disponibles : <code>{`{{first_name}}`}</code>, <code>{`{{last_name}}`}</code>, <code>{`{{coach_name}}`}</code>, <code>{`{{date}}`}</code>, <code>{`{{time}}`}</code>
          </p>
        </div>
      )}

      {!editing && !relevantCall && (
        <p style={{ fontSize: 11, color: '#f59e0b', marginTop: 10 }}>
          ⚠ Aucun appel planifié trouvé pour ce lead. La date et l'heure restent vides.
        </p>
      )}
    </div>
  )
}
