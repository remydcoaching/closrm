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
import { MessageSquarePlus, Play, Pause, Volume2, VolumeX, Maximize2, X, Check, Eye, EyeOff } from 'lucide-react'

export interface VideoAnnotation {
  id: string
  video_timestamp_seconds: number
  body: string
  author_name: string
  author_color?: string
  is_self: boolean
  resolved_at: string | null
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
  onToggleResolved?: (annotationId: string, resolved: boolean) => Promise<void>
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

const VideoReviewPlayer = forwardRef<VideoReviewPlayerHandle, VideoReviewPlayerProps>(
  function VideoReviewPlayer({ url, annotations, onAddAnnotation, onAnnotationClick, onToggleResolved }, ref) {
    const videoRef = useRef<HTMLVideoElement>(null)
    const timelineRef = useRef<HTMLDivElement>(null)
    const playerWrapRef = useRef<HTMLDivElement>(null)

    const [duration, setDuration] = useState(0)
    const [currentTime, setCurrentTime] = useState(0)
    const [playing, setPlaying] = useState(false)
    const [muted, setMuted] = useState(false)
    const [pendingTimestamp, setPendingTimestamp] = useState<number | null>(null)
    const [pendingBody, setPendingBody] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [hoveredId, setHoveredId] = useState<string | null>(null)
    const [clickedId, setClickedId] = useState<string | null>(null)
    const [dismissedId, setDismissedId] = useState<string | null>(null)
    const [aspectRatio, setAspectRatio] = useState<number | null>(null)
    const [playerWidth, setPlayerWidth] = useState<number | null>(null)
    const [showResolved, setShowResolved] = useState(false)
    const [togglingId, setTogglingId] = useState<string | null>(null)

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
      const onMeta = () => {
        setDuration(v.duration || 0)
        if (v.videoWidth && v.videoHeight) setAspectRatio(v.videoWidth / v.videoHeight)
      }
      const onPlay = () => setPlaying(true)
      const onPause = () => setPlaying(false)
      const onVolume = () => setMuted(v.muted)
      v.addEventListener('timeupdate', onTime)
      v.addEventListener('loadedmetadata', onMeta)
      v.addEventListener('play', onPlay)
      v.addEventListener('pause', onPause)
      v.addEventListener('volumechange', onVolume)
      return () => {
        v.removeEventListener('timeupdate', onTime)
        v.removeEventListener('loadedmetadata', onMeta)
        v.removeEventListener('play', onPlay)
        v.removeEventListener('pause', onPause)
        v.removeEventListener('volumechange', onVolume)
      }
    }, [url])

    // Track displayed player width to size toolbar + panels
    useEffect(() => {
      const el = playerWrapRef.current
      if (!el) return
      const ro = new ResizeObserver((entries) => {
        const w = entries[0]?.contentRect.width
        if (w) setPlayerWidth(w)
      })
      ro.observe(el)
      return () => ro.disconnect()
    }, [aspectRatio])

    const togglePlay = () => {
      const v = videoRef.current
      if (!v) return
      if (v.paused) v.play().catch(() => {})
      else v.pause()
    }

    const toggleMute = () => {
      const v = videoRef.current
      if (!v) return
      v.muted = !v.muted
    }

    const goFullscreen = () => {
      const v = videoRef.current
      if (!v) return
      if (v.requestFullscreen) v.requestFullscreen().catch(() => {})
    }

