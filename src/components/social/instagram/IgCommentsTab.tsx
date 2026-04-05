'use client'

import { useState, useEffect, useCallback } from 'react'
import type { IgComment } from '@/types'

// ── Helpers ──

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "à l'instant"
  if (mins < 60) return `il y a ${mins}min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `il y a ${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 30) return `il y a ${days}j`
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

function truncate(str: string | null, max: number): string {
  if (!str) return ''
  return str.length > max ? str.slice(0, max) + '...' : str
}

// ── Skeleton ──

function SkeletonBlock({ width, height }: { width: string | number; height: string | number }) {
  return (
    <div style={{
      width, height, borderRadius: 8, background: 'var(--bg-elevated)',
      animation: 'pulse 1.5s ease-in-out infinite',
    }} />
  )
}

function LoadingSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} style={{
          background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)',
          borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <SkeletonBlock width={28} height={28} />
            <SkeletonBlock width={100} height={14} />
            <SkeletonBlock width={60} height={12} />
          </div>
          <SkeletonBlock width="80%" height={14} />
        </div>
      ))}
    </div>
  )
}

// ── Comment Row ──

interface CommentRowProps {
  comment: IgComment
  replies: IgComment[]
  onReply: (comment: IgComment, message: string) => Promise<void>
  onHide: (comment: IgComment) => Promise<void>
  onDelete: (comment: IgComment) => Promise<void>
}

