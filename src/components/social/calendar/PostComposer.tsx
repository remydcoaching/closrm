'use client'

import { useState, useRef, useEffect } from 'react'
import { X, Upload, Camera, Video, Loader2, Trash2, Calendar, Clock } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { SocialPost, SocialPostPublication, SocialPlatform } from '@/types'

interface PostWithPubs extends SocialPost {
  publications: SocialPostPublication[]
}

interface Props {
  defaultDate?: Date | null
  editingPost?: PostWithPubs | null
  onClose: () => void
  onSaved: () => void
}

const PLATFORMS: { key: SocialPlatform; label: string; color: string; icon: typeof Camera }[] = [
  { key: 'instagram', label: 'Instagram', color: '#EC4899', icon: Camera },
  { key: 'youtube',   label: 'YouTube',   color: '#FF0000', icon: Video },
]

export default function PostComposer({ defaultDate, editingPost, onClose, onSaved }: Props) {
  const [title, setTitle] = useState(editingPost?.title ?? '')
  const [caption, setCaption] = useState(editingPost?.caption ?? '')
  const [hashtags, setHashtags] = useState((editingPost?.hashtags ?? []).join(' '))
  const [mediaUrls, setMediaUrls] = useState<string[]>(editingPost?.media_urls ?? [])
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [enabledPlatforms, setEnabledPlatforms] = useState<Record<SocialPlatform, boolean>>({
    instagram: editingPost?.publications.some((p) => p.platform === 'instagram') ?? true,
    youtube:   editingPost?.publications.some((p) => p.platform === 'youtube') ?? true,
    tiktok:    false,
  })
  const [activeTab, setActiveTab] = useState<SocialPlatform>('instagram')
  const fileRef = useRef<HTMLInputElement>(null)

  // Platform-specific overrides
  const [ytTitle, setYtTitle] = useState(
    (editingPost?.publications.find((p) => p.platform === 'youtube')?.config?.title as string) ??
      editingPost?.title ?? '',
  )
  const [ytDescription, setYtDescription] = useState(
    (editingPost?.publications.find((p) => p.platform === 'youtube')?.config?.description as string) ??
      editingPost?.caption ?? '',
  )
  const [ytPrivacy, setYtPrivacy] = useState<'public' | 'unlisted' | 'private'>(
    (editingPost?.publications.find((p) => p.platform === 'youtube')?.config?.privacy_status as
      | 'public'
      | 'unlisted'
      | 'private') ?? 'public',
  )

  // Schedule
  const initDate = editingPost?.scheduled_at ? new Date(editingPost.scheduled_at) : defaultDate ?? new Date()
  const [scheduleDate, setScheduleDate] = useState(initDate.toISOString().slice(0, 10))
  const [scheduleTime, setScheduleTime] = useState(initDate.toTimeString().slice(0, 5))

  // Auto-detect format based on first media
  const [mediaIsVideo, setMediaIsVideo] = useState(false)
  const [mediaDurationSec, setMediaDurationSec] = useState<number | null>(null)

  useEffect(() => {
    // Lock body scroll
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    setUploading(true)
    try {
      const supabase = createClient()
      const ext = file.name.split('.').pop() || 'bin'
      const path = `posts/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('content-drafts')
        .upload(path, file, { contentType: file.type })
      if (upErr) throw upErr
      const { data: pub } = supabase.storage.from('content-drafts').getPublicUrl(path)
      setMediaUrls((prev) => [...prev, pub.publicUrl])
      setMediaIsVideo(file.type.startsWith('video/'))

      // Probe video duration
      if (file.type.startsWith('video/')) {
        const url = URL.createObjectURL(file)
        const v = document.createElement('video')
        v.preload = 'metadata'
        v.src = url
        v.onloadedmetadata = () => {
          setMediaDurationSec(v.duration)
          URL.revokeObjectURL(url)
        }
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  function removeMedia(idx: number) {
    setMediaUrls((prev) => prev.filter((_, i) => i !== idx))
  }

  async function submit() {
    setError(null)
    if (!enabledPlatforms.instagram && !enabledPlatforms.youtube) {
      return setError('Sélectionne au moins une plateforme')
    }
    if (enabledPlatforms.youtube && !ytTitle.trim()) {
      return setError('Le titre YouTube est requis')
    }

    const iso = new Date(`${scheduleDate}T${scheduleTime}`).toISOString()
    const mediaType =
      mediaUrls.length === 0
        ? null
        : mediaIsVideo
          ? mediaDurationSec != null && mediaDurationSec <= 60
            ? 'SHORT'
            : 'VIDEO'
          : mediaUrls.length > 1
            ? 'CAROUSEL'
            : 'IMAGE'

    const publications: {
      platform: SocialPlatform
      config: Record<string, unknown>
      scheduled_at?: string
    }[] = []

    if (enabledPlatforms.instagram) {
      publications.push({
        platform: 'instagram',
        config: {
          caption: caption,
          hashtags: hashtags.split(/\s+/).filter((h) => h.startsWith('#') || h.length > 0),
        },
      })
    }
    if (enabledPlatforms.youtube) {
      publications.push({
        platform: 'youtube',
        config: {
          title: ytTitle,
          description: ytDescription,
          privacy_status: ytPrivacy,
          tags: hashtags.split(/\s+/).map((h) => h.replace(/^#/, '')).filter(Boolean),
        },
      })
    }

    setSubmitting(true)
    try {
      const body = {
        title: title || null,
        caption: caption || null,
        hashtags: hashtags.split(/\s+/).filter(Boolean),
        media_urls: mediaUrls,
        media_type: mediaType,
        status: 'scheduled',
        scheduled_at: iso,
        publications,
      }
      const endpoint = editingPost ? `/api/social/posts/${editingPost.id}` : '/api/social/posts'
      const method = editingPost ? 'PATCH' : 'POST'
      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(typeof err.error === 'string' ? err.error : `Erreur ${res.status}`)
      }
      onSaved()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  async function deletePost() {
    if (!editingPost) return
    if (!confirm('Supprimer ce post ?')) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/social/posts/${editingPost.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(`Erreur ${res.status}`)
      onSaved()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  const activePlatforms = PLATFORMS.filter((p) => enabledPlatforms[p.key])

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 820, maxWidth: '100%', maxHeight: '90vh',
          background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)',
          borderRadius: 14, overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', borderBottom: '1px solid var(--border-primary)',
        }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>
              {editingPost ? 'Modifier le post' : 'Nouveau post multi-plateforme'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              Publie en une fois sur Instagram, YouTube et plus
            </div>
          </div>
          <button onClick={onClose} style={iconBtn}><X size={16} /></button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0, flex: 1, overflow: 'hidden' }}>
          {/* Left: media + platforms */}
          <div style={{ padding: 20, borderRight: '1px solid var(--border-primary)', overflowY: 'auto' }}>
            <div style={sectionLabel}>Plateformes</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              {PLATFORMS.map((p) => (
                <button
                  key={p.key}
                  onClick={() => {
                    setEnabledPlatforms((prev) => ({ ...prev, [p.key]: !prev[p.key] }))
                    if (!enabledPlatforms[p.key]) setActiveTab(p.key)
                  }}
                  style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    padding: '10px', borderRadius: 8,
                    background: enabledPlatforms[p.key] ? p.color : 'var(--bg-surface)',
                    color: enabledPlatforms[p.key] ? '#fff' : 'var(--text-tertiary)',
                    border: `1px solid ${enabledPlatforms[p.key] ? p.color : 'var(--border-primary)'}`,
                    fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  <p.icon size={13} />
                  {p.label}
                </button>
              ))}
              <button
                disabled
                title="TikTok bientôt"
                style={{
                  flex: 1, padding: '10px', borderRadius: 8,
                  background: 'var(--bg-surface)', color: 'var(--text-muted)',
                  border: '1px dashed var(--border-primary)',
                  fontSize: 12, fontWeight: 600, cursor: 'not-allowed', opacity: 0.5,
                }}
              >
                TikTok (bientôt)
              </button>
            </div>

            <div style={sectionLabel}>Médias</div>
            {mediaUrls.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                {mediaUrls.map((url, i) => (
                  <div key={url} style={{ position: 'relative' }}>
                    {mediaIsVideo ? (
                      <video src={url} style={{ width: 100, height: 100, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border-primary)' }} />
                    ) : (
                      <img src={url} alt="" style={{ width: 100, height: 100, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border-primary)' }} />
                    )}
                    <button
                      onClick={() => removeMedia(i)}
                      style={{
                        position: 'absolute', top: 4, right: 4,
                        width: 22, height: 22, borderRadius: '50%',
                        background: 'rgba(0,0,0,0.7)', border: 'none', color: '#fff',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <X size={11} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*,video/*"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              style={{
                width: '100%', padding: 14, borderRadius: 8,
                background: 'var(--bg-input)', border: '1px dashed var(--border-primary)',
                color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
              {uploading ? 'Upload…' : 'Ajouter image/vidéo'}
            </button>
            {mediaDurationSec != null && (
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 6 }}>
                Durée : {mediaDurationSec.toFixed(0)}s — {mediaDurationSec <= 60 ? 'compatible Shorts/Reels' : 'vidéo longue (YouTube uniquement)'}
              </div>
            )}

            {/* Schedule */}
            <div style={{ marginTop: 20 }}>
              <div style={sectionLabel}>Programmation</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1, position: 'relative' }}>
                  <Calendar size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="date"
                    value={scheduleDate}
                    onChange={(e) => setScheduleDate(e.target.value)}
                    style={{ ...inputStyle, paddingLeft: 32 }}
                  />
                </div>
                <div style={{ flex: 1, position: 'relative' }}>
                  <Clock size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="time"
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                    style={{ ...inputStyle, paddingLeft: 32 }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right: platform-specific content */}
          <div style={{ padding: 20, overflowY: 'auto' }}>
            <div style={{ display: 'flex', gap: 4, marginBottom: 14 }}>
              {activePlatforms.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Active au moins une plateforme</div>
              ) : (
                activePlatforms.map((p) => (
                  <button
                    key={p.key}
                    onClick={() => setActiveTab(p.key)}
                    style={{
                      padding: '7px 14px', fontSize: 12, fontWeight: 600, borderRadius: 7,
                      background: activeTab === p.key ? p.color : 'transparent',
                      color: activeTab === p.key ? '#fff' : 'var(--text-secondary)',
                      border: `1px solid ${activeTab === p.key ? p.color : 'var(--border-primary)'}`,
                      cursor: 'pointer',
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                    }}
                  >
                    <p.icon size={12} />
                    {p.label}
                  </button>
                ))
              )}
            </div>

            {activeTab === 'instagram' && enabledPlatforms.instagram && (
              <>
                <label style={fieldLabel}>Légende</label>
                <textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Écris ta légende..."
                  rows={6}
                  style={textareaStyle}
                />
                <label style={{ ...fieldLabel, marginTop: 12 }}>Hashtags</label>
                <input
                  type="text"
                  value={hashtags}
                  onChange={(e) => setHashtags(e.target.value)}
                  placeholder="#coaching #motivation ..."
                  style={inputStyle}
                />
              </>
            )}

            {activeTab === 'youtube' && enabledPlatforms.youtube && (
              <>
                <label style={fieldLabel}>Titre *</label>
                <input
                  type="text"
                  value={ytTitle}
                  onChange={(e) => setYtTitle(e.target.value)}
                  placeholder="Titre de la vidéo YouTube..."
                  maxLength={100}
                  style={inputStyle}
                />
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{ytTitle.length}/100</div>

                <label style={{ ...fieldLabel, marginTop: 12 }}>Description</label>
                <textarea
                  value={ytDescription}
                  onChange={(e) => setYtDescription(e.target.value)}
                  placeholder="Description complète..."
                  rows={6}
                  style={textareaStyle}
                />

                <label style={{ ...fieldLabel, marginTop: 12 }}>Visibilité</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {(['public', 'unlisted', 'private'] as const).map((v) => (
                    <button
                      key={v}
                      onClick={() => setYtPrivacy(v)}
                      style={{
                        flex: 1, padding: '8px', borderRadius: 7, fontSize: 11, fontWeight: 600,
                        background: ytPrivacy === v ? '#FF0000' : 'var(--bg-surface)',
                        color: ytPrivacy === v ? '#fff' : 'var(--text-secondary)',
                        border: `1px solid ${ytPrivacy === v ? '#FF0000' : 'var(--border-primary)'}`,
                        cursor: 'pointer',
                      }}
                    >
                      {v === 'public' ? 'Public' : v === 'unlisted' ? 'Non répertorié' : 'Privé'}
                    </button>
                  ))}
                </div>
              </>
            )}

            {!enabledPlatforms[activeTab] && activePlatforms.length > 0 && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Cette plateforme n&apos;est pas active. Active-la à gauche.
              </div>
            )}
          </div>
        </div>

        {error && (
          <div style={{ padding: '10px 20px', background: 'rgba(229,62,62,0.1)', color: '#E53E3E', fontSize: 12 }}>
            {error}
          </div>
        )}

        {/* Footer */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '14px 20px', borderTop: '1px solid var(--border-primary)',
          background: 'var(--bg-surface)',
        }}>
          <div>
            {editingPost && (
              <button
                onClick={deletePost}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '8px 14px', fontSize: 12, fontWeight: 600,
                  background: 'transparent', border: '1px solid rgba(229,62,62,0.3)',
                  color: '#E53E3E', borderRadius: 7, cursor: 'pointer',
                }}
              >
                <Trash2 size={12} /> Supprimer
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={btnSecondary}>Annuler</button>
            <button
              onClick={submit}
              disabled={submitting}
              style={{
                padding: '9px 20px', fontSize: 12, fontWeight: 600, borderRadius: 7,
                background: '#5b9bf5', color: '#fff', border: 'none',
                cursor: submitting ? 'wait' : 'pointer', opacity: submitting ? 0.7 : 1,
                display: 'inline-flex', alignItems: 'center', gap: 8,
              }}
            >
              {submitting && <Loader2 size={12} className="animate-spin" />}
              {editingPost ? 'Mettre à jour' : 'Programmer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

const sectionLabel: React.CSSProperties = {
  fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em',
  color: 'var(--text-muted)', fontWeight: 700, marginBottom: 8,
}
const fieldLabel: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)',
  marginBottom: 5, display: 'block',
}
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 11px', fontSize: 13,
  background: 'var(--bg-input)', border: '1px solid var(--border-primary)',
  borderRadius: 7, color: 'var(--text-primary)', outline: 'none',
}
const textareaStyle: React.CSSProperties = {
  ...inputStyle, minHeight: 100, resize: 'vertical',
  fontFamily: 'inherit',
}
const iconBtn: React.CSSProperties = {
  background: 'transparent', border: 'none', color: 'var(--text-secondary)',
  cursor: 'pointer', padding: 6, borderRadius: 6,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
}
const btnSecondary: React.CSSProperties = {
  padding: '9px 16px', fontSize: 12, fontWeight: 600, borderRadius: 7,
  background: 'transparent', border: '1px solid var(--border-primary)',
  color: 'var(--text-secondary)', cursor: 'pointer',
}
