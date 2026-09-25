// Instagram > Interactions — reads GET /api/instagram/interactions (new
// route, Phase B minimal backend), which itself reads instagram_interactions,
// the SAME table Hiker and Apify both write into. Provider is shown
// explicitly per row so Hiker vs Apify data is never conflated silently.
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, ApiError } from '../../lib/api-client'
import { safeExternalUrl } from '../../lib/safe-url'
import { FilterMenu } from '../../design-system/FilterMenu'
import { LoadingState, ErrorState, EmptyState } from '../../design-system/States'
import type { InstagramInteraction, InteractionType } from './types'
import './instagram.css'

const TYPE_OPTIONS: { key: InteractionType; label: string }[] = [
  { key: 'like', label: 'Like' },
  { key: 'comment', label: 'Commentaire' },
  { key: 'dm', label: 'DM' },
  { key: 'mention', label: 'Mention' },
]

const PROVIDER_OPTIONS = [
  { key: 'hiker', label: 'Hiker' },
  { key: 'apify', label: 'Apify' },
]

function providerLabel(provider: string | null): string {
  if (provider === 'hiker') return 'Hiker'
  if (provider === 'apify') return 'Apify'
  return '—'
}

export function InteractionsPage() {
  const navigate = useNavigate()
  const [interactions, setInteractions] = useState<InstagramInteraction[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [types, setTypes] = useState<string[]>([])
  const [providers, setProviders] = useState<string[]>([])

  async function load() {
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set('per_page', '50')
      if (types[0]) params.set('interaction_type', types[0])
      if (providers[0]) params.set('source_provider', providers[0])
      const res = await api.get<{ data: InstagramInteraction[] }>(`/api/instagram/interactions?${params.toString()}`)
      setInteractions(res.data)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur inconnue')
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [types, providers])

  return (
    <div className="ig-page">
      <div className="ig-page-header">
        <div>
          <h1>Interactions Instagram</h1>
          <p>{interactions === null ? '…' : `${interactions.length} interaction${interactions.length > 1 ? 's' : ''}`}</p>
        </div>
        <div className="ig-page-filters">
          <FilterMenu label="Type" options={TYPE_OPTIONS.map((t) => ({ key: t.key, label: t.label }))} selected={types} onChange={setTypes} />
          <FilterMenu label="Provider" options={PROVIDER_OPTIONS} selected={providers} onChange={setProviders} />
        </div>
      </div>

      {interactions === null && !error && <LoadingState label="Chargement des interactions…" />}
      {error && <ErrorState message={error} onRetry={load} />}
      {interactions && interactions.length === 0 && <EmptyState title="Aucune interaction" description="Lancez une discovery ou attendez le prochain cycle Apify." />}

      {interactions && interactions.length > 0 && (
        <table className="ig-table">
          <thead>
            <tr>
              <th>Profil</th>
              <th>Type</th>
              <th>Provider</th>
              <th>Contenu</th>
              <th>Lead CRM</th>
              <th>Dernière observation</th>
            </tr>
          </thead>
          <tbody>
            {interactions.map((interaction) => {
              const safeUrl = safeExternalUrl(interaction.source_post_url)
              return (
              <tr
                key={interaction.id}
                className="ig-table-row-clickable"
                onClick={() => interaction.lead_id && navigate(`/leads?leadId=${interaction.lead_id}`)}
              >
                <td>
                  <div className="ig-cell-name">{interaction.full_name || interaction.instagram_username}</div>
                  <div className="ig-cell-muted">@{interaction.instagram_username}</div>
                </td>
                <td>{TYPE_OPTIONS.find((t) => t.key === interaction.interaction_type)?.label ?? interaction.interaction_type}</td>
                <td>{providerLabel(interaction.source_provider)}</td>
                <td>
                  {safeUrl ? (
                    <a href={safeUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                      Voir le contenu
                    </a>
                  ) : (
                    <span className="ig-cell-muted">—</span>
                  )}
                </td>
                <td>
                  {interaction.lead ? `${interaction.lead.first_name} ${interaction.lead.last_name}`.trim() || '—' : <span className="ig-cell-muted">—</span>}
                </td>
                <td className="ig-cell-muted">{new Date(interaction.last_seen_at).toLocaleString('fr-FR')}</td>
              </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}
