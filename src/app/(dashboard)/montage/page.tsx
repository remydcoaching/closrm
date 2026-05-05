'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Scissors, Clapperboard, Scissors as Cut, Sparkles, ExternalLink, Loader2, Filter, RefreshCw } from 'lucide-react'
import type { SocialPost, SocialProductionStatus, ContentPillar, WorkspaceRole } from '@/types'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'

interface SlotWithMonteur extends SocialPost {
  monteur_email?: string | null
}

interface MonteurOption {
  user_id: string
  email: string | null
}

const COLUMNS: { key: SocialProductionStatus; label: string; color: string; icon: typeof Clapperboard }[] = [
  { key: 'filmed',  label: 'À monter', color: '#06b6d4', icon: Clapperboard },
  { key: 'edited',  label: 'Monté',    color: '#8b5cf6', icon: Cut },
  { key: 'ready',   label: 'Validé',   color: '#10b981', icon: Sparkles },
]

export default function MontagePage() {
  const toast = useToast()
  const [role, setRole] = useState<WorkspaceRole>('admin')
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [slots, setSlots] = useState<SlotWithMonteur[]>([])
  const [pillars, setPillars] = useState<ContentPillar[]>([])
  const [monteurs, setMonteurs] = useState<MonteurOption[]>([])
  const [filterMonteur, setFilterMonteur] = useState<string | 'all'>('all')
  const [loading, setLoading] = useState(true)
  const [selectedSlot, setSelectedSlot] = useState<SlotWithMonteur | null>(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setCurrentUserId(user.id)

      // Get role
      const { data: member } = await supabase
        .from('workspace_members')
        .select('role')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle()
      const userRole = (member?.role ?? 'admin') as WorkspaceRole
      setRole(userRole)

      // Fetch slots — RLS will scope automatically.
      // On exclut les slots déjà publiés (anciens posts backfillés en 'ready'
      // par la migration 063) pour ne montrer que les vraies tâches montage.
      const slotsRes = await fetch('/api/social/posts?production_status=filmed,edited,ready&per_page=200')
      const slotsJson = await slotsRes.json()
      const allSlots = (slotsJson.data ?? []) as SlotWithMonteur[]
      const activeSlots = allSlots.filter(s => s.status !== 'published')
      setSlots(activeSlots)

      // Fetch pillars
      const pillarsRes = await fetch('/api/social/pillars')
      const pillarsJson = await pillarsRes.json()
      setPillars(pillarsJson.data ?? [])

      // If admin, fetch monteurs for filter dropdown
      if (userRole === 'admin') {
        const monteursRes = await fetch('/api/workspaces/members?role=monteur')
        const monteursJson = await monteursRes.json()
        type MemberRow = { user_id: string; user?: { email?: string | null } | null }
        const list = (monteursJson.data ?? []) as MemberRow[]
        setMonteurs(list.map(m => ({ user_id: m.user_id, email: m.user?.email ?? null })))
      }
    } catch (err) {
      toast.error('Erreur de chargement', (err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { fetchAll() }, [fetchAll])

  const filteredSlots = useMemo(() => {
    if (role === 'monteur') return slots // RLS already scoped
    if (filterMonteur === 'all') return slots
    return slots.filter(s => s.monteur_id === filterMonteur)
  }, [slots, filterMonteur, role])

  const slotsByColumn = useMemo(() => {
    const map = new Map<SocialProductionStatus, SlotWithMonteur[]>()
    for (const c of COLUMNS) map.set(c.key, [])
    for (const s of filteredSlots) {
      const status = (s.production_status ?? 'filmed') as SocialProductionStatus
      if (map.has(status)) map.get(status)!.push(s)
    }
    return map
  }, [filteredSlots])

  async function moveSlot(slot: SlotWithMonteur, target: SocialProductionStatus) {
    // Monteur ne peut PAS passer edited→ready (réservé au coach)
    if (role === 'monteur' && slot.production_status === 'edited' && target === 'ready') {
      toast.error('Action réservée au coach', 'Demande au coach de valider ton montage.')
      return
    }
    // Coach uses workflow — allow ready transition only from edited
    try {
      const res = await fetch(`/api/social/posts/${slot.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ production_status: target }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? 'Erreur')
      }
      setSlots(prev => prev.map(s => s.id === slot.id ? { ...s, production_status: target } : s))
      toast.success(target === 'ready' ? 'Slot validé' : target === 'edited' ? 'Marqué comme monté' : 'Mis à jour')
    } catch (e) {
      toast.error('Erreur', (e as Error).message)
    }
  }

  async function updateSlot(id: string, patch: Partial<SocialPost>) {
    try {
      const res = await fetch(`/api/social/posts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? 'Erreur')
      }
      const updated = (await res.json()).data
      setSlots(prev => prev.map(s => s.id === id ? { ...s, ...updated } : s))
      if (selectedSlot?.id === id) setSelectedSlot(prev => prev ? { ...prev, ...updated } : prev)
      return true
    } catch (e) {
      toast.error('Erreur', (e as Error).message)
      return false
    }
  }

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1600, margin: '0 auto' }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 8,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: 'rgba(139,92,246,0.15)', color: '#8b5cf6',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Scissors size={20} />
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              Montage
            </h1>
            <p style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: '2px 0 0' }}>
              {role === 'monteur'
                ? 'Vidéos qui t\'attendent — clique pour voir le brief et le rush.'
                : 'Suivi des vidéos en montage.'}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {role === 'admin' && monteurs.length > 1 && (
            <select
              value={filterMonteur}
              onChange={e => setFilterMonteur(e.target.value)}
              style={{
                padding: '8px 12px', fontSize: 12,
                background: 'var(--bg-input)', color: 'var(--text-primary)',
                border: '1px solid var(--border-primary)', borderRadius: 8, outline: 'none',
              }}
            >
              <option value="all">Tous les monteurs</option>
              {monteurs.map(m => (
                <option key={m.user_id} value={m.user_id}>{m.email ?? m.user_id.slice(0, 8)}</option>
              ))}
            </select>
          )}
          <button
            onClick={fetchAll}
            disabled={loading}
            style={{
              padding: '8px 14px', fontSize: 12, fontWeight: 600,
              color: 'var(--text-secondary)', background: 'var(--bg-elevated)',
              border: '1px solid var(--border-primary)', borderRadius: 8,
              cursor: loading ? 'wait' : 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}
          >
            <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            Rafraîchir
          </button>
        </div>
      </div>

      {/* Board */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12,
        marginTop: 24,
      }}>
        {COLUMNS.map(col => {
          const Icon = col.icon
          const colSlots = slotsByColumn.get(col.key) ?? []
          return (
            <div
              key={col.key}
              style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-primary)',
                borderRadius: 12, padding: 12, minHeight: 400,
              }}
            >
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: 12, paddingBottom: 8,
                borderBottom: `2px solid ${col.color}33`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Icon size={14} color={col.color} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: col.color, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                    {col.label}
                  </span>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)' }}>
                  {colSlots.length}
                </span>
              </div>

              {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[1, 2].map(i => (
                    <div key={i} style={{ height: 80, background: 'var(--bg-elevated)', borderRadius: 8, animation: 'pulse 1.5s ease-in-out infinite' }} />
                  ))}
                </div>
              ) : colSlots.length === 0 ? (
                <div style={{
                  padding: 24, textAlign: 'center', fontSize: 12, color: 'var(--text-tertiary)',
                  fontStyle: 'italic',
                }}>
                  Vide
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {colSlots.map(slot => {
                    const pillar = pillars.find(p => p.id === slot.pillar_id)
                    return (
                      <button
                        key={slot.id}
                        onClick={() => setSelectedSlot(slot)}
                        style={{
                          textAlign: 'left', padding: 12,
                          background: 'var(--bg-elevated)',
                          border: `1px solid var(--border-primary)`,
                          borderLeft: `3px solid ${pillar?.color ?? col.color}`,
                          borderRadius: 8, cursor: 'pointer',
                          transition: 'all 0.15s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.borderColor = col.color }}
                        onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.borderColor = 'var(--border-primary)' }}
                      >
                        {pillar && (
                          <div style={{
                            display: 'inline-block',
                            fontSize: 9, fontWeight: 800, color: '#fff',
                            background: pillar.color, padding: '2px 6px', borderRadius: 3,
                            textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 6,
                          }}>{pillar.name}</div>
                        )}
                        <div style={{
                          fontSize: 13, fontWeight: 600, color: 'var(--text-primary)',
                          lineHeight: 1.3, marginBottom: 6,
                          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}>
                          {slot.hook || slot.title || <em style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>(sans accroche)</em>}
                        </div>
                        <div style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          fontSize: 10, color: 'var(--text-tertiary)',
                        }}>
                          <span>{slot.plan_date ? new Date(slot.plan_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '—'}</span>
                          {slot.rush_url && <span style={{ color: '#06b6d4' }}>● rush</span>}
                          {slot.final_url && <span style={{ color: '#8b5cf6' }}>● monté</span>}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Slot drawer */}
      {selectedSlot && (
        <SlotMontageDrawer
          slot={selectedSlot}
          pillar={pillars.find(p => p.id === selectedSlot.pillar_id) ?? null}
          role={role}
          currentUserId={currentUserId}
          onClose={() => setSelectedSlot(null)}
          onUpdate={updateSlot}
          onMove={moveSlot}
        />
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────
// Slot drawer — readonly brief + edit final_url + status transitions
// ────────────────────────────────────────────────────────────────────

function SlotMontageDrawer({
  slot, pillar, role, currentUserId, onClose, onUpdate, onMove,
}: {
  slot: SlotWithMonteur
  pillar: ContentPillar | null
  role: WorkspaceRole
  currentUserId: string | null
  onClose: () => void
  onUpdate: (id: string, patch: Partial<SocialPost>) => Promise<boolean>
  onMove: (slot: SlotWithMonteur, target: SocialProductionStatus) => Promise<void>
}) {
  const [finalUrl, setFinalUrl] = useState(slot.final_url ?? '')
  const [editorNotes, setEditorNotes] = useState(slot.editor_notes ?? '')
  const [saving, setSaving] = useState(false)

  const isMonteurOwner = role === 'monteur' && slot.monteur_id === currentUserId
  const canEditFinal = role === 'admin' || isMonteurOwner
  const status = slot.production_status as SocialProductionStatus

  async function save() {
    setSaving(true)
    await onUpdate(slot.id, { final_url: finalUrl || null, editor_notes: editorNotes || null })
    setSaving(false)
  }

  async function markEdited() {
    setSaving(true)
    const ok = await onUpdate(slot.id, { final_url: finalUrl || null, editor_notes: editorNotes || null })
    if (ok) await onMove(slot, 'edited')
    setSaving(false)
  }

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
      zIndex: 100, display: 'flex', justifyContent: 'flex-end',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: 'min(560px, 96vw)', height: '100%',
        background: 'var(--bg-primary)', borderLeft: '1px solid var(--border-primary)',
        display: 'flex', flexDirection: 'column',
        boxShadow: '-8px 0 40px rgba(0,0,0,0.4)',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-primary)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        }}>
          <div>
            {pillar && (
              <div style={{
                display: 'inline-block', marginBottom: 6,
                fontSize: 10, fontWeight: 800, color: '#fff',
                background: pillar.color, padding: '2px 8px', borderRadius: 4,
                textTransform: 'uppercase', letterSpacing: 0.3,
              }}>{pillar.name}</div>
            )}
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0, lineHeight: 1.3 }}>
              {slot.hook || slot.title || '(sans accroche)'}
            </h2>
            {slot.title && slot.hook && slot.title !== slot.hook && (
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3 }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.4, marginRight: 6 }}>Titre</span>
                {slot.title}
              </div>
            )}
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
              {slot.plan_date ? `Prévu le ${new Date(slot.plan_date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}` : 'Sans date'}
              {slot.content_kind && ` · ${slot.content_kind}`}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent', border: '1px solid var(--border-primary)',
              borderRadius: 6, padding: 6, cursor: 'pointer', color: 'var(--text-tertiary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >×</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Script */}
          {slot.script && (
            <Section label="Script">
              <div style={{
                fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5,
                background: 'var(--bg-secondary)', padding: '10px 12px', borderRadius: 8,
                whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              }}>
                {slot.script}
              </div>
            </Section>
          )}

          {/* References */}
          {slot.references_urls && slot.references_urls.length > 0 && (
            <Section label="Références / inspirations">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {slot.references_urls.map((url, i) => (
                  <a
                    key={i} href={url} target="_blank" rel="noopener noreferrer"
                    style={{
                      fontSize: 12, color: '#3b82f6',
                      padding: '6px 10px', background: 'var(--bg-secondary)',
                      borderRadius: 6, textDecoration: 'none',
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      wordBreak: 'break-all',
                    }}
                  >
                    <ExternalLink size={11} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{url}</span>
                  </a>
                ))}
              </div>
            </Section>
          )}

          {/* Notes */}
          {slot.notes && (
            <Section label="Notes du coach">
              <div style={{
                fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5,
                background: 'var(--bg-secondary)', padding: '10px 12px', borderRadius: 8,
                whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              }}>
                {slot.notes}
              </div>
            </Section>
          )}

          {/* Rush URL — readonly, big button */}
          <Section label="Rush brut">
            {slot.rush_url ? (
              <a
                href={slot.rush_url} target="_blank" rel="noopener noreferrer"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  padding: '14px 16px', borderRadius: 10,
                  background: 'linear-gradient(135deg, #06b6d4, #0891b2)',
                  color: '#fff', fontSize: 14, fontWeight: 700, textDecoration: 'none',
                }}
              >
                <ExternalLink size={16} />
                Ouvrir le rush
              </a>
            ) : (
              <div style={{
                padding: 14, textAlign: 'center', fontSize: 12,
                color: 'var(--text-tertiary)', fontStyle: 'italic',
                background: 'var(--bg-secondary)',
                border: '1px dashed var(--border-primary)', borderRadius: 8,
              }}>
                Le coach n&apos;a pas encore mis le lien du rush
              </div>
            )}
          </Section>

          {/* Final URL */}
          <Section label="Lien du montage final">
            <input
              type="url"
              value={finalUrl}
              onChange={e => setFinalUrl(e.target.value)}
              disabled={!canEditFinal || status === 'ready'}
              placeholder="https://drive.google.com/..."
              style={{
                width: '100%', boxSizing: 'border-box',
                background: 'var(--bg-input)', border: '1px solid var(--border-primary)',
                borderRadius: 8, padding: '10px 12px', fontSize: 13,
                color: 'var(--text-primary)', outline: 'none', fontFamily: 'monospace',
              }}
            />
          </Section>

          {/* Editor notes */}
          <Section label="Notes du monteur">
            <textarea
              value={editorNotes}
              onChange={e => setEditorNotes(e.target.value)}
              disabled={!canEditFinal || status === 'ready'}
              rows={4}
              placeholder="« j'ai zappé le passage 1:23, ajoute un B-roll si possible »"
              style={{
                width: '100%', boxSizing: 'border-box',
                background: 'var(--bg-input)', border: '1px solid var(--border-primary)',
                borderRadius: 8, padding: '10px 12px', fontSize: 13,
                color: 'var(--text-primary)', outline: 'none', resize: 'vertical', fontFamily: 'inherit',
              }}
            />
          </Section>
        </div>

        {/* Footer actions */}
        <div style={{
          padding: '14px 20px', borderTop: '1px solid var(--border-primary)',
          display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'center',
          background: 'var(--bg-secondary)',
        }}>
          <button
            onClick={save}
            disabled={saving || !canEditFinal || status === 'ready'}
            style={{
              padding: '8px 14px', fontSize: 12, fontWeight: 600,
              color: 'var(--text-secondary)', background: 'var(--bg-elevated)',
              border: '1px solid var(--border-primary)', borderRadius: 6,
              cursor: saving ? 'wait' : 'pointer',
              opacity: !canEditFinal || status === 'ready' ? 0.5 : 1,
            }}
          >
            {saving ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : 'Enregistrer'}
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            {status === 'filmed' && canEditFinal && (
              <button
                onClick={markEdited}
                disabled={saving || !finalUrl}
                title={!finalUrl ? 'Colle d\'abord le lien du montage' : ''}
                style={{
                  padding: '8px 16px', fontSize: 12, fontWeight: 700,
                  color: '#fff', background: '#8b5cf6',
                  border: 'none', borderRadius: 6, cursor: saving || !finalUrl ? 'not-allowed' : 'pointer',
                  opacity: saving || !finalUrl ? 0.5 : 1,
                }}
              >
                Marquer comme monté
              </button>
            )}
            {status === 'edited' && role === 'admin' && (
              <button
                onClick={() => onMove(slot, 'ready')}
                disabled={saving}
                style={{
                  padding: '8px 16px', fontSize: 12, fontWeight: 700,
                  color: '#fff', background: '#10b981',
                  border: 'none', borderRadius: 6, cursor: 'pointer',
                }}
              >
                Valider le montage
              </button>
            )}
            {status === 'edited' && role === 'admin' && (
              <button
                onClick={() => onMove(slot, 'filmed')}
                disabled={saving}
                style={{
                  padding: '8px 14px', fontSize: 12, fontWeight: 600,
                  color: '#f59e0b', background: 'rgba(245,158,11,0.1)',
                  border: '1px solid rgba(245,158,11,0.3)', borderRadius: 6, cursor: 'pointer',
                }}
              >
                Demander une retouche
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{
        fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)',
        textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8,
      }}>{label}</div>
      {children}
    </div>
  )
}
