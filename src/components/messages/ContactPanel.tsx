'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import type { IgConversation, Lead, Call, LeadStatus } from '@/types'

interface Props {
  conversation: IgConversation
}

const STATUS_LABELS: Record<LeadStatus, string> = {
  nouveau: 'Nouveau',
  setting_planifie: 'Setting planifié',
  no_show_setting: 'No-show setting',
  closing_planifie: 'Closing planifié',
  no_show_closing: 'No-show closing',
  clos: 'Closé',
  dead: 'Dead',
}

function getStatusStyle(status: LeadStatus): { dot: string; bg: string; text: string; border: string } {
  switch (status) {
    case 'nouveau':
      return { dot: '#3B82F6', bg: 'rgba(59,130,246,0.1)', text: '#3B82F6', border: 'rgba(59,130,246,0.2)' }
    case 'setting_planifie':
    case 'closing_planifie':
      return { dot: '#D69E2E', bg: 'rgba(214,158,46,0.1)', text: '#D69E2E', border: 'rgba(214,158,46,0.2)' }
    case 'no_show_setting':
    case 'no_show_closing':
    case 'dead':
      return { dot: '#E53E3E', bg: 'rgba(229,62,62,0.1)', text: '#E53E3E', border: 'rgba(229,62,62,0.2)' }
    case 'clos':
      return { dot: '#38A169', bg: 'rgba(56,161,105,0.1)', text: '#38A169', border: 'rgba(56,161,105,0.2)' }
  }
}

function formatCallDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function ContactPanel({ conversation }: Props) {
  const [lead, setLead] = useState<Lead | null>(null)
  const [nextCall, setNextCall] = useState<Call | null>(null)
  const [loadingLead, setLoadingLead] = useState(false)
  const [notes, setNotes] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)
  const notesRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!conversation.lead_id) {
      setLead(null)
      setNextCall(null)
      setNotes('')
      return
    }

    const leadId = conversation.lead_id
    setLoadingLead(true)

    Promise.all([
      fetch(`/api/leads/${leadId}`).then(r => r.ok ? r.json() : null),
      fetch(`/api/calls?lead_id=${leadId}&outcome=pending&limit=1`).then(r => r.ok ? r.json() : null),
    ])
      .then(([leadData, callsData]) => {
        setLead(leadData ?? null)
        setNotes(leadData?.notes ?? '')
        const calls: Call[] = Array.isArray(callsData) ? callsData : (callsData?.calls ?? [])
        setNextCall(calls.length > 0 ? calls[0] : null)
      })
      .finally(() => setLoadingLead(false))
  }, [conversation.lead_id])

  async function handleNotesBlur() {
    if (!lead || notes === (lead.notes ?? '')) return
    setSavingNotes(true)
    try {
      await fetch(`/api/leads/${lead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      })
      setLead(prev => prev ? { ...prev, notes } : prev)
    } finally {
      setSavingNotes(false)
    }
  }

  const displayName = conversation.participant_name ?? conversation.participant_username ?? 'Inconnu'
  const handle = conversation.participant_username ? `@${conversation.participant_username}` : null
  const initial = displayName[0]?.toUpperCase() ?? '?'

  return (
    <aside
      style={{ width: 280 }}
      className="flex flex-col border-l border-[var(--border-primary)] bg-[var(--bg-primary)] overflow-y-auto shrink-0"
    >
      {/* Header */}
      <div className="flex flex-col items-center py-6 px-5 border-b border-[var(--border-primary)]">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center overflow-hidden text-white font-bold text-xl mb-3"
          style={{
            background: 'var(--color-primary)',
          }}
        >
          {conversation.participant_avatar_url ? (
            <img
              src={conversation.participant_avatar_url}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : (
            initial
          )}
        </div>
        <p className="text-[15px] font-bold text-white text-center leading-snug">{displayName}</p>
        {handle && (
          <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5">{handle}</p>
        )}
      </div>

      {/* Lead-linked sections */}
      {!conversation.lead_id ? (
        /* No lead associated */
        <div className="px-5 py-[14px]">
          <p className="text-[11px] text-[var(--text-tertiary)] italic">Aucun lead associé</p>
        </div>
      ) : loadingLead ? (
        /* Loading skeleton */
        <div className="px-5 py-[14px] space-y-3">
          <div className="h-3 w-24 bg-[var(--bg-elevated)] rounded animate-pulse" />
          <div className="h-5 w-32 bg-[var(--bg-elevated)] rounded animate-pulse" />
          <div className="h-3 w-20 bg-[var(--bg-elevated)] rounded animate-pulse mt-4" />
          <div className="flex gap-1">
            <div className="h-5 w-14 bg-[var(--bg-elevated)] rounded-full animate-pulse" />
            <div className="h-5 w-10 bg-[var(--bg-elevated)] rounded-full animate-pulse" />
          </div>
        </div>
      ) : lead ? (
        <>
          {/* Pipeline status */}
          <div className="px-5 py-[14px] border-b border-[var(--border-primary)]">
            <p className="text-[9px] uppercase text-[var(--text-tertiary)] tracking-[0.8px] font-semibold mb-2">
              Statut pipeline
            </p>
            {(() => {
              const s = getStatusStyle(lead.status)
              return (
                <span
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border"
                  style={{ background: s.bg, color: s.text, borderColor: s.border }}
                >
                  <span style={{ color: s.dot }}>●</span>
                  {STATUS_LABELS[lead.status]}
                </span>
              )
            })()}
          </div>

          {/* Tags */}
          <div className="px-5 py-[14px] border-b border-[var(--border-primary)]">
            <p className="text-[9px] uppercase text-[var(--text-tertiary)] tracking-[0.8px] font-semibold mb-2">
              Tags
            </p>
            {lead.tags.length === 0 ? (
              <p className="text-[11px] text-[var(--text-tertiary)] italic">Aucun tag</p>
            ) : (
              <div className="flex flex-wrap gap-[5px]">
                {lead.tags.map(tag => (
                  <span
                    key={tag}
                    className="px-[10px] py-[3px] bg-[var(--bg-elevated)] border border-[var(--border-primary)] rounded-full text-[10px] text-[var(--text-tertiary)]"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Prochain RDV */}
          <div className="px-5 py-[14px] border-b border-[var(--border-primary)]">
            <p className="text-[9px] uppercase text-[var(--text-tertiary)] tracking-[0.8px] font-semibold mb-2">
              Prochain RDV
            </p>
            {nextCall ? (
              <div className="bg-[var(--bg-elevated)] border border-[var(--border-primary)] rounded-[10px] p-3 flex gap-2.5 items-start">
                <svg className="w-3.5 h-3.5 text-[var(--color-primary)] mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
                </svg>
                <div>
                  <p className="text-[11px] text-white font-medium capitalize">{nextCall.type}</p>
                  <p className="text-[10px] text-[#666] mt-0.5">{formatCallDate(nextCall.scheduled_at)}</p>
                </div>
              </div>
            ) : (
              <p className="text-[11px] text-[var(--text-tertiary)] italic">Aucun planifié</p>
            )}
          </div>

          {/* Actions */}
          <div className="px-5 py-[14px] border-b border-[var(--border-primary)]">
            <Link
              href={`/leads/${lead.id}`}
              className="flex items-center gap-1.5 text-[12px] text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] transition-colors font-medium"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
              Fiche complète
            </Link>
          </div>

          {/* Notes */}
          <div className="px-5 py-[14px] flex-1">
            <p className="text-[9px] uppercase text-[var(--text-tertiary)] tracking-[0.8px] font-semibold mb-2 flex items-center gap-1.5">
              Notes
              {savingNotes && (
                <span className="text-[8px] text-[var(--text-tertiary)] normal-case tracking-normal">Sauvegarde…</span>
              )}
            </p>
            <textarea
              ref={notesRef}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              onBlur={handleNotesBlur}
              placeholder="Ajouter une note…"
              rows={5}
              className="w-full bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg p-2.5 text-[12px] text-[#ccc] placeholder-[#444] resize-none focus:outline-none focus:border-[#2a2a2a] transition-colors"
            />
          </div>
        </>
      ) : (
        /* Lead fetch failed */
        <div className="px-5 py-[14px]">
          <p className="text-[11px] text-[var(--text-tertiary)] italic">Impossible de charger le lead</p>
        </div>
      )}
    </aside>
  )
}
