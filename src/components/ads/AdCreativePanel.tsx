'use client'

import { useEffect, useState } from 'react'
import type { MetaAdCreative } from '@/lib/meta/client'

interface AdKpis {
  spend: number
  impressions: number
  clicks: number
  ctr: number
  leads: number
  cpl: number | null
}

interface Props {
  adId: string
  adName: string
  adKpis: AdKpis
  onClose: () => void
}

function formatEuro(n: number): string {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '\u202F€'
}

function formatNumber(n: number): string {
  return n.toLocaleString('fr-FR')
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.5)',
  zIndex: 149,
}

const panelStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  right: 0,
  bottom: 0,
  width: '100%',
  maxWidth: 480,
  background: '#0A0A0A',
  borderLeft: '1px solid #262626',
  zIndex: 150,
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
}

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '20px 24px 16px',
  borderBottom: '1px solid #262626',
}

const closeBtnStyle: React.CSSProperties = {
  background: 'none',
  border: '1px solid #262626',
  borderRadius: 6,
  width: 30,
  height: 30,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  color: '#A0A0A0',
  fontSize: 16,
  flexShrink: 0,
}

const sectionStyle: React.CSSProperties = {
  padding: '20px 24px',
}

const kpiCardStyle: React.CSSProperties = {
  background: '#141414',
  border: '1px solid #262626',
  borderRadius: 10,
  padding: 16,
}

const kpiLabelStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  color: '#A0A0A0',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.08em',
  marginBottom: 6,
}

const kpiValueStyle: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 700,
  color: '#FFFFFF',
}

export default function AdCreativePanel({ adId, adName, adKpis, onClose }: Props) {
  const [creative, setCreative] = useState<MetaAdCreative | null>(null)
  const [loadingCreative, setLoadingCreative] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoadingCreative(true)

    fetch(`/api/meta/ads/${adId}`)
      .then(res => {
        if (!res.ok) throw new Error('fetch failed')
        return res.json()
      })
      .then(json => {
        if (!cancelled) {
          setCreative(json.data?.creative ?? null)
        }
      })
      .catch(() => {
        if (!cancelled) setCreative(null)
      })
      .finally(() => {
        if (!cancelled) setLoadingCreative(false)
      })

    return () => { cancelled = true }
  }, [adId])

  const imageUrl = creative?.image_url ?? creative?.thumbnail_url ?? null

  const kpis: Array<{ label: string; value: string }> = [
    { label: 'Budget dépensé', value: formatEuro(adKpis.spend) },
    { label: 'Impressions', value: formatNumber(adKpis.impressions) },
    { label: 'Clics', value: formatNumber(adKpis.clicks) },
    { label: 'CTR', value: adKpis.ctr.toFixed(2) + '%' },
    { label: 'Leads', value: String(adKpis.leads) },
    { label: 'Coût par lead', value: adKpis.cpl !== null ? formatEuro(adKpis.cpl) : '—' },
  ]

  return (
    <>
      {/* Overlay */}
      <div style={overlayStyle} onClick={onClose} />

      {/* Panel */}
      <div style={panelStyle}>
        {/* Header */}
        <div style={headerStyle}>
          <h2 style={{
            fontSize: 15,
            fontWeight: 700,
            color: '#FFFFFF',
            margin: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            marginRight: 12,
          }}>
            {adName}
          </h2>
          <button style={closeBtnStyle} onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </div>

        {/* Creative section */}
        <div style={sectionStyle}>
          <div style={{
            fontSize: 10,
            fontWeight: 600,
            color: '#A0A0A0',
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            marginBottom: 12,
          }}>
            Creative
          </div>

          {loadingCreative ? (
            <div style={{
              background: '#141414',
              borderRadius: 12,
              height: 200,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#A0A0A0',
              fontSize: 12,
            }}>
              Chargement...
            </div>
          ) : imageUrl ? (
            <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid #262626' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl}
                alt={adName}
                style={{
                  width: '100%',
                  display: 'block',
                  borderRadius: 12,
                }}
              />
            </div>
          ) : (
            <div style={{
              background: '#141414',
              border: '1px solid #262626',
              borderRadius: 12,
              height: 200,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#A0A0A0',
              fontSize: 12,
            }}>
              Aucune creative disponible
            </div>
          )}

          {/* Creative body text */}
          {creative?.body && (
            <p style={{
              fontSize: 12,
              color: '#A0A0A0',
              marginTop: 12,
              lineHeight: 1.5,
              whiteSpace: 'pre-wrap',
            }}>
              {creative.body}
            </p>
          )}

          {/* Creative title */}
          {creative?.title && (
            <p style={{
              fontSize: 13,
              fontWeight: 600,
              color: '#FFFFFF',
              marginTop: 8,
            }}>
              {creative.title}
            </p>
          )}

          {/* Link URL */}
          {creative?.link_url && (
            <a
              href={creative.link_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-block',
                marginTop: 8,
                fontSize: 11,
                color: '#1877F2',
                textDecoration: 'none',
                wordBreak: 'break-all',
              }}
            >
              {creative.link_url}
            </a>
          )}
        </div>

        {/* KPIs section */}
        <div style={{ ...sectionStyle, paddingTop: 0 }}>
          <div style={{
            fontSize: 10,
            fontWeight: 600,
            color: '#A0A0A0',
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            marginBottom: 12,
          }}>
            Performance
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 10,
          }}>
            {kpis.map(kpi => (
              <div key={kpi.label} style={kpiCardStyle}>
                <div style={kpiLabelStyle}>{kpi.label}</div>
                <div style={kpiValueStyle}>{kpi.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
