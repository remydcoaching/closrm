'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { X, Phone, Mail, Tag, Calendar, ExternalLink, Save, Plus, Trash2, Edit3, Check, Sparkles, MessageCircle } from 'lucide-react'

function InstagramIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="17.5" cy="6.5" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  )
}
import { Lead, Call, FollowUp, IgConversation, IgMessage, WorkspaceMemberWithUser, WorkspaceRole } from '@/types'
import AiSuggestionPanel from '@/components/ai/AiSuggestionPanel'
import ClosingModal from '@/components/leads/ClosingModal'
import LeadActionModal, { type LeadAction } from '@/components/leads/LeadActionModal'
import LogCallModal from '@/components/leads/LogCallModal'
import CallScheduleModal from '@/components/leads/CallScheduleModal'
import StatusBadge from '@/components/leads/StatusBadge'
import { useStatusConfig } from '@/lib/workspace/config-context'
import SourceBadge from '@/components/leads/SourceBadge'
import CallOutcomeBadge from '@/components/closing/CallOutcomeBadge'
import CallTypeBadge from '@/components/closing/CallTypeBadge'
import ConversationThread from '@/components/messages/ConversationThread'
import MessageInput from '@/components/messages/MessageInput'
import MemberAssignDropdown from '@/components/shared/MemberAssignDropdown'
import LeadMagnetsWidget from '@/components/leads/LeadMagnetsWidget'
import LeadNotesWidget from '@/components/leads/LeadNotesWidget'
import LeadJourneyBlock from '@/components/leads/LeadJourneyBlock'
import LeadDealsWidget from '@/components/leads/LeadDealsWidget'
import ConfirmationMessageBlock from '@/components/leads/ConfirmationMessageBlock'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import Link from 'next/link'

interface LeadWithRelations extends Lead { calls: Call[]; follow_ups: FollowUp[] }
interface Props { leadId: string; onClose: () => void }

const card: React.CSSProperties = { background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)', borderRadius: 12, padding: 16, marginBottom: 14 }
const sectionTitle: React.CSSProperties = { fontSize: 10, fontWeight: 700, color: 'var(--text-label)', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 12 }

// Group header — visuellement plus marqué que sectionTitle, pour grouper
// plusieurs cards par préoccupation (état / coordonnées / activité…)
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
const inputS: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '8px 10px', background: 'var(--bg-input)', border: '1px solid var(--border-primary)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 12, outline: 'none' }
const smallBtn: React.CSSProperties = { background: 'none', border: '1px solid var(--border-primary)', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26 }

