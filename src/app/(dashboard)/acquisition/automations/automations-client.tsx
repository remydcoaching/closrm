'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Workflow } from '@/types'
import { workflowTemplates } from '@/lib/workflows/templates'
import WorkflowCard from '@/components/automations/WorkflowCard'
import NewWorkflowModal from '@/components/automations/NewWorkflowModal'
import ConfirmModal from '@/components/shared/ConfirmModal'

interface AutomationsClientProps {
  initialWorkflows: Workflow[]
}

export default function AutomationsClient({ initialWorkflows }: AutomationsClientProps) {
  const router = useRouter()
  const [workflows, setWorkflows] = useState<Workflow[]>(initialWorkflows)
  const [showNewModal, setShowNewModal] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
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

  async function handleCreateBlank() {
    const name = prompt('Nom du workflow :')
    if (!name || !name.trim()) return

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

  return (
    <div style={{ padding: '0 0 40px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Automations</h1>
        <button
          onClick={() => setShowNewModal(true)}
          onMouseEnter={() => setBtnHovered(true)}
          onMouseLeave={() => setBtnHovered(false)}
          style={{
            background: btnHovered ? '#00e676' : 'var(--color-primary)',
            color: '#000', fontWeight: 700, fontSize: 13,
            padding: '10px 20px', borderRadius: 8,
            border: 'none', cursor: 'pointer',
            transition: 'background 0.15s',
          }}
        >
          + Nouveau workflow
        </button>
      </div>

      {/* Empty state */}
      {workflows.length === 0 && (
        <div style={{
          textAlign: 'center', color: 'var(--text-label)', fontSize: 13, padding: '80px 0',
        }}>
          Aucun workflow. Cr&eacute;ez-en un pour automatiser vos processus.
        </div>
      )}

      {/* Workflows grid */}
      {workflows.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
          gap: 16,
        }}>
          {workflows.map(w => (
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
          message="Cette action est irr&eacute;versible. Voulez-vous vraiment supprimer ce workflow ?"
          confirmLabel="Supprimer"
          confirmDanger
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
