'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { X, Upload, Trash2, Image, Film, CircleDot, Check, AlertCircle, RotateCcw } from 'lucide-react'
import type { IgDraft, IgHashtagGroup, IgCaptionTemplate } from '@/types'
import { createClient } from '@/lib/supabase/client'

interface Props {
  date?: string
  draft?: IgDraft
  onClose: () => void
  onSaved: () => void
}

type PublishStep = 'saving' | 'uploading' | 'processing' | 'publishing' | 'done'

interface PublishProgress {
  step: PublishStep
  label: string
  startedAt: number
}

const PUBLISH_STEPS: Record<PublishStep, string> = {
  saving: 'Création du brouillon...',
  uploading: 'Upload vers Instagram...',
  processing: 'Traitement en cours...',
  publishing: 'Publication...',
  done: 'Publié !',
}

const STEP_ORDER: PublishStep[] = ['saving', 'uploading', 'processing', 'publishing', 'done']

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** Check video dimensions — warn if > 1080p (no re-encoding to avoid format issues) */
async function checkVideoDimensions(file: File): Promise<{ width: number; height: number; tooLarge: boolean }> {
  return new Promise((resolve) => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    const url = URL.createObjectURL(file)
    video.src = url
    video.onloadedmetadata = () => {
      const { videoWidth, videoHeight } = video
      URL.revokeObjectURL(url)
      resolve({
        width: videoWidth,
        height: videoHeight,
        tooLarge: videoWidth > 1920 || videoHeight > 1920,
      })
    }
    video.onerror = () => {
      URL.revokeObjectURL(url)
      resolve({ width: 0, height: 0, tooLarge: false })
    }
  })
}

