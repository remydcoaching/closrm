'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { X, Trash2 } from 'lucide-react'
import type { SocialPostWithPublications, ContentPillar, SocialPlatform } from '@/types'
import { uploadToR2 } from '@/lib/storage/r2-upload-client'
import StepperBar from './StepperBar'
import BriefStep from './BriefStep'
import MontageStep from './MontageStep'
import PublicationStep from './PublicationStep'
import DiscussionFooter from './DiscussionFooter'
import MediaPreviewPane, { inferMediaKind } from './MediaPreviewPane'
import {
  getDefaultStep,
  isStepComplete,
  shouldShowDiscussion,
  getTransitionAction,
  type StepKey,
} from './slot-stepper'
import { useToast } from '@/components/ui/Toast'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Monteur {
  id: string
  email: string
  full_name?: string | null
}

interface Props {
  slotId: string
  pillars: ContentPillar[]
  onClose: () => void
  onChange: () => void
}

// ─── Constants ───────────────────────────────────────────────────────────────

const MAX_FILE_BYTES = 250 * 1024 * 1024 // 250 MB — match bucket limit

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function SlotDetailDrawer({ slotId, pillars, onClose, onChange }: Props) {
  const toast = useToast()

  // Core state
  const [slot, setSlot] = useState<SocialPostWithPublications | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeStep, setActiveStep] = useState<StepKey>('brief')

  // Monteurs: lazy-loaded only when visiting montage step
  const [monteurs, setMonteurs] = useState<Monteur[]>([])

  // AI generation
  const [hooksLibrary, setHooksLibrary] = useState<string[]>([])
  const [generatingHooks, setGeneratingHooks] = useState(false)
  const [generatingScript, setGeneratingScript] = useState(false)

  // Upload
  const [uploadingFinal, setUploadingFinal] = useState(false)
  const [uploadingMedia, setUploadingMedia] = useState(false)

  // Publication scheduling
  const [scheduling, setScheduling] = useState(false)
  const [scheduledTime, setScheduledTime] = useState<string>('18:00')

  // Delete confirm
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Discussion
  const [unreadCount, setUnreadCount] = useState(0)

  // ─── Fetch slot on mount ────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`/api/social/posts/${slotId}`)
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return
        const fetched = j.data as SocialPostWithPublications
        setSlot(fetched)
        setActiveStep(getDefaultStep(fetched))
      })
      .catch(() => {
        if (!cancelled) toast.error('Erreur chargement', 'Impossible de charger le slot.')
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slotId])

  // ─── Lazy fetch monteurs (only when montage step is active) ─────────────

  useEffect(() => {
    if (activeStep !== 'montage' || monteurs.length > 0) return
    fetch('/api/workspaces/members?role=monteur')
      .then((r) => r.json())
      .then((j: { data?: { user_id: string; user?: { email?: string | null; full_name?: string | null } | null }[] }) => {
        const list: Monteur[] = (j.data ?? []).map((m) => ({
          id: m.user_id,
          email: m.user?.email ?? m.user_id,
          full_name: m.user?.full_name ?? null,
        }))
        setMonteurs(list)
      })
      .catch(() => {})
  }, [activeStep, monteurs.length])

  // ─── Polling unread messages (scoped to drawer mount) ───────────────────

  useEffect(() => {
    if (!slotId) return
    let cancelled = false
    const fetchUnread = () => {
      fetch('/api/social/posts/messages-unread')
        .then((r) => r.json())
        .then((j) => {
          if (cancelled) return
          const map = (j?.data ?? {}) as Record<string, number>
          setUnreadCount(map[slotId] ?? 0)
        })
        .catch(() => {})
    }
    fetchUnread()
    const id = setInterval(fetchUnread, 20000)
    return () => { cancelled = true; clearInterval(id) }
  }, [slotId])

  // ─── Confirm delete timeout ─────────────────────────────────────────────

  useEffect(() => {
    if (!confirmDelete) return
    const t = setTimeout(() => setConfirmDelete(false), 5000)
    return () => clearTimeout(t)
  }, [confirmDelete])

  // ─── Update slot (optimistic with rollback) ─────────────────────────────

  const updateSlot = useCallback(
    async (patch: Partial<SocialPostWithPublications>) => {
      if (!slot) return
      const previous = slot
      setSlot({ ...slot, ...patch })
      try {
        const res = await fetch(`/api/social/posts/${slotId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        })
        if (!res.ok) {
          const j = await res.json().catch(() => ({}))
          toast.error('Erreur sauvegarde', (j as { error?: string }).error ?? '')
          setSlot(previous)
        } else {
          onChange()
        }
      } catch (e) {
        toast.error('Erreur réseau', (e as Error).message)
        setSlot(previous)
      }
    },
    [slot, slotId, toast, onChange]
  )

  // ─── Generate hooks ─────────────────────────────────────────────────────

  const generateHooks = useCallback(async () => {
    if (!slot) return
    setGeneratingHooks(true)
    try {
      const res = await fetch('/api/social/generate-hooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pillar_id: slot.pillar_id,
          content_kind: slot.content_kind,
          topic: slot.title ?? undefined,
          count: 5,
        }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error((j as { error?: string }).error ?? 'Erreur')
      setHooksLibrary((j as { hooks?: string[] }).hooks ?? [])
    } catch (e) {
      toast.error('Erreur génération', (e as Error).message)
    } finally {
      setGeneratingHooks(false)
    }
  }, [slot, toast])

  // ─── Generate script ────────────────────────────────────────────────────

  const generateScript = useCallback(async () => {
    if (!slot) return
    if (!slot.hook && !slot.title) {
      toast.error('Hook manquant', 'Renseigne un hook ou un titre avant de générer le script.')
      return
    }
    setGeneratingScript(true)
    try {
      const res = await fetch('/api/social/generate-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hook: slot.hook,
          title: slot.title,
          pillar_id: slot.pillar_id,
          content_kind: slot.content_kind,
        }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error((j as { error?: string }).error ?? 'Erreur')
      await updateSlot({ script: (j as { script?: string }).script ?? undefined })
    } catch (e) {
      toast.error('Erreur génération script', (e as Error).message)
    } finally {
      setGeneratingScript(false)
    }
  }, [slot, updateSlot, toast])

  // ─── Upload via Cloudflare R2 (presigned PUT) ───────────────────────────

  const uploadFinal = useCallback(
    async (file: File) => {
      if (!slot) return
      if (file.size > MAX_FILE_BYTES) {
        toast.error('Fichier trop lourd', `Max 250 Mo — ce fichier fait ${formatSize(file.size)}.`)
        return
      }
      setUploadingFinal(true)
      try {
        const { path } = await uploadToR2(file, { post_id: slot.id, target: 'final' })
        await updateSlot({ final_url: path })
      } catch (e) {
        toast.error('Erreur upload', e instanceof Error ? e.message : String(e))
      } finally {
        setUploadingFinal(false)
      }
    },
    [slot, updateSlot, toast]
  )

  const uploadMedia = useCallback(
    async (file: File) => {
      if (!slot) return
      if (file.size > MAX_FILE_BYTES) {
        toast.error('Fichier trop lourd', `Max 250 Mo — ce fichier fait ${formatSize(file.size)}.`)
        return
      }
      setUploadingMedia(true)
      try {
        const { path } = await uploadToR2(file, { post_id: slot.id, target: 'media' })
        await updateSlot({ media_urls: [...(slot.media_urls ?? []), path] })
      } catch (e) {
        toast.error('Erreur upload', e instanceof Error ? e.message : String(e))
      } finally {
        setUploadingMedia(false)
      }
    },
    [slot, updateSlot, toast]
  )

  // ─── Toggle platform ────────────────────────────────────────────────────

  const togglePlatform = useCallback(
    (platform: SocialPlatform, enabled: boolean) => {
      if (!slot) return
      let pubs = [...(slot.publications ?? [])]
      if (!enabled) {
        pubs = pubs.filter((p) => p.platform !== platform)
      } else {
        const config =
          platform === 'youtube'
            ? { title: slot.title ?? '', description: slot.caption ?? '', privacy_status: 'public' as const }
            : platform === 'instagram'
            ? { caption: slot.caption ?? '', hashtags: slot.hashtags ?? [] }
            : {}
        pubs.push({
          id: `tmp-${platform}-${Date.now()}`,
          social_post_id: slot.id,
          workspace_id: slot.workspace_id,
          platform,
          config,
          scheduled_at: slot.scheduled_at,
          status: 'pending' as const,
          provider_post_id: null,
          public_url: null,
          published_at: null,
          error_message: null,
          retry_count: 0,
          last_attempt_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
      }
      updateSlot({ publications: pubs })
    },
    [slot, updateSlot]
  )

  // ─── Update publication config ──────────────────────────────────────────

  const updatePublication = useCallback(
    (platform: SocialPlatform, patch: Record<string, unknown>) => {
      if (!slot) return
      const pubs = (slot.publications ?? []).map((p) =>
        p.platform === platform
          ? { ...p, config: { ...(p.config as Record<string, unknown>), ...patch } }
          : p
      )
      updateSlot({ publications: pubs })
    },
    [slot, updateSlot]
  )

  // ─── Schedule ───────────────────────────────────────────────────────────

  const schedule = useCallback(async () => {
    if (!slot || !slot.plan_date) {
      toast.error('Date requise', 'Une date prévue est nécessaire pour programmer.')
      return
    }
    const activePubs = (slot.publications ?? []).filter((p) => p.platform)
    if (activePubs.length === 0) {
      toast.error('Plateforme manquante', 'Sélectionne au moins une plateforme.')
      return
    }
    if (!slot.media_urls || slot.media_urls.length === 0) {
      toast.error('Média manquant', 'Au moins un média est requis.')
      return
    }
    const ytPub = (slot.publications ?? []).find((p) => p.platform === 'youtube')
    if (ytPub) {
      const ytTitle = ((ytPub.config as Record<string, unknown> | undefined)?.title as string | undefined)?.trim()
      if (!ytTitle) {
        toast.error('Titre YouTube manquant', 'Renseigne un titre avant de programmer.')
        return
      }
    }
    setScheduling(true)
    try {
      const scheduledAt = new Date(slot.plan_date + `T${scheduledTime}:00`).toISOString()
      const res = await fetch(`/api/social/posts/${slotId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'scheduled',
          scheduled_at: scheduledAt,
          publications: activePubs.map((p) => ({
            platform: p.platform,
            config: p.config,
            scheduled_at: scheduledAt,
          })),
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error((j as { error?: string }).error ?? `Erreur ${res.status}`)
      }
      toast.success('Publication programmée', 'Le slot a été programmé avec succès.')
      onChange()
      onClose()
    } catch (e) {
      toast.error('Erreur programmation', (e as Error).message)
    } finally {
      setScheduling(false)
    }
  }, [slot, slotId, scheduledTime, toast, onChange, onClose])

  // ─── Transition step ────────────────────────────────────────────────────

  const transition = useCallback(async () => {
    if (!slot) return
    const action = getTransitionAction(slot, activeStep)
    if (!action) return
    await updateSlot({ production_status: action.nextStatus })
    // Auto-switch to next step after transition
    if (action.nextStatus === 'filmed') setActiveStep('montage')
    if (action.nextStatus === 'ready') setActiveStep('publication')
  }, [slot, activeStep, updateSlot])

  // ─── Delete slot ────────────────────────────────────────────────────────

  const handleDelete = useCallback(async () => {
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    const res = await fetch(`/api/social/posts/${slotId}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Slot supprimé')
      onChange()
      onClose()
    } else {
      toast.error('Erreur suppression')
    }
  }, [confirmDelete, slotId, toast, onChange, onClose])

  // ─── Computed ───────────────────────────────────────────────────────────

  const completed = useMemo(() => {
    if (!slot) return { brief: false, montage: false, publication: false }
    return {
      brief: isStepComplete(slot, 'brief'),
      montage: isStepComplete(slot, 'montage'),
      publication: isStepComplete(slot, 'publication'),
    }
  }, [slot])

  // ─── Render ─────────────────────────────────────────────────────────────

  if (loading || !slot) {
    return (
      <Modal onClose={onClose}>
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
          Chargement…
        </div>
      </Modal>
    )
  }

  const transitionAction = getTransitionAction(slot, activeStep)
  const readOnly =
    slot.status === 'scheduled' ||
    slot.status === 'published' ||
    slot.status === 'publishing'
  const pillar = pillars.find((p) => p.id === slot.pillar_id)
  const monteurForSlot = monteurs.find((m) => m.id === slot.monteur_id)

  // Media to show in the right pane: prio final_url > first media_url > rush_url (link only)
  const previewMedia = (() => {
    if (slot.final_url) return { url: slot.final_url, kind: inferMediaKind(slot.final_url), label: 'Montage final' }
    const firstMedia = slot.media_urls?.[0]
    if (firstMedia) return { url: firstMedia, kind: inferMediaKind(firstMedia), label: 'Média de publication' }
    if (slot.rush_url) return { url: slot.rush_url, kind: 'link' as const, label: 'Rush' }
    return null
  })()
  const hasMedia = previewMedia !== null

  return (
    <Modal onClose={onClose}>
      {/* ── Header compact 1 ligne ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '14px 16px',
        borderBottom: '1px solid var(--border-primary)', flexShrink: 0,
      }}>
        {pillar && (
          <span style={{
            fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 4,
            background: pillar.color ?? '#a78bfa', color: '#fff', whiteSpace: 'nowrap', flexShrink: 0,
          }}>
            {pillar.name}
          </span>
        )}
        {slot.content_kind && (
          <span style={{
            fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 4,
            background: 'var(--bg-elevated)', color: 'var(--text-secondary)',
            whiteSpace: 'nowrap', flexShrink: 0, textTransform: 'uppercase',
          }}>
            {slot.content_kind}
          </span>
        )}
        <input
          type="text"
          value={slot.title ?? ''}
          onChange={(e) => updateSlot({ title: e.target.value })}
          placeholder="Titre du post…"
          readOnly={readOnly}
          style={{
            flex: 1, minWidth: 0, fontSize: 15, fontWeight: 700,
            background: 'transparent', color: 'var(--text-primary)',
            border: 'none', outline: 'none',
          }}
        />
        {slot.plan_date && (
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)', whiteSpace: 'nowrap', flexShrink: 0 }}>
            {new Date(slot.plan_date).toLocaleDateString('fr-FR', {
              weekday: 'short', day: '2-digit', month: 'short',
            })}
          </span>
        )}
        {!readOnly && (
          <button
            onClick={handleDelete}
            title={confirmDelete ? 'Cliquer à nouveau pour confirmer' : 'Supprimer'}
            style={{
              width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: confirmDelete ? 'var(--color-danger, #ef4444)' : 'transparent',
              color: confirmDelete ? '#fff' : 'var(--text-tertiary)',
              border: '1px solid var(--border-primary)', borderRadius: 6, cursor: 'pointer',
            }}
          >
            <Trash2 size={14} />
          </button>
        )}
        <button
          onClick={onClose}
          style={{
            width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'transparent', color: 'var(--text-tertiary)',
            border: '1px solid var(--border-primary)', borderRadius: 6, cursor: 'pointer', flexShrink: 0,
          }}
        >
          <X size={14} />
        </button>
      </div>

      {/* ── StepperBar ── */}
      <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid var(--border-primary)', flexShrink: 0 }}>
        <StepperBar active={activeStep} completed={completed} onSelect={setActiveStep} />
      </div>

      {/* ── Step content (col gauche) + MediaPreviewPane (col droite si média) ── */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <div style={{ flex: hasMedia ? '0 0 460px' : 1, overflowY: 'auto', minHeight: 0, minWidth: 0 }}>
          {activeStep === 'brief' && (
            <BriefStep
              slot={slot}
              onUpdate={updateSlot}
              onGenerateHooks={generateHooks}
              onGenerateScript={generateScript}
              generatingHooks={generatingHooks}
              generatingScript={generatingScript}
              hooksLibrary={hooksLibrary}
              onPickHook={(h) => updateSlot({ hook: h })}
              transitionAction={transitionAction as { label: string; nextStatus: 'filmed' | 'ready' } | null}
              onTransition={transition}
            />
          )}
          {activeStep === 'montage' && (
            <MontageStep
              slot={slot}
              monteurs={monteurs}
              onUpdate={updateSlot}
              onUploadFinal={uploadFinal}
              uploading={uploadingFinal}
              transitionAction={transitionAction as { label: string; nextStatus: 'ready' } | null}
              onTransition={transition}
            />
          )}
          {activeStep === 'publication' && (
            <PublicationStep
              slot={slot}
              onUpdate={updateSlot}
              onTogglePlatform={togglePlatform}
              onUpdatePublication={updatePublication}
              onUploadMedia={uploadMedia}
              uploading={uploadingMedia}
              onSchedule={schedule}
              scheduling={scheduling}
              readOnly={readOnly}
              scheduledTime={scheduledTime}
              onScheduledTimeChange={setScheduledTime}
            />
          )}
        </div>
        {hasMedia && previewMedia && (
          <MediaPreviewPane
            url={previewMedia.url}
            kind={previewMedia.kind}
            label={previewMedia.label}
          />
        )}
      </div>

      {/* ── Discussion footer (only when monteur assigned) ── */}
      {shouldShowDiscussion(slot) && (
        <DiscussionFooter
          slotId={slotId}
          monteurName={monteurForSlot?.full_name ?? monteurForSlot?.email ?? undefined}
          unreadCount={unreadCount}
          onMarkRead={() => setUnreadCount(0)}
        />
      )}
    </Modal>
  )
}

// ─── Modal wrapper ────────────────────────────────────────────────────────────

function Modal({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 1100, maxHeight: '90vh',
          display: 'flex', flexDirection: 'column',
          background: 'var(--bg-primary)',
          border: '1px solid var(--border-primary)', borderRadius: 12,
          overflow: 'hidden',
        }}
      >
        {children}
      </div>
    </div>
  )
}
