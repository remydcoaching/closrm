'use client'

import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, ChevronDown, ChevronRight, RotateCcw } from 'lucide-react'
import type { WorkflowExecution, WorkflowExecutionLog } from '@/types'

interface Props {
  workflowId: string
}

type StatusFilter = 'all' | 'completed' | 'failed' | 'running'

const statusColors: Record<string, { bg: string; text: string }> = {
  completed: { bg: 'rgba(56,161,105,0.15)', text: '#38A169' },
  failed: { bg: 'rgba(229,62,62,0.15)', text: '#E53E3E' },
  running: { bg: 'rgba(214,158,46,0.15)', text: '#D69E2E' },
  waiting: { bg: 'rgba(160,160,160,0.15)', text: '#A0A0A0' },
}

export default function ExecutionHistoryPanel({ workflowId }: Props) {
  const [executions, setExecutions] = useState<(WorkflowExecution & { lead?: { first_name: string; last_name: string } | null })[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<StatusFilter>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [logs, setLogs] = useState<Record<string, WorkflowExecutionLog[]>>({})
  const [retrying, setRetrying] = useState<string | null>(null)

  const fetchExecutions = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/workflows/${workflowId}/executions`)
      if (res.ok) {
        const json = await res.json()
        setExecutions(json.data ?? [])
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [workflowId])

  useEffect(() => {
    fetchExecutions()
  }, [fetchExecutions])

  const fetchLogs = async (executionId: string) => {
    if (logs[executionId]) return
    try {
      const res = await fetch(`/api/workflows/${workflowId}/executions/${executionId}/logs`)
      if (res.ok) {
        const json = await res.json()
        setLogs(prev => ({ ...prev, [executionId]: json.data ?? [] }))
      }
    } catch {
      // ignore
    }
  }

  const handleExpand = (execId: string) => {
    if (expandedId === execId) {
      setExpandedId(null)
    } else {
      setExpandedId(execId)
      fetchLogs(execId)
    }
  }

  const handleRetry = async (execId: string) => {
    setRetrying(execId)
    try {
      await fetch(`/api/workflows/${workflowId}/executions/${execId}/retry`, { method: 'POST' })
      await fetchExecutions()
    } catch {
      // ignore
    } finally {
      setRetrying(null)
    }
  }

  const filtered = filter === 'all' ? executions : executions.filter(e => e.status === filter)

  const formatDuration = (exec: WorkflowExecution) => {
    if (!exec.completed_at) return '-'
    const ms = new Date(exec.completed_at).getTime() - new Date(exec.started_at).getTime()
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(1)}s`
  }

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' }) +
      ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
          Historique des executions
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Filter */}
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as StatusFilter)}
            style={{
              background: 'var(--bg-input)',
              border: '1px solid var(--border-primary)',
              borderRadius: 6,
              padding: '6px 10px',
              color: 'var(--text-primary)',
              fontSize: 12,
            }}
          >
            <option value="all">Tous</option>
            <option value="completed">Termines</option>
            <option value="failed">Echoues</option>
            <option value="running">En cours</option>
          </select>
          <button
            onClick={fetchExecutions}
            style={{
              background: 'transparent',
              border: '1px solid var(--border-primary)',
              borderRadius: 6,
              padding: 6,
              cursor: 'pointer',
              color: 'var(--text-tertiary)',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ fontSize: 13, color: 'var(--text-tertiary)', textAlign: 'center', padding: 24 }}>
          Chargement...
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--text-tertiary)', textAlign: 'center', padding: 24 }}>
          Aucune execution trouvee
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {filtered.map((exec) => {
            const colors = statusColors[exec.status] ?? statusColors.waiting
            const isExpanded = expandedId === exec.id
            const execLogs = logs[exec.id] ?? []

            return (
              <div key={exec.id}>
                {/* Row */}
                <div
                  onClick={() => handleExpand(exec.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 12px',
                    background: isExpanded ? 'var(--bg-hover)' : 'transparent',
                    borderRadius: 8,
                    cursor: 'pointer',
                    transition: 'background 0.15s',
                  }}
                >
                  {isExpanded ? <ChevronDown size={14} color="var(--text-tertiary)" /> : <ChevronRight size={14} color="var(--text-tertiary)" />}

                  <span style={{ fontSize: 12, color: 'var(--text-secondary)', minWidth: 110 }}>
                    {formatDate(exec.started_at)}
                  </span>

                  <span style={{ fontSize: 12, color: 'var(--text-primary)', flex: 1 }}>
                    {(exec.lead as { first_name: string; last_name: string } | null)
                      ? `${(exec.lead as { first_name: string }).first_name} ${(exec.lead as { last_name: string }).last_name}`
                      : exec.lead_id?.slice(0, 8) ?? '-'}
                  </span>

                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      padding: '2px 8px',
                      borderRadius: 4,
                      background: colors.bg,
                      color: colors.text,
                    }}
                  >
                    {exec.status}
                  </span>

                  <span style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 50, textAlign: 'right' }}>
                    {formatDuration(exec)}
                  </span>

                  <span style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 30, textAlign: 'right' }}>
                    {exec.current_step} steps
                  </span>

                  {exec.status === 'failed' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleRetry(exec.id)
                      }}
                      disabled={retrying === exec.id}
                      style={{
                        background: 'rgba(229,62,62,0.15)',
                        border: 'none',
                        borderRadius: 4,
                        padding: '4px 8px',
                        cursor: retrying === exec.id ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        color: '#E53E3E',
                        fontSize: 11,
                        opacity: retrying === exec.id ? 0.5 : 1,
                      }}
                    >
                      <RotateCcw size={12} />
                      Relancer
                    </button>
                  )}
                </div>

                {/* Expanded logs */}
                {isExpanded && (
                  <div style={{ marginLeft: 28, padding: '8px 0', borderLeft: '2px solid var(--border-primary)', paddingLeft: 16 }}>
                    {execLogs.length === 0 ? (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Chargement des logs...</div>
                    ) : (
                      execLogs.map((log) => {
                        const logColors = statusColors[log.status] ?? statusColors.waiting
                        return (
                          <div key={log.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 6, fontSize: 11 }}>
                            <span
                              style={{
                                padding: '1px 6px',
                                borderRadius: 3,
                                background: logColors.bg,
                                color: logColors.text,
                                fontWeight: 600,
                                flexShrink: 0,
                              }}
                            >
                              {log.status}
                            </span>
                            <span style={{ color: 'var(--text-secondary)' }}>
                              #{log.step_order} {log.step_type}
                              {log.action_type ? ` (${log.action_type})` : ''}
                            </span>
                            {log.error_message && (
                              <span style={{ color: '#E53E3E' }}>{log.error_message}</span>
                            )}
                          </div>
                        )
                      })
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
