'use client'

import { useState, useEffect } from 'react'
import { X, Play, Search } from 'lucide-react'
import type { WorkflowExecutionLog } from '@/types'

interface Props {
  workflowId: string
  isOpen: boolean
  onClose: () => void
}

interface LeadOption {
  id: string
  first_name: string
  last_name: string
  email: string | null
}

const statusColors: Record<string, { bg: string; text: string }> = {
  success: { bg: 'rgba(56,161,105,0.15)', text: '#38A169' },
  failed: { bg: 'rgba(229,62,62,0.15)', text: '#E53E3E' },
  skipped: { bg: 'rgba(160,160,160,0.15)', text: '#A0A0A0' },
}

export default function DryRunDialog({ workflowId, isOpen, onClose }: Props) {
  const [leads, setLeads] = useState<LeadOption[]>([])
  const [search, setSearch] = useState('')
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const [results, setResults] = useState<WorkflowExecutionLog[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    // Reset state when opening
    setSelectedLeadId(null)
    setResults(null)
    setError(null)
    setSearch('')

    // Fetch leads
    fetch('/api/leads?per_page=50')
      .then(res => res.json())
      .then(json => setLeads(json.data ?? []))
      .catch(() => {})
  }, [isOpen])

  const filteredLeads = search
    ? leads.filter(l =>
        `${l.first_name} ${l.last_name} ${l.email ?? ''}`.toLowerCase().includes(search.toLowerCase())
      )
    : leads

  const handleRun = async () => {
    if (!selectedLeadId) return
    setRunning(true)
    setResults(null)
    setError(null)

    try {
      const res = await fetch(`/api/workflows/${workflowId}/dry-run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: selectedLeadId }),
      })

      const json = await res.json()
      if (!res.ok) {
        setError(json.error || 'Erreur lors du test')
      } else {
        setResults(json.data?.logs ?? [])
      }
    } catch {
      setError('Erreur reseau')
    } finally {
      setRunning(false)
    }
  }

  if (!isOpen) return null

  const selectedLead = leads.find(l => l.id === selectedLeadId)

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.6)',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-primary)',
          borderRadius: 12,
          width: 520,
          maxHeight: '80vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-primary)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
              Test du workflow
            </span>
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: 4,
                background: 'rgba(214,158,46,0.2)',
                color: '#D69E2E',
                textTransform: 'uppercase',
                letterSpacing: 1,
              }}
            >
              DRY RUN
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-tertiary)',
              padding: 4,
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>
          {/* Lead search */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 6, display: 'block' }}>
              Selectionner un lead
            </label>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: 11, color: 'var(--text-muted)' }} />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher..."
                style={{
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-primary)',
                  borderRadius: 8,
                  padding: '10px 12px 10px 32px',
                  color: 'var(--text-primary)',
                  fontSize: 13,
                  width: '100%',
                  outline: 'none',
                }}
              />
            </div>

            {/* Lead list */}
            <div
              style={{
                maxHeight: 160,
                overflowY: 'auto',
                marginTop: 8,
                border: '1px solid var(--border-primary)',
                borderRadius: 8,
                background: 'var(--bg-primary)',
              }}
            >
              {filteredLeads.length === 0 ? (
                <div style={{ padding: 12, fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
                  Aucun lead trouve
                </div>
              ) : (
                filteredLeads.slice(0, 20).map(lead => (
                  <div
                    key={lead.id}
                    onClick={() => setSelectedLeadId(lead.id)}
                    style={{
                      padding: '8px 12px',
                      cursor: 'pointer',
                      background: selectedLeadId === lead.id ? 'rgba(229,62,62,0.1)' : 'transparent',
                      borderBottom: '1px solid var(--border-primary)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                      {lead.first_name} {lead.last_name}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {lead.email ?? ''}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Run button */}
          <button
            onClick={handleRun}
            disabled={!selectedLeadId || running}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              width: '100%',
              padding: '10px 16px',
              background: selectedLeadId ? 'var(--color-primary)' : 'var(--border-primary)',
              color: selectedLeadId ? '#000' : 'var(--text-muted)',
              border: 'none',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: selectedLeadId && !running ? 'pointer' : 'not-allowed',
              opacity: running ? 0.6 : 1,
              marginBottom: 16,
            }}
          >
            <Play size={14} />
            {running ? 'Execution en cours...' : `Lancer le test${selectedLead ? ` pour ${selectedLead.first_name}` : ''}`}
          </button>

          {/* Error */}
          {error && (
            <div style={{ padding: 12, background: 'rgba(229,62,62,0.1)', borderRadius: 8, color: '#E53E3E', fontSize: 12, marginBottom: 16 }}>
              {error}
            </div>
          )}

          {/* Results */}
          {results && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 10 }}>
                Resultat du test ({results.length} etapes)
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {results.map((log, idx) => {
                  const colors = statusColors[log.status] ?? statusColors.skipped
                  return (
                    <div
                      key={log.id || idx}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 8,
                        padding: '8px 10px',
                        background: 'var(--bg-primary)',
                        borderRadius: 6,
                        border: '1px solid var(--border-primary)',
                      }}
                    >
                      <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, minWidth: 20 }}>
                        #{log.step_order}
                      </span>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          padding: '2px 6px',
                          borderRadius: 3,
                          background: colors.bg,
                          color: colors.text,
                          flexShrink: 0,
                        }}
                      >
                        {log.status}
                      </span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, color: 'var(--text-primary)' }}>
                          {log.step_type}{log.action_type ? ` — ${log.action_type}` : ''}
                        </div>
                        {log.error_message && (
                          <div style={{ fontSize: 11, color: '#E53E3E', marginTop: 2 }}>
                            {log.error_message}
                          </div>
                        )}
                        {log.result && Object.keys(log.result).length > 0 && (
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                            {JSON.stringify(log.result)}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