export default function LeadSidePanel({ leadId, onClose }: Props) {
  const statusConfig = useStatusConfig()

  const [lead, setLead] = useState<LeadWithRelations | null>(null)
  const [loading, setLoading] = useState(true)
  const [editingField, setEditingField] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [newTag, setNewTag] = useState('')
  const [showClosingModal, setShowClosingModal] = useState(false)
  const [showActionModal, setShowActionModal] = useState(false)
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [showLogCallModal, setShowLogCallModal] = useState(false)
  const [showMoreDetails, setShowMoreDetails] = useState(false)
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false)

  // Team members state
  const [members, setMembers] = useState<WorkspaceMemberWithUser[]>([])
  const [currentRole, setCurrentRole] = useState<WorkspaceRole>('admin')

  // Auto-assign notification
  const [autoAssignMsg, setAutoAssignMsg] = useState<string | null>(null)
  const autoAssignTimer = useRef<NodeJS.Timeout>(null)

  // Tab state
  const [activeTab, setActiveTab] = useState<'infos' | 'messages'>('infos')

  // Messages state
  const [conversation, setConversation] = useState<IgConversation | null>(null)
  const [messages, setMessages] = useState<(IgMessage & { _optimistic?: boolean })[]>([])
  const [messagesLoading, setMessagesLoading] = useState(false)
  const pollRef = useRef<NodeJS.Timeout>(null)

  useEffect(() => {
    fetchLead()
  }, [leadId])

  useEffect(() => {
    async function fetchMembers() {
      try {
        const res = await fetch('/api/workspaces/members')
        if (res.ok) {
          const json = await res.json()
          setMembers(json.data ?? [])
        }
      } catch { /* silently ignore */ }
    }
    async function fetchCurrentRole() {
      try {
        const res = await fetch('/api/auth/me')
        if (res.ok) {
          const json = await res.json()
          if (json.data?.role) setCurrentRole(json.data.role)
        }
      } catch { /* silently ignore */ }
    }
    fetchMembers()
    fetchCurrentRole()
  }, [])

  async function fetchLead(opts?: { silent?: boolean }) {
    if (!opts?.silent) setLoading(true)
    const res = await fetch(`/api/leads/${leadId}`)
    if (res.ok) {
      const json = await res.json()
      setLead(json.data)
    }
    if (!opts?.silent) setLoading(false)
  }

  async function patchLead(patch: Partial<Lead>): Promise<Lead | null> {
    const res = await fetch(`/api/leads/${leadId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) })
    const json = res.ok ? await res.json() : null
    // Merge updated fields optimistically without triggering the loading state
    if (json?.data) {
      setLead(prev => prev ? { ...prev, ...json.data } : prev)
    } else {
      await fetchLead({ silent: true })
    }
    return json?.data ?? null
  }

  async function patchCall(callId: string, patch: Partial<Call>) {
    await fetch(`/api/calls/${callId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) })
    fetchLead({ silent: true })
  }

  async function patchFollowUp(fuId: string, patch: Partial<FollowUp>) {
    await fetch(`/api/follow-ups/${fuId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) })
    fetchLead({ silent: true })
  }

  // Unifie le menu d'actions (planifier RDV / relance / won / pas qualifié /
  // dead / logger un appel) avec celui de la liste leads. Ouvert depuis le
  // bouton "Traiter" en haut du panel.
  async function handleAction(action: LeadAction) {
    if (!lead) return
    if (action.type === 'schedule_call') {
      setShowScheduleModal(true)
    } else if (action.type === 'log_call') {
      setShowLogCallModal(true)
    } else if (action.type === 'follow_up') {
      await fetch('/api/follow-ups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: lead.id, reason: action.reason, scheduled_at: action.date, channel: action.channel }),
      })
      fetchLead({ silent: true })
    } else if (action.type === 'won') {
      await fetch('/api/deals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_id: lead.id,
          amount: action.amount,
          cash_collected: action.cash_collected,
          installments: action.installments,
          duration_months: action.duration_months,
          closer_id: action.closer_id,
          setter_id: action.setter_id,
        }),
      })
      fetchLead({ silent: true })
    } else if (action.type === 'pas_qualifie') {
      patchLead({ status: 'pas_qualifie' })
    } else if (action.type === 'dead') {
      patchLead({ status: 'dead' })
    }
  }

  function startEdit(field: string, value: string) {
    setEditingField(field); setEditValue(value)
  }

  function saveEdit(field: string) {
    patchLead({ [field]: editValue })
    setEditingField(null)
  }

  function addTag() {
    if (!newTag.trim() || !lead) return
    const tags = [...lead.tags, newTag.trim().toLowerCase()]
    patchLead({ tags })
    setNewTag('')
  }

  function removeTag(tag: string) {
    if (!lead) return
    patchLead({ tags: lead.tags.filter((t) => t !== tag) })
  }

  // --- Messages logic ---
  const fetchMessages = useCallback(async (convoId: string, refresh = false) => {
    const url = `/api/instagram/messages?conversation_id=${convoId}${refresh ? '&refresh=true' : ''}`
    const res = await fetch(url)
    if (res.ok) {
      const json = await res.json()
      setMessages(json.data ?? [])
    }
  }, [])

  const fetchConversation = useCallback(async () => {
    setMessagesLoading(true)
    const res = await fetch(`/api/instagram/conversations?lead_id=${leadId}`)
    if (res.ok) {
      const json = await res.json()
      const convo: IgConversation | null = (json.data && json.data.length > 0) ? json.data[0] : null
      setConversation(convo)
      if (convo) await fetchMessages(convo.id)
    }
    setMessagesLoading(false)
  }, [leadId, fetchMessages])

  useEffect(() => {
    if (activeTab === 'messages') {
      fetchConversation()
    }
  }, [activeTab, fetchConversation])

  // Poll every 5s when messages tab is active
  useEffect(() => {
    if (activeTab !== 'messages' || !conversation) return
    pollRef.current = setInterval(() => fetchMessages(conversation.id, true), 5000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [activeTab, conversation, fetchMessages])

  async function handleSend(text: string) {
    if (!conversation) return
    const optimistic: IgMessage & { _optimistic: boolean } = {
      id: `opt-${Date.now()}`,
      workspace_id: '',
      conversation_id: conversation.id,
      ig_message_id: null,
      sender_type: 'user',
      text,
      media_url: null,
      media_type: null,
      sent_at: new Date().toISOString(),
      is_read: true,
      _optimistic: true,
    }
    setMessages((prev) => [...prev, optimistic])
    await fetch('/api/instagram/messages/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversation_id: conversation.id, text }),
    })
    await fetchMessages(conversation.id, true)
  }

  async function handleSendImage(file: File) {
    if (!conversation) return
    const formData = new FormData()
    formData.append('file', file)
    formData.append('conversation_id', conversation.id)
    await fetch('/api/instagram/messages/send-image', { method: 'POST', body: formData })
    await fetchMessages(conversation.id, true)
  }

  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Profil du lead"
      style={{
        position: 'fixed', inset: 0, zIndex: 150,
        background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(720px, 100%)', maxHeight: '90vh',
          background: 'var(--bg-primary)',
          border: '1px solid var(--border-primary)',
          borderRadius: 16,
          boxShadow: '0 20px 80px rgba(0,0,0,0.6)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-primary)', padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Profil du lead</span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {lead && (
              <button
                onClick={() => setShowActionModal(true)}
                title="Traiter ce lead"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '6px 12px', borderRadius: 7,
                  background: 'rgba(0,200,83,0.12)',
                  border: '1px solid rgba(0,200,83,0.25)',
                  color: 'var(--color-primary)',
                  fontSize: 12, fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <Sparkles size={12} />
                Traiter
              </button>
            )}
            {lead && <Link href={`/leads/${lead.id}`} style={{ fontSize: 11, color: 'var(--text-tertiary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}><ExternalLink size={12} />Page complète</Link>}
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={18} /></button>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>Chargement...</div>
        ) : !lead ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>Lead non trouvé</div>
        ) : (
          <>
            {/* Tab bar */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border-primary)', background: 'var(--bg-secondary)', flexShrink: 0 }}>
              {(['infos', ...(lead.instagram_handle ? ['messages'] : [])] as ('infos' | 'messages')[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={{
                    padding: '10px 20px',
                    fontSize: 13,
                    fontWeight: 500,
                    background: 'none',
                    border: 'none',
                    borderBottom: activeTab === tab ? '2px solid var(--color-primary)' : '2px solid transparent',
                    color: activeTab === tab ? 'var(--text-primary)' : 'var(--text-tertiary)',
                    cursor: 'pointer',
                    transition: 'color 0.15s',
                  }}
                >
                  {tab === 'infos' ? 'Infos' : 'Messages'}
                </button>
              ))}
            </div>

            {/* Infos tab */}
            {activeTab === 'infos' && (
          <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>
            {/* ─── HEADER : Identité + contact direct inline ─── */}
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 14,
              padding: 16, marginBottom: 16,
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-primary)',
              borderRadius: 14,
            }}>
              <div style={{
                width: 48, height: 48, borderRadius: 12,
                background: 'rgba(0,200,83,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 19, fontWeight: 700, color: 'var(--color-primary)', flexShrink: 0,
              }}>
                {lead.first_name[0]}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
                  {lead.first_name} {lead.last_name}
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                  <SourceBadge source={lead.source} />
                  <StatusBadge status={lead.status} />
                </div>
                {/* Contact inline */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 12 }}>
                  {lead.phone && (
                    <a href={`tel:${lead.phone}`} style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      color: 'var(--text-tertiary)', textDecoration: 'none',
                    }}>
                      <Phone size={11} color="var(--text-label)" /> {lead.phone}
                    </a>
                  )}
                  {lead.email && (
                    <a href={`mailto:${lead.email}`} style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      color: 'var(--text-tertiary)', textDecoration: 'none',
                      maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      <Mail size={11} color="var(--text-label)" /> {lead.email}
                    </a>
                  )}
                  {lead.instagram_handle && (
                    <a href={`https://instagram.com/${lead.instagram_handle}`} target="_blank" rel="noopener noreferrer" style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      color: '#E1306C', textDecoration: 'none',
                    }}>
                      <InstagramIcon size={11} /> @{lead.instagram_handle}
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Message de confirmation pré-rendu pour les RDV planifiés */}
            <ConfirmationMessageBlock lead={lead} calls={lead.calls} />

            {/* Auto-assign notification */}
            {autoAssignMsg && (
              <div style={{
                padding: '10px 14px',
                marginBottom: 14,
                borderRadius: 10,
                fontSize: 12,
                fontWeight: 500,
                background: 'rgba(56, 161, 105, 0.1)',
                border: '1px solid rgba(56, 161, 105, 0.3)',
                color: '#38A169',
              }}>
                {autoAssignMsg}
              </div>
            )}

            {/* ─── BLOC 1 : Statut + Assigné + Tags (en 1 carte compacte) ─── */}
            <div style={card}>
              {/* Statut en dropdown */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ ...sectionTitle, marginBottom: 6 }}>Statut</div>
                <div style={{ position: 'relative' }}>
                  <button onClick={() => setStatusDropdownOpen(o => !o)} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                    width: '100%',
                    padding: '8px 12px', borderRadius: 8, fontSize: 13, fontWeight: 500,
                    background: 'var(--bg-subtle)', border: '1px solid var(--border-primary)',
                    color: 'var(--text-primary)', cursor: 'pointer',
                  }}>
                    <StatusBadge status={lead.status} />
                    <span style={{ fontSize: 10, opacity: 0.6 }}>▾</span>
                  </button>
                  {statusDropdownOpen && (
                    <div style={{
                      position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, zIndex: 10,
                      background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)',
                      borderRadius: 10, padding: 6, boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
                    }}>
                      {statusConfig.filter((e) => e.visible).map((e) => (
                        <button key={e.key} onClick={async () => {
                          setStatusDropdownOpen(false)
                          if (e.key === 'clos') { setShowClosingModal(true); return }
                          const previousAssignedTo = lead.assigned_to
                          const updated = await patchLead({ status: e.key })
                          if (
                            e.key === 'closing_planifie' &&
                            currentRole === 'setter' &&
                            updated?.assigned_to &&
                            updated.assigned_to !== previousAssignedTo
                          ) {
                            const closer = members.find((m) => m.user_id === updated.assigned_to)
                            const closerName = closer?.user?.full_name ?? 'un closer'
                            if (autoAssignTimer.current) clearTimeout(autoAssignTimer.current)
                            setAutoAssignMsg(`Lead assigné automatiquement à ${closerName}`)
                            autoAssignTimer.current = setTimeout(() => setAutoAssignMsg(null), 3000)
                          }
                        }} style={{
                          display: 'block', width: '100%', textAlign: 'left',
                          padding: '7px 10px', borderRadius: 7, fontSize: 12, fontWeight: 600,
                          border: 'none',
                          background: lead.status === e.key ? 'var(--bg-hover)' : 'transparent',
                          color: e.color, cursor: 'pointer',
                        }}>
                          {e.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Assigné à */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ ...sectionTitle, marginBottom: 6 }}>Assigné à</div>
                <MemberAssignDropdown
                  assignedTo={lead.assigned_to}
                  members={members}
                  onAssign={(userId) => patchLead({ assigned_to: userId })}
                  canEdit={currentRole === 'admin'}
                />
              </div>

              {/* Tags */}
              <div>
                <div style={{ ...sectionTitle, marginBottom: 6 }}>Tags</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: lead.tags.length > 0 ? 8 : 0 }}>
                  {lead.tags.map((tag) => (
                    <span key={tag} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 99, fontSize: 11, background: 'var(--bg-hover)', color: '#ccc', border: '1px solid var(--border-primary)' }}>
                      {tag}
                      <button onClick={() => removeTag(tag)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, display: 'flex' }}><X size={10} /></button>
                    </span>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input value={newTag} onChange={(e) => setNewTag(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addTag()} placeholder="Ajouter un tag" style={{ ...inputS, flex: 1 }} />
                  <button onClick={addTag} style={{ ...smallBtn, width: 32 }}><Plus size={12} color="var(--color-primary)" /></button>
                </div>
              </div>
            </div>

            {/* ─── BLOC 2 : Appels ─── */}
            {lead.calls.length > 0 && (
              <div style={card}>
                <div style={sectionTitle}>Appels ({lead.calls.length})</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {lead.calls.map((call) => (
                    <CallRow key={call.id} call={call} onPatch={(patch) => patchCall(call.id, patch)} />
                  ))}
                </div>
              </div>
            )}

            {/* ─── BLOC 3 : Relances ─── */}
            {lead.follow_ups.length > 0 && (
              <div style={card}>
                <div style={sectionTitle}>Relances ({lead.follow_ups.length})</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {lead.follow_ups.map((fu) => (
                    <FollowUpRow key={fu.id} followUp={fu} onPatch={(patch) => patchFollowUp(fu.id, patch)} />
                  ))}
                </div>
              </div>
            )}

            {/* ─── BLOC 4 : Paiements (toujours visible — c'est le revenu) ─── */}
            <div style={card}>
              <div style={sectionTitle}>Paiements</div>
              <LeadDealsWidget leadId={leadId} />
            </div>

            {/* ─── BLOC 5 : Notes ─── */}
            <div style={card}>
              <div style={sectionTitle}>Notes</div>
              <LeadNotesWidget leadId={leadId} />
            </div>

            {/* ─── BLOC PLUS : sections secondaires (Assistant IA, Lead Magnets, Acquisition) ─── */}
            <button
              onClick={() => setShowMoreDetails(o => !o)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                width: '100%',
                padding: '10px 14px',
                marginTop: 8, marginBottom: showMoreDetails ? 14 : 0,
                borderRadius: 10,
                border: '1px solid var(--border-primary)',
                background: 'transparent',
                color: 'var(--text-tertiary)',
                fontSize: 12, fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              {showMoreDetails ? '▴ Masquer les détails complémentaires' : '▾ Voir les détails complémentaires'}
            </button>

            {showMoreDetails && (
              <>
                {/* Assistant IA */}
                <div style={card}>
                  <div style={{ ...sectionTitle, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Sparkles size={12} color="#E53E3E" />
                    Assistant IA
                  </div>
                  <AiSuggestionPanel
                    leadId={leadId}
                    instagramHandle={lead.instagram_handle}
                  />
                </div>

                {/* Lead Magnets — le widget gère son propre card + title */}
                <LeadMagnetsWidget leadId={leadId} />

                {/* Parcours du lead */}
                <SectionHeader>Parcours du lead</SectionHeader>
                <LeadJourneyBlock leadId={leadId} compact />
              </>
            )}


            {/* Supprimer */}
            <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--border-primary)' }}>
              <button onClick={async () => {
                if (!confirm('Supprimer definitivement ce lead et toutes ses donnees (appels, follow-ups, notes) ? Cette action est irreversible.')) return
                const res = await fetch(`/api/leads/${leadId}`, { method: 'DELETE' })
                if (res.ok) {
                  onClose()
                  window.location.reload()
                }
              }} style={{
                display: 'flex', alignItems: 'center', gap: 6, width: '100%', justifyContent: 'center',
                padding: '10px 0', borderRadius: 10, fontSize: 12, fontWeight: 500,
                border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.06)',
                color: '#ef4444', cursor: 'pointer',
              }}>
                <Trash2 size={13} />
                Supprimer definitivement ce lead
              </button>
            </div>
          </div>
            )}

            {/* Messages tab */}
            {activeTab === 'messages' && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {messagesLoading ? (
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                    Chargement...
                  </div>
                ) : !conversation ? (
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                    Aucune conversation Instagram trouvée
                  </div>
                ) : (
                  <>
                    <ConversationThread messages={messages} />
                    <MessageInput onSend={handleSend} onSendImage={handleSendImage} />
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {showClosingModal && lead && (
        <ClosingModal
          leadName={`${lead.first_name} ${lead.last_name}`}
          onClose={() => setShowClosingModal(false)}
          onConfirm={(data) => {
            setShowClosingModal(false)
            patchLead({
              status: 'clos',
              deal_amount: data.deal_amount,
              deal_installments: data.deal_installments,
              cash_collected: data.cash_collected,
              closed_at: new Date().toISOString(),
            } as Partial<Lead>)
          }}
        />
      )}

      {showActionModal && lead && (
        <LeadActionModal
          lead={lead}
          onClose={() => setShowActionModal(false)}
          onAction={(action) => handleAction(action)}
        />
      )}

      {showScheduleModal && lead && (
        <CallScheduleModal
          lead={lead}
          onClose={() => setShowScheduleModal(false)}
          onScheduled={() => { setShowScheduleModal(false); fetchLead({ silent: true }) }}
        />
      )}

      {showLogCallModal && lead && (
        <LogCallModal
          lead={{ id: lead.id, first_name: lead.first_name, last_name: lead.last_name }}
          onClose={() => setShowLogCallModal(false)}
          onLogged={() => { fetchLead({ silent: true }) }}
        />
      )}
    </div>
  )
}

function CallRow({ call, onPatch }: { call: Call; onPatch: (patch: Partial<Call>) => void }) {
  const [editing, setEditing] = useState(false)
  const [date, setDate] = useState(format(new Date(call.scheduled_at), 'yyyy-MM-dd'))
  const [time, setTime] = useState(format(new Date(call.scheduled_at), 'HH:mm'))

  function saveDate() {
    onPatch({ scheduled_at: new Date(`${date}T${time}`).toISOString() })
    setEditing(false)
  }

  const outcomes: { value: 'pending' | 'done' | 'cancelled' | 'no_show'; label: string; color: string }[] = [
    { value: 'pending', label: 'En attente', color: '#f59e0b' },
    { value: 'done', label: 'Fait', color: 'var(--color-primary)' },
    { value: 'cancelled', label: 'Annulé', color: '#ef4444' },
    { value: 'no_show', label: 'Absent', color: '#f97316' },
  ]

  return (
    <div style={{ padding: '10px 12px', background: 'var(--bg-input)', borderRadius: 8, border: '1px solid var(--border-primary)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <CallTypeBadge type={call.type} />
        <button onClick={() => setEditing(!editing)} style={smallBtn}><Edit3 size={11} color="#666" /></button>
      </div>

      {/* Outcome buttons */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
        {outcomes.map((o) => {
          const active = call.outcome === o.value
          return (
            <button key={o.value} onClick={() => onPatch({ outcome: o.value })} style={{
              padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 600, cursor: 'pointer',
              border: active ? `1px solid ${o.color}` : '1px solid var(--border-primary)',
              background: active ? o.color + '15' : 'transparent',
              color: active ? o.color : '#555',
            }}>
              {o.label}
            </button>
          )
        })}
      </div>

      {editing ? (
        <div style={{ display: 'flex', gap: 6 }}>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ ...inputS, flex: 1, colorScheme: 'dark', fontSize: 11 }} />
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} style={{ ...inputS, width: 90, colorScheme: 'dark', fontSize: 11 }} />
          <button onClick={saveDate} style={smallBtn}><Check size={12} color="var(--color-primary)" /></button>
        </div>
      ) : (
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
          <Calendar size={10} style={{ marginRight: 4 }} />
          {format(new Date(call.scheduled_at), "dd MMM yyyy 'à' HH'h'mm", { locale: fr })}
        </div>
      )}
    </div>
  )
}

function FollowUpRow({ followUp, onPatch }: { followUp: FollowUp; onPatch: (patch: Partial<FollowUp>) => void }) {
  const [editing, setEditing] = useState(false)
  const [date, setDate] = useState(format(new Date(followUp.scheduled_at), 'yyyy-MM-dd'))
  const [time, setTime] = useState(format(new Date(followUp.scheduled_at), 'HH:mm'))

  function saveDate() {
    onPatch({ scheduled_at: new Date(`${date}T${time}`).toISOString() })
    setEditing(false)
  }

  const statuses: { value: 'en_attente' | 'fait' | 'annule'; label: string; color: string }[] = [
    { value: 'en_attente', label: 'En attente', color: '#f59e0b' },
    { value: 'fait', label: 'Fait', color: 'var(--color-primary)' },
    { value: 'annule', label: 'Annulé', color: '#ef4444' },
  ]

  return (
    <div style={{ padding: '10px 12px', background: 'var(--bg-input)', borderRadius: 8, border: '1px solid var(--border-primary)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 12, color: '#ccc' }}>{followUp.reason}</span>
        <button onClick={() => setEditing(!editing)} style={smallBtn}><Edit3 size={11} color="#666" /></button>
      </div>

      {/* Status buttons */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
        {statuses.map((s) => {
          const active = followUp.status === s.value
          return (
            <button key={s.value} onClick={() => onPatch({ status: s.value })} style={{
              padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 600, cursor: 'pointer',
              border: active ? `1px solid ${s.color}` : '1px solid var(--border-primary)',
              background: active ? s.color + '15' : 'transparent',
              color: active ? s.color : '#555',
            }}>
              {s.label}
            </button>
          )
        })}
      </div>

      {editing ? (
        <div style={{ display: 'flex', gap: 6 }}>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ ...inputS, flex: 1, colorScheme: 'dark', fontSize: 11 }} />
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} style={{ ...inputS, width: 90, colorScheme: 'dark', fontSize: 11 }} />
          <button onClick={saveDate} style={smallBtn}><Check size={12} color="var(--color-primary)" /></button>
        </div>
      ) : (
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
          <Calendar size={10} style={{ marginRight: 4 }} />
          {format(new Date(followUp.scheduled_at), "dd MMM yyyy 'à' HH'h'mm", { locale: fr })}
        </div>
      )}
    </div>
  )
}
