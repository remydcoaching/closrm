'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import {
  X, Calendar as CalIcon, Send, Trash2, Plus, Image as ImgIcon,
  Camera, Film, FileText, Sparkles, Hash, Link2, Check, ChevronDown,
  ChevronLeft, ChevronRight, Upload, Loader, Wand2, BookOpen, Star, TrendingUp,
  Settings, Video, Zap,
} from 'lucide-react'
import { createClient as createBrowserClient } from '@/lib/supabase/client'
import SlotChat from '@/components/social/SlotChat'
import {
  type ContentPillar,
  type SocialPostWithPublications,
  type SocialPlatform,
  type SocialPostMediaType,
  type SocialProductionStatus,
  type SocialContentKind,
  PRODUCTION_STATUSES,
} from '@/types'
import { useToast } from '@/components/ui/Toast'

const PLATFORMS: { key: SocialPlatform; label: string; color: string; icon: typeof Camera; disabled?: boolean }[] = [
  { key: 'instagram', label: 'Instagram', color: '#EC4899', icon: Camera },
  { key: 'youtube',   label: 'YouTube',   color: '#FF0000', icon: Video },
  { key: 'tiktok',    label: 'TikTok',    color: '#000000', icon: Film, disabled: true },
]

function detectMediaType(urls: string[], firstIsVideo: boolean, durationSec: number | null): SocialPostMediaType | null {
  if (urls.length === 0) return null
  if (firstIsVideo) {
    if (durationSec != null && durationSec <= 60) return 'SHORT'
    return 'VIDEO'
  }
  return urls.length > 1 ? 'CAROUSEL' : 'IMAGE'
}

interface Props {
  slotId: string
  pillars: ContentPillar[]
  onClose: () => void
  onChange: () => void
  /** Cache les boutons IA (Suggérer/Générer/Personnaliser) — utile sur /montage où la production éditoriale est déjà finie */
  hideAiActions?: boolean
}

type SectionExpansion = { brief: boolean; montage: boolean; publication: boolean }

function getDefaultExpansion(slot: SocialPostWithPublications): SectionExpansion {
  const ps = slot.production_status ?? 'idea'
  const s  = slot.status ?? 'draft'
  const isPublishedish = s === 'scheduled' || s === 'publishing' || s === 'published'

  if (isPublishedish) return { brief: false, montage: false, publication: true }
  if (ps === 'idea')   return { brief: true,  montage: false, publication: false }
  if (ps === 'filmed' || ps === 'edited') return { brief: false, montage: true, publication: false }
  // 'ready'
  return { brief: false, montage: false, publication: true }
}

