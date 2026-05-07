'use client'

/**
 * Video player avec annotations timestampees (style Frame.io).
 *
 * Comportement :
 * - Lecture/pause standard via les controls natifs
 * - Click sur la timeline (en pause) → ouvre une bulle "Ajouter un commentaire a 0:23"
 * - Markers colores au-dessus de la timeline pour chaque annotation existante
 * - Hover marker → tooltip avec le commentaire
 * - Click marker → seek a la timestamp + emet onAnnotationClick (le parent peut
 *   scroller la liste de discussion vers ce message)
 *
 * Le composant expose un seek(s) via le ref forward pour que le parent puisse
 * sauter a un timestamp donne (par exemple click sur un message dans le footer).
 */

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { MessageSquarePlus } from 'lucide-react'

export interface VideoAnnotation {
  id: string
  video_timestamp_seconds: number
  body: string
  author_name: string
  author_color?: string
  is_self: boolean
}

export interface VideoReviewPlayerHandle {
  seek: (seconds: number) => void
  pause: () => void
}

interface VideoReviewPlayerProps {
  url: string
  annotations: VideoAnnotation[]
  onAddAnnotation: (timestampSeconds: number, body: string) => Promise<void>
  onAnnotationClick?: (annotationId: string) => void
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

const VideoReviewPlayer = forwardRef<VideoReviewPlayerHandle, VideoReviewPlayerProps>(
  function VideoReviewPlayer({ url, annotations, onAddAnnotation, onAnnotationClick }, ref) {
    const videoRef = useRef<HTMLVideoElement>(null)
    const timelineRef = useRef<HTMLDivElement>(null)

    const [duration, setDuration] = useState(0)
    const [currentTime, setCurrentTime] = useState(0)
    const [pendingTimestamp, setPendingTimestamp] = useState<number | null>(null)
    const [pendingBody, setPendingBody] = useState('')
    const [submitting, setSubmitting] = useState(false)

    useImperativeHandle(ref, () => ({
      seek: (s: number) => {
        const v = videoRef.current
        if (v && Number.isFinite(s)) {
          v.currentTime = Math.max(0, Math.min(v.duration || s, s))
          v.pause()
        }
      },
      pause: () => videoRef.current?.pause(),
    }), [])

    useEffect(() => {
      const v = videoRef.current
      if (!v) return
      const onTime = () => setCurrentTime(v.currentTime)
      const onMeta = () => setDuration(v.duration || 0)
      v.addEventListener('timeupdate', onTime)
      v.addEventListener('loadedmetadata', onMeta)
      return () => {
        v.removeEventListener('timeupdate', onTime)
        v.removeEventListener('loadedmetadata', onMeta)
      }
    }, [url])

    const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
      const tl = timelineRef.current
      const v = videoRef.current
      if (!tl || !v || !duration) return
      const rect = tl.getBoundingClientRect()
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
      const t = ratio * duration
      v.pause()
      v.currentTime = t
      setPendingTimestamp(t)
      setPendingBody('')
    }

    const submitAnnotation = async () => {
      if (pendingTimestamp === null || !pendingBody.trim()) return
      setSubmitting(true)
      try {
        await onAddAnnotation(pendingTimestamp, pendingBody.trim())
        setPendingTimestamp(null)
        setPendingBody('')
      } finally {
        setSubmitting(false)
      }
    }

    const cancelAnnotation = () => {
      setPendingTimestamp(null)
      setPendingBody('')
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', height: '100%' }}>
        {/* Player */}
        <div style={{ flex: 1, minHeight: 0, background: '#000', borderRadius: 10, overflow: 'hidden', position: 'relative' }}>
          <video
            ref={videoRef}
            src={url}
            controls
            preload="metadata"
            playsInline
            style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
          />
        </div>

        {/* Timeline custom avec markers + click pour annoter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11, color: 'var(--text-tertiary)', padding: '0 4px' }}>
          <span style={{ minWidth: 38, textAlign: 'right', fontFamily: 'monospace' }}>{formatTime(currentTime)}</span>
          <div
            ref={timelineRef}
            onClick={handleTimelineClick}
            title="Clique pour ajouter un commentaire à ce moment"
            style={{
              position: 'relative',
              flex: 1,
              height: 24,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {/* Track */}
            <div style={{
              position: 'absolute', inset: '10px 0 10px 0',
              background: 'var(--bg-elevated)', borderRadius: 2,
            }} />
            {/* Played portion */}
            <div style={{
              position: 'absolute', left: 0, top: 10, bottom: 10,
              width: duration > 0 ? `${(currentTime / duration) * 100}%` : 0,
              background: 'var(--color-primary)', opacity: 0.6, borderRadius: 2,
            }} />
            {/* Markers */}
            {duration > 0 && annotations.map((a) => {
              const left = `${Math.max(0, Math.min(100, (a.video_timestamp_seconds / duration) * 100))}%`
              return (
                <button
                  key={a.id}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (videoRef.current) {
                      videoRef.current.currentTime = a.video_timestamp_seconds
                      videoRef.current.pause()
                    }
                    onAnnotationClick?.(a.id)
                  }}
                  title={`${a.author_name} · ${formatTime(a.video_timestamp_seconds)}\n${a.body}`}
                  style={{
                    position: 'absolute',
                    left,
                    transform: 'translate(-50%, 0)',
                    top: 4,
                    width: 12,
                    height: 16,
                    padding: 0,
                    background: a.author_color ?? '#f59e0b',
                    border: '2px solid var(--bg-secondary)',
                    borderRadius: 4,
                    cursor: 'pointer',
                  }}
                  aria-label={`Annotation à ${formatTime(a.video_timestamp_seconds)}`}
                />
              )
            })}
          </div>
          <span style={{ minWidth: 38, fontFamily: 'monospace' }}>{formatTime(duration)}</span>
        </div>