function CommentRow({ comment, replies, onReply, onHide, onDelete }: CommentRowProps) {
  const [showReply, setShowReply] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [sending, setSending] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const handleReply = async () => {
    if (!replyText.trim()) return
    setSending(true)
    try {
      await onReply(comment, replyText.trim())
      setReplyText('')
      setShowReply(false)
    } finally {
      setSending(false)
    }
  }

  const handleHide = async () => {
    setActionLoading('hide')
    try { await onHide(comment) } finally { setActionLoading(null) }
  }

  const handleDelete = async () => {
    if (!confirm('Supprimer ce commentaire ? Cette action est irréversible.')) return
    setActionLoading('delete')
    try { await onDelete(comment) } finally { setActionLoading(null) }
  }

  const isHidden = comment.is_hidden

  return (
    <div style={{ opacity: isHidden ? 0.5 : 1 }}>
      {/* Main comment */}
      <div style={{
        display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px 0',
      }}>
        {/* Avatar placeholder */}
        <div style={{
          width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
          background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)',
        }}>
          {comment.username ? comment.username[0].toUpperCase() : '?'}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
              {comment.username || 'Inconnu'}
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
              {timeAgo(comment.timestamp)}
            </span>
            {isHidden && (
              <span style={{
                fontSize: 10, fontWeight: 600, color: '#f59e0b',
                background: 'rgba(245, 158, 11, 0.12)', padding: '2px 6px',
                borderRadius: 4,
              }}>
                Masqué
              </span>
            )}
          </div>

          {/* Text */}
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0, wordBreak: 'break-word' }}>
            {comment.text}
          </p>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
            <button
              onClick={() => setShowReply(!showReply)}
              style={{
                fontSize: 11, color: 'var(--color-primary)', background: 'none',
                border: 'none', cursor: 'pointer', padding: 0, fontWeight: 500,
              }}
            >
              Répondre
            </button>
            <button
              onClick={handleHide}
              disabled={actionLoading === 'hide'}
              style={{
                fontSize: 11, color: 'var(--text-tertiary)', background: 'none',
                border: 'none', cursor: 'pointer', padding: 0,
                opacity: actionLoading === 'hide' ? 0.5 : 1,
              }}
            >
              {isHidden ? 'Afficher' : 'Masquer'}
            </button>
            <button
              onClick={handleDelete}
              disabled={actionLoading === 'delete'}
              style={{
                fontSize: 11, color: '#ef4444', background: 'none',
                border: 'none', cursor: 'pointer', padding: 0,
                opacity: actionLoading === 'delete' ? 0.5 : 1,
              }}
            >
              Supprimer
            </button>
          </div>

          {/* Reply input */}
          {showReply && (
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <input
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleReply() } }}
                placeholder="Écrire une réponse..."
                style={{
                  flex: 1, padding: '8px 12px', fontSize: 12,
                  background: 'var(--bg-primary)', color: 'var(--text-primary)',
                  border: '1px solid var(--border-primary)', borderRadius: 8,
                  outline: 'none',
                }}
              />
              <button
                onClick={handleReply}
                disabled={sending || !replyText.trim()}
                style={{
                  padding: '8px 14px', fontSize: 12, fontWeight: 600,
                  color: '#fff', background: 'var(--color-primary)',
                  border: 'none', borderRadius: 8, cursor: 'pointer',
                  opacity: sending || !replyText.trim() ? 0.5 : 1,
                }}
              >
                {sending ? '...' : 'Envoyer'}
              </button>
            </div>
          )}

          {/* Replies */}
          {replies.length > 0 && (
            <div style={{ marginTop: 10, paddingLeft: 20, borderLeft: '2px solid var(--border-primary)' }}>
              {replies.map(r => (
                <div key={r.id} style={{ padding: '8px 0', opacity: r.is_hidden ? 0.5 : 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {r.username || 'Vous'}
                    </span>
                    <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                      {timeAgo(r.timestamp)}
                    </span>
                    {r.is_hidden && (
                      <span style={{
                        fontSize: 9, fontWeight: 600, color: '#f59e0b',
                        background: 'rgba(245, 158, 11, 0.12)', padding: '1px 5px', borderRadius: 3,
                      }}>
                        Masqué
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4, wordBreak: 'break-word' }}>
                    {r.text}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Media Group ──

interface MediaGroupProps {
  mediaId: string
  caption: string | null
  comments: IgComment[]
  onReply: (comment: IgComment, message: string) => Promise<void>
  onHide: (comment: IgComment) => Promise<void>
  onDelete: (comment: IgComment) => Promise<void>
}

function MediaGroup({ mediaId, caption, comments, onReply, onHide, onDelete }: MediaGroupProps) {
  const [expanded, setExpanded] = useState(true)
  const topLevel = comments.filter(c => !c.ig_parent_id && !c.parent_id)
  const repliesMap: Record<string, IgComment[]> = {}

  // Build replies map by ig_parent_id
  for (const c of comments) {
    if (c.ig_parent_id) {
      if (!repliesMap[c.ig_parent_id]) repliesMap[c.ig_parent_id] = []
      repliesMap[c.ig_parent_id].push(c)
    } else if (c.parent_id) {
      // Find parent ig_comment_id from parent_id (UUID)
      const parent = comments.find(p => p.id === c.parent_id)
      if (parent) {
        if (!repliesMap[parent.ig_comment_id]) repliesMap[parent.ig_comment_id] = []
        repliesMap[parent.ig_comment_id].push(c)
      }
    }
  }

  return (
    <div style={{
      background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)',
      borderRadius: 12, marginBottom: 12, overflow: 'hidden',
    }}>
      {/* Media header */}
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: '100%', padding: '14px 18px', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', background: 'none', border: 'none',
          cursor: 'pointer', borderBottom: expanded ? '1px solid var(--border-primary)' : 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <span style={{ fontSize: 16 }}>📷</span>
          <span style={{
            fontSize: 13, color: 'var(--text-primary)', fontWeight: 500,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {truncate(caption, 80) || 'Publication sans légende'}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <span style={{
            fontSize: 11, color: 'var(--text-tertiary)', background: 'var(--bg-elevated)',
            padding: '3px 8px', borderRadius: 10, fontWeight: 500,
          }}>
            {topLevel.length} commentaire{topLevel.length !== 1 ? 's' : ''}
          </span>
          <span style={{
            fontSize: 12, color: 'var(--text-tertiary)',
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s',
          }}>
            ▼
          </span>
        </div>
      </button>

      {/* Comments list */}
      {expanded && (
        <div style={{ padding: '4px 18px 10px' }}>
          {topLevel.length === 0 ? (
            <p style={{ fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center', padding: 16 }}>
              Aucun commentaire sur cette publication
            </p>
          ) : (
            topLevel.map(c => (
              <CommentRow
                key={c.id}
                comment={c}
                replies={repliesMap[c.ig_comment_id] ?? []}
                onReply={onReply}
                onHide={onHide}
                onDelete={onDelete}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ── Main Tab ──

export default function IgCommentsTab() {
  const [comments, setComments] = useState<IgComment[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filterMediaId, setFilterMediaId] = useState<string>('')

  // Unique media IDs for filter dropdown
  const mediaOptions = Array.from(
    new Map(
      comments.map(c => [c.ig_media_id, c.media_caption])
    )
  ).map(([id, caption]) => ({ id, caption }))

  const fetchComments = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const qs = filterMediaId ? `?media_id=${filterMediaId}` : ''
      const res = await fetch(`/api/instagram/comments${qs}`)
      if (!res.ok) throw new Error(`Erreur ${res.status}`)
      const json = await res.json()
      setComments(json.data ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de charger les commentaires')
    } finally {
      setLoading(false)
    }
  }, [filterMediaId])

  useEffect(() => { fetchComments() }, [fetchComments])

  const handleSync = async () => {
    setSyncing(true)
    try {
      const res = await fetch('/api/instagram/comments/sync', { method: 'POST' })
      if (!res.ok) throw new Error(`Erreur ${res.status}`)
      // Refresh after sync
      await fetchComments()
    } catch {
      alert('Erreur lors de la synchronisation des commentaires')
    } finally {
      setSyncing(false)
    }
  }

  const handleReply = async (comment: IgComment, message: string) => {
    const res = await fetch('/api/instagram/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        comment_id: comment.id,
        ig_comment_id: comment.ig_comment_id,
        ig_media_id: comment.ig_media_id,
        message,
      }),
    })
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      alert(json.error || 'Erreur lors de la réponse')
      return
    }
    // Refresh to show the new reply
    await fetchComments()
  }

  const handleHide = async (comment: IgComment) => {
    const res = await fetch(`/api/instagram/comments/${comment.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hide: !comment.is_hidden }),
    })
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      alert(json.error || 'Erreur')
      return
    }
    // Update locally
    setComments(prev =>
      prev.map(c => c.id === comment.id ? { ...c, is_hidden: !c.is_hidden } : c)
    )
  }

  const handleDelete = async (comment: IgComment) => {
    const res = await fetch(`/api/instagram/comments/${comment.id}`, { method: 'DELETE' })
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      alert(json.error || 'Erreur lors de la suppression')
      return
    }
    // Remove from local state
    setComments(prev => prev.filter(c => c.id !== comment.id))
  }

  // Group comments by media
  const grouped = new Map<string, IgComment[]>()
  const filteredComments = filterMediaId
    ? comments.filter(c => c.ig_media_id === filterMediaId)
    : comments

  for (const c of filteredComments) {
    if (!grouped.has(c.ig_media_id)) grouped.set(c.ig_media_id, [])
    grouped.get(c.ig_media_id)!.push(c)
  }

  // Sort groups by most recent comment
  const sortedGroups = Array.from(grouped.entries()).sort((a, b) => {
    const aMax = Math.max(...a[1].map(c => c.timestamp ? new Date(c.timestamp).getTime() : 0))
    const bMax = Math.max(...b[1].map(c => c.timestamp ? new Date(c.timestamp).getTime() : 0))
    return bMax - aMax
  })

  return (
    <div>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20,
      }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
            Commentaires
          </h2>
          <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: '4px 0 0' }}>
            Gérez les commentaires de vos publications Instagram
          </p>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          style={{
            padding: '8px 16px', fontSize: 12, fontWeight: 600,
            color: '#fff', background: 'var(--color-primary)',
            border: 'none', borderRadius: 8, cursor: 'pointer',
            opacity: syncing ? 0.6 : 1,
          }}
        >
          {syncing ? 'Synchronisation...' : 'Synchroniser'}
        </button>
      </div>

      {/* Filter */}
      {mediaOptions.length > 1 && (
        <div style={{ marginBottom: 16 }}>
          <select
            value={filterMediaId}
            onChange={e => setFilterMediaId(e.target.value)}
            style={{
              padding: '8px 12px', fontSize: 12,
              background: 'var(--bg-primary)', color: 'var(--text-primary)',
              border: '1px solid var(--border-primary)', borderRadius: 8,
              outline: 'none', cursor: 'pointer', minWidth: 260,
            }}
          >
            <option value="">Toutes les publications</option>
            {mediaOptions.map(m => (
              <option key={m.id} value={m.id}>
                {truncate(m.caption, 60) || `Publication ${m.id.slice(-6)}`}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <LoadingSkeleton />
      ) : error ? (
        <div style={{
          textAlign: 'center', padding: 48,
          background: 'var(--bg-secondary)', borderRadius: 12,
          border: '1px solid var(--border-primary)',
        }}>
          <p style={{ fontSize: 13, color: '#ef4444', marginBottom: 12 }}>{error}</p>
          <button
            onClick={fetchComments}
            style={{
              padding: '6px 16px', fontSize: 12,
              color: 'var(--text-primary)', background: 'var(--bg-elevated)',
              border: '1px solid var(--border-primary)', borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            Réessayer
          </button>
        </div>
      ) : sortedGroups.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: 60,
          background: 'var(--bg-secondary)', borderRadius: 12,
          border: '1px solid var(--border-primary)',
        }}>
          <p style={{ fontSize: 32, marginBottom: 12 }}>💬</p>
          <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 6 }}>
            Aucun commentaire
          </p>
          <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 16 }}>
            Synchronisez vos publications pour voir les commentaires
          </p>
          <button
            onClick={handleSync}
            disabled={syncing}
            style={{
              padding: '8px 18px', fontSize: 12, fontWeight: 600,
              color: '#fff', background: 'var(--color-primary)',
              border: 'none', borderRadius: 8, cursor: 'pointer',
              opacity: syncing ? 0.6 : 1,
            }}
          >
            {syncing ? 'Synchronisation...' : 'Synchroniser maintenant'}
          </button>
        </div>
      ) : (
        <div>
          {sortedGroups.map(([mediaId, mediaComments]) => (
            <MediaGroup
              key={mediaId}
              mediaId={mediaId}
              caption={mediaComments[0]?.media_caption ?? null}
              comments={mediaComments}
              onReply={handleReply}
              onHide={handleHide}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  )
}
