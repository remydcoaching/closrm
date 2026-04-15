'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import type { IgConversation, Lead, Call, LeadStatus } from '@/types'

interface Props {
  conversation: IgConversation
}

const STATUS_CONFIG: Record<LeadStatus, { label: string; color: string; bg: string }> = {
  nouveau: { label: 'Nouveau', color: '#3B82F6', bg: 'rgba(59,130,246,0.1)' },
  scripte: { label: 'Scripté', color: '#06b6d4', bg: 'rgba(6,182,212,0.1)' },
  setting_planifie: { label: 'Setting planifié', color: '#D69E2E', bg: 'rgba(214,158,46,0.1)' },
  no_show_setting: { label: 'No-show setting', color: '#E53E3E', bg: 'rgba(229,62,62,0.1)' },
  closing_planifie: { label: 'Closing planifié', color: '#D69E2E', bg: 'rgba(214,158,46,0.1)' },
  no_show_closing: { label: 'No-show closing', color: '#E53E3E', bg: 'rgba(229,62,62,0.1)' },
  clos: { label: 'Closé', color: '#38A169', bg: 'rgba(56,161,105,0.1)' },
  dead: { label: 'Dead', color: '#E53E3E', bg: 'rgba(229,62,62,0.1)' },
}

function formatCallDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
    + ' · ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

const sectionStyle: React.CSSProperties = {
  padding: '18px 20px',
  borderBottom: '1px solid var(--border-primary)',
}

const labelStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: 0.8,
  color: 'var(--text-tertiary)',
  marginBottom: 10,
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
      .then(([leadRes, callsData]) => {
        const leadData = leadRes?.data ?? leadRes ?? null
        setLead(leadData)
        setNotes(leadData?.notes ?? '')
        const callsArr = callsData?.data ?? (Array.isArray(callsData) ? callsData : [])
        setNextCall(callsArr.length > 0 ? callsArr[0] : null)
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
    <aside style={{
      width: 300,
      flexShrink: 0,
      borderLeft: '1px solid var(--border-primary)',
      background: 'var(--bg-primary)',
      overflowY: 'auto',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        padding: '28px 24px 20px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        borderBottom: '1px solid var(--border-primary)',
      }}>
        <div style={{
          width: 72,
          height: 72,
          borderRadius: '50%',
          background: conversation.participant_avatar_url ? 'transparent' : 'var(--color-primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 26,
          fontWeight: 700,
          color: '#fff',
          overflow: 'hidden',
          marginBottom: 14,
        }}>
          {conversation.participant_avatar_url ? (
            <img src={conversation.participant_avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : initial}
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', textAlign: 'center' }}>
          {displayName}
        </div>
        {handle && (
          <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 4 }}>{handle}</div>
        )}
      </div>

      {/* Content */}
      {!conversation.lead_id ? (
        <div style={{ padding: '24px 20px', textAlign: 'center' }}>
          <span style={{ fontSize: 13, color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
            Aucun lead associé
          </span>
        </div>
      ) : loadingLead ? (
        <div style={{ padding: '24px 20px' }}>
          <div style={{ height: 12, width: 100, background: 'var(--bg-elevated)', borderRadius: 6, marginBottom: 12 }} className="animate-pulse" />
          <div style={{ height: 28, width: 130, background: 'var(--bg-elevated)', borderRadius: 20, marginBottom: 20 }} className="animate-pulse" />
          <div style={{ height: 12, width: 80, background: 'var(--bg-elevated)', borderRadius: 6, marginBottom: 12 }} className="animate-pulse" />
          <div style={{ display: 'flex', gap: 6 }}>
            <div style={{ height: 24, width: 60, background: 'var(--bg-elevated)', borderRadius: 20 }} className="animate-pulse" />
            <div style={{ height: 24, width: 50, background: 'var(--bg-elevated)', borderRadius: 20 }} className="animate-pulse" />
          </div>
        </div>
      ) : lead ? (
        <>
          {/* Pipeline status */}
          <div style={sectionStyle}>
            <div style={labelStyle}>Statut pipeline</div>
            {(() => {
              const s = STATUS_CONFIG[lead.status]
              return (
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '5px 14px',
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 600,
                  background: s.bg,
                  color: s.color,
                  border: `1px solid ${s.color}20`,
                }}>
                  <span>●</span> {s.label}
                </span>
              )
            })()}
          </div>

          {/* Tags */}
          <div style={sectionStyle}>
            <div style={labelStyle}>Tags</div>
            {lead.tags.length === 0 ? (
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontStyle: 'italic' }}>Aucun tag</span>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {lead.tags.map(tag => (
                  <span key={tag} style={{
                    padding: '4px 12px',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-primary)',
                    borderRadius: 20,
                    fontSize: 11,
                    color: 'var(--text-secondary)',
                    fontWeight: 500,
                  }}>
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Prochain RDV */}
          <div style={sectionStyle}>
            <div style={labelStyle}>Prochain RDV</div>
            {nextCall ? (
              <div style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-primary)',
                borderRadius: 12,
                padding: '12px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}>
                <span style={{ fontSize: 18 }}>📅</span>
                <div>
                  <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500, textTransform: 'capitalize' }}>
                    {nextCall.type}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                    {formatCallDate(nextCall.scheduled_at)}
                  </div>
                </div>
              </div>
            ) : (
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontStyle: 'italic' }}>Aucun planifié</span>
            )}
          </div>

          {/* Actions */}
          <div style={sectionStyle}>
            <Link
              href={`/leads/${lead.id}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 16px',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-primary)',
                borderRadius: 12,
                fontSize: 13,
                color: 'var(--color-primary)',
                fontWeight: 500,
                textDecoration: 'none',
                transition: 'all 0.2s',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
              Fiche complète
            </Link>
          </div>

          {/* Notes */}
          <div style={{ padding: '18px 20px', flex: 1 }}>
            <div style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 8 }}>
              Notes
              {savingNotes && (
                <span style={{ fontSize: 9, color: 'var(--text-tertiary)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
                  Sauvegarde...
                </span>
              )}
            </div>
            <textarea
              ref={notesRef}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              onBlur={handleNotesBlur}
              placeholder="Ajouter une note..."
              rows={4}
              style={{
                width: '100%',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-primary)',
                borderRadius: 12,
                padding: '12px 14px',
                fontSize: 13,
                color: 'var(--text-primary)',
                fontFamily: 'inherit',
                resize: 'none',
                outline: 'none',
                transition: 'border-color 0.2s',
                lineHeight: 1.5,
              }}
            />
          </div>
        </>
      ) : (
        <div style={{ padding: '24px 20px', textAlign: 'center' }}>
          <span style={{ fontSize: 13, color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
            Impossible de charger le lead
          </span>
        </div>
      )}
    </aside>
  )
}