        {/* Bulle d'annotation */}
        {pendingTimestamp !== null && (
          <div style={{
            display: 'flex', flexDirection: 'column', gap: 8,
            padding: 12,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--color-primary)',
            borderRadius: 8,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
              <MessageSquarePlus size={14} color="var(--color-primary)" />
              <span style={{ fontWeight: 600 }}>Commenter à {formatTime(pendingTimestamp)}</span>
            </div>
            <textarea
              value={pendingBody}
              onChange={(e) => setPendingBody(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault()
                  submitAnnotation()
                }
                if (e.key === 'Escape') cancelAnnotation()
              }}
              placeholder="Ton retour à ce moment précis…"
              autoFocus
              rows={2}
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '8px 10px', fontSize: 13,
                background: 'var(--bg-secondary)', color: 'var(--text-primary)',
                border: '1px solid var(--border-primary)', borderRadius: 6,
                outline: 'none', resize: 'vertical', fontFamily: 'inherit',
              }}
            />
            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
              <button
                onClick={cancelAnnotation}
                style={{
                  padding: '6px 12px', fontSize: 12, fontWeight: 600,
                  background: 'transparent', color: 'var(--text-tertiary)',
                  border: '1px solid var(--border-primary)', borderRadius: 6,
                  cursor: 'pointer',
                }}
              >
                Annuler
              </button>
              <button
                onClick={submitAnnotation}
                disabled={submitting || !pendingBody.trim()}
                style={{
                  padding: '6px 14px', fontSize: 12, fontWeight: 600,
                  color: '#fff', background: 'var(--color-primary)',
                  border: 'none', borderRadius: 6,
                  cursor: submitting ? 'wait' : 'pointer',
                  opacity: submitting || !pendingBody.trim() ? 0.5 : 1,
                }}
              >
                {submitting ? 'Envoi…' : 'Commenter'}
              </button>
            </div>
            <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
              ⌘+Entrée pour envoyer · Échap pour annuler
            </span>
          </div>
        )}
      </div>
    )
  },
)

export default VideoReviewPlayer
