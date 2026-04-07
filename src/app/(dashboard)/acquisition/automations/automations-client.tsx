'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Plus, Zap, Filter } from 'lucide-react'
import { Workflow, WorkflowStatus } from '@/types'
import { workflowTemplates } from '@/lib/workflows/templates'
import WorkflowCard from '@/components/automations/WorkflowCard'
import NewWorkflowModal from '@/components/automations/NewWorkflowModal'
import ConfirmModal from '@/components/shared/ConfirmModal'

interface AutomationsClientProps {
  initialWorkflows: Workflow[]
}

type StatusFilter = 'all' | WorkflowStatus

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'Tous' },
  { key: 'actif', label: 'Actifs' },
  { key: 'inactif', label: 'Inactifs' },
  { key: 'brouillon', label: 'Brouillons' },
]

export default function AutomationsClient({ initialWorkflows }: AutomationsClientProps) {
  const router = useRouter()
  const [workflows, setWorkflows] = useState<Workflow[]>(initialWorkflows)
  const [showNewModal, setShowNewModal] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [btnHovered, setBtnHovered] = useState(false)

  async function fetchWorkflows() {
    try {
      const res = await fetch('/api/workflows?per_page=100')
      if (res.ok) {
        const json = await res.json()
        setWorkflows(json.data)
      }
    } catch {
      // silently fail
    }
  }

  async function handleActivate(id: string) {
    const res = await fetch(`/api/workflows/${id}/activate`, { method: 'POST' })
    if (res.ok) fetchWorkflows()
  }

  async function handleDeactivate(id: string) {
    const res = await fetch(`/api/workflows/${id}/deactivate`, { method: 'POST' })
    if (res.ok) fetchWorkflows()
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return
    const res = await fetch(`/api/workflows/${deleteTarget}`, { method: 'DELETE' })
    if (res.ok) {
      setDeleteTarget(null)
      fetchWorkflows()
    }
  }

  async function handleCreateFromTemplate(templateId: string) {
    const template = workflowTemplates.find(t => t.id === templateId)
    if (!template) return

    const res = await fetch('/api/workflows', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: template.name,
        description: template.description,
        trigger_type: template.trigger_type,
        trigger_config: template.trigger_config,
      }),
    })
    if (!res.ok) return
    const { data: workflow } = await res.json()

    for (const step of template.steps) {
      await fetch(`/api/workflows/${workflow.id}/steps`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step_type: step.step_type,
          action_type: step.action_type || null,
          action_config: step.action_config || {},
          delay_value: step.delay_value || null,
          delay_unit: step.delay_unit || null,
        }),
      })
    }

    setShowNewModal(false)
    router.push(`/acquisition/automations/${workflow.id}`)
  }

  async function handleCreateBlank(name: string) {
    if (!name.trim()) return

    const res = await fetch('/api/workflows', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name.trim(),
        trigger_type: 'new_lead',
        trigger_config: {},
      }),
    })
    if (!res.ok) return
    const { data: workflow } = await res.json()

    setShowNewModal(false)
    router.push(`/acquisition/automations/${workflow.id}`)
  }

  // Filtered workflows
  const filtered = useMemo(() => {
    let result = workflows
    if (statusFilter !== 'all') {
      result = result.filter(w => w.status === statusFilter)
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(w =>
        w.name.toLowerCase().includes(q) ||
        (w.description ?? '').toLowerCase().includes(q)
      )
    }
    return result
  }, [workflows, statusFilter, search])

  // Count per status for tabs
  const counts = useMemo(() => ({
    all: workflows.length,
    actif: workflows.filter(w => w.status === 'actif').length,
    inactif: workflows.filter(w => w.status === 'inactif').length,
    brouillon: workflows.filter(w => w.status === 'brouillon').length,
  }), [workflows])

  return (
    <div style={{ padding: '24px 24px 40px' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 28,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h1 style={{
            fontSize: 22,
            fontWeight: 700,
            color: 'var(--text-primary)',
            margin: 0,
          }}>
            Automations
          </h1>
          {workflows.length > 0 && (
            <span style={{
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--text-label)',
              background: 'var(--bg-hover)',
              padding: '3px 10px',
              borderRadius: 20,
            }}>
              {workflows.length}
            </span>
          )}
        </div>
        <button
          onClick={() => setShowNewModal(true)}
          onMouseEnter={() => setBtnHovered(true)}
          onMouseLeave={() => setBtnHovered(false)}
          style={{
            background: btnHovered ? 'var(--color-primary-hover)' : 'var(--color-primary)',
            color: '#fff',
            fontWeight: 600,
            fontSize: 13,
            padding: '10px 20px',
            borderRadius: 10,
            border: 'none',
            cursor: 'pointer',
            transition: 'all 0.15s',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Plus size={16} />
          Nouveau workflow
        </button>
      </div>

      {/* Filters bar */}
      {workflows.length > 0 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 20,
        }}>
          {/* Status tabs */}
          <div style={{
            display: 'flex',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-primary)',
            borderRadius: 10,
            padding: 3,
            gap: 2,
          }}>
            {STATUS_TABS.map(tab => {
              const isActive = statusFilter === tab.key
              const count = counts[tab.key]
              return (
                <button
                  key={tab.key}
                  onClick={() => setStatusFilter(tab.key)}
                  style={{
                    padding: '6px 14px',
                    fontSize: 12,
                    fontWeight: 500,
                    color: isActive ? 'var(--text-primary)' : 'var(--text-label)',
                    background: isActive ? 'var(--bg-hover)' : 'transparent',
                    border: 'none',
                    borderRadius: 8,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  {tab.label}
                  {count > 0 && (
                    <span style={{
                      fontSize: 10,
                      fontWeight: 600,
                      color: isActive ? 'var(--text-secondary)' : 'var(--text-label)',
                      background: isActive ? 'var(--border-primary)' : 'transparent',
                      padding: '1px 6px',
                      borderRadius: 10,
                    }}>
                      {count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Search */}
          <div style={{
            position: 'relative',
            flex: 1,
            maxWidth: 320,
          }}>
            <Search
              size={14}
              style={{
                position: 'absolute',
                left: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-label)',
              }}
            />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher un workflow..."
              style={{
                width: '100%',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-primary)',
                borderRadius: 10,
                padding: '8px 12px 8px 34px',
                color: 'var(--text-primary)',
                fontSize: 13,
                outline: 'none',
              }}
            />
          </div>
        </div>
      )}

      {/* Empty state */}
      {workflows.length === 0 && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '80px 20px',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-primary)',
          borderRadius: 16,
        }}>
          <div style={{
            width: 64,
            height: 64,
            borderRadius: 16,
            background: 'rgba(229,62,62,0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 20,
          }}>
            <Zap size={28} style={{ color: '#E53E3E' }} />
          </div>
          <h3 style={{
            fontSize: 16,
            fontWeight: 600,
            color: 'var(--text-primary)',
            margin: '0 0 8px',
          }}>
            Aucun workflow
          </h3>
          <p style={{
            fontSize: 13,
            color: 'var(--text-muted)',
            margin: '0 0 24px',
            textAlign: 'center',
            maxWidth: 360,
            lineHeight: 1.5,
          }}>
            Automatisez vos processus : envoi de messages, changements de statut, notifications et plus encore.
          </p>
          <button
            onClick={() => setShowNewModal(true)}
            style={{
              background: '#E53E3E',
              color: '#fff',
              fontWeight: 600,
              fontSize: 13,
              padding: '10px 24px',
              borderRadius: 10,
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Plus size={16} />
            Creer un workflow
          </button>
        </div>
      )}

      {/* No results for filter */}
      {workflows.length > 0 && filtered.length === 0 && (
        <div style={{
          textAlign: 'center',
          padding: '60px 20px',
          color: 'var(--text-muted)',
          fontSize: 13,
        }}>
          <Filter size={24} style={{ color: 'var(--text-label)', marginBottom: 12 }} />
          <div>Aucun workflow ne correspond a vos filtres.</div>
        </div>
      )}

      {/* Workflows grid */}
      {filtered.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
          gap: 20,
        }}>
          {filtered.map(w => (
            <WorkflowCard
              key={w.id}
              workflow={w}
              onActivate={handleActivate}
              onDeactivate={handleDeactivate}
              onDelete={id => setDeleteTarget(id)}
              onClick={id => router.push(`/acquisition/automations/${id}`)}
            />
          ))}
        </div>
      )}

      {/* New workflow modal */}
      <NewWorkflowModal
        open={showNewModal}
        onClose={() => setShowNewModal(false)}
        onCreateFromTemplate={handleCreateFromTemplate}
        onCreateBlank={handleCreateBlank}
      />

      {/* Delete confirmation */}
      {deleteTarget && (
        <ConfirmModal
          title="Supprimer le workflow"
          message="Cette action est irreversible. Voulez-vous vraiment supprimer ce workflow ?"
          confirmLabel="Supprimer"
          confirmDanger
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
