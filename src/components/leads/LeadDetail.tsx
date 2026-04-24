'use client'

import { useEffect, useRef, useState } from 'react'
import { Phone, Mail, Tag, FileText, CheckCircle, XCircle, Clock, X, Plus } from 'lucide-react'
import { Lead, Call, FollowUp, LeadStatus } from '@/types'
import StatusBadge from '@/components/leads/StatusBadge'
import { useStatusConfig } from '@/lib/workspace/config-context'
import LeadMagnetsWidget from '@/components/leads/LeadMagnetsWidget'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

interface LeadWithRelations extends Lead {
  calls: Call[]
  follow_ups: FollowUp[]
}

interface LeadDetailProps {
  lead: LeadWithRelations
  onUpdate: (updated: Partial<Lead>) => void
}

const CALL_OUTCOME_LABEL: Record<string, string> = {
  pending: 'En attente',
  done: 'Fait',
  cancelled: 'Annulé',
  no_show: 'Absent',
}

const CALL_TYPE_COLOR: Record<string, string> = {
  setting: '#3b82f6',
  closing: '#a855f7',
}

const FOLLOWUP_CHANNEL_LABEL: Record<string, string> = {
  whatsapp: 'WhatsApp',
  email: 'Email',
  manuel: 'Manuel',
}

