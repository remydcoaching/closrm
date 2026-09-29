// Pipeline — Kanban view over the EXISTING GET /api/leads/grouped
// (leads_grouped_by_status RPC, migration 030), the same endpoint the web
// Kanban view (LeadsKanbanView.tsx) uses. No new grouping logic: same 9
// statuses, same per-column cap (p_limit), same filters shape.
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, ApiError } from '../../lib/api-client'
import { Avatar } from '../../design-system/Avatar'
import { StatusPill } from '../../design-system/StatusPill'
import { LoadingState, ErrorState } from '../../design-system/States'
import { STATUS_CONFIG, statusEntry, displayName } from '../leads/status'
import type { GroupedColumns } from './types'
import './crm.css'
import { useCachedQuery } from '../../lib/use-cached-query'

export function PipelinePage() {
  const navigate = useNavigate()

  // Cache first, refreshed in the background (lib/query-cache).
  const loadQuery = useCachedQuery<{ columns: GroupedColumns }>('/api/leads/grouped?limit_per_status=25', { screen: 'Pipeline', staleMs: 20000, keepPrevious: true })
  const columns = loadQuery.data ? loadQuery.data.columns : null
  const error = loadQuery.error
  const load = loadQuery.refresh

  if (columns === null && !error) return <LoadingState label="Chargement du pipeline…" />
  if (error) return <ErrorState message={error} onRetry={load} />

  return (
    <div className="crm-page crm-page--pipeline">
      <div className="crm-page-header">
        <div>
          <h1>Pipeline</h1>
          <p>Vue par statut, jusqu'à 25 leads par colonne.</p>
        </div>
      </div>

      <div className="pipeline-board">
        {STATUS_CONFIG.map((status) => {
          const column = columns?.[status.key]
          return (
            <div key={status.key} className="pipeline-column">
              <div className="pipeline-column-header">
                <StatusPill label={status.label} color={status.color} bg={status.bg} />
                <span className="pipeline-column-count font-mono">{column?.total ?? 0}</span>
              </div>
              <div className="pipeline-column-cards">
                {(column?.leads ?? []).map((lead) => {
                  const name = displayName(lead.first_name, lead.last_name, lead.instagram_handle ?? 'Sans nom')
                  return (
                    <button key={lead.id} className="pipeline-card" onClick={() => navigate(`/leads/${lead.id}`)}>
                      <Avatar name={name} size={26} src={lead.instagram_profile_pic_url} />
                      <div className="pipeline-card-body">
                        <div className="pipeline-card-name">{name}</div>
                        {lead.instagram_handle && <div className="pipeline-card-handle">@{lead.instagram_handle}</div>}
                      </div>
                    </button>
                  )
                })}
                {(!column || column.leads.length === 0) && <div className="pipeline-column-empty">—</div>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
