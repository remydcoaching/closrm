'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { Scissors, Clapperboard, Scissors as Cut, Sparkles, ExternalLink, Loader2, Filter, RefreshCw, Receipt, KanbanSquare, CheckCircle2 } from 'lucide-react'
import type { SocialPost, SocialProductionStatus, ContentPillar, WorkspaceRole, MonteurPricingTier } from '@/types'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'

// Drawer complet du coach (avec script/caption/hashtags/prestation/etc.)
// Lazy : ~2k lignes, ne charge que si l'admin clique sur un slot.
const SlotDetailDrawer = dynamic(() => import('@/components/social/planning/SlotDetailDrawer'), { ssr: false })

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
  const [billingSlots, setBillingSlots] = useState<SlotWithMonteur[]>([])
  const [pricingTiers, setPricingTiers] = useState<MonteurPricingTier[]>([])
  const [pillars, setPillars] = useState<ContentPillar[]>([])
  const [monteurs, setMonteurs] = useState<MonteurOption[]>([])
  const [filterMonteur, setFilterMonteur] = useState<string | 'all'>('all')
  const [view, setView] = useState<'board' | 'billing'>('board')
  const [paidFilter, setPaidFilter] = useState<'all' | 'unpaid' | 'paid'>('unpaid')
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

      // 1 seul fetch (ex 2) en mode slim : on charge tous les slots du workspace
      // puis on filtre côté client pour le board (filmed/edited/ready non publiés)
      // et le tab Facturation (pricing_tier_id != null).
      // Économise 1 round-trip + 1 pass RLS + ~80% de payload (pas de script/caption/notes).
      const slotsRes = await fetch('/api/social/posts?per_page=500&slim=true')
      const slotsJson = await slotsRes.json()
      const allRows = (slotsJson.data ?? []) as SlotWithMonteur[]
      setSlots(allRows.filter(s =>
        ['filmed', 'edited', 'ready'].includes(s.production_status ?? '')
        && s.status !== 'published'
      ))
      setBillingSlots(allRows.filter(s => s.pricing_tier_id != null))

      // Fetch pricing tiers (tous monteurs confondus pour pouvoir afficher le name + prix)
      const tiersRes = await fetch('/api/monteur-pricing-tiers?include_archived=true')
      const tiersJson = await tiersRes.json()
      setPricingTiers(tiersJson.data ?? [])

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
        marginBottom: 16,
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
                : 'Suivi des vidéos en montage et facturation.'}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {role === 'admin' && monteurs.length > 1 && view === 'board' && (
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

      {/* Tabs Board / Facturation */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 18, padding: 3, background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)', borderRadius: 10, width: 'fit-content' }}>
        <button
          onClick={() => setView('board')}
          style={tabStyle(view === 'board')}
        >
          <KanbanSquare size={13} /> Board
        </button>
        <button
          onClick={() => setView('billing')}
          style={tabStyle(view === 'billing')}
        >
          <Receipt size={13} /> Facturation
        </button>
      </div>

      {/* Board view */}
      {view === 'board' && (
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12,
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
      )}

      {/* Billing view */}
      {view === 'billing' && (
        <BillingView
          slots={billingSlots}
          tiers={pricingTiers}
          monteurs={monteurs}
          role={role}
          paidFilter={paidFilter}
          onPaidFilterChange={setPaidFilter}
          filterMonteur={filterMonteur}
          onFilterMonteurChange={setFilterMonteur}
          onUpdate={updateSlot}
          loading={loading}
        />
      )}

      {/* Slot drawer
          - admin/coach : drawer complet du planning (script, prestation, payment, etc.)
          - monteur : drawer simplifié focalisé sur rush + final_url + notes monteur
       */}
      {selectedSlot && role !== 'monteur' && (
        <SlotDetailDrawer
          slotId={selectedSlot.id}
          pillars={pillars}
          onClose={() => setSelectedSlot(null)}
          onChange={fetchAll}
          hideAiActions
        />
      )}
      {selectedSlot && role === 'monteur' && (
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
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)',
      zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: 'min(720px, 100%)', maxHeight: '92vh',
        background: 'var(--bg-primary)', border: '1px solid var(--border-primary)',
        borderRadius: 16,
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 80px rgba(0,0,0,0.6)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '18px 24px',
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
              borderRadius: 8, padding: 8, cursor: 'pointer', color: 'var(--text-tertiary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16,
            }}
            aria-label="Fermer"
          >×</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
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
          padding: '14px 24px', borderTop: '1px solid var(--border-primary)',
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

// ────────────────────────────────────────────────────────────────────
// Billing view — facturation des slots assignés aux monteurs
// ────────────────────────────────────────────────────────────────────

function tabStyle(active: boolean): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '6px 14px', fontSize: 12, fontWeight: 600,
    color: active ? '#fff' : 'var(--text-tertiary)',
    background: active ? '#8b5cf6' : 'transparent',
    border: 'none', borderRadius: 7, cursor: 'pointer',
    transition: 'all 0.15s',
  }
}