const sectionTitle = { fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.12em', marginBottom: 14 }
const inputStyle = {
  width: '100%', boxSizing: 'border-box' as const,
  padding: '7px 10px',
  background: 'var(--bg-subtle)', border: '1px solid var(--border-primary)',
  borderRadius: 7, color: 'var(--text-primary)', fontSize: 13, outline: 'none',
}

export default function LeadDetail({ lead, onUpdate }: LeadDetailProps) {
  const statusConfig = useStatusConfig()

  const [notes, setNotes] = useState(lead.notes ?? '')
  const [tags, setTags] = useState<string[]>(lead.tags)
  const [tagInput, setTagInput] = useState('')
  const [statusOpen, setStatusOpen] = useState(false)
  const notesDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { setNotes(lead.notes ?? '') }, [lead.notes])
  useEffect(() => { setTags(lead.tags) }, [lead.tags])

  function handleNotesChange(value: string) {
    setNotes(value)
    if (notesDebounce.current) clearTimeout(notesDebounce.current)
    notesDebounce.current = setTimeout(async () => {
      await fetch(`/api/leads/${lead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: value }),
      })
      onUpdate({ notes: value })
    }, 800)
  }

  async function changeStatus(status: LeadStatus) {
    setStatusOpen(false)
    await fetch(`/api/leads/${lead.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    onUpdate({ status })
  }

  async function addTag() {
    const t = tagInput.trim().toLowerCase()
    if (!t || tags.includes(t)) { setTagInput(''); return }
    const newTags = [...tags, t]
    setTags(newTags)
    setTagInput('')
    await fetch(`/api/leads/${lead.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags: newTags }),
    })
    onUpdate({ tags: newTags })
  }

  async function removeTag(tag: string) {
    const newTags = tags.filter(t => t !== tag)
    setTags(newTags)
    await fetch(`/api/leads/${lead.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags: newTags }),
    })
    onUpdate({ tags: newTags })
  }

  // Timeline unifiée : appels + follow-ups triés par date desc
  const timeline = [
    ...lead.calls.map(c => ({ type: 'call' as const, date: c.scheduled_at, data: c })),
    ...lead.follow_ups.map(f => ({ type: 'followup' as const, date: f.scheduled_at, data: f })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  const card: React.CSSProperties = {
    background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)',
    borderRadius: 12, padding: 20, marginBottom: 14,
  }

  return (
    <div>
      {/* Infos contact */}
      <div style={card}>
        <p style={sectionTitle}>Informations de contact</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>Téléphone</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)', fontSize: 13 }}>
              <Phone size={13} color="var(--text-muted)" />
              {lead.phone || <span style={{ color: 'var(--text-label)' }}>Non renseigné</span>}
            </div>
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>Email</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)', fontSize: 13 }}>
              <Mail size={13} color="var(--text-muted)" />
              {lead.email || <span style={{ color: 'var(--text-label)' }}>Non renseigné</span>}
            </div>
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>Tentatives d&apos;appel</label>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{lead.call_attempts} tentative{lead.call_attempts > 1 ? 's' : ''}</div>
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>Joint</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
              {lead.reached
                ? <><CheckCircle size={13} color="var(--color-primary)" /><span style={{ color: 'var(--color-primary)' }}>Oui</span></>
                : <><XCircle size={13} color="var(--text-muted)" /><span style={{ color: 'var(--text-muted)' }}>Non</span></>
              }
            </div>
          </div>
        </div>
      </div>

      {/* Statut */}
      <div style={card}>
        <p style={sectionTitle}>Statut du pipeline</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <StatusBadge status={lead.status} />
          <div style={{ position: 'relative' }}>
            <button onClick={() => setStatusOpen(o => !o)} style={{
              padding: '5px 12px', borderRadius: 7, fontSize: 12,
              border: '1px solid var(--border-primary)', background: 'transparent',
              color: 'var(--text-tertiary)', cursor: 'pointer',
            }}>
              Changer ↓
            </button>
            {statusOpen && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, zIndex: 10, marginTop: 4,
                background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)',
                borderRadius: 10, padding: 6, minWidth: 200, boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
              }}>
                {statusConfig.filter((e) => e.visible).map((e) => (
                  <button key={e.key} onClick={() => changeStatus(e.key)} style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '7px 10px', borderRadius: 7, fontSize: 12, fontWeight: 600,
                    border: 'none', background: lead.status === e.key ? 'var(--bg-hover)' : 'transparent',
                    color: e.color, cursor: 'pointer',
                  }}>
                    {e.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tags */}
      <div style={card}>
        <p style={sectionTitle}><Tag size={11} style={{ marginRight: 5 }} />Tags</p>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          {tags.map(tag => (
            <span key={tag} style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 600,
              background: 'rgba(0,200,83,0.08)', color: 'var(--color-primary)', border: '1px solid rgba(0,200,83,0.15)',
            }}>
              {tag}
              <button onClick={() => removeTag(tag)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-primary)', padding: 0 }}>
                <X size={10} />
              </button>
            </span>
          ))}
          {tags.length === 0 && <span style={{ fontSize: 12, color: 'var(--text-label)' }}>Aucun tag</span>}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <input style={{ ...inputStyle, flex: 1 }} value={tagInput}
            onChange={e => setTagInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
            placeholder="Ajouter un tag..." />
          <button onClick={addTag} style={{
            padding: '7px 10px', background: 'var(--bg-hover)',
            border: '1px solid var(--border-primary)', borderRadius: 7, color: 'var(--text-tertiary)', cursor: 'pointer',
          }}>
            <Plus size={13} />
          </button>
        </div>
      </div>

      {/* Notes */}
      <div style={card}>
        <p style={sectionTitle}><FileText size={11} style={{ marginRight: 5 }} />Notes</p>
        <textarea value={notes} onChange={e => handleNotesChange(e.target.value)}
          rows={5} placeholder="Notes libres sur ce lead..."
          style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }} />
        <p style={{ fontSize: 10, color: 'var(--text-label)', marginTop: 6 }}>Sauvegarde automatique</p>
      </div>

      {/* Lead Magnets */}
      <LeadMagnetsWidget leadId={lead.id} />

      {/* Timeline */}
      <div style={card}>
        <p style={sectionTitle}><Clock size={11} style={{ marginRight: 5 }} />Historique des interactions</p>
        {timeline.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--text-label)', textAlign: 'center', padding: '16px 0' }}>
            Aucune interaction enregistrée
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {timeline.map((item, i) => (
              <div key={i} style={{
                display: 'flex', gap: 12, paddingBottom: i < timeline.length - 1 ? 10 : 0,
                borderBottom: i < timeline.length - 1 ? '1px solid var(--bg-hover)' : 'none',
              }}>
                {/* Dot */}
                <div style={{
                  width: 8, height: 8, borderRadius: '50%', flexShrink: 0, marginTop: 4,
                  background: item.type === 'call'
                    ? CALL_TYPE_COLOR[(item.data as Call).type]
                    : '#f59e0b',
                }} />
                <div style={{ flex: 1 }}>
                  {item.type === 'call' ? (
                    <>
                      <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>
                        Appel {(item.data as Call).type} — {' '}
                        <span style={{ color: CALL_TYPE_COLOR[(item.data as Call).type] }}>
                          {CALL_OUTCOME_LABEL[(item.data as Call).outcome]}
                        </span>
                      </div>
                      {(item.data as Call).notes && (
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>{(item.data as Call).notes}</div>
                      )}
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>
                        Follow-up — {FOLLOWUP_CHANNEL_LABEL[(item.data as FollowUp).channel]}
                        {' · '}<span style={{ color: '#f59e0b' }}>{(item.data as FollowUp).status}</span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{(item.data as FollowUp).reason}</div>
                    </>
                  )}
                  <div style={{ fontSize: 11, color: 'var(--text-label)', marginTop: 4 }}>
                    {format(new Date(item.date), "d MMM yyyy 'à' HH'h'mm", { locale: fr })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
