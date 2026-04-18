'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Megaphone, ChevronRight } from 'lucide-react'

interface Props {
  meta_campaign_id: string | null
  meta_adset_id: string | null
  meta_ad_id: string | null
  compact?: boolean
}

interface Resolved {
  id: string
  name: string
  type: string
  status: string
}

type AttributionMap = Record<string, Resolved | null>

export default function LeadAttributionBlock({ meta_campaign_id, meta_adset_id, meta_ad_id, compact }: Props) {
  const [map, setMap] = useState<AttributionMap>({})
  const [loading, setLoading] = useState(false)

  const ids = [meta_campaign_id, meta_adset_id, meta_ad_id].filter((x): x is string => !!x)

  useEffect(() => {
    if (ids.length === 0) return
    let cancelled = false
    async function fetchNames() {
      setLoading(true)
      try {
        const res = await fetch(`/api/meta/ad-attribution?ids=${ids.join(',')}`)
        if (res.ok) {
          const json = await res.json()
          if (!cancelled) setMap(json.data ?? {})
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchNames()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta_campaign_id, meta_adset_id, meta_ad_id])

  if (ids.length === 0) return null

  const campaign = meta_campaign_id ? map[meta_campaign_id] : null
  const adset = meta_adset_id ? map[meta_adset_id] : null
  const ad = meta_ad_id ? map[meta_ad_id] : null

  const nameOrId = (id: string | null, resolved: Resolved | null) =>
    resolved?.name || (id ? `${id.slice(0, 8)}…` : '—')

  const linkBase = '/acquisition/publicites'

  const pathItems: { id: string; label: string; href: string; kind: 'Campagne' | 'Adset' | 'Ad' }[] = []
  if (meta_campaign_id) pathItems.push({ id: meta_campaign_id, label: nameOrId(meta_campaign_id, campaign), href: `${linkBase}?level=campaigns`, kind: 'Campagne' })
  if (meta_adset_id)   pathItems.push({ id: meta_adset_id, label: nameOrId(meta_adset_id, adset), href: `${linkBase}?level=adsets`, kind: 'Adset' })
  if (meta_ad_id)      pathItems.push({ id: meta_ad_id, label: nameOrId(meta_ad_id, ad), href: `/leads?meta_ad_id=${meta_ad_id}`, kind: 'Ad' })

  if (compact) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
        fontSize: 11, color: 'var(--text-muted)',
      }}>
        <Megaphone size={11} style={{ flexShrink: 0 }} />
        {pathItems.map((item, i) => (
          <span key={item.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            {i > 0 && <ChevronRight size={10} style={{ opacity: 0.5 }} />}
            <Link
              href={item.href}
              title={`${item.kind}: ${item.id}`}
              style={{ color: 'var(--text-tertiary)', textDecoration: 'none' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-primary)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-tertiary)')}
            >
              {loading && !item.label ? '…' : item.label}
            </Link>
          </span>
        ))}
      </div>
    )
  }

  return (
    <div style={{
      background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)',
      borderRadius: 12, padding: 14,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10,
        fontSize: 10, fontWeight: 700, color: 'var(--text-label)',
        letterSpacing: '0.15em', textTransform: 'uppercase',
      }}>
        <Megaphone size={11} />
        Origine publicitaire
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {pathItems.map((item) => (
          <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              fontSize: 10, fontWeight: 700, color: 'var(--text-muted)',
              textTransform: 'uppercase', letterSpacing: '0.1em',
              minWidth: 62,
            }}>
              {item.kind}
            </span>
            <Link
              href={item.href}
              title={item.id}
              style={{
                fontSize: 12, color: 'var(--text-primary)', fontWeight: 500,
                textDecoration: 'none', flex: 1,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-primary)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-primary)')}
            >
              {loading && !item.label ? '…' : item.label}
            </Link>
          </div>
        ))}
      </div>
    </div>
  )
}