export default function IgDraftModal({ date, draft, onClose, onSaved }: Props) {
  const [caption, setCaption] = useState(draft?.caption ?? '')
  const [hashtagsText, setHashtagsText] = useState(draft?.hashtags?.join(', ') ?? '')
  const [mediaUrls, setMediaUrls] = useState<string[]>(draft?.media_urls ?? [])
  const [mediaType, setMediaType] = useState<string>(draft?.media_type ?? 'IMAGE')
  const [schedDate, setSchedDate] = useState(() => {
    if (draft?.scheduled_at) return draft.scheduled_at.slice(0, 10)
    if (date) return date
    return new Date().toISOString().slice(0, 10)
  })
  const [schedTime, setSchedTime] = useState(() => {
    if (draft?.scheduled_at) return draft.scheduled_at.slice(11, 16)
    // Default to now + 5 minutes
    const now = new Date(Date.now() + 5 * 60_000)
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  })
  const [schedError, setSchedError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [publishStatus, setPublishStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [publishError, setPublishError] = useState<string | null>(null)
  const [showPublishConfirm, setShowPublishConfirm] = useState(false)
  const [hashtagGroups, setHashtagGroups] = useState<IgHashtagGroup[]>([])
  const [templates, setTemplates] = useState<IgCaptionTemplate[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadInfo, setUploadInfo] = useState<string | null>(null)
  const [videoWarning, setVideoWarning] = useState<string | null>(null)
  const [publishProgress, setPublishProgress] = useState<PublishProgress | null>(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const fileRef = useRef<HTMLInputElement>(null)
  const publishTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const elapsedIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/instagram/hashtag-groups').then(r => r.json()),
      fetch('/api/instagram/caption-templates').then(r => r.json()),
    ]).then(([hg, ct]) => {
      setHashtagGroups(hg.data ?? [])
      setTemplates(ct.data ?? [])
    }).catch(() => {
      // Non-critical — modal still works without groups/templates
    })
  }, [])

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (publishTimeoutRef.current) clearTimeout(publishTimeoutRef.current)
      if (elapsedIntervalRef.current) clearInterval(elapsedIntervalRef.current)
    }
  }, [])

  // Elapsed time ticker for publish progress
  useEffect(() => {
    if (publishProgress && publishProgress.step !== 'done') {
      setElapsedSeconds(0)
      const start = publishProgress.startedAt
      elapsedIntervalRef.current = setInterval(() => {
        setElapsedSeconds(Math.floor((Date.now() - start) / 1000))
      }, 1000)
      return () => {
        if (elapsedIntervalRef.current) clearInterval(elapsedIntervalRef.current)
      }
    } else {
      if (elapsedIntervalRef.current) clearInterval(elapsedIntervalRef.current)
    }
  }, [publishProgress])

  const parseHashtags = () => hashtagsText.split(',').map(h => h.trim().replace(/^#/, '')).filter(Boolean)

  const setPublishStep = useCallback((step: PublishStep) => {
    setPublishProgress({ step, label: PUBLISH_STEPS[step], startedAt: Date.now() })
  }, [])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const isVideo = file.type.startsWith('video/')
    const maxSize = isVideo ? 200 * 1024 * 1024 : 10 * 1024 * 1024
    if (file.size > maxSize) {
      alert(`Fichier trop volumineux (max ${isVideo ? '200' : '10'} MB)`)
      return
    }

    const fileToUpload = file

    // Check video dimensions and warn if too large
    if (isVideo) {
      const dims = await checkVideoDimensions(file)
      if (dims.tooLarge) {
        const proceed = confirm(
          `Cette vidéo est en ${dims.width}x${dims.height}. Instagram recommande max 1080p.\n\nL'upload va continuer avec la vidéo originale. Pour de meilleurs résultats, compressez-la avant avec un outil comme HandBrake.`
        )
        if (!proceed) return
      }
    }

    setUploading(true)
    setUploadInfo(`Upload en cours... (${formatFileSize(fileToUpload.size)})`)
    try {
      const supabase = createClient()
      const ext = fileToUpload.name.split('.').pop()
      const path = `${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('content-drafts').upload(path, fileToUpload, {
        contentType: fileToUpload.type,
        upsert: false,
      })
      if (!error) {
        const { data: { publicUrl } } = supabase.storage.from('content-drafts').getPublicUrl(path)
        setMediaUrls(prev => [...prev, publicUrl])
        if (isVideo && mediaType === 'IMAGE') setMediaType('REELS')
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erreur lors de l\'upload')
    } finally {
      setUploading(false)
      setUploadInfo(null)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const removeMedia = (idx: number) => setMediaUrls(prev => prev.filter((_, i) => i !== idx))

  const saveDraft = async (status: 'draft' | 'scheduled') => {
    setSchedError(null)
    if (status === 'scheduled') {
      const scheduledDate = new Date(`${schedDate}T${schedTime}:00`)
      if (scheduledDate <= new Date()) {
        setSchedError('La date de programmation doit être dans le futur')
        return
      }
    }
    setSaving(true)
    try {
      const hashtags = parseHashtags()
      const scheduled_at = status === 'scheduled' && schedDate ? new Date(`${schedDate}T${schedTime}:00`).toISOString() : undefined
      const body = { caption, hashtags, media_urls: mediaUrls, media_type: mediaType, status, scheduled_at }

      let res: Response
      if (draft) {
        res = await fetch(`/api/instagram/drafts/${draft.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      } else {
        res = await fetch('/api/instagram/drafts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      }
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        throw new Error(errJson.error ?? `Erreur ${res.status}`)
      }
      onSaved()
    } catch {
      alert('Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  const publishNow = async () => {
    if (!mediaUrls.length) { alert('Au moins un média requis'); return }
    setPublishing(true)
    setPublishStatus('loading')
    setPublishError(null)
    setShowPublishConfirm(false)

    // 2 minute client-side timeout (videos need longer processing)
    publishTimeoutRef.current = setTimeout(() => {
      if (publishing) {
        setPublishStatus('error')
        setPublishError('Délai dépassé (2min). La publication peut encore être en cours côté Instagram. Vérifiez dans quelques instants.')
        setPublishing(false)
        setPublishProgress(null)
      }
    }, 120000)

    try {
      // Step 1: Save draft if new
      let draftId = draft?.id
      if (!draftId) {
        setPublishStep('saving')
        const hashtags = parseHashtags()
        const res = await fetch('/api/instagram/drafts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ caption, hashtags, media_urls: mediaUrls, media_type: mediaType, status: 'draft' }),
        })
        const json = await res.json()
        draftId = json.data?.id
      }

      if (!draftId) {
        throw new Error('Impossible de créer le brouillon')
      }

      // Step 2: Upload to Instagram
      setPublishStep('uploading')

      const res = await fetch(`/api/instagram/drafts/${draftId}/publish`, { method: 'POST' })

      // Step 3: Processing (video may take time)
      if (mediaType === 'VIDEO') {
        setPublishStep('processing')
      }

      if (publishTimeoutRef.current) clearTimeout(publishTimeoutRef.current)

      if (res.ok) {
        // Step 4: Publishing complete
        setPublishStep('done')
        setPublishStatus('success')
        setTimeout(() => onSaved(), 2500)
      } else {
        const errJson = await res.json().catch(() => ({}))
        throw new Error(errJson.error || `Erreur ${res.status}`)
      }
    } catch (err) {
      if (publishTimeoutRef.current) clearTimeout(publishTimeoutRef.current)
      setPublishStatus('error')
      setPublishError(err instanceof Error ? err.message : 'Erreur lors de la publication')
      setPublishing(false)
      setPublishProgress(null)
    }
  }

  const applyTemplate = (t: IgCaptionTemplate) => {
    setCaption(t.body)
    if (t.hashtags?.length) {
      const existing = parseHashtags()
      const merged = [...new Set([...existing, ...t.hashtags])]
      setHashtagsText(merged.join(', '))
    }
  }

  const applyHashtagGroup = (g: IgHashtagGroup) => {
    const existing = parseHashtags()
    const merged = [...new Set([...existing, ...g.hashtags])]
    setHashtagsText(merged.join(', '))
  }

  const currentStepIndex = publishProgress ? STEP_ORDER.indexOf(publishProgress.step) : -1

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16, backdropFilter: 'blur(4px)' }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes progressPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
        @keyframes checkPop { 0% { transform: scale(0); } 50% { transform: scale(1.2); } 100% { transform: scale(1); } }
        @keyframes slideIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes progressBar { from { width: 0%; } to { width: 100%; } }
      `}</style>
      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 16, width: 950, maxWidth: '90vw', maxHeight: '85vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 48px rgba(0,0,0,0.4)' }}>
        {/* Responsive container: row on desktop, column on mobile */}
        <div style={{ display: 'flex', flexWrap: 'wrap', flex: 1, minHeight: 0 }}>
          {/* Left: Media */}
          <div style={{ width: 320, minWidth: 280, padding: 24, borderRight: '1px solid var(--border-primary)', display: 'flex', flexDirection: 'column', gap: 12, flexShrink: 0 }}>
            <h4 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Médias</h4>

            {/* Preview */}
            {mediaUrls.length > 0 ? (
              <div style={{ display: 'grid', gap: 8 }}>
                {mediaUrls.map((url, i) => (
                  <div key={i} style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', background: 'var(--bg-elevated)' }}>
                    {(mediaType === 'REELS' || mediaType === 'VIDEO' || mediaType === 'STORY') ? (
                      <video src={url} controls style={{ width: '100%', maxHeight: 450, objectFit: 'contain', background: '#000' }} />
                    ) : (
                      <img src={url} alt="" style={{ width: '100%', maxHeight: 400, objectFit: 'cover' }} />
                    )}
                    <button onClick={() => removeMedia(i)} style={{ position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Trash2 size={14} style={{ color: '#fff' }} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ aspectRatio: '9/16', background: 'var(--bg-elevated)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
                <Upload size={32} style={{ color: 'var(--text-tertiary)' }} />
                <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Glissez ou cliquez</span>
              </div>
            )}

            {/* Upload progress info */}
            {uploading && uploadInfo && (
              <div style={{
                padding: 10,
                background: 'var(--bg-elevated)',
                borderRadius: 8,
                border: '1px solid var(--border-primary)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}>
                <span style={{
                  width: 14, height: 14,
                  border: '2px solid var(--text-tertiary)',
                  borderTopColor: '#3b82f6',
                  borderRadius: '50%',
                  display: 'inline-block',
                  animation: 'spin 0.8s linear infinite',
                  flexShrink: 0,
                }} />
                <span style={{ fontSize: 12, color: 'var(--text-secondary)', animation: 'progressPulse 1.5s ease-in-out infinite' }}>{uploadInfo}</span>
              </div>
            )}

            <input ref={fileRef} type="file" accept="image/*,video/*" onChange={handleUpload} style={{ display: 'none' }} />
            <button onClick={() => fileRef.current?.click()} disabled={uploading}
              style={{ padding: '8px 16px', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', background: 'var(--bg-primary)', border: '1px solid var(--border-primary)', borderRadius: 8, cursor: uploading ? 'wait' : 'pointer', opacity: uploading ? 0.7 : 1, transition: 'all 0.2s ease', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {uploading ? (
                <>
                  <span style={{ width: 14, height: 14, border: '2px solid var(--text-tertiary)', borderTopColor: 'var(--text-primary)', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
                  Upload en cours...
                </>
              ) : 'Ajouter un média'}
            </button>
          </div>

          {/* Right: Form */}
          <div style={{ flex: 1, minWidth: 300, padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{draft ? 'Modifier le post' : 'Nouveau post'}</h3>
              <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}><X size={18} /></button>
            </div>

            {/* Caption */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Légende</label>
                <span style={{ fontSize: 11, color: caption.length > 2200 ? '#ef4444' : 'var(--text-tertiary)' }}>{caption.length}/2200</span>
              </div>
              <textarea value={caption} onChange={e => setCaption(e.target.value)} rows={5} placeholder="Votre légende..."
                style={{ width: '100%', padding: '10px 12px', fontSize: 13, background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-primary)', borderRadius: 8, outline: 'none', resize: 'vertical' }} />
              {templates.length > 0 && (
                <select onChange={e => { const t = templates.find(t => t.id === e.target.value); if (t) applyTemplate(t); e.target.value = '' }}
                  style={{ marginTop: 6, padding: '6px 10px', fontSize: 11, background: 'var(--bg-primary)', color: 'var(--text-secondary)', border: '1px solid var(--border-primary)', borderRadius: 6, width: '100%' }}>
                  <option value="">Appliquer un template...</option>
                  {templates.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                </select>
              )}
            </div>

            {/* Hashtags */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Hashtags</label>
                <span style={{ fontSize: 11, color: parseHashtags().length > 30 ? '#ef4444' : 'var(--text-tertiary)' }}>{parseHashtags().length}/30</span>
              </div>
              <input value={hashtagsText} onChange={e => setHashtagsText(e.target.value)} placeholder="tag1, tag2, tag3"
                style={{ width: '100%', padding: '10px 12px', fontSize: 13, background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-primary)', borderRadius: 8, outline: 'none' }} />
              {hashtagGroups.length > 0 && (
                <select onChange={e => { const g = hashtagGroups.find(g => g.id === e.target.value); if (g) applyHashtagGroup(g); e.target.value = '' }}
                  style={{ marginTop: 6, padding: '6px 10px', fontSize: 11, background: 'var(--bg-primary)', color: 'var(--text-secondary)', border: '1px solid var(--border-primary)', borderRadius: 6, width: '100%' }}>
                  <option value="">Appliquer un groupe...</option>
                  {hashtagGroups.map(g => <option key={g.id} value={g.id}>{g.name} ({g.hashtags.length})</option>)}
                </select>
              )}
            </div>

            {/* Media type */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Type de média</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {[{ v: 'IMAGE', icon: Image, label: 'Post' }, { v: 'REELS', icon: Film, label: 'Reel' }, { v: 'STORY', icon: CircleDot, label: 'Story' }].map(t => {
                  const Icon = t.icon
                  const active = mediaType === t.v
                  return (
                    <button key={t.v} onClick={() => setMediaType(t.v)}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', fontSize: 12, fontWeight: 500, color: active ? '#fff' : 'var(--text-tertiary)', background: active ? 'var(--color-primary)' : 'transparent', border: active ? '1px solid var(--color-primary)' : '1px solid var(--border-primary)', borderRadius: 6, cursor: 'pointer' }}>
                      <Icon size={14} /> {t.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Schedule */}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 140 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Date</label>
                <input type="date" value={schedDate} onChange={e => setSchedDate(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', fontSize: 13, background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-primary)', borderRadius: 8, outline: 'none' }} />
              </div>
              <div style={{ flex: 1, minWidth: 140 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Heure</label>
                <input type="time" value={schedTime} onChange={e => setSchedTime(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', fontSize: 13, background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-primary)', borderRadius: 8, outline: 'none' }} />
              </div>
            </div>

            {/* Publish progress indicator */}
            {publishProgress && publishStatus === 'loading' && (
              <div style={{
                padding: 16,
                background: 'var(--bg-elevated)',
                borderRadius: 10,
                border: '1px solid var(--border-primary)',
                animation: 'slideIn 0.2s ease',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Publication en cours</span>
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>{elapsedSeconds}s</span>
                </div>

                {/* Step indicators */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {STEP_ORDER.filter(s => s !== 'done').map((step, i) => {
                    const isActive = publishProgress.step === step
                    const isDone = currentStepIndex > i
                    const isPending = currentStepIndex < i
                    // Skip processing step for non-video
                    if (step === 'processing' && mediaType !== 'VIDEO') return null

                    return (
                      <div key={step} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        opacity: isPending ? 0.4 : 1,
                        transition: 'opacity 0.3s ease',
                      }}>
                        {/* Step dot / check */}
                        <div style={{
                          width: 20,
                          height: 20,
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          background: isDone ? '#16a34a' : isActive ? '#3b82f6' : 'var(--bg-primary)',
                          border: isDone ? 'none' : isActive ? '2px solid #3b82f6' : '1px solid var(--border-primary)',
                          transition: 'all 0.3s ease',
                        }}>
                          {isDone ? (
                            <Check size={12} style={{ color: '#fff' }} />
                          ) : isActive ? (
                            <span style={{
                              width: 8, height: 8,
                              borderRadius: '50%',
                              background: '#fff',
                              animation: 'progressPulse 1s ease-in-out infinite',
                            }} />
                          ) : (
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--text-tertiary)' }} />
                          )}
                        </div>

                        {/* Step label */}
                        <span style={{
                          fontSize: 12,
                          color: isActive ? 'var(--text-primary)' : isDone ? '#16a34a' : 'var(--text-tertiary)',
                          fontWeight: isActive ? 600 : 400,
                        }}>
                          {PUBLISH_STEPS[step]}
                        </span>
                      </div>
                    )
                  })}
                </div>

                {/* Progress bar */}
                <div style={{ marginTop: 12, height: 3, background: 'var(--bg-primary)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    background: 'linear-gradient(90deg, #3b82f6, #22c55e)',
                    borderRadius: 2,
                    animation: 'progressBar 2s ease-in-out infinite',
                  }} />
                </div>
              </div>
            )}

            {/* Publish success */}
            {publishStatus === 'success' && (
              <div style={{
                padding: 16,
                background: 'rgba(22,163,106,0.1)',
                borderRadius: 10,
                border: '1px solid rgba(22,163,106,0.3)',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                animation: 'slideIn 0.3s ease',
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: '#16a34a',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  animation: 'checkPop 0.4s ease',
                }}>
                  <Check size={18} style={{ color: '#fff' }} />
                </div>
                <div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#16a34a', display: 'block' }}>Publié avec succès !</span>
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Le post est maintenant visible sur Instagram</span>
                </div>
              </div>
            )}

            {/* Schedule error */}
            {schedError && (
              <div style={{ padding: '8px 12px', fontSize: 12, color: '#ef4444', background: 'rgba(239,68,68,0.1)', borderRadius: 8, border: '1px solid rgba(239,68,68,0.2)' }}>
                {schedError}
              </div>
            )}

            {/* Publish error message */}
            {publishError && (
              <div style={{
                padding: 12,
                background: 'rgba(239,68,68,0.1)',
                borderRadius: 10,
                border: '1px solid rgba(239,68,68,0.2)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                animation: 'slideIn 0.2s ease',
              }}>
                <AlertCircle size={16} style={{ color: '#ef4444', flexShrink: 0, marginTop: 1 }} />
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 12, color: '#ef4444', display: 'block', lineHeight: 1.4 }}>{publishError}</span>
                </div>
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              <button onClick={() => saveDraft('draft')} disabled={saving || publishing}
                style={{ padding: '10px 20px', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)', borderRadius: 8, cursor: 'pointer', transition: 'all 0.2s ease', opacity: publishing ? 0.5 : 1 }}>
                {saving ? '...' : 'Brouillon'}
              </button>
              <button onClick={() => saveDraft('scheduled')} disabled={saving || !schedDate || publishing}
                style={{ padding: '10px 20px', fontSize: 13, fontWeight: 600, color: '#fff', background: '#3b82f6', border: 'none', borderRadius: 8, cursor: (!schedDate || publishing) ? 'not-allowed' : 'pointer', opacity: (!schedDate || publishing) ? 0.5 : 1, transition: 'all 0.2s ease' }}>
                {saving ? '...' : 'Programmer'}
              </button>
              {publishStatus === 'error' ? (
                <button onClick={() => { setPublishStatus('idle'); setPublishError(null); setShowPublishConfirm(true) }}
                  style={{ padding: '10px 20px', fontSize: 13, fontWeight: 600, color: '#fff', background: '#ef4444', border: 'none', borderRadius: 8, cursor: 'pointer', transition: 'all 0.2s ease', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <RotateCcw size={14} /> Réessayer
                </button>
              ) : (
                <button onClick={() => setShowPublishConfirm(true)} disabled={publishing || !mediaUrls.length}
                  style={{ padding: '10px 20px', fontSize: 13, fontWeight: 600, color: '#fff', background: publishStatus === 'success' ? '#16a34a' : '#22c55e', border: 'none', borderRadius: 8, cursor: (!mediaUrls.length || publishing) ? 'not-allowed' : 'pointer', opacity: (!mediaUrls.length || publishing) ? 0.5 : 1, transition: 'all 0.2s ease' }}>
                  {publishStatus === 'loading' ? 'Publication...' : publishStatus === 'success' ? 'Publié !' : 'Publier'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Publish confirmation dialog */}
        {showPublishConfirm && (
          <div onClick={e => { if (e.target === e.currentTarget) setShowPublishConfirm(false) }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 12, padding: 24, maxWidth: 400, width: '90vw' }}>
              <h4 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>Confirmer la publication</h4>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 20 }}>
                Ce post sera publié immédiatement sur votre compte Instagram. Cette action est irréversible.
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button onClick={() => setShowPublishConfirm(false)}
                  style={{ padding: '8px 16px', fontSize: 13, color: 'var(--text-tertiary)', background: 'none', border: '1px solid var(--border-primary)', borderRadius: 8, cursor: 'pointer' }}>
                  Annuler
                </button>
                <button onClick={publishNow}
                  style={{ padding: '8px 20px', fontSize: 13, fontWeight: 600, color: '#fff', background: '#22c55e', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
                  Publier maintenant
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
