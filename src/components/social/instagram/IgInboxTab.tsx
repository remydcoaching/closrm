'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw, Inbox } from 'lucide-react'
import type { IgConversation, IgComment } from '@/types'
import AcquisitionInbox, { type InboxItem } from '../AcquisitionInbox'
import { useSocialLeadCreation } from '../_shared/useSocialLeadCreation'
import { useToast } from '@/components/ui/Toast'

const ACCENT = '#EC4899'

export default function IgInboxTab() {
  const router = useRouter()
  const createLead = useSocialLeadCreation()
  const toast = useToast()
  const [conversations, setConversations] = useState<IgConversation[]>([])
  const [comments, setComments] = useState<IgComment[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [convRes, comRes] = await Promise.all([
        fetch('/api/instagram/conversations?per_page=100'),
        fetch('/api/instagram/comments'),
      ])
      const [convJson, comJson] = await Promise.all([convRes.json(), comRes.json()])
      setConversations(convJson.data ?? [])
      setComments(comJson.data ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const handleSync = async () => {
    setSyncing(true)
    try {
      await Promise.all([
        fetch('/api/instagram/conversations?sync=true&per_page=1'),
        fetch('/api/instagram/comments/sync', { method: 'POST' }),
      ])
      await fetchData()
      toast.success('Inbox synchronisée')
    } catch {
      toast.error('Erreur lors de la synchronisation')
    } finally {
      setSyncing(false)
    }
  }

  async function createLeadFromDM(c: IgConversation) {
    const username = c.participant_username ?? c.participant_name ?? ''
    await createLead({
      username,
      firstName: c.participant_name?.split(' ')[0] ?? username,
      lastName:  c.participant_name?.split(' ').slice(1).join(' '),
      source: 'instagram_ads',
      notes: `Importé depuis DM Instagram (@${username})`,
      afterCreate: async (leadId) => {
        await fetch(`/api/instagram/conversations/${c.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lead_id: leadId }),
        }).catch(() => null)
      },
    })
  }

  async function createLeadFromComment(c: IgComment) {
    await createLead({
      username: c.username ?? '',
      source: 'instagram_ads',
      notes: `Commentaire Instagram : "${c.text}"\nSur post : ${c.media_caption ?? '—'}`,
    })
  }

  const items: InboxItem[] = useMemo(() => {
    const dms: InboxItem[] = conversations.map(c => ({
      id: `dm-${c.id}`,
      source: 'dm',
      username: c.participant_username ?? c.participant_name ?? null,
      avatarUrl: c.participant_avatar_url,
      text: c.last_message_text,
      timestamp: c.last_message_at,
      hasLead: !!c.lead_id,
      onOpen: () => router.push(`/messages?conversation=${c.id}`),
      onCreateLead: c.lead_id ? undefined : () => createLeadFromDM(c),
    }))
    const cms: InboxItem[] = comments.map(c => ({
      id: `cm-${c.id}`,
      source: 'comment',
      username: c.username,
      text: c.text,
      timestamp: c.timestamp,
      context: c.media_caption,
      onCreateLead: () => createLeadFromComment(c),
    }))
    return [...dms, ...cms]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversations, comments])

  return (
    <div>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        marginBottom: 18, gap: 16,
      }}>
        <div>
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
                Inbox d'acquisition
              </h2>
              <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: '2px 0 0' }}>
                DMs et commentaires unifiés, classifiés par intention. Convertis en leads en un clic.
              </p>
            </div>
          </div>
        </div>
        <button
          onClick={handleSync}
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

      {error ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#ef4444', fontSize: 13 }}>{error}</div>
      ) : (
        <AcquisitionInbox
          items={items}
          loading={loading}
          showFilters
          accentColor={ACCENT}
          emptyLabel="Pas encore de message à traiter — synchronise tes DMs et commentaires."
        />
      )}
    </div>
  )
}