function fmtEuros(cents: number): string {
  return (cents / 100).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' €'
}

interface BillingViewProps {
  slots: SlotWithMonteur[]
  tiers: MonteurPricingTier[]
  monteurs: MonteurOption[]
  role: WorkspaceRole
  paidFilter: 'all' | 'unpaid' | 'paid'
  onPaidFilterChange: (f: 'all' | 'unpaid' | 'paid') => void
  filterMonteur: string | 'all'
  onFilterMonteurChange: (id: string | 'all') => void
  onUpdate: (id: string, patch: Partial<SocialPost>) => Promise<boolean>
  loading: boolean
}

function BillingView({
  slots, tiers, monteurs, role, paidFilter, onPaidFilterChange,
  filterMonteur, onFilterMonteurChange, onUpdate, loading,
}: BillingViewProps) {
  const tierMap = useMemo(() => new Map(tiers.map(t => [t.id, t])), [tiers])
  const monteurMap = useMemo(() => new Map(monteurs.map(m => [m.user_id, m])), [monteurs])

  const filtered = useMemo(() => {
    let list = slots
    if (paidFilter === 'unpaid') list = list.filter(s => !s.paid_at)
    else if (paidFilter === 'paid') list = list.filter(s => !!s.paid_at)
    if (filterMonteur !== 'all') list = list.filter(s => s.monteur_id === filterMonteur)
    return [...list].sort((a, b) => {
      // Non-payés d'abord, puis par plan_date desc
      if (!!a.paid_at !== !!b.paid_at) return a.paid_at ? 1 : -1
      const ad = a.plan_date ?? a.created_at
      const bd = b.plan_date ?? b.created_at
      return bd.localeCompare(ad)
    })
  }, [slots, paidFilter, filterMonteur])

  const totalUnpaid = useMemo(() => {
    return slots
      .filter(s => !s.paid_at && (filterMonteur === 'all' || s.monteur_id === filterMonteur))
      .reduce((sum, s) => sum + (tierMap.get(s.pricing_tier_id ?? '')?.price_cents ?? 0), 0)
  }, [slots, filterMonteur, tierMap])

  const totalPaid = useMemo(() => {
    return slots
      .filter(s => s.paid_at && (filterMonteur === 'all' || s.monteur_id === filterMonteur))
      .reduce((sum, s) => sum + (tierMap.get(s.pricing_tier_id ?? '')?.price_cents ?? 0), 0)
  }, [slots, filterMonteur, tierMap])

  return (
    <div>
      {/* Filters + totals */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12,
        marginBottom: 18,
      }}>
        <div style={{
          padding: 16, borderRadius: 12,
          background: 'linear-gradient(135deg, rgba(139,92,246,0.15), rgba(139,92,246,0.05))',
          border: '1px solid rgba(139,92,246,0.3)',
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#8b5cf6', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>
            À payer
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>
            {fmtEuros(totalUnpaid)}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 6 }}>
            {slots.filter(s => !s.paid_at && (filterMonteur === 'all' || s.monteur_id === filterMonteur)).length} prestation(s)
          </div>
        </div>
        <div style={{
          padding: 16, borderRadius: 12,
          background: 'linear-gradient(135deg, rgba(16,185,129,0.12), rgba(16,185,129,0.04))',
          border: '1px solid rgba(16,185,129,0.25)',
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#10b981', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>
            Déjà payé (cumulé)
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>
            {fmtEuros(totalPaid)}
          </div>
        </div>
      </div>

      {/* Filter buttons */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 4, padding: 3, background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)', borderRadius: 8 }}>
          {(['unpaid', 'paid', 'all'] as const).map(f => (
            <button
              key={f}
              onClick={() => onPaidFilterChange(f)}
              style={{
                padding: '5px 12px', fontSize: 11, fontWeight: 600,
                color: paidFilter === f ? '#fff' : 'var(--text-tertiary)',
                background: paidFilter === f ? '#8b5cf6' : 'transparent',
                border: 'none', borderRadius: 5, cursor: 'pointer',
              }}
            >
              {f === 'unpaid' ? 'À payer' : f === 'paid' ? 'Payés' : 'Tout'}
            </button>
          ))}
        </div>
        {role === 'admin' && monteurs.length > 1 && (
          <select
            value={filterMonteur}
            onChange={e => onFilterMonteurChange(e.target.value)}
            style={{
              padding: '6px 12px', fontSize: 12,
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
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ padding: 32, textAlign: 'center', fontSize: 13, color: 'var(--text-tertiary)' }}>
          <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
        </div>
      ) : filtered.length === 0 ? (
        <div style={{
          padding: 40, textAlign: 'center',
          background: 'var(--bg-secondary)', border: '1px dashed var(--border-primary)',
          borderRadius: 10, fontSize: 13, color: 'var(--text-tertiary)',
        }}>
          {paidFilter === 'unpaid' ? 'Rien à payer 🎉' : paidFilter === 'paid' ? 'Aucun paiement enregistré.' : 'Aucune prestation facturable.'}
        </div>
      ) : (
        <div style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-primary)',
          borderRadius: 10, overflow: 'hidden',
        }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '2fr 1.2fr 1fr 0.8fr 1fr 0.8fr',
            padding: '10px 14px', fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)',
            textTransform: 'uppercase', letterSpacing: 0.4,
            borderBottom: '1px solid var(--border-primary)',
            background: 'var(--bg-elevated)',
          }}>
            <span>Vidéo</span>
            <span>Monteur</span>
            <span>Prestation</span>
            <span style={{ textAlign: 'right' }}>Montant</span>
            <span>Date</span>
            <span style={{ textAlign: 'center' }}>Statut</span>
          </div>
          {filtered.map(s => {
            const tier = s.pricing_tier_id ? tierMap.get(s.pricing_tier_id) : null
            const monteur = s.monteur_id ? monteurMap.get(s.monteur_id) : null
            return (
              <div key={s.id} style={{
                display: 'grid', gridTemplateColumns: '2fr 1.2fr 1fr 0.8fr 1fr 0.8fr',
                padding: '12px 14px', fontSize: 12,
                borderTop: '1px solid var(--border-primary)',
                alignItems: 'center',
                background: s.paid_at ? 'rgba(16,185,129,0.04)' : 'transparent',
              }}>
                <span style={{ color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {s.hook || s.title || <em style={{ color: 'var(--text-tertiary)' }}>(sans accroche)</em>}
                </span>
                <span style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {monteur?.email ?? '—'}
                </span>
                <span style={{ color: 'var(--text-secondary)' }}>
                  {tier?.name ?? '—'}
                </span>
                <span style={{ textAlign: 'right', fontWeight: 700, color: '#8b5cf6' }}>
                  {tier ? fmtEuros(tier.price_cents) : '—'}
                </span>
                <span style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>
                  {s.plan_date ? new Date(s.plan_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: '2-digit' }) : '—'}
                </span>
                <span style={{ textAlign: 'center' }}>
                  {role === 'monteur' ? (
                    s.paid_at ? (
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#10b981', padding: '3px 8px', borderRadius: 4, background: 'rgba(16,185,129,0.12)' }}>
                        ✓ Payé
                      </span>
                    ) : (
                      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)' }}>
                        En attente
                      </span>
                    )
                  ) : (
                    <button
                      onClick={() => onUpdate(s.id, { paid_at: s.paid_at ? null : new Date().toISOString() })}
                      style={{
                        padding: '4px 10px', fontSize: 10, fontWeight: 700,
                        color: s.paid_at ? '#10b981' : '#fff',
                        background: s.paid_at ? 'rgba(16,185,129,0.12)' : '#8b5cf6',
                        border: s.paid_at ? '1px solid rgba(16,185,129,0.3)' : 'none',
                        borderRadius: 5, cursor: 'pointer',
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                      }}
                    >
                      {s.paid_at ? <><CheckCircle2 size={10} /> Payé</> : 'Marquer payé'}
                    </button>
                  )}
                </span>
              </div>
            )
          })}
        </div>
      )}
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
