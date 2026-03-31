'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Save, Play, Pause, Loader2 } from 'lucide-react'
import { Workflow, WorkflowStep, WorkflowStepType } from '@/types'
import WorkflowBuilder from '@/components/automations/WorkflowBuilder'
import TriggerConfigPanel from '@/components/automations/TriggerConfigPanel'
import ActionConfigPanel from '@/components/automations/ActionConfigPanel'
import DelayConfigPanel from '@/components/automations/DelayConfigPanel'
import ConditionConfigPanel from '@/components/automations/ConditionConfigPanel'

export default function WorkflowEditorPage() {
  const params = useParams()
  const router = useRouter()
  const workflowId = params.id as string

  const [workflow, setWorkflow] = useState<Workflow | null>(null)
  const [steps, setSteps] = useState<WorkflowStep[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [nameValue, setNameValue] = useState('')

  const fetchWorkflow = useCallback(async () => {
    try {
      const res = await fetch(`/api/workflows/${workflowId}`)
      if (!res.ok) throw new Error('Erreur chargement')
      const json = await res.json()
      const data = json.data
      const { steps: fetchedSteps, ...wf } = data
      setWorkflow(wf as Workflow)
      setSteps(fetchedSteps ?? [])
      setNameValue(wf.name)
    } catch {
      console.error('Erreur chargement workflow')
    } finally {
      setLoading(false)
    }
  }, [workflowId])

  useEffect(() => {
    fetchWorkflow()
  }, [fetchWorkflow])

  const handleSave = async () => {
    if (!workflow) return
    setSaving(true)
    try {
      // Save workflow metadata
      await fetch(`/api/workflows/${workflowId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: nameValue,
          trigger_type: workflow.trigger_type,
          trigger_config: workflow.trigger_config,
        }),
      })

      // Save each step's config
      for (const step of steps) {
        await fetch(`/api/workflows/${workflowId}/steps/${step.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            step_type: step.step_type,
            action_type: step.action_type,
            action_config: step.action_config,
            delay_value: step.delay_value,
            delay_unit: step.delay_unit,
            condition_field: step.condition_field,
            condition_operator: step.condition_operator,
            condition_value: step.condition_value,
            on_true_step: step.on_true_step,
            on_false_step: step.on_false_step,
          }),
        })
      }

      setHasUnsavedChanges(false)
      setWorkflow((prev) => prev ? { ...prev, name: nameValue } : prev)
    } catch {
      console.error('Erreur sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  const handleActivate = async () => {
    if (!workflow) return
    const endpoint = workflow.status === 'actif' ? 'deactivate' : 'activate'
    try {
      const res = await fetch(`/api/workflows/${workflowId}/${endpoint}`, { method: 'POST' })
      if (res.ok) {
        setWorkflow((prev) =>
          prev ? { ...prev, status: endpoint === 'activate' ? 'actif' : 'inactif' } : prev
        )
      }
    } catch {
      console.error('Erreur activation/désactivation')
    }
  }

  const handleAddStep = async (stepType: WorkflowStepType, afterOrder: number) => {
    const newStep: Record<string, unknown> = {
      step_type: stepType,
      step_order: afterOrder + 1,
    }

    if (stepType === 'action') {
      newStep.action_type = 'send_email'
      newStep.action_config = {}
    } else if (stepType === 'delay') {
      newStep.delay_value = 1
      newStep.delay_unit = 'hours'
    } else if (stepType === 'condition') {
      newStep.condition_field = 'status'
      newStep.condition_operator = 'equals'
      newStep.condition_value = ''
    }

    try {
      const res = await fetch(`/api/workflows/${workflowId}/steps`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newStep),
      })
      if (res.ok) {
        await fetchWorkflow()
        setHasUnsavedChanges(true)
      }
    } catch {
      console.error('Erreur ajout étape')
    }
  }

  const handleDeleteStep = async (stepId: string) => {
    try {
      const res = await fetch(`/api/workflows/${workflowId}/steps/${stepId}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        setSteps((prev) => prev.filter((s) => s.id !== stepId))
        if (selectedBlockId === stepId) setSelectedBlockId(null)
        setHasUnsavedChanges(true)
      }
    } catch {
      console.error('Erreur suppression étape')
    }
  }

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          color: 'var(--text-tertiary)',
        }}
      >
        <Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} />
        <span style={{ marginLeft: 8, fontSize: 14 }}>Chargement...</span>
      </div>
    )
  }

  if (!workflow) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          color: 'var(--text-tertiary)',
          fontSize: 14,
        }}
      >
        Workflow introuvable
      </div>
    )
  }

  const selectedStep = selectedBlockId ? steps.find((s) => s.id === selectedBlockId) : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg-primary)' }}>
      {/* Top bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 24px',
          borderBottom: '1px solid var(--border-primary)',
          flexShrink: 0,
        }}
      >
        {/* Left: back + name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => router.back()}
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              border: '1px solid var(--border-primary)',
              background: 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'var(--text-tertiary)',
            }}
          >
            <ArrowLeft size={16} />
          </button>

          {editingName ? (
            <input
              value={nameValue}
              onChange={(e) => {
                setNameValue(e.target.value)
                setHasUnsavedChanges(true)
              }}
              onBlur={() => setEditingName(false)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') setEditingName(false)
              }}
              autoFocus
              style={{
                fontSize: 16,
                fontWeight: 600,
                background: 'transparent',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-primary)',
                borderRadius: 6,
                padding: '4px 8px',
                outline: 'none',
                minWidth: 200,
              }}
            />
          ) : (
            <span
              onClick={() => setEditingName(true)}
              style={{
                fontSize: 16,
                fontWeight: 600,
                color: 'var(--text-primary)',
                cursor: 'text',
              }}
            >
              {nameValue}
            </span>
          )}
        </div>

        {/* Right: status + buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {hasUnsavedChanges && (
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 11,
                color: '#D69E2E',
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: '#D69E2E',
                  display: 'inline-block',
                }}
              />
              Brouillon
            </span>
          )}

          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'var(--border-primary)',
              color: 'var(--text-primary)',
              borderRadius: 8,
              padding: '8px 16px',
              border: 'none',
              fontSize: 13,
              fontWeight: 500,
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={14} />}
            Sauvegarder
          </button>

          <button
            onClick={handleActivate}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: workflow.status === 'actif' ? 'rgba(214,158,46,0.2)' : 'var(--color-primary)',
              color: workflow.status === 'actif' ? '#D69E2E' : '#000',
              borderRadius: 8,
              padding: '8px 16px',
              border: 'none',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {workflow.status === 'actif' ? <Pause size={14} /> : <Play size={14} />}
            {workflow.status === 'actif' ? 'Désactiver' : 'Activer'}
          </button>
        </div>
      </div>

      {/* Main content */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left: builder canvas */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <WorkflowBuilder
            workflow={workflow}
            steps={steps}
            selectedBlockId={selectedBlockId}
            onSelectTrigger={() => setSelectedBlockId(null)}
            onSelectStep={(stepId) => setSelectedBlockId(stepId)}
            onAddStep={handleAddStep}
            onDeleteStep={handleDeleteStep}
          />
        </div>

        {/* Right: config panel */}
        <div
          style={{
            width: 360,
            borderLeft: '1px solid var(--border-primary)',
            background: 'var(--bg-secondary)',
            padding: 24,
            overflowY: 'auto',
            flexShrink: 0,
          }}
        >
          {selectedBlockId === null ? (
            <TriggerConfigPanel
              triggerType={workflow.trigger_type}
              triggerConfig={workflow.trigger_config}
              onChange={(triggerType, triggerConfig) => {
                setWorkflow((prev) => prev ? { ...prev, trigger_type: triggerType, trigger_config: triggerConfig } : prev)
                setHasUnsavedChanges(true)
              }}
            />
          ) : selectedStep ? (
            selectedStep.step_type === 'action' ? (
              <ActionConfigPanel
                step={selectedStep}
                onChange={(updates) => {
                  setSteps((prev) => prev.map((s) => s.id === selectedStep.id ? { ...s, ...updates } : s))
                  setHasUnsavedChanges(true)
                }}
              />
            ) : selectedStep.step_type === 'delay' ? (
              <DelayConfigPanel
                step={selectedStep}
                onChange={(updates) => {
                  setSteps((prev) => prev.map((s) => s.id === selectedStep.id ? { ...s, ...updates } : s))
                  setHasUnsavedChanges(true)
                }}
              />
            ) : (
              <ConditionConfigPanel
                step={selectedStep}
                onChange={(updates) => {
                  setSteps((prev) => prev.map((s) => s.id === selectedStep.id ? { ...s, ...updates } : s))
                  setHasUnsavedChanges(true)
                }}
              />
            )
          ) : (
            <div style={{ fontSize: 13, color: 'var(--text-label)' }}>
              Sélectionnez un élément pour le configurer.
            </div>
          )}
        </div>
      </div>

      {/* Spin animation */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
