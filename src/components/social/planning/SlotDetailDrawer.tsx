'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { X, Trash2 } from 'lucide-react'
import type { SocialPostWithPublications, ContentPillar, SocialPlatform, SocialPostPublication } from '@/types'
import { uploadToR2 } from '@/lib/storage/r2-upload-client'
import StepperBar from './StepperBar'
import BriefStep from './BriefStep'
import MontageStep from './MontageStep'
import PublicationStep from './PublicationStep'
import DiscussionFooter from './DiscussionFooter'
import MediaPreviewPane, { inferMediaKind } from './MediaPreviewPane'
import type { VideoReviewPlayerHandle, VideoAnnotation } from './VideoReviewPlayer'
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

const MAX_FILE_BYTES = 2 * 1024 * 1024 * 1024 // 2 GB — R2 supporte jusqu'a 5 GB par PUT, 250 MB suffisait pour Supabase mais plus de raison de brider

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
  const [uploadFinalPct, setUploadFinalPct] = useState(0)
  const [uploadMediaPct, setUploadMediaPct] = useState(0)

  // Publication scheduling
  const [scheduling, setScheduling] = useState(false)
  // Distinct du scheduling: 'Publier maintenant' a son propre loading state
  // pour que le bouton publier affiche son spinner sans que 'Programmer'
  // se mette aussi a clignoter (et inversement).
  const [publishingNow, setPublishingNow] = useState(false)
  const [scheduledTime, setScheduledTime] = useState<string>('18:00')

  // Delete confirm
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Discussion
  const [unreadCount, setUnreadCount] = useState(0)

  // Role of current user (admin/monteur/etc) — drives UI gating (hide
  // coach-only buttons for monteur etc.). Default 'admin' = optimist : on
  // affiche tout pendant le fetch initial pour eviter un flash.
  const [role, setRole] = useState<'admin' | 'monteur' | 'closer' | 'setter'>('admin')

  // Video annotations (Frame.io style)
  const [annotations, setAnnotations] = useState<VideoAnnotation[]>([])
  const [messagesVersion, setMessagesVersion] = useState(0)
  const [footerOpenTrigger, setFooterOpenTrigger] = useState(0)
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null)
  const playerRef = useRef<VideoReviewPlayerHandle | null>(null)

  // ─── Fetch role once on mount ───────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (cancelled || !j?.data?.role) return
        const r = j.data.role as typeof role
        if (r === 'monteur' || r === 'admin' || r === 'closer' || r === 'setter') setRole(r)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

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
        // Si le slot est déjà programmé, on initialise le picker depuis
        // scheduled_at (sinon il afficherait toujours 18:00 + plan_date au
        // lieu de l'heure réelle de programmation).
        if (fetched.scheduled_at) {
          const d = new Date(fetched.scheduled_at)
          const hh = String(d.getHours()).padStart(2, '0')
          const mm = String(d.getMinutes()).padStart(2, '0')
          setScheduledTime(`${hh}:${mm}`)
        }
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

  // ─── Fetch annotations (messages with video_timestamp_seconds) ─────────

  const refreshAnnotations = useCallback(async () => {
    if (!slotId) return
    try {
      const [msgRes, meRes] = await Promise.all([
        fetch(`/api/social/posts/${slotId}/messages`),
        fetch('/api/auth/me').catch(() => null),
      ])
      const msgJson = await msgRes.json()
      const meJson = meRes ? await meRes.json().catch(() => null) : null
      const meId = meJson?.user?.id ?? meJson?.data?.id ?? null
      type RawMsg = { id: string; author_id: string; body: string; video_timestamp_seconds: number | null; resolved_at: string | null; author?: { full_name?: string | null; email?: string | null } | null }
      const list: VideoAnnotation[] = ((msgJson?.data ?? []) as RawMsg[])
        .filter((m) => m.video_timestamp_seconds !== null && m.video_timestamp_seconds !== undefined)
        .map((m) => ({
          id: m.id,
          video_timestamp_seconds: m.video_timestamp_seconds!,
          body: m.body,
          author_name: m.author?.full_name || m.author?.email || 'Utilisateur',
          is_self: m.author_id === meId,
          resolved_at: m.resolved_at ?? null,
        }))
      setAnnotations(list)
    } catch {
      // best-effort
    }
  }, [slotId])

  useEffect(() => { refreshAnnotations() }, [refreshAnnotations])

  const addAnnotation = useCallback(
    async (timestampSeconds: number, body: string) => {
      const res = await fetch(`/api/social/posts/${slotId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body, video_timestamp_seconds: timestampSeconds }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        toast.error('Erreur annotation', (j as { error?: string }).error ?? '')
        return
      }
      await refreshAnnotations()
      setMessagesVersion((v) => v + 1)
    },
    [slotId, toast, refreshAnnotations]
  )

  const toggleAnnotationResolved = useCallback(
    async (annotationId: string, resolved: boolean) => {
      // Optimistic
      setAnnotations((prev) => prev.map((a) =>
        a.id === annotationId ? { ...a, resolved_at: resolved ? new Date().toISOString() : null } : a,
      ))
      try {
        const res = await fetch(`/api/social/posts/${slotId}/messages/${annotationId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ resolved }),
        })
        if (!res.ok) throw new Error('patch failed')
        setMessagesVersion((v) => v + 1)
      } catch {
        // Rollback
        toast.error('Erreur', 'Impossible de mettre à jour le statut')
        await refreshAnnotations()
      }
    },
    [slotId, toast, refreshAnnotations],
  )

  const handleAnnotationClick = useCallback((id: string) => {
    const a = annotations.find((x) => x.id === id)
    if (a) playerRef.current?.seek(a.video_timestamp_seconds)
    // L'affichage du contenu est gere par le popup persistant dans VideoReviewPlayer.
    // Le footer ne s'ouvre PAS automatiquement (si l'utilisateur veut tout voir,
    // il l'ouvre lui-meme).
  }, [annotations])

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
        // Sanitize: les publications creees cote client ont un id temporaire
        // ("tmp-instagram-1234567890") qui fait planter la validation UUID.
        // On envoie au serveur juste les champs editables (platform/config/
        // scheduled_at + id si c'est un vrai UUID a updater).
        // Helper: Zod .datetime() exige RFC 3339 avec TZ ('Z' ou '+HH:MM').
        // Une valeur sans TZ (e.g. "2026-05-05T18:00:00") est rejetee → on
        // la convertit en ISO complet, sinon on retourne null.
        const toIsoOrNull = (v: unknown): string | null => {
          if (typeof v !== 'string' || v.length === 0) return null
          const d = new Date(v)
          if (isNaN(d.getTime())) return null
          return d.toISOString()
        }
        const sanitized: Partial<SocialPostWithPublications> = { ...patch }
        // Sanitize scheduled_at top-level
        if ('scheduled_at' in patch) {
          sanitized.scheduled_at = toIsoOrNull(patch.scheduled_at)
        }
        if (Array.isArray(patch.publications)) {
          // Dedupe par platform (1 publication par plateforme = unique constraint server-side)
          const seenPlatforms = new Set<string>()
          const cleaned: SocialPostPublication[] = []
          for (const p of patch.publications) {
            if (seenPlatforms.has(p.platform)) continue
            seenPlatforms.add(p.platform)
            const isRealId = typeof p.id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(p.id)
            cleaned.push({
              ...(isRealId ? { id: p.id } : {}),
              platform: p.platform,
              config: p.config ?? {},
              scheduled_at: toIsoOrNull(p.scheduled_at),
            } as SocialPostPublication)
          }
          sanitized.publications = cleaned
        }
        const res = await fetch(`/api/social/posts/${slotId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sanitized),
        })
        if (!res.ok) {
          const j = await res.json().catch(() => ({}))
          const err = (j as { error?: unknown }).error
          const msg = typeof err === 'string'
            ? err
            : (err as { formErrors?: string[]; fieldErrors?: Record<string, string[]> })?.formErrors?.join(', ')
              || Object.values((err as { fieldErrors?: Record<string, string[]> })?.fieldErrors ?? {}).flat().join(', ')
              || 'Erreur'
          toast.error('Erreur sauvegarde', msg)
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
        toast.error('Fichier trop lourd', `Max 2 Go — ce fichier fait ${formatSize(file.size)}.`)
        return
      }
      setUploadingFinal(true)
      setUploadFinalPct(0)
      try {
        const { path } = await uploadToR2(file, {
          post_id: slot.id,
          target: 'final',
          onProgress: (pct) => setUploadFinalPct(pct),
        })
        // Auto-transition: si le slot etait en 'idea'/'to_film'/'filmed' et qu'on
        // pose un final_url, le slot passe en 'edited' (= prêt a etre valide).
        // L'API declenche notifyCoachEdited si applicable.
        const shouldAdvance =
          slot.production_status === 'idea' ||
          slot.production_status === 'to_film' ||
          slot.production_status === 'filmed' ||
          slot.production_status === null
        await updateSlot({
          final_url: path,
          ...(shouldAdvance ? { production_status: 'edited' as const } : {}),
        })
      } catch (e) {
        toast.error('Erreur upload', e instanceof Error ? e.message : String(e))
      } finally {
        setUploadingFinal(false)
        setUploadFinalPct(0)
      }
    },
    [slot, updateSlot, toast]
  )

  const uploadMedia = useCallback(
    async (file: File) => {
      if (!slot) return
      if (file.size > MAX_FILE_BYTES) {
        toast.error('Fichier trop lourd', `Max 2 Go — ce fichier fait ${formatSize(file.size)}.`)
        return
      }
      setUploadingMedia(true)
      setUploadMediaPct(0)
      try {
        const { path } = await uploadToR2(file, {
          post_id: slot.id,
          target: 'media',
          onProgress: (pct) => setUploadMediaPct(pct),
        })
        await updateSlot({ media_urls: [...(slot.media_urls ?? []), path] })
      } catch (e) {
        toast.error('Erreur upload', e instanceof Error ? e.message : String(e))
      } finally {
        setUploadingMedia(false)
        setUploadMediaPct(0)
      }
    },
    [slot, updateSlot, toast]
  )

  // ─── Toggle platform ────────────────────────────────────────────────────

  const togglePlatform = useCallback(
    (platform: SocialPlatform, enabled: boolean) => {
      if (!slot) return
      let pubs = [...(slot.publications ?? [])]
      // Dedupe defensif: si pour une raison X la plateforme est en double, on nettoie
      const alreadyHasPlatform = pubs.some((p) => p.platform === platform)
      if (!enabled) {
        pubs = pubs.filter((p) => p.platform !== platform)
      } else if (alreadyHasPlatform) {
        // Deja activee: ne pas dupliquer (et nettoyer d'eventuels doublons existants)
        const seen = new Set<string>()
        pubs = pubs.filter((p) => {
          if (seen.has(p.platform)) return false
          seen.add(p.platform)
          return true
        })
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
      // plan_date peut etre au format 'YYYY-MM-DD' ou 'YYYY-MM-DDTxx...'
      // On prend juste les 10 premiers chars (date pure) pour eviter
      // 'YYYY-MM-DDT00:00:00T18:00:00' qui parse en Invalid Date.
      const datePart = slot.plan_date.slice(0, 10)
      const built = new Date(`${datePart}T${scheduledTime}:00`)
      if (isNaN(built.getTime())) {
        throw new Error(`Date invalide : ${datePart} ${scheduledTime}`)
      }
      if (built.getTime() <= Date.now()) {
        toast.error('Date dans le passé', 'Choisis une date/heure future, ou clique « Publier maintenant ».')
        setScheduling(false)
        return
      }
      const scheduledAt = built.toISOString()
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

  // ─── Reprogrammer un slot deja `scheduled` ──────────────────────────────
  // Debounce naturel via le picker (l'user click une nouvelle date+time, on
  // PATCH une seule fois). Pas de loading state visible, juste un toast.
  const reschedule = useCallback(async (date: string, time: string) => {
    if (!slot) return
    const built = new Date(`${date}T${time}:00`)
    if (isNaN(built.getTime()) || built.getTime() <= Date.now()) {
      toast.error('Date invalide', 'La date doit être future.')
      return
    }
    const scheduledAt = built.toISOString()
    // Lock anti double-PATCH : si un reschedule est deja en vol, on ignore.
    // Sans ca, click rapide sur picker + bouton 'Reprogrammer' => 2 PATCHes
    // concurrents, dont la 2e peut ecraser une mise a jour serveur entre-deux.
    if (scheduling) return
    setScheduling(true)
    try {
      const activePubs = (slot.publications ?? []).filter((p) => p.platform)
      const res = await fetch(`/api/social/posts/${slotId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan_date: date,
          scheduled_at: scheduledAt,
          // re-sync chaque pub pour que le cron prenne la bonne heure
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
      const j = await res.json()
      if (j.data) setSlot(j.data as SocialPostWithPublications)
      toast.success('Reprogrammé', `Nouvelle date : ${built.toLocaleString('fr-FR', { day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' })}`)
      onChange()
    } catch (e) {
      toast.error('Erreur reprogrammation', (e as Error).message)
    } finally {
      setScheduling(false)
    }
  }, [slot, slotId, scheduling, toast, onChange])

  // ─── Publier maintenant (immediat, ignore l'heure programmee) ───────────

  const publishNow = useCallback(async () => {
    if (!slot) return
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
        toast.error('Titre YouTube manquant', 'Renseigne un titre avant de publier.')
        return
      }
    }
    setPublishingNow(true)
    try {
      // 1. PATCH le slot pour persister scheduled_at = now + status scheduled
      //    (sinon le record reste 'draft' et la publication n'est pas tracee).
      const nowIso = new Date().toISOString()
      const patchRes = await fetch(`/api/social/posts/${slotId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'scheduled',
          scheduled_at: nowIso,
          publications: activePubs.map((p) => ({
            platform: p.platform,
            config: p.config,
            scheduled_at: nowIso,
          })),
        }),
      })
      if (!patchRes.ok) {
        const j = await patchRes.json().catch(() => ({}))
        throw new Error((j as { error?: string }).error ?? `Erreur ${patchRes.status}`)
      }
      // 2. Trigger l'API de publication immediate (publishPostNow service-role).
      //    Sinon le user attendrait le cron qui tourne 1x/jour a 09:00 UTC.
      const publishRes = await fetch(`/api/social/posts/${slotId}/publish`, {
        method: 'POST',
      })
      if (!publishRes.ok) {
        const j = await publishRes.json().catch(() => ({}))
        throw new Error((j as { error?: string }).error ?? `Erreur publication ${publishRes.status}`)
      }
      const result = (await publishRes.json()) as { published?: number; errors?: number }
      if ((result.errors ?? 0) > 0) {
        toast.error('Publication partielle', `${result.published ?? 0} publié(s), ${result.errors} échec(s). Voir la fiche pour les détails.`)
      } else {
        toast.success('Publication lancée', `${result.published ?? activePubs.length} publication(s) en cours.`)
      }
      onChange()
      onClose()
    } catch (e) {
      toast.error('Erreur publication', (e as Error).message)
    } finally {
      setPublishingNow(false)
    }
  }, [slot, slotId, toast, onChange, onClose])

  // ─── Demander des retouches (edited|ready -> filmed avec feedback) ──────

  const requestRevision = useCallback(async (feedback: string) => {
    if (!slot) return
    // Optimistic
    const previous = slot
    setSlot({ ...slot, production_status: 'filmed' })
    try {
      const res = await fetch(`/api/social/posts/${slotId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          production_status: 'filmed',
          revision_feedback: feedback,
        }),
      })
      if (!res.ok) throw new Error('PATCH failed')

      // Aussi: poste le feedback dans la discussion pour le tracer
      await fetch(`/api/social/posts/${slotId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: `🔄 Retouches demandées: ${feedback}` }),
      }).catch(() => { /* best-effort */ })

      setMessagesVersion((v) => v + 1)
      setActiveStep('montage')
      toast.success('Retouches demandées', 'Le monteur a été notifié et le slot est repassé en montage.')
      onChange()
    } catch (e) {
      setSlot(previous)
      toast.error('Erreur', (e as Error).message)
    }
  }, [slot, slotId, toast, onChange])

  // ─── Transition step ────────────────────────────────────────────────────

  const transition = useCallback(async () => {
    if (!slot) return
    const action = getTransitionAction(slot, activeStep)
    if (!action) return

    // Si on valide le montage et que le slot n'a pas encore de media_urls,
    // on copie le final_url dedans pour eviter au coach de re-uploader.
    // Et on set media_type=VIDEO pour que YouTube/IG sachent que c'est une
    // video (sinon publishToYoutube throw 'YouTube accepte uniquement des
    // videos' et IG passe en image_url au lieu de video_url).
    const patch: Partial<SocialPostWithPublications> = {
      production_status: action.nextStatus,
    }
    if (
      action.nextStatus === 'ready' &&
      slot.final_url &&
      (!slot.media_urls || slot.media_urls.length === 0)
    ) {
      patch.media_urls = [slot.final_url]
      if (!slot.media_type) {
        patch.media_type = 'VIDEO'
      }
    }
    await updateSlot(patch)

    // Auto-switch to next step + toast pour feedback visuel
    if (action.nextStatus === 'filmed') {
      setActiveStep('montage')
      toast.success('Brief envoyé', 'Le slot est passé en montage.')
    }
    if (action.nextStatus === 'ready') {
      setActiveStep('publication')
      toast.success('Montage validé', 'Le monteur a été notifié. Le media est pret pour la publication.')
    }
  }, [slot, activeStep, updateSlot, toast])

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
        {slot.content_kind === 'reel' && (
          <a
            href={`/acquisition/reels/tournage/prep?reel=${slot.id}`}
            title="Préparer mon tournage"
            style={{
              padding: '5px 10px', fontSize: 11, fontWeight: 700,
              color: '#fff', background: '#FF0000',
              borderRadius: 6, textDecoration: 'none',
              whiteSpace: 'nowrap', flexShrink: 0,
              display: 'inline-flex', alignItems: 'center', gap: 4,
            }}>
            📋 Préparer
          </a>
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
        <div style={{ flex: hasMedia ? '0 0 420px' : 1, overflowY: 'auto', minHeight: 0, minWidth: 0 }}>
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
              transitionAction={role === 'monteur' ? null : (transitionAction as { label: string; nextStatus: 'filmed' | 'ready' } | null)}
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
              uploadPct={uploadFinalPct}
              // Le monteur ne valide pas son propre montage et ne demande pas
              // de retouches : ce sont des actions COACH. On masque ces deux
              // boutons quand le user est monteur.
              transitionAction={role === 'monteur' ? null : (transitionAction as { label: string; nextStatus: 'ready' } | null)}
              onTransition={transition}
              onRequestRevision={role === 'monteur' ? undefined : requestRevision}
              isMonteur={role === 'monteur'}
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
              uploadPct={uploadMediaPct}
              onSchedule={schedule}
              onPublishNow={publishNow}
              onReschedule={reschedule}
              scheduling={scheduling}
              publishingNow={publishingNow}
              readOnly={readOnly}
              scheduledTime={scheduledTime}
              onScheduledTimeChange={setScheduledTime}
            />
          )}
        </div>
        {hasMedia && previewMedia && (
          <MediaPreviewPane
            ref={playerRef}
            url={previewMedia.url}
            kind={previewMedia.kind}
            label={previewMedia.label}
            annotations={annotations}
            onAddAnnotation={addAnnotation}
            onAnnotationClick={handleAnnotationClick}
            onToggleResolved={toggleAnnotationResolved}
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
          onAnnotationClick={handleAnnotationClick}
          refreshKey={messagesVersion}
          openTrigger={footerOpenTrigger}
          highlightedMessageId={highlightedMessageId}
          onHighlightCleared={() => setHighlightedMessageId(null)}
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
          width: '95vw', maxWidth: 1500, height: '92vh',
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
