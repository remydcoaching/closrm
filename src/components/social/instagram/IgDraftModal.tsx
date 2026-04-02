'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Upload, Trash2, Image, Video, Layers } from 'lucide-react'
import type { IgDraft, IgHashtagGroup, IgCaptionTemplate } from '@/types'
import { createClient } from '@/lib/supabase/client'

interface Props {
  date?: string
  draft?: IgDraft
  onClose: () => void
  onSaved: () => void
}

export default function IgDraftModal({ date, draft, onClose, onSaved }: Props) {
  const [caption, setCaption] = useState(draft?.caption ?? '')
  const [hashtagsText, setHashtagsText] = useState(draft?.hashtags?.join(', ') ?? '')
  const [mediaUrls, setMediaUrls] = useState<string[]>(draft?.media_urls ?? [])
  const [mediaType, setMediaType] = useState<string>(draft?.media_type ?? 'IMAGE')
  const [schedDate, setSchedDate] = useState(draft?.scheduled_at?.slice(0, 10) ?? date ?? '')
  const [schedTime, setSchedTime] = useState(draft?.scheduled_at?.slice(11, 16) ?? '09:00')
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [publishStatus, setPublishStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [hashtagGroups, setHashtagGroups] = useState<IgHashtagGroup[]>([])
  const [templates, setTemplates] = useState<IgCaptionTemplate[]>([])
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/instagram/hashtag-groups').then(r => r.json()),
      fetch('/api/instagram/caption-templates').then(r => r.json()),
    ]).then(([hg, ct]) => {
      setHashtagGroups(hg.data ?? [])
      setTemplates(ct.data ?? [])
    })
  }, [])

  const parseHashtags = () => hashtagsText.split(',').map(h => h.trim().replace(/^#/, '')).filter(Boolean)

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const maxSize = file.type.startsWith('video/') ? 200 * 1024 * 1024 : 10 * 1024 * 1024
    if (file.size > maxSize) { alert(`Fichier trop volumineux (max ${file.type.startsWith('video/') ? '200' : '10'} MB)`); return }

    setUploading(true)
    const supabase = createClient()
    const ext = file.name.split('.').pop()
    const path = `${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('content-drafts').upload(path, file)
    if (!error) {
      const { data: { publicUrl } } = supabase.storage.from('content-drafts').getPublicUrl(path)
      setMediaUrls(prev => [...prev, publicUrl])
      if (file.type.startsWith('video/')) setMediaType('VIDEO')
    }
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  const removeMedia = (idx: number) => setMediaUrls(prev => prev.filter((_, i) => i !== idx))

  const saveDraft = async (status: 'draft' | 'scheduled') => {
    setSaving(true)
    const hashtags = parseHashtags()
    const scheduled_at = status === 'scheduled' && schedDate ? `${schedDate}T${schedTime}:00Z` : undefined
    const body = { caption, hashtags, media_urls: mediaUrls, media_type: mediaType, status, scheduled_at }

    if (draft) {
      await fetch(`/api/instagram/drafts/${draft.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    } else {
      await fetch('/api/instagram/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    }
    setSaving(false)
    onSaved()
  }

  const publishNow = async () => {
    if (!mediaUrls.length) { alert('Au moins un media requis'); return }
    setPublishing(true)
    setPublishStatus('loading')

    // Save first if new
    let draftId = draft?.id
    if (!draftId) {
      const hashtags = parseHashtags()
      const res = await fetch('/api/instagram/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caption, hashtags, media_urls: mediaUrls, media_type: mediaType, status: 'draft' }),
      })
      const json = await res.json()
      draftId = json.data?.id
    }

    if (!draftId) { setPublishStatus('error'); setPublishing(false); return }

    const res = await fetch(`/api/instagram/drafts/${draftId}/publish`, { method: 'POST' })
    if (res.ok) {
      setPublishStatus('success')
      setTimeout(() => onSaved(), 2000)
    } else {
      setPublishStatus('error')
      setPublishing(false)
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

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 16, width: 950, maxHeight: '85vh', overflowY: 'auto', display: 'flex' }}>
        {/* Left: Media */}
        <div style={{ width: 320, padding: 24, borderRight: '1px solid var(--border-primary)', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h4 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Medias</h4>

          {/* Preview */}
          {mediaUrls.length > 0 ? (
            <div style={{ display: 'grid', gap: 8 }}>
              {mediaUrls.map((url, i) => (
                <div key={i} style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', background: 'var(--bg-elevated)' }}>
                  {mediaType === 'VIDEO' ? (
                    <video src={url} controls style={{ width: '100%', maxHeight: 300 }} />
                  ) : (
                    <img src={url} alt="" style={{ width: '100%', maxHeight: 300, objectFit: 'cover' }} />
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

          <input ref={fileRef} type="file" accept="image/*,video/*" onChange={handleUpload} style={{ display: 'none' }} />
          <button onClick={() => fileRef.current?.click()} disabled={uploading}
            style={{ padding: '8px 16px', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', background: 'var(--bg-primary)', border: '1px solid var(--border-primary)', borderRadius: 8, cursor: 'pointer' }}>
            {uploading ? 'Upload en cours...' : 'Ajouter un media'}
          </button>
        </div>

        {/* Right: Form */}
        <div style={{ flex: 1, padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{draft ? 'Modifier le post' : 'Nouveau post'}</h3>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}><X size={18} /></button>
          </div>

          {/* Caption */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Legende</label>
              <span style={{ fontSize: 11, color: caption.length > 2200 ? '#ef4444' : 'var(--text-tertiary)' }}>{caption.length}/2200</span>
            </div>
            <textarea value={caption} onChange={e => setCaption(e.target.value)} rows={5} placeholder="Votre legende..."
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
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Type de media</label>
            <div style={{ display: 'flex', gap: 6 }}>
              {[{ v: 'IMAGE', icon: Image, label: 'Image' }, { v: 'VIDEO', icon: Video, label: 'Video' }, { v: 'CAROUSEL', icon: Layers, label: 'Carousel' }].map(t => {
                const Icon = t.icon
                const active = mediaType === t.v
                return (
                  <button key={t.v} onClick={() => setMediaType(t.v)}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', fontSize: 12, fontWeight: 500, color: active ? '#fff' : 'var(--text-tertiary)', background: active ? 'var(--bg-elevated)' : 'transparent', border: active ? '1px solid var(--border-primary)' : '1px solid transparent', borderRadius: 6, cursor: 'pointer' }}>
                    <Icon size={14} /> {t.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Schedule */}
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Date</label>
              <input type="date" value={schedDate} onChange={e => setSchedDate(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', fontSize: 13, background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-primary)', borderRadius: 8, outline: 'none' }} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Heure</label>
              <input type="time" value={schedTime} onChange={e => setSchedTime(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', fontSize: 13, background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-primary)', borderRadius: 8, outline: 'none' }} />
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button onClick={() => saveDraft('draft')} disabled={saving}
              style={{ padding: '10px 20px', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)', borderRadius: 8, cursor: 'pointer' }}>
              {saving ? '...' : 'Brouillon'}
            </button>
            <button onClick={() => saveDraft('scheduled')} disabled={saving || !schedDate}
              style={{ padding: '10px 20px', fontSize: 13, fontWeight: 600, color: '#fff', background: '#3b82f6', border: 'none', borderRadius: 8, cursor: 'pointer', opacity: !schedDate ? 0.5 : 1 }}>
              {saving ? '...' : 'Programmer'}
            </button>
            <button onClick={publishNow} disabled={publishing || !mediaUrls.length}
              style={{ padding: '10px 20px', fontSize: 13, fontWeight: 600, color: '#fff', background: '#22c55e', border: 'none', borderRadius: 8, cursor: 'pointer', opacity: !mediaUrls.length ? 0.5 : 1 }}>
              {publishStatus === 'loading' ? 'Publication...' : publishStatus === 'success' ? 'Publie !' : publishStatus === 'error' ? 'Erreur' : 'Publier'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
