'use client'

import { useEffect, useState } from 'react'
import { Phone, Mail, Tag, FileText, Clock, X, Plus } from 'lucide-react'
import { Lead, Call, FollowUp, LeadStatus } from '@/types'
import StatusBadge from '@/components/leads/StatusBadge'
import SourceBadge from '@/components/leads/SourceBadge'
import { useStatusConfig } from '@/lib/workspace/config-context'
import LeadMagnetsWidget from '@/components/leads/LeadMagnetsWidget'
import LeadNotesWidget from '@/components/leads/LeadNotesWidget'
import LeadDealsWidget from '@/components/leads/LeadDealsWidget'
import LeadJourneyBlock from '@/components/leads/LeadJourneyBlock'
import CallConfirmationToggle from '@/components/leads/CallConfirmationToggle'
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

// Group header — meme logique que LeadSidePanel pour coherence
function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)',
      letterSpacing: '0.1em', textTransform: 'uppercase',
      margin: '8px 0 12px', paddingBottom: 6,
      borderBottom: '1px solid var(--border-primary)',
    }}>
      {children}
    </div>
  )
}

const inputStyle = {
  width: '100%', boxSizing: 'border-box' as const,
  padding: '7px 10px',
  background: 'var(--bg-subtle)', border: '1px solid var(--border-primary)',
  borderRadius: 7, color: 'var(--text-primary)', fontSize: 13, outline: 'none',
}

