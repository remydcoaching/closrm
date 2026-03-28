'use client'

import { useEffect, useState, useRef } from 'react'
import { X, Phone, Mail, Tag, Calendar, ExternalLink, Save, Plus, Trash2, Edit3, Check } from 'lucide-react'
import { Lead, Call, FollowUp, LeadStatus } from '@/types'
import StatusBadge, { STATUS_CONFIG } from '@/components/leads/StatusBadge'
import SourceBadge from '@/components/leads/SourceBadge'
import CallOutcomeBadge from '@/components/closing/CallOutcomeBadge'
import CallTypeBadge from '@/components/closing/CallTypeBadge'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import Link from 'next/link'

interface LeadWithRelations extends Lead { calls: Call[]; follow_ups: FollowUp[] }
interface Props { leadId: string; onClose: () => void }

const card: React.CSSProperties = { background: '#0f0f11', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 16, marginBottom: 14 }
const sectionTitle: React.CSSProperties = { fontSize: 10, fontWeight: 700, color: '#444', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 12 }
const inputS: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '8px 10px', background: '#09090b', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, color: '#fff', fontSize: 12, outline: 'none' }
const smallBtn: React.CSSProperties = { background: 'none', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26 }

export default function LeadSidePanel({ leadId, onClose }: Props) {
  const [lead, setLead] = useState<LeadWithRelations | null>(null)
  const [loading, setLoading] = useState(true)
  const [editingField, setEditingField] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [newTag, setNewTag] = useState('')
  const [notes, setNotes] = useState('')
  const notesTimer = useRef<NodeJS.Timeout>(null)

  useEffect(() => {
    fetchLead()
  }, [leadId])

  async function fetchLead() {
    setLoading(true)
    const res = await fetch(`/api/leads/${leadId}`)
    if (res.ok) {
      const json = await res.json()
      setLead(json.data)
      setNotes(json.data.notes || '')
    }
    setLoading(false)
  }

  async function patchLead(patch: Partial<Lead>) {
    await fetch(`/api/leads/${leadId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) })
    fetchLead()
  }

  async function patchCall(callId: string, patch: Partial<Call>) {
    await fetch(`/api/calls/${callId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) })
    fetchLead()
  }

  async function patchFollowUp(fuId: string, patch: Partial<FollowUp>) {
    await fetch(`/api/follow-ups/${fuId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) })
    fetchLead()
  }

  function startEdit(field: string, value: string) {
    setEditingField(field); setEditValue(value)
  }

  function saveEdit(field: string) {
    patchLead({ [field]: editValue })
    setEditingField(null)
  }

  function handleNotesChange(val: string) {
    setNotes(val)
    if (notesTimer.current) clearTimeout(notesTimer.current)
    notesTimer.current = setTimeout(() => patchLead({ notes: val }), 800)
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

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 150, background: 'rgba(0,0,0,0.4)' }} />

      <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: '100%', maxWidth: 460, zIndex: 151, background: '#0c0c0e', borderLeft: '1px solid rgba(255,255,255,0.06)', overflowY: 'auto', boxShadow: '-10px 0 40px rgba(0,0,0,0.5)' }}>
        {/* Header */}
        <div style={{ position: 'sticky', top: 0, background: '#0c0c0e', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>Profil du lead</span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {lead && <Link href={`/leads/${lead.id}`} style={{ fontSize: 11, color: '#888', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}><ExternalLink size={12} />Page complète</Link>}
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer' }}><X size={18} /></button>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#555' }}>Chargement...</div>
        ) : !lead ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#555' }}>Lead non trouvé</div>
        ) : (
          <div style={{ padding: 20 }}>
            {/* Identity */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(0,200,83,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: '#00C853', flexShrink: 0 }}>
                {lead.first_name[0]}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 17, fontWeight: 600, color: '#fff' }}>{lead.first_name} {lead.last_name}</div>
                <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                  <SourceBadge source={lead.source} />
                </div>
              </div>
            </div>

            {/* Status */}
            <div style={card}>
              <div style={sectionTitle}>Statut</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {(Object.keys(STATUS_CONFIG) as LeadStatus[]).map((s) => {
                  const active = lead.status === s
                  const cfg = STATUS_CONFIG[s]
                  return (
                    <button key={s} onClick={() => patchLead({ status: s })} style={{
                      padding: '5px 10px', borderRadius: 8, fontSize: 11, fontWeight: 500, cursor: 'pointer',
                      border: active ? `2px solid ${cfg.color}` : '1px solid rgba(255,255,255,0.06)',
                      background: active ? cfg.bg : 'transparent', color: active ? cfg.color : '#666',
                    }}>
                      {cfg.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Contact editable */}
            <div style={card}>
              <div style={sectionTitle}>Contact</div>
              {[
                { field: 'phone', label: 'Téléphone', icon: Phone, value: lead.phone },
                { field: 'email', label: 'Email', icon: Mail, value: lead.email || '' },
              ].map((f) => {
                const Icon = f.icon
                const editing = editingField === f.field
                return (
                  <div key={f.field} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <Icon size={14} color="#555" style={{ flexShrink: 0 }} />
                    {editing ? (
                      <>
                        <input value={editValue} onChange={(e) => setEditValue(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && saveEdit(f.field)} style={{ ...inputS, flex: 1 }} autoFocus />
                        <button onClick={() => saveEdit(f.field)} style={smallBtn}><Check size={12} color="#00C853" /></button>
                      </>
                    ) : (
                      <>
                        <span style={{ flex: 1, fontSize: 13, color: f.value ? '#ccc' : '#555' }}>{f.value || '—'}</span>
                        <button onClick={() => startEdit(f.field, f.value)} style={smallBtn}><Edit3 size={11} color="#666" /></button>
                      </>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Tags editable */}
            <div style={card}>
              <div style={sectionTitle}>Tags</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: lead.tags.length > 0 ? 10 : 0 }}>
                {lead.tags.map((tag) => (
                  <span key={tag} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 99, fontSize: 11, background: 'rgba(255,255,255,0.04)', color: '#ccc', border: '1px solid rgba(255,255,255,0.06)' }}>
                    {tag}
                    <button onClick={() => removeTag(tag)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#666', padding: 0, display: 'flex' }}><X size={10} /></button>
                  </span>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <input value={newTag} onChange={(e) => setNewTag(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addTag()} placeholder="Ajouter un tag" style={{ ...inputS, flex: 1 }} />
                <button onClick={addTag} style={{ ...smallBtn, width: 32 }}><Plus size={12} color="#00C853" /></button>
              </div>
            </div>

            {/* Notes editable */}
            <div style={card}>
              <div style={sectionTitle}>Notes</div>
              <textarea value={notes} onChange={(e) => handleNotesChange(e.target.value)} rows={3} placeholder="Notes sur ce lead..." style={{ ...inputS, resize: 'vertical' as const, fontSize: 12, lineHeight: 1.5 }} />
            </div>

            {/* Calls — editable dates */}
            <div style={card}>
              <div style={sectionTitle}>Appels ({lead.calls.length})</div>
              {lead.calls.length === 0 ? (
                <p style={{ fontSize: 12, color: '#555' }}>Aucun appel</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {lead.calls.map((call) => (
                    <CallRow key={call.id} call={call} onPatch={(patch) => patchCall(call.id, patch)} />
                  ))}
                </div>
              )}
            </div>

            {/* Follow-ups — editable dates */}
            <div style={card}>
              <div style={sectionTitle}>Follow-ups ({lead.follow_ups.length})</div>
              {lead.follow_ups.length === 0 ? (
                <p style={{ fontSize: 12, color: '#555' }}>Aucun follow-up</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {lead.follow_ups.map((fu) => (
                    <FollowUpRow key={fu.id} followUp={fu} onPatch={(patch) => patchFollowUp(fu.id, patch)} />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
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
    { value: 'done', label: 'Fait', color: '#00C853' },
    { value: 'cancelled', label: 'Annulé', color: '#ef4444' },
    { value: 'no_show', label: 'Absent', color: '#f97316' },
  ]

  return (
    <div style={{ padding: '10px 12px', background: '#09090b', borderRadius: 8, border: '1px solid rgba(255,255,255,0.04)' }}>
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
              border: active ? `1px solid ${o.color}` : '1px solid rgba(255,255,255,0.04)',
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
          <button onClick={saveDate} style={smallBtn}><Check size={12} color="#00C853" /></button>
        </div>
      ) : (
        <div style={{ fontSize: 11, color: '#888' }}>
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
    { value: 'fait', label: 'Fait', color: '#00C853' },
    { value: 'annule', label: 'Annulé', color: '#ef4444' },
  ]

  return (
    <div style={{ padding: '10px 12px', background: '#09090b', borderRadius: 8, border: '1px solid rgba(255,255,255,0.04)' }}>
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
              border: active ? `1px solid ${s.color}` : '1px solid rgba(255,255,255,0.04)',
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
          <button onClick={saveDate} style={smallBtn}><Check size={12} color="#00C853" /></button>
        </div>
      ) : (
        <div style={{ fontSize: 11, color: '#888' }}>
          <Calendar size={10} style={{ marginRight: 4 }} />
          {format(new Date(followUp.scheduled_at), "dd MMM yyyy 'à' HH'h'mm", { locale: fr })}
        </div>
      )}
    </div>
  )
}
