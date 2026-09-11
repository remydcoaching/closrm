'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Trash2, GripVertical } from 'lucide-react'
import type { SettingProcessWithSteps, SettingProcessStep } from '@/types'

interface ProcessDetailClientProps {
  process: SettingProcessWithSteps
  canManage: boolean
}

function StepCard({
  step,
  index,
  allSteps,
  canManage,
  onUpdate,
  onDelete,
  onAddTransition,
}: {
  step: SettingProcessStep
  index: number
  allSteps: SettingProcessStep[]
  canManage: boolean
  onUpdate: (stepId: string, patch: Partial<SettingProcessStep>) => void
  onDelete: (stepId: string) => void
  onAddTransition: (stepId: string, outcomeLabel: string, targetStepId: string) => void
}) {
  const [content, setContent] = useState(step.content)
  const [showTransitionForm, setShowTransitionForm] = useState(false)
  const [transitionLabel, setTransitionLabel] = useState('')
  const [transitionTarget, setTransitionTarget] = useState('')

  const otherSteps = allSteps.filter((s) => s.id !== step.id)

  return (
    <div
      style={{
        border: '1px solid var(--border-primary)',
        borderRadius: 10,
        background: 'var(--bg-secondary)',
        padding: 16,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <GripVertical size={16} color="var(--text-secondary)" />
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}>ÉTAPE {index + 1}</span>
        {canManage ? (
          <input
            value={step.title}
            onChange={(e) => onUpdate(step.id, { title: e.target.value })}
            style={{
              flex: 1,
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--text-primary)',
              background: 'transparent',
              border: 'none',
              outline: 'none',
            }}
          />
        ) : (
          <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{step.title}</span>
        )}
        <select
          value={step.step_type}
          disabled={!canManage}
          onChange={(e) => onUpdate(step.id, { step_type: e.target.value as 'message' | 'relance' })}
          style={{
            fontSize: 11,
            padding: '3px 8px',
            borderRadius: 20,
            border: '1px solid var(--border-primary)',
            background: 'var(--bg-primary)',
            color: 'var(--text-secondary)',
          }}
        >
          <option value="message">Message</option>
          <option value="relance">Relance</option>
        </select>
        {canManage && (
          <button
            onClick={() => onDelete(step.id)}
            title="Supprimer l'étape"
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>

      {step.step_type === 'relance' && (
        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 11, color: 'var(--text-secondary)', marginRight: 8 }}>Délai (jours) :</label>
          <input
            type="number"
            min={1}
            disabled={!canManage}
            value={step.delay_days ?? ''}
            onChange={(e) => onUpdate(step.id, { delay_days: e.target.value ? Number(e.target.value) : null })}
            style={{
              width: 60,
              padding: '4px 8px',
              borderRadius: 6,
              border: '1px solid var(--border-primary)',
              background: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              fontSize: 12,
            }}
          />
        </div>
      )}

      {canManage ? (
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onBlur={() => { if (content !== step.content) onUpdate(step.id, { content }) }}
          rows={4}
          placeholder="Contenu du message — utilise {{prenom}} pour personnaliser"
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: 8,
            border: '1px solid var(--border-primary)',
            background: 'var(--bg-primary)',
            color: 'var(--text-primary)',
            fontSize: 13,
            fontFamily: 'inherit',
            resize: 'vertical',
          }}
        />
      ) : (
        <p style={{ fontSize: 13, color: 'var(--text-primary)', whiteSpace: 'pre-wrap', margin: 0 }}>{step.content}</p>
      )}

      {step.transitions && step.transitions.length > 0 && (
        <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {step.transitions.map((t) => {
            const target = allSteps.find((s) => s.id === t.target_step_id)
            return (
              <span
                key={t.id}
                style={{
                  fontSize: 11,
                  padding: '4px 10px',
                  borderRadius: 20,
                  border: '1px solid var(--border-primary)',
                  color: 'var(--text-secondary)',
                }}
              >
                {t.outcome_label} → {target?.title ?? '?'}
              </span>
            )
          })}
        </div>
      )}

      {canManage && (
        <div style={{ marginTop: 10 }}>
          {showTransitionForm ? (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input
                value={transitionLabel}
                onChange={(e) => setTransitionLabel(e.target.value)}
                placeholder="Ex: répondu"
                style={{
                  width: 120,
                  padding: '5px 8px',
                  borderRadius: 6,
                  border: '1px solid var(--border-primary)',
                  background: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  fontSize: 12,
                }}
              />
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>→</span>
              <select
                value={transitionTarget}
                onChange={(e) => setTransitionTarget(e.target.value)}
                style={{
                  padding: '5px 8px',
                  borderRadius: 6,
                  border: '1px solid var(--border-primary)',
                  background: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  fontSize: 12,
                }}
              >
                <option value="">Choisir l&apos;étape...</option>
                {otherSteps.map((s) => (
                  <option key={s.id} value={s.id}>{s.title}</option>
                ))}
              </select>
              <button
                onClick={() => {
                  if (!transitionLabel.trim() || !transitionTarget) return
                  onAddTransition(step.id, transitionLabel.trim(), transitionTarget)
                  setTransitionLabel('')
                  setTransitionTarget('')
                  setShowTransitionForm(false)
                }}
                style={{
                  padding: '5px 10px',
                  borderRadius: 6,
                  border: 'none',
                  background: 'var(--color-primary)',
                  color: '#fff',
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                Ajouter
              </button>
              <button
                onClick={() => setShowTransitionForm(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer' }}
              >
                Annuler
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowTransitionForm(true)}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer', padding: 0 }}
            >
              + Ajouter une sortie (ex: si le prospect répond)
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default function ProcessDetailClient({ process: initialProcess, canManage }: ProcessDetailClientProps) {
  const router = useRouter()
  const [process, setProcess] = useState(initialProcess)

  async function refetchSteps() {
    const res = await fetch(`/api/setting-processes/${process.id}`)
    if (!res.ok) return
    const { data } = await res.json()
    setProcess(data)
  }

  async function handleToggleStatus() {
    const nextStatus = process.status === 'active' ? 'inactive' : 'active'
    const res = await fetch(`/api/setting-processes/${process.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus }),
    })
    if (res.ok) {
      const { data } = await res.json()
      setProcess((prev) => ({ ...prev, status: data.status }))
    }
  }

  async function handleAddStep() {
    const res = await fetch(`/api/setting-processes/${process.id}/steps`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: `Étape ${process.steps.length + 1}`,
        step_type: process.steps.length === 0 ? 'message' : 'relance',
        content: '',
        delay_days: process.steps.length === 0 ? undefined : 2,
      }),
    })
    if (res.ok) refetchSteps()
  }

  async function handleUpdateStep(stepId: string, patch: Partial<SettingProcessStep>) {
    const res = await fetch(`/api/setting-processes/${process.id}/steps/${stepId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    if (res.ok) refetchSteps()
  }

  async function handleDeleteStep(stepId: string) {
    const res = await fetch(`/api/setting-processes/${process.id}/steps/${stepId}`, { method: 'DELETE' })
    if (res.ok) refetchSteps()
  }

  async function handleAddTransition(stepId: string, outcomeLabel: string, targetStepId: string) {
    const res = await fetch(`/api/setting-processes/${process.id}/steps/${stepId}/transitions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ outcome_label: outcomeLabel, target_step_id: targetStepId }),
    })
    if (res.ok) refetchSteps()
  }

  return (
    <div style={{ padding: '24px 32px', maxWidth: 720 }}>
      <button
        onClick={() => router.push('/acquisition/process-setting')}
        style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', border: 'none', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer', marginBottom: 16, padding: 0 }}
      >
        <ArrowLeft size={14} />
        Retour aux process
      </button>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{process.name}</h1>
          {process.description && (
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '4px 0 0' }}>{process.description}</p>
          )}
        </div>
        {canManage && (
          <button
            onClick={handleToggleStatus}
            style={{
              fontSize: 12,
              fontWeight: 700,
              padding: '6px 14px',
              borderRadius: 20,
              border: '1px solid var(--border-primary)',
              cursor: 'pointer',
              color: process.status === 'active' ? '#38A169' : 'var(--text-secondary)',
              background: process.status === 'active' ? 'rgba(56,161,105,0.12)' : 'var(--bg-secondary)',
            }}
          >
            {process.status === 'active' ? 'Actif — désactiver' : 'Inactif — activer'}
          </button>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {process.steps.map((step, index) => (
          <StepCard
            key={step.id}
            step={step}
            index={index}
            allSteps={process.steps}
            canManage={canManage}
            onUpdate={handleUpdateStep}
            onDelete={handleDeleteStep}
            onAddTransition={handleAddTransition}
          />
        ))}
      </div>

      {canManage && (
        <button
          onClick={handleAddStep}
          style={{
            marginTop: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 16px',
            borderRadius: 8,
            border: '1px dashed var(--border-primary)',
            background: 'transparent',
            color: 'var(--text-secondary)',
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          <Plus size={16} />
          Ajouter une étape
        </button>
      )}
    </div>
  )
}