    // Click sur la timeline = juste un seek (précis) — plus d'ouverture auto de la bulle
    const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
      const tl = timelineRef.current
      const v = videoRef.current
      if (!tl || !v || !duration) return
      const rect = tl.getBoundingClientRect()
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
      const t = ratio * duration
      v.currentTime = t
    }

    // CTA principal : commenter au temps actuel (= la frame visible)
    const startCommentHere = () => {
      const v = videoRef.current
      if (!v) return
      v.pause()
      setPendingTimestamp(v.currentTime)
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

    // Pour les videos portrait, on contraint la largeur des controles a celle du player
    const isPortrait = aspectRatio !== null && aspectRatio < 1
    const controlsWidth = isPortrait && playerWidth ? `${playerWidth}px` : '100%'

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', height: '100%', alignItems: 'center' }}>
        {/* Player (sans controls natifs — on a notre propre toolbar).
            Si portrait : aspect-ratio applique pour eviter le letterboxing horizontal massif. */}
        <div
          ref={playerWrapRef}
          style={{
            flex: 1, minHeight: 0,
            width: isPortrait ? 'auto' : '100%',
            maxWidth: '100%',
            aspectRatio: isPortrait && aspectRatio ? `${aspectRatio}` : undefined,
            background: '#000', borderRadius: 10, overflow: 'hidden', position: 'relative',
          }}
        >
          <video
            ref={videoRef}
            src={url}
            preload="metadata"
            playsInline
            onClick={togglePlay}
            style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', cursor: 'pointer' }}
          />
          {/* Overlay play icon quand pause */}
          {!playing && (
            <div
              onClick={togglePlay}
              style={{
                position: 'absolute', inset: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                pointerEvents: 'none',
              }}
            >
              <div style={{
                width: 56, height: 56, borderRadius: '50%',
                background: 'rgba(0,0,0,0.55)', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Play size={26} color="#fff" fill="#fff" style={{ marginLeft: 3 }} />
              </div>
            </div>
          )}
        </div>

        {/* Toolbar custom : play/pause + timeline + volume + fullscreen */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11, color: 'var(--text-tertiary)', padding: '0 4px', width: controlsWidth, maxWidth: '100%' }}>
          <button
            onClick={togglePlay}
            aria-label={playing ? 'Pause' : 'Play'}
            style={{
              width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'transparent', color: 'var(--text-primary)',
              border: 'none', borderRadius: 6, cursor: 'pointer',
            }}
          >
            {playing ? <Pause size={14} /> : <Play size={14} fill="currentColor" />}
          </button>
          <span style={{ minWidth: 38, textAlign: 'right', fontFamily: 'monospace' }}>{formatTime(currentTime)}</span>
          <div
            ref={timelineRef}
            onClick={handleTimelineClick}
            title="Clique pour aller à ce moment"
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
            {duration > 0 && annotations.filter(a => showResolved || !a.resolved_at).map((a) => {
              const left = `${Math.max(0, Math.min(100, (a.video_timestamp_seconds / duration) * 100))}%`
              const isHovered = hoveredId === a.id
              const isClicked = clickedId === a.id
              const showPopup = isClicked || (isHovered && !clickedId)
              const isResolved = !!a.resolved_at
              return (
                <div
                  key={a.id}
                  style={{
                    position: 'absolute',
                    left,
                    transform: 'translate(-50%, 0)',
                    top: 0,
                    height: '100%',
                    display: 'flex',
                    alignItems: 'flex-start',
                    pointerEvents: 'none',
                  }}
                  onMouseEnter={() => setHoveredId(a.id)}
                  onMouseLeave={() => setHoveredId((prev) => (prev === a.id ? null : prev))}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      if (videoRef.current) {
                        videoRef.current.currentTime = a.video_timestamp_seconds
                        videoRef.current.pause()
                      }
                      // Toggle: si deja ouvert, ferme; sinon ouvre
                      setClickedId((prev) => (prev === a.id ? null : a.id))
                      setDismissedId(null) // reset: le user redemande explicitement cette annotation
                      onAnnotationClick?.(a.id)
                    }}
                    style={{
                      width: 12,
                      height: 16,
                      marginTop: 4,
                      padding: 0,
                      background: isResolved ? 'var(--text-tertiary)' : (a.author_color ?? '#f59e0b'),
                      border: '2px solid var(--bg-secondary)',
                      borderRadius: 4,
                      cursor: 'pointer',
                      pointerEvents: 'auto',
                      opacity: isResolved ? 0.5 : 1,
                      transform: isHovered || isClicked ? 'scale(1.25)' : 'scale(1)',
                      transition: 'transform 0.12s',
                      boxShadow: isClicked ? `0 0 0 3px ${a.author_color ?? '#f59e0b'}33` : 'none',
                    }}
                    aria-label={`Annotation à ${formatTime(a.video_timestamp_seconds)}`}
                  />
                  {/* Tooltip hover uniquement (pas le clicked — celui-la s'affiche dans le panneau dedie en dessous) */}
                  {showPopup && !isClicked && (
                    <div
                      style={{
                        position: 'absolute',
                        bottom: 'calc(100% + 6px)',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        minWidth: 180,
                        maxWidth: 260,
                        padding: '8px 10px',
                        background: 'var(--bg-elevated)',
                        color: 'var(--text-primary)',
                        border: '1px solid var(--border-primary)',
                        borderRadius: 8,
                        boxShadow: '0 6px 20px rgba(0,0,0,0.4)',
                        fontSize: 12,
                        zIndex: 10,
                        pointerEvents: 'none',
                        whiteSpace: 'normal',
                        textAlign: 'left',
                      }}
                    >
                      <div style={{
                        fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)',
                        marginBottom: 4,
                        display: 'flex', alignItems: 'center', gap: 6,
                      }}>
                        <span style={{
                          fontFamily: 'monospace',
                          padding: '1px 5px',
                          background: a.author_color ?? '#f59e0b',
                          color: '#fff',
                          borderRadius: 3,
                        }}>
                          {formatTime(a.video_timestamp_seconds)}
                        </span>
                        <span>{a.author_name}</span>
                      </div>
                      <div style={{ lineHeight: 1.4 }}>{a.body}</div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          <span style={{ minWidth: 38, fontFamily: 'monospace' }}>{formatTime(duration)}</span>
          <button
            onClick={toggleMute}
            aria-label={muted ? 'Activer le son' : 'Couper le son'}
            style={{
              width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'transparent', color: 'var(--text-primary)',
              border: 'none', borderRadius: 6, cursor: 'pointer',
            }}
          >
            {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
          </button>
          <button
            onClick={goFullscreen}
            aria-label="Plein écran"
            style={{
              width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'transparent', color: 'var(--text-primary)',
              border: 'none', borderRadius: 6, cursor: 'pointer',
            }}
          >
            <Maximize2 size={13} />
          </button>
        </div>

        {/* Toggle visibilite des annotations resolues (apparait uniquement s'il y en a) */}
        {annotations.some(a => a.resolved_at) && (
          <button
            onClick={() => setShowResolved(v => !v)}
            style={{
              alignSelf: isPortrait ? 'center' : 'flex-start',
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '5px 10px', fontSize: 11, fontWeight: 600,
              color: 'var(--text-secondary)',
              background: 'transparent',
              border: '1px solid var(--border-primary)',
              borderRadius: 6, cursor: 'pointer',
            }}
            title={showResolved ? 'Masquer les annotations résolues' : 'Afficher les annotations résolues'}
          >
            {showResolved ? <EyeOff size={12} /> : <Eye size={12} />}
            {showResolved ? 'Masquer résolues' : `Voir résolues (${annotations.filter(a => a.resolved_at).length})`}
          </button>
        )}

        {/* Panneau "annotation active" : auto-affiche celle la plus proche du playhead.
            Click marker = override manuel. X = dismiss tant qu'on reste sur ce timestamp. */}
        {(() => {
          // Annotation manuellement cliquee a la priorite
          let activeAnnotation = clickedId ? annotations.find((a) => a.id === clickedId) : null

          if (!activeAnnotation) {
            // Auto: derniere annotation passee dans les 8 dernieres secondes du playhead
            // (skip resolved sauf si showResolved actif)
            const TOLERANCE_S = 8
            const candidates = annotations.filter(
              (a) =>
                (showResolved || !a.resolved_at) &&
                a.video_timestamp_seconds <= currentTime + 0.3 &&
                a.video_timestamp_seconds >= currentTime - TOLERANCE_S,
            )
            if (candidates.length > 0) {
              activeAnnotation = candidates.reduce(
                (best, a) => (a.video_timestamp_seconds > best.video_timestamp_seconds ? a : best),
                candidates[0],
              )
            }
          }

          // Si l'utilisateur a fait X sur cette annotation, ne pas la re-afficher tant qu'elle est encore active
          if (activeAnnotation && dismissedId === activeAnnotation.id) return null
          if (!activeAnnotation) return null
          const annotForRender = activeAnnotation
          const isResolved = !!annotForRender.resolved_at
          const accentColor = isResolved ? 'var(--text-tertiary)' : (annotForRender.author_color ?? '#f59e0b')
          return (
            <div style={{
              padding: '10px 12px',
              background: 'var(--bg-elevated)',
              border: `1px solid ${accentColor}`,
              borderLeftWidth: 4,
              borderRadius: 8,
              fontSize: 12,
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              width: controlsWidth, maxWidth: '100%',
              opacity: isResolved ? 0.7 : 1,
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
              }}>
                <div style={{
                  fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <span style={{
                    fontFamily: 'monospace', padding: '2px 6px',
                    background: accentColor,
                    color: '#fff', borderRadius: 3, fontSize: 10,
                  }}>
                    {formatTime(annotForRender.video_timestamp_seconds)}
                  </span>
                  <span>{annotForRender.author_name}</span>
                  {isResolved && (
                    <span style={{
                      fontSize: 10, fontWeight: 700, color: '#10b981',
                      padding: '1px 6px', background: 'rgba(16,185,129,0.12)', borderRadius: 3,
                    }}>RÉSOLU</span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {onToggleResolved && (
                    <button
                      onClick={async () => {
                        setTogglingId(annotForRender.id)
                        try { await onToggleResolved(annotForRender.id, !isResolved) }
                        finally { setTogglingId(null) }
                      }}
                      disabled={togglingId === annotForRender.id}
                      style={{
                        height: 22, padding: '0 8px', display: 'flex',
                        alignItems: 'center', justifyContent: 'center', gap: 4,
                        fontSize: 11, fontWeight: 600,
                        background: isResolved ? 'transparent' : 'rgba(16,185,129,0.15)',
                        color: isResolved ? 'var(--text-tertiary)' : '#10b981',
                        border: `1px solid ${isResolved ? 'var(--border-primary)' : 'rgba(16,185,129,0.4)'}`,
                        borderRadius: 4, cursor: 'pointer',
                      }}
                      title={isResolved ? 'Réouvrir cette annotation' : 'Marquer comme résolu (corrigé dans la nouvelle version)'}
                    >
                      <Check size={11} />
                      {isResolved ? 'Réouvrir' : 'Résolu'}
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setClickedId(null)
                      setDismissedId(annotForRender.id)
                    }}
                    aria-label="Fermer"
                    style={{
                      width: 22, height: 22, padding: 0, display: 'flex',
                      alignItems: 'center', justifyContent: 'center',
                      background: 'transparent', color: 'var(--text-tertiary)',
                      border: 'none', borderRadius: 4, cursor: 'pointer',
                    }}
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
              <div style={{
                lineHeight: 1.5,
                color: 'var(--text-primary)',
                whiteSpace: 'pre-wrap',
                textDecoration: isResolved ? 'line-through' : 'none',
              }}>
                {annotForRender.body}
              </div>
            </div>
          )
        })()}

        {/* CTA "Commenter ici" — utilise le temps actuel, pas besoin de viser la timeline */}
        {pendingTimestamp === null && (
          <button
            onClick={startCommentHere}
            disabled={!duration}
            style={{
              alignSelf: isPortrait ? 'center' : 'flex-start',
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '7px 12px', fontSize: 12, fontWeight: 600,
              color: '#fff', background: 'var(--color-primary)',
              border: 'none', borderRadius: 6, cursor: duration ? 'pointer' : 'not-allowed',
              opacity: duration ? 1 : 0.5,
            }}
          >
            <MessageSquarePlus size={13} />
            Commenter à {formatTime(currentTime)}
          </button>
        )}

        {/* Bulle d'annotation */}
        {pendingTimestamp !== null && (
          <div style={{
            display: 'flex', flexDirection: 'column', gap: 8,
            padding: 12,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--color-primary)',
            borderRadius: 8,
            width: controlsWidth, maxWidth: '100%', boxSizing: 'border-box',
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
