// Instagram > Analyse de l'audience — segments leads with real Instagram
// engagement data into actionable groups (actifs / ne vous suivent pas /
// lurkers). Reads GET /api/instagram/audience (counts) and
// GET /api/instagram/audience/leads?segment=... (drill-down list). No live
// Instagram API call, no follower/story-view totals fabricated — everything
// comes from instagram_interactions + discovery_profiles already persisted.
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, ApiError } from '../../lib/api-client'
import { LoadingState, ErrorState, EmptyState } from '../../design-system/States'
import { relativeTime } from '../leads/status'
import './instagram.css'

interface AudienceCounts {
  actifs: number
  neVousSuiventPas: number
  lurkers: number
  totalEngaged: number
}

interface AudienceLeadRow {
  id: string
  first_name: string
  last_name: string
  instagram_handle: string | null
  status: string
  call_attempts: number
  last_seen_at: string | null
}

type Segment = 'actifs' | 'ne_vous_suivent_pas' | 'lurkers'

const SEGMENT_LABEL: Record<Segment, string> = {
  actifs: 'Actifs (interaction < 7 jours)',
  ne_vous_suivent_pas: 'Ne vous suivent pas',
  lurkers: 'Lurkers (jamais contactés)',
}

export function AudiencePage() {
  const navigate = useNavigate()
  const [counts, setCounts] = useState<AudienceCounts | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [segment, setSegment] = useState<Segment | null>(null)
  const [segmentLeads, setSegmentLeads] = useState<AudienceLeadRow[] | null>(null)

  async function load() {
    setError(null)
    try {
      const res = await api.get<{ data: AudienceCounts }>('/api/instagram/audience')
      setCounts(res.data)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur inconnue')
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function openSegment(s: Segment) {
    setSegment(s)
    setSegmentLeads(null)
    try {
      const res = await api.get<{ data: AudienceLeadRow[] }>(`/api/instagram/audience/leads?segment=${s}`)
      setSegmentLeads(res.data)
    } catch {
      setSegmentLeads([])
    }
  }

  return (
    <div className="ig-page">
      <div className="ig-page-header">
        <div>
          <h1>Analyse de l'audience</h1>
          <p>Comment votre communauté interagit avec vous — basé sur les leads ayant une interaction Instagram connue.</p>
        </div>
      </div>

      {counts === null && !error && <LoadingState label="Chargement…" />}
      {error && <ErrorState message={error} onRetry={load} />}

      {counts && counts.totalEngaged === 0 && (
        <EmptyState title="Aucune donnée d'audience" description="Lancez une analyse Ciblage ou attendez les prochaines interactions détectées." />
      )}

      {counts && counts.totalEngaged > 0 && (
        <div className="ig-discovery-stats">
          <button className="ig-audience-card" onClick={() => openSegment('actifs')}>
            <div className="ig-stat-value font-mono">{counts.actifs}</div>
            <div className="ig-stat-label">Actifs</div>
          </button>
          <button className="ig-audience-card" onClick={() => openSegment('ne_vous_suivent_pas')}>
            <div className="ig-stat-value font-mono">{counts.neVousSuiventPas}</div>
            <div className="ig-stat-label">Ne vous suivent pas</div>
          </button>
          <button className="ig-audience-card" onClick={() => openSegment('lurkers')}>
            <div className="ig-stat-value font-mono">{counts.lurkers}</div>
            <div className="ig-stat-label">Lurkers (jamais contactés)</div>
          </button>
          <div className="ig-stat">
            <div className="ig-stat-value font-mono">{counts.totalEngaged}</div>
            <div className="ig-stat-label">Total engagés</div>
          </div>
        </div>
      )}

      {segment && (
        <div className="ig-page-section">
          <h2>{SEGMENT_LABEL[segment]}</h2>
          {segmentLeads === null && <LoadingState label="Chargement…" />}
          {segmentLeads && segmentLeads.length === 0 && <EmptyState title="Aucun lead dans ce segment" />}
          {segmentLeads && segmentLeads.length > 0 && (
            <table className="ig-table">
              <thead>
                <tr>
                  <th>Lead</th>
                  <th>Statut</th>
                  <th>Tentatives d'appel</th>
                  <th>Dernière interaction</th>
                </tr>
              </thead>
              <tbody>
                {segmentLeads.map((l) => (
                  <tr key={l.id} className="ig-table-row-clickable" onClick={() => navigate(`/leads/${l.id}`)}>
                    <td>
                      <div className="ig-cell-name">{`${l.first_name} ${l.last_name}`.trim() || '—'}</div>
                      {l.instagram_handle && <div className="ig-cell-muted">@{l.instagram_handle}</div>}
                    </td>
                    <td className="ig-cell-muted">{l.status}</td>
                    <td className="font-mono">{l.call_attempts}</td>
                    <td className="ig-cell-muted">{l.last_seen_at ? relativeTime(l.last_seen_at) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
