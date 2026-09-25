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
import { TableCard } from '../../design-system/TableCard'
import { StatCard } from '../../design-system/StatCard'

interface AudienceCounts {
  actifs: number
  neVousSuiventPas: number
  lurkers: number
  actifsJamaisContactes: number
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

type Segment = 'actifs' | 'actifs_jamais_contactes' | 'ne_vous_suivent_pas' | 'lurkers'

const SEGMENT_LABEL: Record<Segment, string> = {
  actifs: 'Actifs (interaction < 7 jours)',
  actifs_jamais_contactes: 'Actifs, jamais contactés',
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
        <div className="ds-stat-grid">
          <StatCard label="Leads actifs" value={counts.actifs} caption="interaction sur les 7 derniers jours" onClick={() => openSegment('actifs')} />
          <StatCard
            label="Actifs, jamais contactés"
            value={counts.actifsJamaisContactes}
            highlight
            caption="actifs sur la période, personne ne leur a écrit"
            onClick={() => openSegment('actifs_jamais_contactes')}
          />
          <StatCard label="Ne vous suivent pas" value={counts.neVousSuiventPas} caption="au dernier ciblage" onClick={() => openSegment('ne_vous_suivent_pas')} />
          <StatCard label="Lurkers" value={counts.lurkers} unit="profils" caption="ont interagi, jamais contactés" onClick={() => openSegment('lurkers')} />
          <StatCard label="Total engagés" value={counts.totalEngaged} caption="au moins une interaction observée" />
        </div>
      )}

      {segment && (
        <div className="ig-page-section">
          <h2>{SEGMENT_LABEL[segment]}</h2>
          {segmentLeads === null && <LoadingState label="Chargement…" />}
          {segmentLeads && segmentLeads.length === 0 && <EmptyState title="Aucun lead dans ce segment" />}
          {segmentLeads && segmentLeads.length > 0 && (
            <TableCard>
              <table className="ds-table">
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
                  <tr key={l.id} className="ds-row-clickable" onClick={() => navigate(`/leads/${l.id}`)}>
                    <td>
                      <div className="ig-cell-name">{`${l.first_name} ${l.last_name}`.trim() || '—'}</div>
                      {l.instagram_handle && <div className="ds-muted">@{l.instagram_handle}</div>}
                    </td>
                    <td className="ds-muted">{l.status}</td>
                    <td className="ds-num-cell ds-num">{l.call_attempts}</td>
                    <td className="ds-muted">{l.last_seen_at ? relativeTime(l.last_seen_at) : '—'}</td>
                  </tr>
                ))}
              </tbody>
              </table>
            </TableCard>
          )}
        </div>
      )}
    </div>
  )
}
