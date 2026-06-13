'use client'

import { useEffect, useState } from 'react'
import { X, Sparkles, Loader2, RefreshCw } from 'lucide-react'

export interface AnalysisTarget {
  level: 'campaign' | 'adset' | 'ad'
  id: string
  name: string
  kpis: Record<string, unknown>
  crm?: Record<string, unknown> | null
  dateFrom?: string
  dateTo?: string
}

interface Props {
  target: AnalysisTarget
  onClose: () => void
}

const LEVEL_LABEL: Record<AnalysisTarget['level'], string> = {
  campaign: 'Campagne',
  adset: 'Ad set',
  ad: 'Ad',
}

/**
 * Rendu markdown ultra-simple : titres `###`, **bold**, listes `-`.
 * Pas besoin de tirer une lib markdown lourde pour ce qu'on rend ici.
 */
function renderMarkdown(text: string): React.ReactNode {
  const lines = text.split('\n')
  const nodes: React.ReactNode[] = []
  let listBuffer: string[] = []

  function flushList() {
    if (listBuffer.length > 0) {
      nodes.push(
        <ul key={`ul-${nodes.length}`} style={{ margin: '6px 0 12px 18px', padding: 0 }}>
          {listBuffer.map((item, i) => (
            <li key={i} style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.55, marginBottom: 4 }}>
              {renderInline(item)}
            </li>
          ))}
        </ul>
      )
      listBuffer = []
    }
  }

  function renderInline(s: string): React.ReactNode {
    // Bold
    const parts = s.split(/(\*\*[^*]+\*\*)/g)
    return parts.map((p, i) => {
      if (p.startsWith('**') && p.endsWith('**')) {
        return <strong key={i} style={{ color: 'var(--text-primary)' }}>{p.slice(2, -2)}</strong>
      }
      return <span key={i}>{p}</span>
    })
  }

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (line.startsWith('### ')) {
      flushList()
      nodes.push(
        <h4 key={`h-${nodes.length}`} style={{
          fontSize: 14, fontWeight: 700, color: 'var(--text-primary)',
          marginTop: 18, marginBottom: 8,
        }}>
          {line.slice(4)}
        </h4>
      )
    } else if (line.startsWith('## ')) {
      flushList()
      nodes.push(
        <h3 key={`h-${nodes.length}`} style={{
          fontSize: 15, fontWeight: 700, color: 'var(--text-primary)',
          marginTop: 20, marginBottom: 10,
        }}>
          {line.slice(3)}
        </h3>
      )
    } else if (line.startsWith('- ')) {
      listBuffer.push(line.slice(2))
    } else if (line === '') {
      flushList()
    } else {
      flushList()
      nodes.push(
        <p key={`p-${nodes.length}`} style={{
          fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.55,
          margin: '0 0 10px',
        }}>
          {renderInline(line)}
        </p>
      )
    }
  }
  flushList()
  return nodes
}

export default function AnalysisPanel({ target, onClose }: Props) {
  const [loading, setLoading] = useState(true)
  const [analysis, setAnalysis] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function fetchAnalysis() {
    setLoading(true)
    setError(null)
    setAnalysis(null)
    try {
      const res = await fetch('/api/meta/ai-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          level: target.level,
          name: target.name,
          kpis: target.kpis,
          crm: target.crm ?? null,
          dateFrom: target.dateFrom,
          dateTo: target.dateTo,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erreur')
      setAnalysis(json.analysis ?? '')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur réseau')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAnalysis()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target.id, target.level])

  return (
    <div style={{
      position: 'fixed', top: 0, right: 0, bottom: 0,
      width: '100%', maxWidth: 540,
      background: 'var(--bg-elevated)',
      borderLeft: '1px solid var(--border-primary)',
      boxShadow: '-8px 0 32px rgba(0,0,0,0.4)',
      zIndex: 250,
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        padding: '20px 24px',
        borderBottom: '1px solid var(--border-primary)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <Sparkles size={14} color="#a855f7" />
            <span style={{ fontSize: 11, fontWeight: 700, color: '#a855f7', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              Analyse IA · {LEVEL_LABEL[target.level]}
            </span>
          </div>
          <h3 style={{
            fontSize: 16, fontWeight: 600, color: 'var(--text-primary)',
            margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {target.name}
          </h3>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={fetchAnalysis}
            disabled={loading}
            title="Régénérer"
            style={{
              width: 32, height: 32, borderRadius: 8,
              border: '1px solid var(--border-primary)',
              background: 'transparent',
              color: 'var(--text-muted)',
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <RefreshCw size={14} style={loading ? { animation: 'spin 1s linear infinite' } : undefined} />
          </button>
          <button
            onClick={onClose}
            title="Fermer"
            style={{
              width: 32, height: 32, borderRadius: 8,
              border: '1px solid var(--border-primary)',
              background: 'transparent',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '24px',
      }}>
        {loading && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: '60px 20px', gap: 16, color: 'var(--text-muted)',
          }}>
            <Loader2 size={28} style={{ animation: 'spin 1s linear infinite', color: '#a855f7' }} />
            <div style={{ fontSize: 13, textAlign: 'center' }}>
              Claude analyse les chiffres…<br />
              <span style={{ fontSize: 11, color: 'var(--text-label)' }}>~10-20s</span>
            </div>
          </div>
        )}

        {error && (
          <div style={{
            padding: 16, borderRadius: 10,
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.25)',
            color: '#ef4444', fontSize: 13,
          }}>
            <strong>Erreur :</strong> {error}
          </div>
        )}

        {analysis && !loading && (
          <div>
            {renderMarkdown(analysis)}
          </div>
        )}
      </div>
    </div>
  )
}