export default function LeadDetail({ lead, onUpdate }: LeadDetailProps) {
  const statusConfig = useStatusConfig()

  const [tags, setTags] = useState<string[]>(lead.tags)
  const [tagInput, setTagInput] = useState('')
  const [statusOpen, setStatusOpen] = useState(false)

  useEffect(() => { setTags(lead.tags) }, [lead.tags])

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

  const [showMoreDetails, setShowMoreDetails] = useState(false)

  return (
    <div>
      {/* ─── BLOC 1 : Header unique — Nom en haut + Grille 3 lignes ─── */}
      <div style={{ ...card, padding: 24 }}>
        {/* En-tête : Nom + Source */}
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', margin: 0, marginBottom: 8, lineHeight: 1.2 }}>
            {lead.first_name} {lead.last_name}
          </h2>
          <SourceBadge source={lead.source} />
        </div>

        {/* Grille 2 colonnes × 3 lignes : Téléphone/Email · Tentatives/Joint · Statut/Tags */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
          {/* Rangée 1 */}
          <div>
            <p style={{ ...sectionTitle, marginBottom: 6 }}>Téléphone</p>
            <a href={lead.phone ? `tel:${lead.phone}` : undefined} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13,
              color: lead.phone ? 'var(--text-primary)' : 'var(--text-label)',
              textDecoration: 'none', fontWeight: 500,
            }}>
              <Phone size={13} color="var(--text-muted)" />
              {lead.phone || 'Non renseigné'}
            </a>
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{ ...sectionTitle, marginBottom: 6 }}>Email</p>
            <a href={lead.email ? `mailto:${lead.email}` : undefined} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13,
              color: lead.email ? 'var(--text-primary)' : 'var(--text-label)',
              textDecoration: 'none', fontWeight: 500,
              maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              <Mail size={13} color="var(--text-muted)" style={{ flexShrink: 0 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{lead.email || 'Non renseigné'}</span>
            </a>
          </div>

          {/* Rangée 2 */}
          <div>
            <p style={{ ...sectionTitle, marginBottom: 6 }}>Tentatives d&apos;appel</p>
            <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>
              {lead.call_attempts} tentative{lead.call_attempts > 1 ? 's' : ''}
            </span>
          </div>
          <div>
            <p style={{ ...sectionTitle, marginBottom: 6 }}>Joint</p>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '3px 10px', borderRadius: 99,
              background: lead.reached ? 'rgba(56,161,105,0.12)' : 'rgba(239,68,68,0.12)',
              color: lead.reached ? '#38A169' : '#ef4444',
              fontSize: 11, fontWeight: 600,
            }}>
              {lead.reached ? 'Joint' : 'Non joint'}
            </span>
          </div>

          {/* Rangée 3 : Statut (modifiable) + Tags (modifiable) — alignés strict */}
          <div style={{ position: 'relative' }}>
            <p style={{ ...sectionTitle, marginBottom: 6, height: 14, lineHeight: '14px' }}>Statut</p>
            <button onClick={() => setStatusOpen(o => !o)} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
              width: '100%',
              height: 38, boxSizing: 'border-box',
              padding: '0 12px', borderRadius: 8, fontSize: 13, fontWeight: 500,
              background: 'var(--bg-subtle)', border: '1px solid var(--border-primary)',
              color: 'var(--text-primary)', cursor: 'pointer',
            }}>
              <StatusBadge status={lead.status} />
              <span style={{ fontSize: 10, opacity: 0.6 }}>▾</span>
            </button>
            {statusOpen && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, zIndex: 10,
                background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)',
                borderRadius: 10, padding: 6, boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
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
          <div>
            <p style={{ ...sectionTitle, marginBottom: 6, height: 14, lineHeight: '14px' }}>Tags</p>
            <div style={{
              display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4,
              height: 38, boxSizing: 'border-box',
              padding: '0 6px',
              border: '1px solid var(--border-primary)',
              borderRadius: 8,
              background: 'var(--bg-subtle)',
              overflow: 'hidden',
            }}>
              {tags.map(tag => (
                <span key={tag} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 3,
                  padding: '2px 8px', borderRadius: 99, fontSize: 10, fontWeight: 600,
                  background: 'rgba(0,200,83,0.12)', color: 'var(--color-primary)', border: '1px solid rgba(0,200,83,0.20)',
                }}>
                  {tag}
                  <button onClick={() => removeTag(tag)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-primary)', padding: 0, display: 'flex' }}>
                    <X size={9} />
                  </button>
                </span>
              ))}
              <input
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
                placeholder={tags.length === 0 ? 'Ajouter un tag…' : '+ Tag'}
                style={{
                  flex: 1, minWidth: 80,
                  background: 'transparent', border: 'none', outline: 'none',
                  fontSize: 12, color: 'var(--text-primary)',
                  padding: '0 6px',
                  height: '100%',
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ─── BLOC 2 : Historique des interactions ─── */}
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
                      {/* Message de confirmation collapsible — seulement pour les appels planifiés (outcome='pending') */}
                      {(item.data as Call).outcome === 'pending' && (
                        <CallConfirmationToggle
                          lead={lead}
                          call={item.data as Call}
                        />
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

      {/* ─── BLOC 3 : Notes ─── */}
      <div style={card}>
        <p style={sectionTitle}><FileText size={11} style={{ marginRight: 5 }} />Notes</p>
        <LeadNotesWidget leadId={lead.id} />
      </div>

      {/* ─── BLOC 4 : Parcours du lead ─── */}
      <div style={card}>
        <p style={sectionTitle}>Parcours du lead</p>
        <LeadJourneyBlock leadId={lead.id} />
      </div>

      {/* ─── BLOC 5 : Paiements (en bas) ─── */}
      <div style={card}>
        <p style={sectionTitle}>Paiements</p>
        <LeadDealsWidget leadId={lead.id} />
      </div>

      {/* ─── BLOC PLUS : Lead Magnets (collapsible) ─── */}
      <button
        onClick={() => setShowMoreDetails(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          width: '100%',
          padding: '10px 14px',
          marginTop: 4, marginBottom: showMoreDetails ? 14 : 0,
          borderRadius: 10,
          border: '1px solid var(--border-primary)',
          background: 'transparent',
          color: 'var(--text-tertiary)',
          fontSize: 12, fontWeight: 500,
          cursor: 'pointer',
        }}
      >
        {showMoreDetails ? '▴ Masquer Lead Magnets' : '▾ Voir Lead Magnets'}
      </button>

      {showMoreDetails && (
        <div style={card}>
          <p style={sectionTitle}>Lead Magnets</p>
          <LeadMagnetsWidget leadId={lead.id} />
        </div>
      )}
    </div>
  )
}

