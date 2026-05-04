'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw, Inbox } from 'lucide-react'
import AcquisitionInbox, { type InboxItem } from '../AcquisitionInbox'

const ACCENT = '#FF0000'

interface YtCommentRow {
  id: string
  yt_comment_id: string
  yt_video_id: string
  author_name: string | null
  author_channel_id: string | null
  author_avatar_url: string | null
  text: string | null
  published_at: string | null
  like_count: number
  yt_videos?: { title: string | null; yt_video_id: string } | null
}

export default function YtInboxTab({ onSync, syncing }: { onSync: () => void; syncing: boolean }) {
  const router = useRouter()
  const [comments, setComments] = useState<YtCommentRow[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/youtube/comments?limit=200')
      const json = await res.json()
      setComments(json.data ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  async function createLeadFromComment(c: YtCommentRow) {
    const username = c.author_name ?? ''
    if (!username) return
    const res = await fetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        first_name: username,
        last_name: '',
        source: 'manuel',
        notes: `Commentaire YouTube : "${c.text}"\nSur vidéo : ${c.yt_videos?.title ?? '—'}`,
      }),
    })
    const json = await res.json()
    if (res.ok && json.data?.id) router.push(`/leads/${json.data.id}`)
    else alert(json.error ?? 'Impossible de créer le lead')
  }

  const items: InboxItem[] = useMemo(() => {
    return comments.map(c => ({
      id: `yt-${c.id}`,
      source: 'comment' as const,
      username: c.author_name,
      avatarUrl: c.author_avatar_url,
      text: c.text,
      timestamp: c.published_at,
      context: c.yt_videos?.title,
      externalUrl: c.yt_videos?.yt_video_id ? `https://youtu.be/${c.yt_videos.yt_video_id}` : null,
      onCreateLead: () => createLeadFromComment(c),
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comments])

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18, gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 9,
            background: `${ACCENT}1a`, color: ACCENT,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Inbox size={18} />
          </div>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              Inbox d'acquisition YouTube
            </h2>
            <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: '2px 0 0' }}>
              Commentaires triés par intention. Repère les questions d'achat et convertis-les en leads.
            </p>
          </div>
        </div>
        <button
          onClick={onSync}
          disabled={syncing}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '8px 14px', fontSize: 12, fontWeight: 600,
            color: '#fff', background: ACCENT, border: 'none', borderRadius: 8,
            cursor: syncing ? 'wait' : 'pointer', opacity: syncing ? 0.7 : 1, flexShrink: 0,
          }}
        >
          <RefreshCw size={13} style={{ animation: syncing ? 'spin 1s linear infinite' : 'none' }} />
          {syncing ? 'Sync…' : 'Synchroniser'}
        </button>
      </div>

      <AcquisitionInbox
        items={items}
        loading={loading}
        showFilters
        accentColor={ACCENT}
        emptyLabel="Aucun commentaire YouTube synchronisé pour l'instant. Lance une synchronisation depuis le bouton en haut à droite."
      />
    </div>
  )
}
