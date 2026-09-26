// Unified acquisition inbox (DMs + comments classified by buying intent) —
// port of components/social/AcquisitionInbox.tsx + useSocialLeadCreation.ts.
import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../lib/api-client'
import { Avatar } from '../../design-system/Avatar'
import { Chips } from '../../design-system/Tabs'
import { EmptyState, LoadingState } from '../../design-system/States'
import { classifyIntent, INTENT_META, intentSortValue, timeAgo, type SocialIntent } from './social-utils'
import { errMsg } from './http'
import '../../design-system/status-pill.css'
import '../../design-system/data-table.css'
import './social.css'

export interface InboxItem {
  id: string
  source: 'dm' | 'comment'
  username: string | null
  avatarUrl?: string | null
  text: string | null
  timestamp: string | null
  context?: string | null
  hasLead?: boolean
  externalUrl?: string | null
  onCreateLead?: () => void
  onOpen?: () => void
}

type StatusFilter = 'todo' | 'linked' | 'all'
type SourceFilter = 'all' | 'dm' | 'comment'
const HOT: SocialIntent[] = ['rdv', 'prix', 'info', 'objection']

export function AcquisitionInbox({
  items,
  loading,
  previewLimit,
  showFilters,
  emptyLabel,
}: {
  items: InboxItem[]
  loading?: boolean
  previewLimit?: number
  showFilters?: boolean
  emptyLabel?: string
}) {
  const [status, setStatus] = useState<StatusFilter>('todo')
  const [source, setSource] = useState<SourceFilter>('all')
  const [showSpam, setShowSpam] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)

  const enriched = useMemo(() => items.map((i) => ({ ...i, intent: classifyIntent(i.text) })), [items])

  const counts = useMemo(() => {
    let todo = 0
    let linked = 0
    let spam = 0
    let dm = 0
    let comment = 0
    for (const it of enriched) {
      if (it.intent === 'spam') {
        spam += 1
        continue
      }
      if (it.hasLead) linked += 1
      else todo += 1
      if (it.source === 'dm') dm += 1
      else comment += 1
    }
    return { todo, linked, all: enriched.length - spam, spam, dm, comment }
  }, [enriched])

  const filtered = useMemo(() => {
    let list = enriched
    if (!showSpam) list = list.filter((i) => i.intent !== 'spam')
    if (status === 'todo') list = list.filter((i) => !i.hasLead)
    if (status === 'linked') list = list.filter((i) => i.hasLead)
    if (source !== 'all') list = list.filter((i) => i.source === source)
    return [...list].sort((a, b) => {
      const di = intentSortValue(b.intent) - intentSortValue(a.intent)
      if (di !== 0) return di
      return (b.timestamp ? Date.parse(b.timestamp) : 0) - (a.timestamp ? Date.parse(a.timestamp) : 0)
    })
  }, [enriched, status, source, showSpam])

  const display = previewLimit != null ? filtered.slice(0, previewLimit) : filtered

  if (loading) return <LoadingState />

  return (
    <div className="soc-stack">
      {showFilters && (
        <div className="soc-toolbar">
          <Chips
            items={[
              { key: 'todo', label: 'À traiter', count: counts.todo },
              { key: 'linked', label: 'Liés à un lead', count: counts.linked },
              { key: 'all', label: 'Tout', count: counts.all },
            ]}
            active={status}
            onChange={setStatus}
          />
          {counts.dm > 0 && counts.comment > 0 && (
            <Chips
              items={[
                { key: 'all', label: 'Tout' },
                { key: 'dm', label: 'DMs' },
                { key: 'comment', label: 'Commentaires' },
              ]}
              active={source}
              onChange={setSource}
            />
          )}
          <div className="soc-spacer" />
          {counts.spam > 0 && (
            <button type="button" className="ds-pill-button" onClick={() => setShowSpam((s) => !s)} title="Bruit = emojis seuls, 'first', 🔥🔥, etc.">
              {showSpam ? 'Masquer' : 'Afficher'} le bruit ({counts.spam})
            </button>
          )}
        </div>
      )}

      {display.length === 0 ? (
        <EmptyState
          title={
            status === 'todo'
              ? 'Aucun message à traiter — tout est à jour'
              : status === 'linked'
                ? 'Aucun message rattaché à un lead pour l’instant.'
                : (emptyLabel ?? 'Aucun message.')
          }
          description={status === 'todo' && items.length === 0 ? emptyLabel : undefined}
        />
      ) : (
        <div className="soc-inbox">
          {display.map((item) => {
            const meta = INTENT_META[item.intent]
            const isHot = HOT.includes(item.intent)
            const isOpen = expanded === item.id
            return (
              <div
                key={item.id}
                className={`soc-inbox-row ${isHot ? 'soc-inbox-row--hot' : ''}`}
                style={{ ['--intent-color' as string]: meta.color }}
              >
                <button type="button" onClick={() => setExpanded(isOpen ? null : item.id)}>
                  <Avatar name={item.username ?? '?'} size={26} src={item.avatarUrl} />
                  <span className="ds-muted" style={{ fontSize: 11 }}>
                    {item.source === 'dm' ? 'DM' : 'Com.'}
                  </span>
                  <span className="soc-inbox-name">{item.username ?? 'Anonyme'}</span>
                  {item.hasLead && (
                    <span className="ds-status-pill" style={{ color: 'var(--color-success)', background: 'var(--color-success-soft)' }}>
                      Lead
                    </span>
                  )}
                  {item.intent !== 'neutre' && (
                    <span className="ds-status-pill" title={meta.description} style={{ color: meta.color, background: `${meta.color}1a` }}>
                      {meta.label}
                    </span>
                  )}
                  <span className="soc-inbox-text">{item.text ?? '(vide)'}</span>
                  <span className="ds-num" style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                    {timeAgo(item.timestamp)}
                  </span>
                </button>
                {isOpen && (
                  <div className="soc-inbox-expanded">
                    <p style={{ margin: 0, fontSize: 13, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{item.text}</p>
                    {item.context && <div className="soc-inbox-context">↳ {item.context}</div>}
                    <div className="soc-row">
                      {item.onOpen && (
                        <button type="button" className="ds-pill-button" onClick={item.onOpen}>
                          Ouvrir
                        </button>
                      )}
                      {item.onCreateLead && !item.hasLead && (
                        <button type="button" className="ds-pill-button ds-pill-button--dark" onClick={item.onCreateLead}>
                          + Créer un lead
                        </button>
                      )}
                      {item.externalUrl && (
                        <button type="button" className="ds-pill-button" onClick={() => window.open(item.externalUrl ?? '', '_blank')}>
                          Voir ↗
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export interface CreateSocialLeadParams {
  username: string
  firstName?: string
  lastName?: string
  source: 'instagram_ads' | 'manuel'
  notes: string
  afterCreate?: (leadId: string) => Promise<void> | void
}

/**
 * Same flow as the web's useSocialLeadCreation(): dedupe by instagram_handle
 * via GET /api/leads?search=, else POST /api/leads, then open the lead.
 */
export function useSocialLeadCreation(onError: (msg: string) => void) {
  const navigate = useNavigate()
  return useCallback(
    async (params: CreateSocialLeadParams): Promise<string | null> => {
      const username = params.username.trim().replace(/^@/, '')
      if (!username) {
        onError('Impossible de créer le lead — username manquant.')
        return null
      }
      try {
        const search = await api.get<{ data?: { id: string; instagram_handle: string | null }[] }>(
          `/api/leads?search=${encodeURIComponent(username)}&per_page=5`,
        )
        const existing = (search.data ?? []).find((l) => l.instagram_handle?.toLowerCase() === username.toLowerCase())
        if (existing) {
          if (params.afterCreate) await params.afterCreate(existing.id)
          navigate(`/leads/${existing.id}`)
          return existing.id
        }
        const created = await api.post<{ data?: { id: string } }>('/api/leads', {
          first_name: params.firstName ?? username,
          last_name: params.lastName ?? '',
          instagram_handle: username,
          source: params.source,
          notes: params.notes,
        })
        const id = created.data?.id
        if (!id) throw new Error('Impossible de créer le lead')
        if (params.afterCreate) await params.afterCreate(id)
        navigate(`/leads/${id}`)
        return id
      } catch (e) {
        onError(errMsg(e))
        return null
      }
    },
    [navigate, onError],
  )
}
