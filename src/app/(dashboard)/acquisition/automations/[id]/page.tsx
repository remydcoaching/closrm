'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Save, Play, Pause, Loader2, FlaskConical, ChevronLeft } from 'lucide-react'
import { Workflow, WorkflowStep, WorkflowStepType } from '@/types'
import WorkflowBuilder from '@/components/automations/WorkflowBuilder'
import WorkflowStatusBadge from '@/components/automations/WorkflowStatusBadge'
import TriggerConfigPanel from '@/components/automations/TriggerConfigPanel'
import ActionConfigPanel from '@/components/automations/ActionConfigPanel'
import DelayConfigPanel from '@/components/automations/DelayConfigPanel'
import ConditionConfigPanel from '@/components/automations/ConditionConfigPanel'
import WaitForEventConfigPanel from '@/components/automations/WaitForEventConfigPanel'
import ExecutionHistoryPanel from '@/components/automations/ExecutionHistoryPanel'
import DryRunDialog from '@/components/automations/DryRunDialog'

type RightTab = 'config' | 'history' | 'settings'

const TAB_CONFIG: { key: RightTab; label: string }[] = [
  { key: 'config', label: 'Configuration' },
  { key: 'history', label: 'Historique' },
  { key: 'settings', label: 'Parametres' },
]

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
  const [showDryRun, setShowDryRun] = useState(false)
  const [rightPanelTab, setRightPanelTab] = useState<RightTab>('config')
  const [saveBtnHovered, setSaveBtnHovered] = useState(false)
  const [testBtnHovered, setTestBtnHovered] = useState(false)

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
      await fetch(`/api/workflows/${workflowId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: nameValue,
          trigger_type: workflow.trigger_type,
          trigger_config: workflow.trigger_config,
          notify_on_failure: workflow.notify_on_failure,
          failure_notification_channel: workflow.failure_notification_channel,
        }),
      })

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
      console.error('Erreur activation/desactivation')
    }
  }

  const handleAddStep = async (stepType: WorkflowStepType, afterOrder: number, parentStepId?: string, branch?: string) => {
    const newStep: Record<string, unknown> = {
      step_type: stepType,
      insert_after: afterOrder,
    }

    if (parentStepId) newStep.parent_step_id = parentStepId
    if (branch) newStep.branch = branch

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
    } else if (stepType === 'wait_for_event') {
      newStep.action_config = { event_type: 'before_call', hours_before: 24 }
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
    } catch (err) {
      console.error('Erreur ajout etape', err)
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
      console.error('Erreur suppression etape')
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
          gap: 10,
        }}
      >
        <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
        <span style={{ fontSize: 14 }}>Chargement du workflow...</span>
      </div>
    )
  }

  if (!workflow) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          gap: 16,
        }}
      >
        <div style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>
          Workflow introuvable
        </div>
        <button
          onClick={() => router.push('/acquisition/automations')}
          style={{
            background: 'var(--bg-hover)',
            border: '1px solid var(--border-primary)',
            borderRadius: 8,
            padding: '8px 16px',
            color: 'var(--text-secondary)',
            fontSize: 13,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <ChevronLeft size={14} />
          Retour aux automations
        </button>
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
          padding: '14px 24px',
          borderBottom: '1px solid var(--border-primary)',
          flexShrink: 0,
          background: 'var(--bg-elevated)',
        }}
      >
        {/* Left: back + name + badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button
            onClick={() => router.push('/acquisition/automations')}
            style={{
              width: 34,
              height: 34,
              borderRadius: 8,
              border: '1px solid var(--border-primary)',
              background: 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'var(--text-tertiary)',
              transition: 'all 0.15s',
            }}
          >
            <ArrowLeft size={16} />
          </button>

          <div style={{
            width: 1, height: 24,
            background: 'var(--border-primary)',
          }} />

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
                if (e.key === 'Escape') { setNameValue(workflow.name); setEditingName(false) }
              }}
              autoFocus
              style={{
                fontSize: 15,
                fontWeight: 600,
                background: 'var(--bg-input)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-primary)',
                borderRadius: 8,
                padding: '6px 10px',
                outline: 'none',
                minWidth: 240,
              }}
            />
          ) : (
            <span
              onClick={() => setEditingName(true)}
              style={{
                fontSize: 15,
                fontWeight: 600,
                color: 'var(--text-primary)',
                cursor: 'text',
                padding: '6px 2px',
                borderRadius: 6,
                transition: 'background 0.15s',
              }}
              title="Cliquer pour modifier le nom"
            >
              {nameValue}
            </span>
          )}

          <WorkflowStatusBadge status={workflow.status} />

          {hasUnsavedChanges && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                fontSize: 11,
                color: '#D69E2E',
                fontWeight: 500,
              }}
            >
              <span
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: '50%',
                  background: '#D69E2E',
                }}
              />
              Non sauvegarde
            </span>
          )}
        </div>

        {/* Right: buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={handleSave}
            disabled={saving}
            onMouseEnter={() => setSaveBtnHovered(true)}
            onMouseLeave={() => setSaveBtnHovered(false)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: saveBtnHovered ? 'var(--bg-hover)' : 'var(--bg-primary)',
              color: 'var(--text-primary)',
              borderRadius: 8,
              padding: '8px 16px',
              border: '1px solid var(--border-primary)',
              fontSize: 13,
              fontWeight: 500,
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.6 : 1,
              transition: 'all 0.15s',
            }}
          >
            {saving ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={14} />}
            Sauvegarder
          </button>

          <button
            onClick={() => setShowDryRun(true)}
            onMouseEnter={() => setTestBtnHovered(true)}
            onMouseLeave={() => setTestBtnHovered(false)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: testBtnHovered ? 'rgba(214,158,46,0.08)' : 'transparent',
              color: 'var(--text-secondary)',
              borderRadius: 8,
              padding: '8px 16px',
              border: '1px solid var(--border-primary)',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            <FlaskConical size={14} />
            Tester
          </button>

          <button
            onClick={handleActivate}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: workflow.status === 'actif'
                ? 'rgba(214,158,46,0.12)'
                : '#E53E3E',
              color: workflow.status === 'actif' ? '#D69E2E' : '#fff',
              borderRadius: 8,
              padding: '8px 18px',
              border: workflow.status === 'actif' ? '1px solid rgba(214,158,46,0.25)' : 'none',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {workflow.status === 'actif' ? <Pause size={14} /> : <Play size={14} />}
            {workflow.status === 'actif' ? 'Desactiver' : 'Activer'}
          </button>
        </div>
      </div>

      {/* Main content */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left: builder canvas */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          background: 'var(--bg-primary)',
        }}>
          <WorkflowBuilder
            workflow={workflow}
            steps={steps}
            selectedBlockId={selectedBlockId}
            onSelectTrigger={() => setSelectedBlockId(null)}
            onSelectStep={(stepId) => setSelectedBlockId(stepId)}
            onAddStep={handleAddStep}
            onDeleteStep={handleDeleteStep}
            onReorderSteps={(reordered) => {
              setSteps(reordered)
              setHasUnsavedChanges(true)
            }}
          />
        </div>

        {/* Right: config panel with tabs */}
        <div
          style={{
            width: 380,
            borderLeft: '1px solid var(--border-primary)',
            background: 'var(--bg-elevated)',
            overflowY: 'auto',
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Tab bar */}
          <div style={{
            display: 'flex',
            borderBottom: '1px solid var(--border-primary)',
            flexShrink: 0,
            padding: '0 4px',
          }}>
            {TAB_CONFIG.map(tab => (
              <button
                key={tab.key}
                onClick={() => setRightPanelTab(tab.key)}
                style={{
                  flex: 1,
                  padding: '12px 8px',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: rightPanelTab === tab.key
                    ? '2px solid #E53E3E'
                    : '2px solid transparent',
                  color: rightPanelTab === tab.key ? 'var(--text-primary)' : 'var(--text-label)',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  letterSpacing: '0.01em',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div style={{ padding: 24, flex: 1, overflowY: 'auto' }}>
            {rightPanelTab === 'config' && (
              <>
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
                  ) : selectedStep.step_type === 'wait_for_event' ? (
                    <WaitForEventConfigPanel
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
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '40px 20px',
                    textAlign: 'center',
                  }}>
                    <div style={{
                      width: 48, height: 48, borderRadius: 12,
                      background: 'var(--bg-hover)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      marginBottom: 12,
                    }}>
                      <FlaskConical size={20} style={{ color: 'var(--text-label)' }} />
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                      Selectionnez un element du workflow pour le configurer.
                    </div>
                  </div>
                )}
              </>
            )}

            {rightPanelTab === 'history' && (
              <ExecutionHistoryPanel workflowId={workflowId} />
            )}

            {rightPanelTab === 'settings' && (
              <div>
                <div style={{
                  fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 20,
                }}>
                  Parametres du workflow
                </div>

                {/* Description */}
                <div style={{ marginBottom: 18 }}>
                  <label style={{
                    fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)',
                    marginBottom: 6, display: 'block',
                  }}>
                    Description
                  </label>
                  <textarea
                    value={workflow.description ?? ''}
                    onChange={(e) => {
                      setWorkflow(prev => prev ? { ...prev, description: e.target.value } : prev)
                      setHasUnsavedChanges(true)
                    }}
                    placeholder="Decrivez ce que fait ce workflow..."
                    style={{
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border-primary)',
                      borderRadius: 8,
                      padding: '10px 12px',
                      color: 'var(--text-primary)',
                      fontSize: 13,
                      width: '100%',
                      minHeight: 60,
                      resize: 'vertical' as const,
                      outline: 'none',
                    }}
                  />
                </div>

                {/* Separator */}
                <div style={{
                  borderTop: '1px solid var(--border-primary)',
                  margin: '20px 0',
                }} />

                {/* Notify on failure */}
                <div style={{
                  fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)',
                  marginBottom: 14,
                }}>
                  Notifications
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      fontSize: 13,
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                    }}
                  >
                    <div
                      onClick={() => {
                        setWorkflow(prev => prev ? { ...prev, notify_on_failure: !prev.notify_on_failure } : prev)
                        setHasUnsavedChanges(true)
                      }}
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: 4,
                        border: workflow.notify_on_failure
                          ? '1px solid #E53E3E'
                          : '1px solid var(--border-primary)',
                        background: workflow.notify_on_failure
                          ? 'rgba(229,62,62,0.15)'
                          : 'var(--bg-hover)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                      }}
                    >
                      {workflow.notify_on_failure && (
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <path d="M2.5 6L5 8.5L9.5 3.5" stroke="#E53E3E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                    <span>Notifier en cas d&apos;echec</span>
                  </label>
                </div>

                {workflow.notify_on_failure && (
                  <div style={{ marginBottom: 14, paddingLeft: 28 }}>
                    <label style={{
                      fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)',
                      marginBottom: 6, display: 'block',
                    }}>
                      Canal de notification
                    </label>
                    <select
                      value={workflow.failure_notification_channel ?? ''}
                      onChange={(e) => {
                        setWorkflow(prev => prev ? { ...prev, failure_notification_channel: e.target.value || null } : prev)
                        setHasUnsavedChanges(true)
                      }}
                      style={{
                        background: 'var(--bg-input)',
                        border: '1px solid var(--border-primary)',
                        borderRadius: 8,
                        padding: '10px 12px',
                        color: 'var(--text-primary)',
                        fontSize: 13,
                        width: '100%',
                        appearance: 'none' as const,
                      }}
                    >
                      <option value="">Selectionner...</option>
                      <option value="telegram">Telegram</option>
                      <option value="whatsapp">WhatsApp</option>
                    </select>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Dry Run Dialog */}
        <DryRunDialog
          workflowId={workflowId}
          isOpen={showDryRun}
          onClose={() => setShowDryRun(false)}
        />
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
