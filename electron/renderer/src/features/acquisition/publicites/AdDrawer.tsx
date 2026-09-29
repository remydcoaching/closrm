// Ad detail side panel — parity with the web's components/ads/AdCreativePanel:
// creative (GET /api/meta/ads/:adId), KPIs of the row, CRM leads attributed
// to the ad (GET /api/leads?meta_ad_id=…&per_page=100).
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../../lib/api-client'
import { openWeb } from '../../../lib/web-link'
import { Drawer } from '../../../design-system/Drawer'
import { StatusPill } from '../../../design-system/StatusPill'
import { statusEntry, displayName } from '../../leads/status'
import type { LeadStatus } from '../../leads/types'
import type { AdDetailResponse, MetaAdCreative, MetaBreakdownRow } from './types'
import { euro, num } from './metrics'

interface LeadLite {
  id: string
  first_name: string
  last_name: string
  phone: string | null
  email: string | null
  status: LeadStatus
  created_at: string
}

export function AdDrawer({ ad, onClose }: { ad: MetaBreakdownRow; onClose: () => void }) {
  const navigate = useNavigate()
  const [creative, setCreative] = useState<MetaAdCreative | null>(null)
  const [loadingCreative, setLoadingCreative] = useState(true)
  const [leads, setLeads] = useState<LeadLite[]>([])
  const [leadsTotal, setLeadsTotal] = useState(0)
  const [loadingLeads, setLoadingLeads] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoadingCreative(true)
    api
      .get<AdDetailResponse>(`/api/meta/ads/${encodeURIComponent(ad.id)}`)
      .then((res) => !cancelled && setCreative(res.data?.creative ?? null))
      .catch(() => !cancelled && setCreative(null))
      .finally(() => !cancelled && setLoadingCreative(false))
    return () => {
      cancelled = true
    }
  }, [ad.id])

  useEffect(() => {
    let cancelled = false
    setLoadingLeads(true)
    api
      .get<{ data: LeadLite[]; meta?: { total: number } }>(`/api/leads?meta_ad_id=${encodeURIComponent(ad.id)}&per_page=100`)
      .then((res) => {
        if (cancelled) return
        setLeads(res.data ?? [])
        setLeadsTotal(res.meta?.total ?? res.data?.length ?? 0)
      })
      .catch(() => !cancelled && setLeads([]))
      .finally(() => !cancelled && setLoadingLeads(false))
    return () => {
      cancelled = true
    }
  }, [ad.id])

  const videoUrl = creative?.video_url ?? null
  const imageUrl = creative?.image_url ?? creative?.thumbnail_url ?? null
  const kpis = [
    { label: 'Budget dépensé', value: euro(ad.spend, 2) },
    { label: 'Impressions', value: num(ad.impressions) },
    { label: 'Clics', value: num(ad.clicks) },
    { label: 'CTR', value: `${ad.ctr.toFixed(2)} %` },
    { label: 'Leads', value: num(ad.leads) },
    { label: 'Coût par lead', value: ad.cpl !== null ? euro(ad.cpl, 2) : '—' },
  ]

  return (
    <Drawer title={ad.name} onClose={onClose}>
      <div className="pub-drawer-section">
        <h3>Créative</h3>
        {loadingCreative ? (
          <p className="ds-muted">Chargement…</p>
        ) : videoUrl ? (
          <video className="pub-creative-media" src={videoUrl} controls playsInline poster={imageUrl ?? undefined} />
        ) : imageUrl ? (
          <img className="pub-creative-media" src={imageUrl} alt={ad.name} />
        ) : (
          <p className="ds-muted">Aucune créative disponible</p>
        )}
        {creative?.body && <p className="pub-creative-text">{creative.body}</p>}
        {creative?.title && <p className="pub-creative-title">{creative.title}</p>}
        {creative?.link_url && (
          <button
            type="button"
            className="pub-link-btn"
            onClick={() => {
              const url = creative.link_url as string
              if (window.closrm?.openExternal) void window.closrm.openExternal(url)
              else window.open(url, '_blank', 'noopener,noreferrer')
            }}
          >
            {creative.link_url}
          </button>
        )}
      </div>

      <div className="pub-drawer-section">
        <h3>Performance (période sélectionnée)</h3>
        <div className="pub-kpi-mini-grid">
          {kpis.map((k) => (
            <div key={k.label} className="pub-kpi-mini">
              <span>{k.label}</span>
              <strong>{k.value}</strong>
            </div>
          ))}
        </div>
      </div>

      <div className="pub-drawer-section">
        <h3>Leads CRM {leadsTotal > 0 && `(${num(leadsTotal)})`}</h3>
        {loadingLeads ? (
          <p className="ds-muted">Chargement…</p>
        ) : leads.length === 0 ? (
          <p className="ds-muted">Aucun lead attribué à cette pub</p>
        ) : (
          <>
            {leads.map((lead) => {
              const s = statusEntry(lead.status)
              return (
                <button key={lead.id} type="button" className="pub-lead-row" onClick={() => navigate(`/leads/${lead.id}`)}>
                  <div style={{ minWidth: 0 }}>
                    <div className="pub-lead-name">{displayName(lead.first_name, lead.last_name, lead.email ?? lead.phone ?? 'Sans nom')}</div>
                    <div className="ds-muted">{lead.phone || lead.email || '—'}</div>
                  </div>
                  <StatusPill label={s.label} color={s.color} bg={s.bg} />
                </button>
              )
            })}
            {leadsTotal > leads.length && (
              <button type="button" className="pub-link-btn" onClick={() => void openWeb(`/leads?meta_ad_id=${encodeURIComponent(ad.id)}`)}>
                +{num(leadsTotal - leads.length)} leads non affichés — voir la liste complète sur le web
              </button>
            )}
          </>
        )}
      </div>
    </Drawer>
  )
}
