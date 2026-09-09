'use client'

import { useEffect, useState } from 'react'
import { X, Sparkles, Loader2, RefreshCw } from 'lucide-react'

export interface AnalysisRow {
  id: string
  name: string
  data: Record<string, unknown>
}

export interface AnalysisTarget {
  level: 'campaign' | 'adset' | 'ad'
  rows: AnalysisRow[]
  dateFrom?: string
  dateTo?: string
}

interface Props {
  target: AnalysisTarget
  onClose: () => void
}

const LEVEL_LABEL_PLURAL: Record<AnalysisTarget['level'], string> = {
  campaign: 'campagnes',
  adset: 'ad sets',
  ad: 'ads',
}

/** Rendu markdown minimaliste : titres `###`, **bold**, listes `-`. */
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
  const [analyzedCount, setAnalyzedCount] = useState<number>(target.rows.length)
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
          rows: target.rows,
          dateFrom: target.dateFrom,
          dateTo: target.dateTo,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erreur')
      setAnalysis(json.analysis ?? '')
      setAnalyzedCount(json.analyzedCount ?? target.rows.length)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur réseau')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAnalysis()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target.level, target.rows.length, target.dateFrom, target.dateTo])

  const truncated = analyzedCount < target.rows.length
  const label = LEVEL_LABEL_PLURAL[target.level]

  return (
    <div style={{
      position: 'fixed', top: 0, right: 0, bottom: 0,
      width: '100%', maxWidth: 560,
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
              Analyse IA globale
            </span>
          </div>
          <h3 style={{
            fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', margin: 0,
          }}>
            {target.rows.length} {label}
            {target.dateFrom && target.dateTo && (
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 400, marginLeft: 8 }}>
                · {target.dateFrom} → {target.dateTo}
              </span>
            )}
          </h3>
          {truncated && (
            <div style={{ fontSize: 11, color: '#f59e0b', marginTop: 4 }}>
              Analyse limitée aux {analyzedCount} premières lignes (sur {target.rows.length}) pour optimiser le coût IA.
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
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
              Claude analyse les {target.rows.length} {label}…<br />
              <span style={{ fontSize: 11, color: 'var(--text-label)' }}>~15-30s</span>
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
          <div>{renderMarkdown(analysis)}</div>
        )}
      </div>
    </div>
  )
}