export default function SlotDetailDrawer({ slotId, pillars, onClose, onChange, hideAiActions = false }: Props) {
  const toast = useToast()
  const [slot, setSlot] = useState<SocialPostWithPublications | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [scheduling, setScheduling] = useState(false)
  const [scheduleTime, setScheduleTime] = useState('18:00')
  const [showScheduleConfirm, setShowScheduleConfirm] = useState(false)
  const [hookSuggestions, setHookSuggestions] = useState<string[] | null>(null)
  const [generatingHooks, setGeneratingHooks] = useState(false)
  const [generatingScript, setGeneratingScript] = useState(false)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [activePlatformTab, setActivePlatformTab] = useState<SocialPlatform>('instagram')
  const [briefOpen, setBriefOpen] = useState(false)
  const [montageOpen, setMontageOpen] = useState(false)
  const [pubOpen, setPubOpen] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const initSlotIdRef = useRef<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [mediaIsVideo, setMediaIsVideo] = useState(false)
  const [mediaDurationSec, setMediaDurationSec] = useState<number | null>(null)
  const [publishingNow, setPublishingNow] = useState(false)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      const res = await fetch(`/api/social/posts/${slotId}`)
      if (cancelled) return
      const json = await res.json()
      setSlot(json.data ?? null)
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [slotId])

  const patch = async (fields: Partial<SocialPostWithPublications>) => {
    if (!slot) return
    setSaving(true)
    setSlot({ ...slot, ...fields })
    try {
      await fetch(`/api/social/posts/${slot.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      })
      onChange()
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!slot) return
    await fetch(`/api/social/posts/${slot.id}`, { method: 'DELETE' })
    setConfirmDelete(false)
    onChange()
    onClose()
  }

  const handleSchedule = async () => {
    if (!slot || !slot.plan_date) {
      toast.error('Date requise', 'Une date prévue est requise pour programmer le slot.')
      return
    }
    if (!validateBeforePublish()) return
    setScheduling(true)
    try {
      const [hh, mm] = scheduleTime.split(':')
      const dt = new Date(slot.plan_date + 'T' + hh + ':' + mm + ':00')
      const activePubs = (slot.publications ?? []).filter((p) => enabledPlatforms[p.platform as SocialPlatform])
      await fetch(`/api/social/posts/${slot.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'scheduled',
          scheduled_at: dt.toISOString(),
          publications: activePubs.map((p) => ({ platform: p.platform, config: p.config, scheduled_at: dt.toISOString() })),
        }),
      })
      setShowScheduleConfirm(false)
      onChange()
      onClose()
    } finally {
      setScheduling(false)
    }
  }

  const handleUnschedule = async () => {
    if (!slot) return
    await patch({ status: 'draft', scheduled_at: null })
  }

  // ─── Platform helpers ────────────────────────────────────
  // enabledPlatforms reflète UNIQUEMENT les publications réellement persistées.
  // Pas de "default on" cosmétique : si l'utilisateur n'a rien activé, rien n'est on.
  const enabledPlatforms = useMemo<Record<SocialPlatform, boolean>>(() => {
    const set = new Set((slot?.publications ?? []).map((p) => p.platform))
    return {
      instagram: set.has('instagram'),
      youtube: set.has('youtube'),
      tiktok: set.has('tiktok'),
    }
  }, [slot?.publications])

  const ytPub = useMemo(() => slot?.publications?.find((p) => p.platform === 'youtube'), [slot?.publications])
  const ytConfig = (ytPub?.config ?? {}) as { title?: string; description?: string; privacy_status?: 'public' | 'unlisted' | 'private' }

  const makePub = (platform: SocialPlatform, slot: SocialPostWithPublications) => {
    const config = platform === 'youtube'
      ? { title: slot.title ?? '', description: slot.caption ?? '', privacy_status: 'public' as const }
      : platform === 'instagram'
        ? { caption: slot.caption ?? '', hashtags: slot.hashtags ?? [] }
        : {}
    return {
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
    }
  }

  const togglePlatform = async (platform: SocialPlatform) => {
    if (!slot) return
    const isOn = enabledPlatforms[platform]
    let pubs = [...(slot.publications ?? [])]
    if (isOn) {
      pubs = pubs.filter((p) => p.platform !== platform)
    } else {
      pubs.push(makePub(platform, slot))
    }
    setSlot({ ...slot, publications: pubs })
    setActivePlatformTab(platform)
    await fetch(`/api/social/posts/${slot.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        publications: pubs.map((p) => ({ platform: p.platform, config: p.config })),
      }),
    })
    onChange()
  }

  const updatePlatformConfig = async (platform: SocialPlatform, patch: Record<string, unknown>) => {
    if (!slot) return
    const pubs = (slot.publications ?? []).map((p) =>
      p.platform === platform ? { ...p, config: { ...(p.config as Record<string, unknown>), ...patch } } : p
    )
    setSlot({ ...slot, publications: pubs })
    await fetch(`/api/social/posts/${slot.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        publications: pubs.map((p) => ({ platform: p.platform, config: p.config })),
      }),
    })
  }

  // ─── Auto-detect media type from media_urls ──────────────
  useEffect(() => {
    if (!slot?.media_urls || slot.media_urls.length === 0) return
    const firstUrl = slot.media_urls[0]
    const isVideo = /\.(mp4|mov|webm|m4v)(\?|$)/i.test(firstUrl)
    setMediaIsVideo(isVideo)
    if (isVideo && mediaDurationSec === null) {
      const v = document.createElement('video')
      v.preload = 'metadata'
      v.src = firstUrl
      v.onloadedmetadata = () => setMediaDurationSec(v.duration)
      v.onerror = () => setMediaDurationSec(null)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slot?.media_urls])

  const computedMediaType = useMemo(
    () => detectMediaType(slot?.media_urls ?? [], mediaIsVideo, mediaDurationSec),
    [slot?.media_urls, mediaIsVideo, mediaDurationSec]
  )

  // Persist computed media_type when it changes
  useEffect(() => {
    if (slot && computedMediaType !== slot.media_type) {
      patch({ media_type: computedMediaType })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [computedMediaType])

  const handlePublishNow = async () => {
    if (!slot) return
    if (!validateBeforePublish()) return
    setPublishingNow(true)
    try {
      // First save: mark scheduled with now+1s
      const now = new Date(Date.now() - 1000)
      await fetch(`/api/social/posts/${slot.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'scheduled',
          scheduled_at: now.toISOString(),
        }),
      })
      // Then trigger immediate publish
      const pubRes = await fetch(`/api/social/posts/${slot.id}/publish`, { method: 'POST' })
      const pubJson = await pubRes.json().catch(() => ({}))
      if (!pubRes.ok) throw new Error(pubJson.error ?? `Erreur ${pubRes.status}`)
      onChange()
      onClose()
    } catch (e) {
      toast.error('Erreur publication', (e as Error).message)
    } finally {
      setPublishingNow(false)
    }
  }

  const validateBeforePublish = (): boolean => {
    if (!slot) return false
    const platforms = Object.entries(enabledPlatforms).filter(([, on]) => on).map(([k]) => k as SocialPlatform)
    if (platforms.length === 0) {
      toast.error('Plateforme manquante', 'Sélectionne au moins une plateforme.')
      return false
    }
    if (enabledPlatforms.youtube && !ytConfig.title?.trim()) {
      toast.error('Titre YouTube manquant', 'Le titre est requis pour publier sur YouTube.')
      return false
    }
    if (!slot.media_urls || slot.media_urls.length === 0) {
      toast.error('Media manquant', 'Au moins un media est requis.')
      return false
    }
    if (slot.production_status !== 'ready') {
      toast.error('Slot non prêt', 'Le slot doit être en statut Prêt.')
      return false
    }
    return true
  }

  const generateHooks = async () => {
    if (!slot) return
    setGeneratingHooks(true)
    try {
      const res = await fetch('/api/social/generate-hooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pillar_id: slot.pillar_id,
          content_kind: slot.content_kind,
          topic: slot.title || undefined,
          count: 5,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erreur')
      setHookSuggestions(json.hooks ?? [])
    } catch (e) {
      toast.error('Erreur génération', (e as Error).message)
    } finally {
      setGeneratingHooks(false)
    }
  }

  const generateScript = async () => {
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
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erreur')
      await patch({ script: json.script })
    } catch (e) {
      toast.error('Erreur génération script', (e as Error).message)
    } finally {
      setGeneratingScript(false)
    }
  }

  const saveHookToLibrary = async (content: string, source: 'manual' | 'ai_generated' = 'manual') => {
    if (!slot) return
    try {
      await fetch('/api/social/hook-library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          pillar_id: slot.pillar_id,
          content_kind: slot.content_kind,
          source,
        }),
      })
    } catch {}
  }

  // Fetch unread messages count pour ce slot. Polling 20s pour rafraichir
  // quand l'accordéon Discussion est replié (sinon SlotChat marque tout lu
  // au mount). Reset à 0 quand on ouvre le chat.
  useEffect(() => {
    if (!slot?.id) return
    let cancelled = false
    const fetchUnread = async () => {
      try {
        const res = await fetch('/api/social/posts/messages-unread')
        const json = await res.json()
        if (cancelled) return
        const map = (json?.data ?? {}) as Record<string, number>
        setUnreadCount(map[slot.id] ?? 0)
      } catch { /* silent */ }
    }
    if (!chatOpen) {
      fetchUnread()
      const id = setInterval(fetchUnread, 20000)
      return () => { cancelled = true; clearInterval(id) }
    } else {
      setUnreadCount(0)
    }
    return () => { cancelled = true }
  }, [slot?.id, chatOpen])

  // Init des accordéons une fois par slotId. Si seul le contenu de `slot`
  // change (auto-save), on garde l'état utilisateur.
  useEffect(() => {
    if (!slot || initSlotIdRef.current === slot.id) return
    const exp = getDefaultExpansion(slot)
    setBriefOpen(exp.brief)
    setMontageOpen(exp.montage)
    setPubOpen(exp.publication)
    initSlotIdRef.current = slot.id
  }, [slot])

  if (loading) {
    return (
      <div style={overlayStyle} onClick={onClose}>
        <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
          <div style={{ padding: 80, textAlign: 'center', color: 'var(--text-tertiary)' }}>Chargement…</div>
        </div>
      </div>
    )
  }
  if (!slot) {
    return (
      <div style={overlayStyle} onClick={onClose}>
        <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
          <div style={{ padding: 80, textAlign: 'center', color: '#ef4444' }}>Slot introuvable</div>
        </div>
      </div>
    )
  }

  const pillar = pillars.find((p) => p.id === slot.pillar_id)
  const KindIcon = slot.content_kind === 'story' ? Camera : slot.content_kind === 'reel' ? Film : FileText
  const canSchedule =
    slot.production_status === 'ready' &&
    slot.media_urls && slot.media_urls.length > 0 &&
    slot.status === 'draft'
  const isPublished = slot.status === 'published' || slot.status === 'publishing'

  // Color for header banner
  const headerColor = pillar?.color ?? '#666'

  const briefSummary = (() => {
    const txt = slot?.hook?.trim() || slot?.title?.trim() || ''
    if (!txt) return '(vide)'
    return txt.length > 80 ? txt.slice(0, 77) + '…' : txt
  })()

  const montageVisible = !!slot?.monteur_id || (slot?.production_status !== 'idea' && slot?.production_status != null)
  const montageSummary = (() => {
    if (!slot) return ''
    const ps = slot.production_status
    const status = ps === 'ready' ? 'Validé ✓✓' : ps === 'edited' ? 'Monté ✓' : ps === 'filmed' ? 'À monter' : 'Pas commencé'
    const monteur = slot.monteur_id ? 'Assigné' : 'Non assigné'
    return `${monteur} · ${status}`
  })()

  const pubSummary = (() => {
    if (!slot) return ''
    const active = (PLATFORMS.filter(p => enabledPlatforms[p.key]) ?? []).map(p => p.label)
    if (active.length === 0) return 'Aucune plateforme'
    return active.join(' · ')
  })()

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        {/* HEADER with pillar color band */}
        <div style={{
          background: `linear-gradient(180deg, ${headerColor}22 0%, transparent 100%)`,
          borderBottom: '1px solid var(--border-primary)',
          padding: '20px 24px',
          position: 'relative',
        }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: headerColor }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                  <select
                    value={slot.pillar_id ?? ''}
                    onChange={(e) => patch({ pillar_id: e.target.value || null })}
                    style={{
                      padding: '4px 24px 4px 12px', fontSize: 11, fontWeight: 700,
                      color: '#fff',
                      background: headerColor,
                      border: 'none', borderRadius: 999, cursor: 'pointer',
                      appearance: 'none', textTransform: 'uppercase', letterSpacing: 0.4,
                    }}
                  >
                    <option value="" style={{ color: '#000', background: '#fff' }}>(aucun pillar)</option>
                    {pillars.map((p) => (
                      <option key={p.id} value={p.id} style={{ color: '#000', background: '#fff' }}>{p.name}</option>
                    ))}
                  </select>
                  <ChevronDown size={11} color="#fff" style={{ position: 'absolute', right: 8, pointerEvents: 'none' }} />
                </div>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 4, padding: '3px 22px 3px 10px', background: 'var(--bg-secondary)', borderRadius: 999, border: '1px solid var(--border-primary)', cursor: 'pointer' }}>
                  <KindIcon size={11} color="var(--text-tertiary)" />
                  <select
                    value={slot.content_kind ?? 'post'}
                    onChange={(e) => patch({ content_kind: e.target.value as SocialContentKind })}
                    style={{ background: 'transparent', border: 'none', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer', appearance: 'none', textTransform: 'uppercase', paddingRight: 0 }}
                  >
                    <option value="post">Post</option>
                    <option value="story">Story</option>
                    <option value="reel">Reel</option>
                  </select>
                  <ChevronDown size={10} color="var(--text-tertiary)" style={{ position: 'absolute', right: 7, pointerEvents: 'none' }} />
                </div>
                {isPublished && (
                  <span style={{ padding: '3px 10px', fontSize: 10, fontWeight: 700, color: '#10b981', background: 'rgba(16,185,129,0.15)', borderRadius: 999, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                    Publié
                  </span>
                )}
                {slot.status === 'scheduled' && (
                  <span style={{ padding: '3px 10px', fontSize: 10, fontWeight: 700, color: '#a78bfa', background: 'rgba(167,139,250,0.15)', borderRadius: 999, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                    Programmé
                  </span>
                )}
              </div>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>
                {slot.hook || slot.title || <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>Sans accroche</span>}
              </h2>
            </div>
            <button onClick={onClose} style={iconBtnStyle}><X size={18} /></button>
          </div>

          {/* Quick metadata row — pill chips */}
          <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
            <DatePill
              value={slot.plan_date}
              onChange={(d) => patch({ plan_date: d })}
            />
            <StatusPill
              value={(slot.production_status ?? 'idea') as SocialProductionStatus}
              onChange={(v) => patch({ production_status: v })}
            />
            {slot.scheduled_at && (
              <MetaPill icon={Send} label="Programmé" iconColor="#a78bfa">
                <span style={{ ...pillInputStyle, display: 'inline-block', cursor: 'default' }}>
                  {new Date(slot.scheduled_at).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
              </MetaPill>
            )}
          </div>
        </div>

        {/* BODY — 2 columns */}
        <div style={bodyStyle}>
          {/* LEFT COLUMN — Production */}
          <div style={columnStyle}>
            <DrawerSection
              title="Brief"
              summary={briefSummary}
              open={briefOpen}
              onToggle={() => setBriefOpen(o => !o)}
            >
            <Field
              label="Accroche / Hook"
              hint="1 ligne percutante"
              action={
                <div style={{ display: 'flex', gap: 4 }}>
                  {!hideAiActions && (
                    <button
                      onClick={generateHooks}
                      disabled={generatingHooks}
                      title="Générer 5 hooks avec l'IA"
                      style={aiBtnStyle(generatingHooks)}
                    >
                      {generatingHooks ? (
                        <Loader size={11} style={{ animation: 'spin 0.8s linear infinite' }} />
                      ) : (
                        <Wand2 size={11} />
                      )}
                      Suggérer
                    </button>
                  )}
                  <button
                    onClick={() => setLibraryOpen(true)}
                    title="Bibliothèque de hooks"
                    style={libBtnStyle}
                  >
                    <BookOpen size={12} />
                  </button>
                </div>
              }
            >
              <input
                type="text"
                value={slot.hook ?? ''}
                onChange={(e) => setSlot({ ...slot, hook: e.target.value })}
                onBlur={() => patch({ hook: slot.hook })}
                placeholder="Ex: Comment j'ai perdu 5kg en 2 semaines…"
                style={inputStyle}
              />
              {slot.hook && (
                <button
                  onClick={() => saveHookToLibrary(slot.hook!, 'manual')}
                  style={{ marginTop: 6, fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  <Star size={10} /> Sauver ce hook dans la bibliothèque
                </button>
              )}
              {hookSuggestions && (
                <HookSuggestions
                  hooks={hookSuggestions}
                  onPick={(h) => {
                    setSlot({ ...slot, hook: h })
                    patch({ hook: h })
                    setHookSuggestions(null)
                  }}
                  onSave={(h) => saveHookToLibrary(h, 'ai_generated')}
                  onClose={() => setHookSuggestions(null)}
                  onRegenerate={generateHooks}
                  regenerating={generatingHooks}
                />
              )}
            </Field>

            <Field label="Titre / Sujet">
              <input
                type="text"
                value={slot.title ?? ''}
                onChange={(e) => setSlot({ ...slot, title: e.target.value })}
                onBlur={() => patch({ title: slot.title })}
                placeholder="Sujet du contenu…"
                style={inputStyle}
              />
            </Field>

            <Field
              label="Script"
              action={hideAiActions ? null : (
                <button
                  onClick={generateScript}
                  disabled={generatingScript}
                  title={slot.hook || slot.title ? 'Générer le script à partir du hook' : 'Renseigne un hook ou titre d\'abord'}
                  style={aiBtnStyle(generatingScript)}
                >
                  {generatingScript ? (
                    <Loader size={11} style={{ animation: 'spin 0.8s linear infinite' }} />
                  ) : (
                    <Wand2 size={11} />
                  )}
                  {generatingScript ? 'Génération…' : 'Générer'}
                </button>
              )}
            >
              <textarea
                value={slot.script ?? ''}
                onChange={(e) => setSlot({ ...slot, script: e.target.value })}
                onBlur={() => patch({ script: slot.script })}
                placeholder={hideAiActions ? 'Plan de tournage, dialogues, points clés…' : 'Plan de tournage, dialogues, points clés… ou clique \'Générer\' pour un script structuré IA.'}
                rows={8}
                style={{ ...inputStyle, fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.5 }}
              />
            </Field>

            <Field label="Références" icon={Link2} hint="Liens rushs, moodboard, inspirations">
              <RefsList
                urls={slot.references_urls ?? []}
                onChange={(urls) => patch({ references_urls: urls })}
              />
            </Field>
            </DrawerSection>

            {montageVisible && (
              <DrawerSection
                title="Montage"
                summary={montageSummary}
                open={montageOpen}
                onToggle={() => setMontageOpen(o => !o)}
              >
                <MontageSection slot={slot} setSlot={setSlot} patch={patch} />
              </DrawerSection>
            )}

            <DrawerSection
              title="Publication"
              summary={pubSummary}
              open={pubOpen}
              onToggle={() => setPubOpen(o => !o)}
            >
              {/* Platforms */}
              <Field label="Plateformes" hint="≥ 1 obligatoire">
                <div style={{ display: 'flex', gap: 6 }}>
                  {PLATFORMS.map((p) => {
                    const on = enabledPlatforms[p.key]
                    return (
                      <button
                        key={p.key}
                        onClick={() => !p.disabled && togglePlatform(p.key)}
                        disabled={p.disabled}
                        title={p.disabled ? 'Bientôt disponible' : ''}
                        style={{
                          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                          padding: '8px 10px', fontSize: 11, fontWeight: 600,
                          color: on ? '#fff' : 'var(--text-tertiary)',
                          background: on ? p.color : 'var(--bg-secondary)',
                          border: `1px solid ${on ? p.color : 'var(--border-primary)'}`,
                          borderRadius: 8, cursor: p.disabled ? 'not-allowed' : 'pointer',
                          opacity: p.disabled ? 0.45 : 1,
                          transition: 'all 0.15s',
                        }}
                      >
                        <p.icon size={12} />
                        {p.label}
                      </button>
                    )
                  })}
                </div>
              </Field>

              {/* Media + auto-detected type */}
              <Field
                label="Media"
                icon={ImgIcon}
                hint="Drop ou click pour upload"
                action={
                  computedMediaType ? (
                    <span style={{ padding: '3px 8px', fontSize: 9, fontWeight: 700, color: '#10b981', background: 'rgba(16,185,129,0.12)', borderRadius: 999, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      {computedMediaType}
                      {mediaDurationSec != null && ` · ${mediaDurationSec.toFixed(0)}s`}
                    </span>
                  ) : null
                }
              >
                <MediaList
                  urls={slot.media_urls ?? []}
                  onChange={(urls) => {
                    setMediaDurationSec(null)
                    patch({ media_urls: urls })
                  }}
                />
              </Field>

              {/* Per-platform tabs */}
              <div style={{ marginTop: 4 }}>
                <PlatformTabs
                  platforms={PLATFORMS.filter((p) => enabledPlatforms[p.key] && !p.disabled)}
                  active={activePlatformTab}
                  onChange={setActivePlatformTab}
                />

                {activePlatformTab === 'instagram' && enabledPlatforms.instagram && (
                  <>
                    <Field label="Caption Instagram">
                      <textarea
                        value={slot.caption ?? ''}
                        onChange={(e) => setSlot({ ...slot, caption: e.target.value })}
                        onBlur={() => patch({ caption: slot.caption })}
                        placeholder="Caption finale qui sera publiée…"
                        rows={5}
                        style={{ ...inputStyle, fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.5 }}
                      />
                    </Field>

                    <Field label="Hashtags" icon={Hash}>
                      <HashtagsInput
                        tags={slot.hashtags ?? []}
                        onChange={(tags) => patch({ hashtags: tags })}
                      />
                    </Field>
                  </>
                )}

                {activePlatformTab === 'youtube' && enabledPlatforms.youtube && (
                  <>
                    <Field label="Titre YouTube *" hint={`${(ytConfig.title ?? '').length}/100`}>
                      <input
                        type="text"
                        value={ytConfig.title ?? ''}
                        onChange={(e) => updatePlatformConfig('youtube', { title: e.target.value })}
                        placeholder="Titre de la vidéo (max 100 char)"
                        maxLength={100}
                        style={inputStyle}
                      />
                    </Field>
                    <Field label="Description YouTube">
                      <textarea
                        value={ytConfig.description ?? ''}
                        onChange={(e) => updatePlatformConfig('youtube', { description: e.target.value })}
                        placeholder="Description complète…"
                        rows={5}
                        style={{ ...inputStyle, fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.5 }}
                      />
                    </Field>
                    <Field label="Visibilité">
                      <div style={{ display: 'flex', gap: 4 }}>
                        {(['public', 'unlisted', 'private'] as const).map((v) => {
                          const active = (ytConfig.privacy_status ?? 'public') === v
                          return (
                            <button
                              key={v}
                              onClick={() => updatePlatformConfig('youtube', { privacy_status: v })}
                              style={{
                                flex: 1, padding: '7px', fontSize: 11, fontWeight: 600,
                                color: active ? '#fff' : 'var(--text-secondary)',
                                background: active ? '#FF0000' : 'var(--bg-secondary)',
                                border: `1px solid ${active ? '#FF0000' : 'var(--border-primary)'}`,
                                borderRadius: 6, cursor: 'pointer',
                              }}
                            >
                              {v === 'public' ? 'Public' : v === 'unlisted' ? 'Non répertorié' : 'Privé'}
                            </button>
                          )
                        })}
                      </div>
                    </Field>
                  </>
                )}

                {Object.values(enabledPlatforms).every((v) => !v) && (
                  <div style={{ padding: 14, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 6, fontSize: 11, color: '#ef4444' }}>
                    Active au moins une plateforme pour pouvoir programmer ce slot.
                  </div>
                )}
              </div>

              <Field label="Notes">
                <textarea
                  value={slot.notes ?? ''}
                  onChange={(e) => setSlot({ ...slot, notes: e.target.value })}
                  onBlur={() => patch({ notes: slot.notes })}
                  placeholder="Notes internes, todos…"
                  rows={3}
                  style={{ ...inputStyle, fontFamily: 'inherit', resize: 'vertical' }}
                />
              </Field>
            </DrawerSection>

            {slot.monteur_id && (
              <DrawerSection
                title="Discussion"
                summary={chatOpen ? null : (unreadCount > 0 ? `${unreadCount} message${unreadCount > 1 ? 's' : ''} non lu${unreadCount > 1 ? 's' : ''}` : 'Échanger avec le monteur')}
                open={chatOpen}
                onToggle={() => setChatOpen(o => !o)}
                badge={unreadCount}
              >
                <div style={{ height: 360 }}>
                  <SlotChat slotId={slot.id} fillHeight />
                </div>
              </DrawerSection>
            )}
          </div>

          {/* DIVIDER */}
          <div style={{ width: 1, background: 'var(--border-primary)' }} />

          {/* RIGHT COLUMN — Big media preview */}
          <div style={{ ...columnStyle, display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto' }}>
            <div style={{
              fontSize: 11, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase',
              color: 'var(--text-tertiary)',
            }}>
              Preview
            </div>
            <MediaPreview slot={slot} />
          </div>
        </div>

        {/* FOOTER */}
        <div style={footerStyle}>
          <button onClick={() => setConfirmDelete(true)} style={dangerBtnStyle}>
            <Trash2 size={14} /> Supprimer
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {saving && (
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Sauvegarde…</span>
            )}
            {slot.status === 'scheduled' && (
              <button onClick={handleUnschedule} style={cancelBtnStyle}>
                <CalIcon size={14} /> Dé-programmer
              </button>
            )}
            {slot.status === 'draft' && canSchedule && !showScheduleConfirm && (
              <>
                <button
                  onClick={handlePublishNow}
                  disabled={publishingNow}
                  style={publishNowBtnStyle(publishingNow)}
                >
                  {publishingNow ? <Loader size={13} style={{ animation: 'spin 0.8s linear infinite' }} /> : <Zap size={14} />}
                  {publishingNow ? 'Publication…' : 'Publier maintenant'}
                </button>
                <button onClick={() => setShowScheduleConfirm(true)} style={primaryBtnStyle}>
                  <Send size={14} /> Programmer
                </button>
              </>
            )}
            {showScheduleConfirm && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-secondary)', padding: '4px 6px', borderRadius: 8 }}>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)', paddingLeft: 6 }}>à</span>
                <input
                  type="time"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                  style={{ ...inputStyle, width: 90, padding: '6px 8px' }}
                />
                <button onClick={() => setShowScheduleConfirm(false)} style={cancelBtnStyle}>Annuler</button>
                <button onClick={handleSchedule} disabled={scheduling} style={primaryBtnStyle}>
                  {scheduling ? '…' : 'Confirmer'}
                </button>
              </div>
            )}
            {slot.status === 'draft' && !canSchedule && (
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
                {slot.production_status !== 'ready'
                  ? 'Passe en "Prêt" + media pour programmer'
                  : 'Upload un media pour programmer'}
              </span>
            )}
          </div>
        </div>

        {confirmDelete && (
          <ConfirmModal
            title="Supprimer ce slot ?"
            message={
              slot.production_status !== 'idea' || (slot.media_urls?.length ?? 0) > 0 || slot.hook
                ? 'Ce slot contient du travail (hook, script, media…). La suppression est définitive.'
                : 'Ce slot est vide. La suppression est définitive.'
            }
            confirmLabel="Supprimer"
            danger
            onCancel={() => setConfirmDelete(false)}
            onConfirm={handleDelete}
          />
        )}

        {libraryOpen && (
          <HookLibraryModal
            pillarId={slot.pillar_id}
            onPick={async (h, libId) => {
              setSlot({ ...slot, hook: h })
              await patch({ hook: h })
              fetch(`/api/social/hook-library/${libId}`, { method: 'POST' }).catch(() => {})
              setLibraryOpen(false)
            }}
            onClose={() => setLibraryOpen(false)}
          />
        )}
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  )
}

// ─── Confirm modal ───────────────────────────────────────────

function ConfirmModal({
  title, message, confirmLabel, danger, onCancel, onConfirm,
}: {
  title: string
  message: string
  confirmLabel: string
  danger?: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div onClick={onCancel} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 110, padding: 20,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: 'min(420px, 92vw)',
        background: 'var(--bg-primary)', border: '1px solid var(--border-primary)',
        borderRadius: 12, overflow: 'hidden',
        boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
      }}>
        <div style={{ padding: '20px 22px 8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            {danger && (
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: 'rgba(239,68,68,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Trash2 size={16} color="#ef4444" />
              </div>
            )}
            <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{title}</h3>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.5, marginLeft: danger ? 42 : 0 }}>
            {message}
          </p>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '14px 22px', background: 'var(--bg-secondary)' }}>
          <button onClick={onCancel} style={{
            padding: '8px 16px', fontSize: 12, fontWeight: 600,
            color: 'var(--text-secondary)', background: 'transparent',
            border: '1px solid var(--border-primary)', borderRadius: 6, cursor: 'pointer',
          }}>Annuler</button>
          <button onClick={onConfirm} style={{
            padding: '8px 16px', fontSize: 12, fontWeight: 700,
            color: '#fff',
            background: danger ? '#ef4444' : '#a78bfa',
            border: 'none', borderRadius: 6, cursor: 'pointer',
          }}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}

// ─── AI helpers ──────────────────────────────────────────────

interface HookLibraryItem {
  id: string
  content: string
  pillar_id: string | null
  source: string
  used_count: number
  created_at: string
}

function HookSuggestions({
  hooks, onPick, onSave, onClose, onRegenerate, regenerating,
}: {
  hooks: string[]
  onPick: (h: string) => void
  onSave: (h: string) => void
  onClose: () => void
  onRegenerate: () => void
  regenerating: boolean
}) {
  return (
    <div style={{
      marginTop: 8, background: 'rgba(167,139,250,0.08)',
      border: '1px solid rgba(167,139,250,0.3)', borderRadius: 8, padding: 10,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: 0.4, display: 'flex', alignItems: 'center', gap: 4 }}>
          <Sparkles size={11} /> Suggestions IA
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={onRegenerate} disabled={regenerating} style={{ padding: '3px 8px', fontSize: 10, fontWeight: 600, color: '#a78bfa', background: 'transparent', border: '1px solid rgba(167,139,250,0.4)', borderRadius: 4, cursor: regenerating ? 'wait' : 'pointer' }}>
            {regenerating ? '…' : '↻ Regénérer'}
          </button>
          <button onClick={onClose} style={{ padding: '3px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'flex' }}>
            <X size={12} />
          </button>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {hooks.map((h, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: 6, background: 'var(--bg-primary)', borderRadius: 6 }}>
            <button
              onClick={() => onPick(h)}
              style={{ flex: 1, fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', background: 'transparent', border: 'none', textAlign: 'left', cursor: 'pointer', padding: 0, lineHeight: 1.4 }}
            >
              {h}
            </button>
            <button
              onClick={() => { onSave(h); }}
              title="Sauver dans la bibliothèque"
              style={{ padding: 4, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'flex' }}
            >
              <Star size={12} />
            </button>
          </div>
        ))}
      </div>
      <button
        onClick={() => window.open('/parametres/assistant-ia', '_blank')}
        style={{
          display: 'flex', alignItems: 'center', gap: 4,
          marginTop: 8, padding: '4px 0',
          fontSize: 10, fontWeight: 600,
          color: 'var(--text-tertiary)', textDecoration: 'underline',
          background: 'transparent', border: 'none', cursor: 'pointer',
        }}
      >
        <Settings size={10} /> Pas content du résultat ? Personnalise l'IA
      </button>
    </div>
  )
}

function HookLibraryModal({
  pillarId, onPick, onClose,
}: {
  pillarId: string | null
  onPick: (h: string, libId: string) => void
  onClose: () => void
}) {
  const [items, setItems] = useState<HookLibraryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filterByPillar, setFilterByPillar] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    setLoading(true)
    const url = filterByPillar && pillarId
      ? `/api/social/hook-library?pillar_id=${pillarId}`
      : '/api/social/hook-library'
    fetch(url).then((r) => r.json()).then((j) => {
      setItems(j.data ?? [])
    }).finally(() => setLoading(false))
  }, [filterByPillar, pillarId])

  const filtered = useMemo(() => {
    if (!search) return items
    const q = search.toLowerCase()
    return items.filter((i) => i.content.toLowerCase().includes(q))
  }, [items, search])

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer ce hook de la bibliothèque ?')) return
    await fetch(`/api/social/hook-library/${id}`, { method: 'DELETE' })
    setItems(items.filter((i) => i.id !== id))
  }

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 110,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: 'min(560px, 92vw)', maxHeight: '80vh',
        background: 'var(--bg-primary)', border: '1px solid var(--border-primary)',
        borderRadius: 12, display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', borderBottom: '1px solid var(--border-primary)' }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <BookOpen size={14} /> Bibliothèque de hooks
          </h3>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: 4 }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: 12, borderBottom: '1px solid var(--border-primary)', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un hook…"
            style={inputStyle}
          />
          {pillarId && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-tertiary)', cursor: 'pointer' }}>
              <input type="checkbox" checked={filterByPillar} onChange={(e) => setFilterByPillar(e.target.checked)} />
              Uniquement le pillar de ce slot
            </label>
          )}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 12 }}>Chargement…</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 12 }}>
              {items.length === 0 ? 'Bibliothèque vide. Sauvegarde des hooks depuis tes slots pour les retrouver ici.' : 'Aucun résultat.'}
            </div>
          ) : (
            filtered.map((item) => (
              <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 10, background: 'var(--bg-secondary)', borderRadius: 6, marginBottom: 4 }}>
                <button
                  onClick={() => onPick(item.content, item.id)}
                  style={{ flex: 1, fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', background: 'transparent', border: 'none', textAlign: 'left', cursor: 'pointer', padding: 0, lineHeight: 1.4 }}
                >
                  {item.content}
                </button>
                {item.used_count > 0 && (
                  <span title="Réutilisations" style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 10, color: 'var(--text-tertiary)' }}>
                    <TrendingUp size={10} /> {item.used_count}
                  </span>
                )}
                <button
                  onClick={() => handleDelete(item.id)}
                  style={{ padding: 4, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'flex' }}
                >
                  <Trash2 size={11} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Sub-components ──────────────────────────────────────────

function MetaField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={metaLabelStyle}>{label}</span>
      {children}
    </div>
  )
}

function MetaPill({
  icon: Icon, label, iconColor, children,
}: {
  icon: typeof Send
  label: string
  iconColor?: string
  children: React.ReactNode
}) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 8,
      padding: '6px 10px 6px 12px',
      background: 'var(--bg-secondary)',
      border: '1px solid var(--border-primary)',
      borderRadius: 999,
    }}>
      <Icon size={12} color={iconColor ?? 'var(--text-tertiary)'} />
      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
        <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>
          {label}
        </span>
        {children}
      </div>
    </div>
  )
}

function DatePill({ value, onChange }: {
  value: string | null
  onChange: (v: string | null) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    setTimeout(() => document.addEventListener('mousedown', handler), 0)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const display = value
    ? new Date(value + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
    : 'Pas de date'

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '6px 12px',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-primary)',
          borderRadius: 999, cursor: 'pointer',
          transition: 'all 0.15s',
        }}
      >
        <CalIcon size={12} color="var(--text-tertiary)" />
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1, alignItems: 'flex-start' }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>
            Date prévue
          </span>
          <span style={{ fontSize: 12, fontWeight: 700, color: value ? 'var(--text-primary)' : 'var(--text-tertiary)', textTransform: 'capitalize' }}>{display}</span>
        </div>
        {value && (
          <span
            onClick={(e) => { e.stopPropagation(); onChange(null) }}
            style={{ display: 'flex', padding: 2, marginLeft: 2, opacity: 0.5, cursor: 'pointer' }}
          >
            <X size={11} />
          </span>
        )}
        <ChevronDown size={12} color="var(--text-tertiary)" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, marginTop: 6,
          background: 'var(--bg-primary)', border: '1px solid var(--border-primary)',
          borderRadius: 12, padding: 12,
          boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
          zIndex: 50, width: 280,
        }}>
          <CustomCalendar
            value={value}
            onChange={(v) => { onChange(v); setOpen(false) }}
          />
        </div>
      )}
    </div>
  )
}

function CustomCalendar({ value, onChange }: { value: string | null; onChange: (v: string) => void }) {
  const initial = value ? new Date(value + 'T00:00:00') : new Date()
  const [cursor, setCursor] = useState({ year: initial.getFullYear(), month: initial.getMonth() })

  const cells = useMemo(() => {
    const first = new Date(cursor.year, cursor.month, 1)
    const startOffset = (first.getDay() + 6) % 7 // monday-first
    const gridStart = new Date(cursor.year, cursor.month, 1 - startOffset)
    const days: { date: Date; inMonth: boolean }[] = []
    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart); d.setDate(gridStart.getDate() + i)
      days.push({ date: d, inMonth: d.getMonth() === cursor.month })
    }
    return days
  }, [cursor])

  const monthLabel = new Date(cursor.year, cursor.month, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
  const today = new Date()
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const todayStr = fmt(today)

  const navigate = (delta: number) => {
    const m = cursor.month + delta
    if (m < 0) setCursor({ year: cursor.year - 1, month: 11 })
    else if (m > 11) setCursor({ year: cursor.year + 1, month: 0 })
    else setCursor({ year: cursor.year, month: m })
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <button onClick={() => navigate(-1)} style={calNavBtn}><ChevronLeft size={14} /></button>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', textTransform: 'capitalize' }}>
          {monthLabel}
        </span>
        <button onClick={() => navigate(1)} style={calNavBtn}><ChevronRight size={14} /></button>
      </div>

      {/* Weekdays */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
        {['L','M','M','J','V','S','D'].map((d, i) => (
          <div key={i} style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textAlign: 'center', padding: 4 }}>
            {d}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
        {cells.map((c, i) => {
          const dateStr = fmt(c.date)
          const isSelected = value === dateStr
          const isToday = dateStr === todayStr
          return (
            <button
              key={i}
              onClick={() => onChange(dateStr)}
              style={{
                aspectRatio: '1',
                fontSize: 12, fontWeight: isSelected ? 700 : 500,
                color: isSelected ? '#fff' : c.inMonth ? 'var(--text-primary)' : 'var(--text-tertiary)',
                background: isSelected ? '#a78bfa' : 'transparent',
                border: isToday && !isSelected ? '1px solid #a78bfa' : 'none',
                borderRadius: 6, cursor: 'pointer',
                opacity: c.inMonth ? 1 : 0.35,
                transition: 'all 0.1s',
              }}
              onMouseEnter={(e) => { if (!isSelected) (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-secondary)' }}
              onMouseLeave={(e) => { if (!isSelected) (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
            >
              {c.date.getDate()}
            </button>
          )
        })}
      </div>

      {/* Quick actions */}
      <div style={{ display: 'flex', gap: 4, marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border-primary)' }}>
        <button
          onClick={() => onChange(todayStr)}
          style={{ flex: 1, padding: '6px 8px', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', background: 'var(--bg-secondary)', border: 'none', borderRadius: 6, cursor: 'pointer' }}
        >Aujourd'hui</button>
        <button
          onClick={() => {
            const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1)
            onChange(fmt(tomorrow))
          }}
          style={{ flex: 1, padding: '6px 8px', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', background: 'var(--bg-secondary)', border: 'none', borderRadius: 6, cursor: 'pointer' }}
        >Demain</button>
      </div>
    </div>
  )
}

const calNavBtn: React.CSSProperties = {
  width: 26, height: 26,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'var(--bg-secondary)', border: 'none',
  borderRadius: 6, color: 'var(--text-secondary)', cursor: 'pointer',
}

function StatusPill({ value, onChange }: {
  value: SocialProductionStatus
  onChange: (v: SocialProductionStatus) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    setTimeout(() => document.addEventListener('mousedown', handler), 0)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const current = PRODUCTION_STATUSES.find((s) => s.value === value)
  const color = statusColor(value)

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '6px 12px',
          background: color + '18',
          border: `1px solid ${color}55`,
          borderRadius: 999, cursor: 'pointer',
          transition: 'all 0.15s',
        }}
      >
        <span style={{ width: 9, height: 9, borderRadius: '50%', background: color, boxShadow: `0 0 8px ${color}` }} />
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1, alignItems: 'flex-start' }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>
            Statut
          </span>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{current?.label}</span>
        </div>
        <ChevronDown size={12} color="var(--text-tertiary)" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, marginTop: 6,
          minWidth: 200,
          background: 'var(--bg-primary)', border: '1px solid var(--border-primary)',
          borderRadius: 10, padding: 4,
          boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
          zIndex: 50,
        }}>
          {PRODUCTION_STATUSES.map((s) => {
            const c = statusColor(s.value)
            const active = s.value === value
            return (
              <button
                key={s.value}
                onClick={() => { onChange(s.value); setOpen(false) }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  width: '100%', padding: '8px 10px',
                  background: active ? c + '15' : 'transparent',
                  border: 'none', borderRadius: 6, cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-secondary)' }}
                onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
              >
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: c, flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{s.label}</span>
                {active && <Check size={13} color={c} />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function statusColor(status: SocialProductionStatus | null | undefined): string {
  switch (status) {
    case 'idea':    return '#94a3b8'
    case 'to_film': return '#f59e0b'
    case 'filmed':  return '#06b6d4'
    case 'edited':  return '#8b5cf6'
    case 'ready':   return '#10b981'
    default:        return '#94a3b8'
  }
}

function ColumnHeader({ icon: Icon, label, color, action }: {
  icon: typeof Send
  label: string
  color: string
  action?: React.ReactNode
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
      <div style={{ width: 28, height: 28, borderRadius: 8, background: color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={14} color={color} />
      </div>
      <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {label}
      </h3>
      {action && <div style={{ marginLeft: 'auto' }}>{action}</div>}
    </div>
  )
}

function Field({
  label, hint, icon: Icon, action, children,
}: {
  label: string
  hint?: string
  icon?: typeof Send
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        {Icon && <Icon size={11} color="var(--text-tertiary)" />}
        <label style={labelStyle}>{label}</label>
        {hint && <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>· {hint}</span>}
        {action && <div style={{ marginLeft: 'auto' }}>{action}</div>}
      </div>
      {children}
    </div>
  )
}

function DrawerSection({
  title,
  summary,
  open,
  onToggle,
  badge,
  children,
}: {
  title: string
  summary?: string | null
  open: boolean
  onToggle: () => void
  badge?: number
  children: React.ReactNode
}) {
  return (
    <div style={{
      border: '1px solid var(--border-primary)',
      borderRadius: 10,
      background: 'var(--bg-secondary)',
      overflow: 'hidden',
      marginBottom: 12,
    }}>
      <button
        onClick={onToggle}
        style={{
          width: '100%', boxSizing: 'border-box',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
          padding: '12px 14px',
          background: 'transparent', border: 'none', cursor: 'pointer',
          color: 'var(--text-primary)', textAlign: 'left',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
            {title}
            {badge != null && badge > 0 && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                minWidth: 18, height: 18, padding: '0 5px',
                fontSize: 10, fontWeight: 800, color: '#fff',
                background: '#ef4444', borderRadius: 9,
                boxShadow: '0 2px 6px rgba(239,68,68,0.4)',
              }}>{badge > 99 ? '99+' : badge}</span>
            )}
          </span>
          {!open && summary && (
            <span style={{
              fontSize: 12, color: 'var(--text-tertiary)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              maxWidth: '100%',
            }}>
              {summary}
            </span>
          )}
        </div>
        {open ? <ChevronDown size={15} color="var(--text-tertiary)" /> : <ChevronRight size={15} color="var(--text-tertiary)" />}
      </button>
      {open && (
        <div style={{
          padding: '4px 14px 14px',
          borderTop: '1px solid var(--border-primary)',
          display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          {children}
        </div>
      )}
    </div>
  )
}

// ─── Media preview helper + component ─────────────────────────────────
type EmbedType = 'image' | 'native' | 'youtube' | 'loom' | 'drive' | 'unsupported'
const VIDEO_EXT_RE = /\.(mp4|webm|mov|m4v|ogg|avi)(\?|#|$)/i
const IMAGE_EXT_RE = /\.(jpg|jpeg|png|webp|gif|avif)(\?|#|$)/i

function detectMediaEmbed(url: string | null | undefined): { type: EmbedType; src?: string } {
  if (!url) return { type: 'unsupported' }
  if (IMAGE_EXT_RE.test(url)) return { type: 'image', src: url }
  if (VIDEO_EXT_RE.test(url)) return { type: 'native', src: url }
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([\w-]+)/)
  if (yt) return { type: 'youtube', src: `https://www.youtube.com/embed/${yt[1]}` }
  const loom = url.match(/loom\.com\/share\/([\w]+)/)
  if (loom) return { type: 'loom', src: `https://www.loom.com/embed/${loom[1]}` }
  const drive = url.match(/drive\.google\.com\/file\/d\/([\w-]+)/)
  if (drive) return { type: 'drive', src: `https://drive.google.com/file/d/${drive[1]}/preview` }
  return { type: 'unsupported' }
}

function MediaPreview({ slot }: { slot: SocialPostWithPublications }) {
  // Priorité : 1er fichier vidéo de media_urls > final_url > rush_url > 1ère image de media_urls
  const url = (() => {
    const media = slot.media_urls ?? []
    const firstVideo = media.find((u) => VIDEO_EXT_RE.test(u))
    if (firstVideo) return firstVideo
    if (slot.final_url) return slot.final_url
    if (slot.rush_url) return slot.rush_url
    const firstImage = media.find((u) => IMAGE_EXT_RE.test(u))
    if (firstImage) return firstImage
    return media[0] ?? null
  })()
  const embed = detectMediaEmbed(url)

  // Aspect-ratio fixe sur le container pour éviter que le player saute de
  // petit à grand quand les metadata vidéo arrivent. La majorité du contenu
  // social moderne est vertical (Reels/Shorts/TikTok), donc default 9:16.
  // Le content_kind 'post' utilisé pour de la vidéo IG feed peut quand même
  // être vertical, donc on prend 9:16 sauf cas explicite contraire.
  // object-fit: contain à l'intérieur letterbox proprement si la vidéo est
  // en réalité horizontale.
  const isVertical = true // default vertical, plus large public d'usage
  const frameStyle: React.CSSProperties = {
    width: '100%',
    aspectRatio: isVertical ? '9 / 16' : '16 / 9',
    maxHeight: '72vh',
    background: '#000',
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    margin: '0 auto',
  }
  const fillStyle: React.CSSProperties = {
    width: '100%', height: '100%', objectFit: 'contain',
    display: 'block', border: 'none', background: '#000',
  }

  if (!url) {
    return (
      <div style={{
        ...frameStyle,
        background: 'var(--bg-secondary)',
        border: '1px dashed var(--border-primary)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: 32, textAlign: 'center', gap: 10,
      }}>
        <Video size={32} color="var(--text-tertiary)" />
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Aucun media à prévisualiser</div>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', maxWidth: 320, lineHeight: 1.4 }}>
          Le rush du coach, le montage final ou le media uploadé apparaîtront ici.
        </div>
      </div>
    )
  }

  if (embed.type === 'image' && embed.src) {
    return (
      <div style={frameStyle}>
        <img src={embed.src} alt="Preview" style={fillStyle} />
      </div>
    )
  }

  if (embed.type === 'native' && embed.src) {
    return (
      <div style={frameStyle}>
        <video
          src={embed.src}
          controls
          preload="metadata"
          playsInline
          style={fillStyle}
        />
      </div>
    )
  }
  if ((embed.type === 'youtube' || embed.type === 'loom' || embed.type === 'drive') && embed.src) {
    return (
      <div style={frameStyle}>
        <iframe
          src={embed.src}
          allowFullScreen
          allow="autoplay; encrypted-media; picture-in-picture"
          style={fillStyle}
        />
      </div>
    )
  }

  // Unsupported (SwissTransfer, WeTransfer, Dropbox shared link, etc.)
  return (
    <div style={{
      ...frameStyle,
      background: 'var(--bg-secondary)',
      border: '1px solid var(--border-primary)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 28, gap: 14,
    }}>
      <Video size={32} color="#a78bfa" />
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', textAlign: 'center' }}>
        Lien non prévisualisable directement
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'center', maxWidth: 360, lineHeight: 1.5 }}>
        SwissTransfer, WeTransfer, Dropbox… nécessitent un téléchargement. Pour une preview embarquée, utilise YouTube (unlisted), Loom ou Google Drive.
      </div>
      <a
        href={url} target="_blank" rel="noopener noreferrer"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '10px 18px', fontSize: 13, fontWeight: 700,
          color: '#fff', background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
          borderRadius: 10, textDecoration: 'none',
          boxShadow: '0 4px 16px rgba(139,92,246,0.3)',
        }}
      >
        Ouvrir le lien dans un nouvel onglet ↗
      </a>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────
// Montage section — rush URL, monteur assignment, montage feedback view
// ────────────────────────────────────────────────────────────────────

interface PricingTier {
  id: string
  monteur_id: string
  name: string
  price_cents: number
}

function formatEuros(cents: number): string {
  return (cents / 100).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' €'
}

function MontageSection({
  slot, setSlot, patch,
}: {
  slot: SocialPostWithPublications
  setSlot: (s: SocialPostWithPublications) => void
  patch: (changes: Partial<SocialPostWithPublications>) => void
}) {
  const [monteurs, setMonteurs] = useState<{ user_id: string; email: string | null }[]>([])
  const [tiers, setTiers] = useState<PricingTier[]>([])
  const [pickerOpen, setPickerOpen] = useState(false)
  const [tierPickerOpen, setTierPickerOpen] = useState(false)
  const pickerRef = useRef<HTMLDivElement | null>(null)
  const tierPickerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    fetch('/api/workspaces/members?role=monteur')
      .then(r => r.json())
      .then((j: { data?: { user_id: string; user?: { email?: string | null } | null }[] }) => {
        const list = (j.data ?? []).map(m => ({ user_id: m.user_id, email: m.user?.email ?? null }))
        setMonteurs(list)
      })
      .catch(() => null)
  }, [])

  useEffect(() => {
    if (!pickerOpen) return
    function onClick(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setPickerOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [pickerOpen])

  useEffect(() => {
    if (!tierPickerOpen) return
    function onClick(e: MouseEvent) {
      if (tierPickerRef.current && !tierPickerRef.current.contains(e.target as Node)) setTierPickerOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [tierPickerOpen])

  // Charge les tiers du monteur sélectionné
  useEffect(() => {
    if (!slot.monteur_id) { setTiers([]); return }
    fetch(`/api/monteur-pricing-tiers?monteur_id=${slot.monteur_id}`)
      .then(r => r.json())
      .then((j: { data?: PricingTier[] }) => setTiers(j.data ?? []))
      .catch(() => setTiers([]))
  }, [slot.monteur_id])

  const selectedMonteur = monteurs.find(m => m.user_id === slot.monteur_id) ?? null
  const monteurLabel = selectedMonteur
    ? (selectedMonteur.email ?? selectedMonteur.user_id.slice(0, 8))
    : null

  const selectedTier = tiers.find(t => t.id === slot.pricing_tier_id) ?? null

  function selectMonteur(id: string | null) {
    setSlot({ ...slot, monteur_id: id, pricing_tier_id: null })
    patch({ monteur_id: id, pricing_tier_id: null })
    setPickerOpen(false)
  }

  function selectTier(tierId: string | null) {
    setSlot({ ...slot, pricing_tier_id: tierId })
    patch({ pricing_tier_id: tierId })
    setTierPickerOpen(false)
  }

  function togglePaid() {
    const newPaidAt = slot.paid_at ? null : new Date().toISOString()
    setSlot({ ...slot, paid_at: newPaidAt })
    patch({ paid_at: newPaidAt })
  }

  return (
    <div style={{
      marginTop: 4, marginBottom: 18, padding: 12,
      borderRadius: 10, border: '1px solid rgba(139,92,246,0.3)',
      background: 'rgba(139,92,246,0.06)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <Wand2 size={11} color="#8b5cf6" />
        <label style={{ ...labelStyle, color: '#8b5cf6' }}>Montage</label>
      </div>

      {monteurs.length > 0 ? (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 4 }}>Assigné à</div>
          <div ref={pickerRef} style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setPickerOpen(o => !o)}
              style={{
                width: '100%', boxSizing: 'border-box',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                padding: '8px 10px', borderRadius: 8,
                background: 'var(--bg-input)',
                border: `1px solid ${pickerOpen ? '#8b5cf6' : 'var(--border-primary)'}`,
                color: monteurLabel ? 'var(--text-primary)' : 'var(--text-tertiary)',
                fontSize: 13, cursor: 'pointer',
                transition: 'border-color 0.15s',
                textAlign: 'left',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                {monteurLabel ? (
                  <>
                    <span style={{
                      width: 22, height: 22, borderRadius: '50%',
                      background: '#8b5cf6', color: '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10, fontWeight: 700, flexShrink: 0,
                    }}>
                      {(monteurLabel[0] ?? '?').toUpperCase()}
                    </span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{monteurLabel}</span>
                  </>
                ) : (
                  <span>— Aucun monteur assigné —</span>
                )}
              </span>
              <ChevronDown size={13} color="var(--text-tertiary)" style={{ flexShrink: 0, transform: pickerOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
            </button>

            {pickerOpen && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 10,
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-primary)',
                borderRadius: 8, padding: 4,
                boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                maxHeight: 220, overflow: 'auto',
              }}>
                <button
                  type="button"
                  onClick={() => selectMonteur(null)}
                  style={pickerOptionStyle(slot.monteur_id == null)}
                >
                  <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <X size={11} color="var(--text-tertiary)" />
                  </span>
                  <span>— Aucun —</span>
                </button>
                {monteurs.map(m => {
                  const label = m.email ?? m.user_id.slice(0, 8)
                  const active = slot.monteur_id === m.user_id
                  return (
                    <button
                      key={m.user_id}
                      type="button"
                      onClick={() => selectMonteur(m.user_id)}
                      style={pickerOptionStyle(active)}
                    >
                      <span style={{
                        width: 22, height: 22, borderRadius: '50%',
                        background: '#8b5cf6', color: '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 10, fontWeight: 700, flexShrink: 0,
                      }}>
                        {(label[0] ?? '?').toUpperCase()}
                      </span>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{label}</span>
                      {active && <Check size={12} color="#8b5cf6" style={{ flexShrink: 0 }} />}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div style={{
          marginBottom: 10, padding: '8px 10px',
          background: 'var(--bg-secondary)', borderRadius: 6,
          fontSize: 11, color: 'var(--text-tertiary)',
        }}>
          Aucun monteur dans ce workspace. <a href="/parametres/equipe" style={{ color: '#8b5cf6' }}>Inviter un monteur →</a>
        </div>
      )}

      {/* Pricing tier picker — visible seulement si monteur assigné */}
      {slot.monteur_id && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Prestation</span>
            <a
              href={`/parametres/equipe/${slot.monteur_id}/prestations`}
              style={{ fontSize: 10, color: '#8b5cf6', textDecoration: 'none' }}
            >
              Gérer →
            </a>
          </div>
          {tiers.length > 0 ? (
            <div ref={tierPickerRef} style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setTierPickerOpen(o => !o)}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                  padding: '8px 10px', borderRadius: 8,
                  background: 'var(--bg-input)',
                  border: `1px solid ${tierPickerOpen ? '#8b5cf6' : 'var(--border-primary)'}`,
                  color: selectedTier ? 'var(--text-primary)' : 'var(--text-tertiary)',
                  fontSize: 13, cursor: 'pointer', textAlign: 'left',
                }}
              >
                {selectedTier ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {selectedTier.name}
                    </span>
                    <span style={{ color: '#8b5cf6', fontWeight: 700, flexShrink: 0 }}>
                      {formatEuros(selectedTier.price_cents)}
                    </span>
                  </span>
                ) : (
                  <span>— Choisir une prestation —</span>
                )}
                <ChevronDown size={13} color="var(--text-tertiary)" style={{ flexShrink: 0, transform: tierPickerOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
              </button>
              {tierPickerOpen && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 10,
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-primary)',
                  borderRadius: 8, padding: 4,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                  maxHeight: 240, overflow: 'auto',
                }}>
                  <button
                    type="button"
                    onClick={() => selectTier(null)}
                    style={pickerOptionStyle(slot.pricing_tier_id == null)}
                  >
                    <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <X size={11} color="var(--text-tertiary)" />
                    </span>
                    <span>— Aucune —</span>
                  </button>
                  {tiers.map(t => {
                    const active = slot.pricing_tier_id === t.id
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => selectTier(t.id)}
                        style={pickerOptionStyle(active)}
                      >
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</span>
                        <span style={{ color: '#8b5cf6', fontWeight: 700, fontSize: 12 }}>
                          {formatEuros(t.price_cents)}
                        </span>
                        {active && <Check size={12} color="#8b5cf6" style={{ flexShrink: 0 }} />}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          ) : (
            <a
              href={`/parametres/equipe/${slot.monteur_id}/prestations`}
              style={{
                display: 'block', padding: '8px 10px',
                background: 'var(--bg-secondary)', borderRadius: 6,
                fontSize: 11, color: 'var(--text-tertiary)',
                textDecoration: 'none',
                border: '1px dashed var(--border-primary)',
                textAlign: 'center',
              }}
            >
              Aucune prestation pour ce monteur. <span style={{ color: '#8b5cf6' }}>Créer →</span>
            </a>
          )}

          {/* Statut payé */}
          {slot.pricing_tier_id && (
            <div style={{
              marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '6px 10px', borderRadius: 6,
              background: slot.paid_at ? 'rgba(16,185,129,0.1)' : 'var(--bg-secondary)',
              border: `1px solid ${slot.paid_at ? 'rgba(16,185,129,0.3)' : 'var(--border-primary)'}`,
            }}>
              <span style={{ fontSize: 11, color: slot.paid_at ? '#10b981' : 'var(--text-tertiary)', fontWeight: 600 }}>
                {slot.paid_at ? `✓ Payé le ${new Date(slot.paid_at).toLocaleDateString('fr-FR')}` : 'Non payé'}
              </span>
              <button
                type="button"
                onClick={togglePaid}
                style={{
                  padding: '3px 10px', fontSize: 10, fontWeight: 700,
                  color: slot.paid_at ? 'var(--text-tertiary)' : '#fff',
                  background: slot.paid_at ? 'transparent' : '#10b981',
                  border: slot.paid_at ? '1px solid var(--border-primary)' : 'none',
                  borderRadius: 4, cursor: 'pointer',
                }}
              >
                {slot.paid_at ? 'Annuler' : 'Marquer payé'}
              </button>
            </div>
          )}
        </div>
      )}

      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 4 }}>Lien du rush (Drive / SwissTransfer / WeTransfer…)</div>
        <input
          type="url"
          value={slot.rush_url ?? ''}
          onChange={(e) => setSlot({ ...slot, rush_url: e.target.value })}
          onBlur={() => patch({ rush_url: slot.rush_url })}
          placeholder="https://drive.google.com/..."
          style={{ ...inputStyle, fontFamily: 'monospace', fontSize: 12 }}
        />
      </div>

      {slot.final_url && (
        <div style={{ marginTop: 10, padding: 10, background: 'var(--bg-secondary)', borderRadius: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#8b5cf6', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>
            Montage final livré
          </div>
          <a
            href={slot.final_url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              fontSize: 12, color: '#8b5cf6',
              textDecoration: 'none', wordBreak: 'break-all',
            }}
          >
            <Link2 size={11} /> {slot.final_url}
          </a>
          {slot.editor_notes && (
            <div style={{
              marginTop: 8, padding: '8px 10px',
              background: 'var(--bg-elevated)', borderRadius: 6,
              fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap',
            }}>
              <span style={{ fontWeight: 600, fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.3 }}>
                Note du monteur ·{' '}
              </span>
              {slot.editor_notes}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function RefsList({ urls, onChange }: { urls: string[]; onChange: (urls: string[]) => void }) {
  const [input, setInput] = useState('')
  return (
    <div>
      {urls.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
          {urls.map((u, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', background: 'var(--bg-secondary)', borderRadius: 6 }}>
              <Link2 size={11} color="var(--text-tertiary)" />
              <a href={u} target="_blank" rel="noreferrer" style={{ flex: 1, fontSize: 12, color: '#5b9bf5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u}</a>
              <button onClick={() => onChange(urls.filter((_, j) => j !== i))} style={iconBtnStyle}><X size={12} /></button>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          type="url"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && input) {
              onChange([...urls, input])
              setInput('')
            }
          }}
          placeholder="https://…"
          style={{ ...inputStyle, flex: 1 }}
        />
        <button
          onClick={() => {
            if (input) {
              onChange([...urls, input])
              setInput('')
            }
          }}
          style={addInlineBtnStyle}
        ><Plus size={14} /></button>
      </div>
    </div>
  )
}

function MediaList({ urls, onChange }: { urls: string[]; onChange: (urls: string[]) => void }) {
  const toast = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)

  const uploadFiles = async (files: FileList | File[]) => {
    const arr = Array.from(files)
    if (arr.length === 0) return
    setUploading(true)
    const supabase = createBrowserClient()
    const uploadedUrls: string[] = []
    try {
      for (let i = 0; i < arr.length; i++) {
        const file = arr[i]
        setProgress(`Upload ${i + 1}/${arr.length} (${formatSize(file.size)})…`)
        const ext = file.name.split('.').pop() ?? 'bin'
        const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
        const { error } = await supabase.storage.from('content-drafts').upload(path, file, {
          contentType: file.type,
          upsert: false,
        })
        if (error) {
          toast.error(`Erreur upload ${file.name}`, error.message)
          continue
        }
        const { data: { publicUrl } } = supabase.storage.from('content-drafts').getPublicUrl(path)
        uploadedUrls.push(publicUrl)
      }
      if (uploadedUrls.length > 0) onChange([...urls, ...uploadedUrls])
    } finally {
      setUploading(false)
      setProgress(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      uploadFiles(e.dataTransfer.files)
    }
  }

  return (
    <div>
      {urls.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
          {urls.map((u, i) => {
            const isVideo = /\.(mp4|mov|webm|m4v)(\?|$)/i.test(u)
            return (
              <div key={i} style={{ position: 'relative', width: 90, height: 90, background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 8, overflow: 'hidden' }}>
                {isVideo ? (
                  <video src={u} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted />
                ) : (
                  <img src={u} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                )}
                {isVideo && (
                  <div style={{ position: 'absolute', bottom: 4, left: 4, padding: '1px 5px', background: 'rgba(0,0,0,0.7)', color: '#fff', fontSize: 9, fontWeight: 600, borderRadius: 3 }}>VIDEO</div>
                )}
                <button onClick={() => onChange(urls.filter((_, j) => j !== i))} style={{ position: 'absolute', top: 4, right: 4, padding: 4, background: 'rgba(0,0,0,0.7)', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', display: 'flex' }}>
                  <Trash2 size={11} />
                </button>
              </div>
            )
          })}
        </div>
      )}

      <div
        onClick={() => !uploading && fileInputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        style={{
          padding: 16,
          background: dragOver ? 'rgba(167,139,250,0.1)' : 'var(--bg-secondary)',
          border: `1.5px dashed ${dragOver ? '#a78bfa' : 'var(--border-primary)'}`,
          borderRadius: 8,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6,
          cursor: uploading ? 'wait' : 'pointer',
          transition: 'all 0.15s',
          textAlign: 'center',
        }}
      >
        {uploading ? (
          <>
            <Loader size={20} color="#a78bfa" style={{ animation: 'spin 0.8s linear infinite' }} />
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{progress ?? 'Upload…'}</span>
          </>
        ) : (
          <>
            <Upload size={20} color="var(--text-tertiary)" />
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
              Click ou drop des fichiers
            </span>
            <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
              Image (JPG, PNG, WebP) ou Vidéo (MP4, MOV)
            </span>
          </>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm"
        multiple
        onChange={(e) => e.target.files && uploadFiles(e.target.files)}
        style={{ display: 'none' }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function PlatformTabs({ platforms, active, onChange }: {
  platforms: { key: SocialPlatform; label: string; color: string; icon: typeof Camera }[]
  active: SocialPlatform
  onChange: (p: SocialPlatform) => void
}) {
  if (platforms.length === 0) return null
  return (
    <div style={{ display: 'flex', gap: 4, marginBottom: 12, borderBottom: '1px solid var(--border-primary)' }}>
      {platforms.map((p) => {
        const isActive = active === p.key
        return (
          <button
            key={p.key}
            onClick={() => onChange(p.key)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 12px', fontSize: 11, fontWeight: 600,
              color: isActive ? p.color : 'var(--text-tertiary)',
              background: 'transparent',
              border: 'none',
              borderBottom: `2px solid ${isActive ? p.color : 'transparent'}`,
              marginBottom: -1,
              cursor: 'pointer',
            }}
          >
            <p.icon size={11} />
            {p.label}
          </button>
        )
      })}
    </div>
  )
}

function HashtagsInput({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const [input, setInput] = useState('')
  const addTag = (raw: string) => {
    const clean = raw.replace(/^#+/, '').trim()
    if (!clean) return
    if (tags.includes(clean)) return
    onChange([...tags, clean])
  }
  return (
    <div>
      {tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
          {tags.map((t, i) => (
            <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.3)', borderRadius: 999, fontSize: 11, fontWeight: 500, color: 'var(--text-primary)' }}>
              #{t}
              <button onClick={() => onChange(tags.filter((_, j) => j !== i))} style={{ ...iconBtnStyle, padding: 0, display: 'flex' }}><X size={10} /></button>
            </span>
          ))}
        </div>
      )}
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ' || e.key === ',') && input) {
            e.preventDefault()
            addTag(input)
            setInput('')
          } else if (e.key === 'Backspace' && !input && tags.length > 0) {
            onChange(tags.slice(0, -1))
          }
        }}
        onBlur={() => {
          if (input) { addTag(input); setInput('') }
        }}
        placeholder="Tape un hashtag puis Entrée ou espace"
        style={inputStyle}
      />
    </div>
  )
}

// ─── Styles ──────────────────────────────────────────────────

const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0,
  background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 100, padding: 20,
}
const modalStyle: React.CSSProperties = {
  width: 'min(1400px, 100%)', maxHeight: '92vh',
  background: 'var(--bg-primary)', border: '1px solid var(--border-primary)',
  borderRadius: 16,
  display: 'flex', flexDirection: 'column',
  boxShadow: '0 20px 80px rgba(0,0,0,0.6)',
  overflow: 'hidden',
}
const bodyStyle: React.CSSProperties = {
  flex: 1, overflow: 'hidden',
  display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 1px minmax(0, 1.4fr)',
}
const columnStyle: React.CSSProperties = {
  padding: '20px 24px', overflowY: 'auto', minHeight: 0, minWidth: 0,
}
const footerStyle: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
  padding: '14px 24px', borderTop: '1px solid var(--border-primary)',
  background: 'var(--bg-secondary)',
}
function pickerOptionStyle(active: boolean): React.CSSProperties {
  return {
    width: '100%', display: 'flex', alignItems: 'center', gap: 8,
    padding: '7px 10px', borderRadius: 6,
    background: active ? 'rgba(139,92,246,0.15)' : 'transparent',
    border: 'none', cursor: 'pointer',
    color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
    fontSize: 12, textAlign: 'left',
    transition: 'background 0.1s',
  }
}

const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)',
  textTransform: 'uppercase', letterSpacing: 0.5,
}
const metaLabelStyle: React.CSSProperties = {
  fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)',
  textTransform: 'uppercase', letterSpacing: 0.5,
}
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', fontSize: 13,
  color: 'var(--text-primary)', background: 'var(--bg-secondary)',
  border: '1px solid var(--border-primary)', borderRadius: 6, outline: 'none',
}
const metaInputStyle: React.CSSProperties = {
  padding: '5px 10px', fontSize: 12, fontWeight: 500,
  color: 'var(--text-primary)', background: 'var(--bg-secondary)',
  border: '1px solid var(--border-primary)', borderRadius: 6, outline: 'none',
  cursor: 'pointer',
}
const pillInputStyle: React.CSSProperties = {
  padding: 0, fontSize: 12, fontWeight: 600,
  color: 'var(--text-primary)', background: 'transparent',
  border: 'none', outline: 'none', cursor: 'pointer',
  appearance: 'none',
}
const iconBtnStyle: React.CSSProperties = {
  background: 'transparent', border: 'none', cursor: 'pointer',
  color: 'var(--text-tertiary)', padding: 4,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
}
const addInlineBtnStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: '0 12px', fontSize: 12, fontWeight: 600,
  color: '#fff', background: '#a78bfa',
  border: 'none', borderRadius: 6, cursor: 'pointer',
}
const primaryBtnStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6,
  padding: '8px 16px', fontSize: 12, fontWeight: 600,
  color: '#fff', background: '#a78bfa',
  border: 'none', borderRadius: 6, cursor: 'pointer',
}
const cancelBtnStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6,
  padding: '8px 14px', fontSize: 12, fontWeight: 600,
  color: 'var(--text-secondary)', background: 'transparent',
  border: '1px solid var(--border-primary)', borderRadius: 6, cursor: 'pointer',
}
const aiBtnStyle = (loading: boolean): React.CSSProperties => ({
  display: 'flex', alignItems: 'center', gap: 4,
  padding: '8px 12px', fontSize: 11, fontWeight: 700,
  color: '#fff',
  background: 'linear-gradient(135deg, #a78bfa 0%, #ec4899 100%)',
  border: 'none', borderRadius: 6,
  cursor: loading ? 'wait' : 'pointer',
  opacity: loading ? 0.7 : 1,
  whiteSpace: 'nowrap',
  boxShadow: '0 2px 8px rgba(167,139,250,0.3)',
})
const libBtnStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: '8px 10px',
  color: 'var(--text-secondary)',
  background: 'var(--bg-secondary)',
  border: '1px solid var(--border-primary)', borderRadius: 6, cursor: 'pointer',
}
const publishNowBtnStyle = (loading: boolean): React.CSSProperties => ({
  display: 'flex', alignItems: 'center', gap: 6,
  padding: '8px 14px', fontSize: 12, fontWeight: 600,
  color: '#22c55e', background: 'transparent',
  border: '1px solid rgba(34,197,94,0.4)', borderRadius: 6,
  cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.7 : 1,
})
const dangerBtnStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6,
  padding: '8px 14px', fontSize: 12, fontWeight: 600,
  color: '#ef4444', background: 'transparent',
  border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, cursor: 'pointer',
}
