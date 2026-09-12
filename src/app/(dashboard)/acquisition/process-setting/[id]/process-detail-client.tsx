'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Trash2, GripVertical, Check, Loader2 } from 'lucide-react'
import {
  DndContext, DragEndEvent, PointerSensor, useSensor, useSensors, closestCenter,
} from '@dnd-kit/core'
import {
  SortableContext, arrayMove, useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
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

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: step.id, disabled: !canManage })

  const otherSteps = allSteps.filter((s) => s.id !== step.id)

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        border: '1px solid var(--border-primary)',
        borderRadius: 10,
        background: 'var(--bg-secondary)',
        padding: 16,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <button
          type="button"
          {...(canManage ? attributes : {})}
          {...(canManage ? listeners : {})}
          disabled={!canManage}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: canManage ? 'grab' : 'default',
            color: 'var(--text-secondary)',
            display: 'flex',
          }}
          aria-label="Réordonner l'étape"
        >
          <GripVertical size={16} />
        </button>
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

      <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <label style={{ fontSize: 11, color: 'var(--text-secondary)', marginRight: 8 }}>S&apos;applique à :</label>
          <select
            value={step.applies_to_category ?? 'any'}
            disabled={!canManage}
            onChange={(e) =>
              onUpdate(step.id, {
                applies_to_category: e.target.value === 'any' ? null : (e.target.value as SettingProcessStep['applies_to_category']),
              })
            }
            style={{
              fontSize: 12,
              padding: '4px 8px',
              borderRadius: 6,
              border: '1px solid var(--border-primary)',
              background: 'var(--bg-primary)',
              color: 'var(--text-primary)',
            }}
          >
            <option value="any">Toutes situations (par défaut)</option>
            <option value="premier_contact">Premier contact</option>
            <option value="relance_en_retard">Relance en retard</option>
            <option value="jamais_recontacte">Ancien lead (longue absence)</option>
          </select>
        </div>

      {step.step_type === 'relance' && (
        <div>
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
      </div>

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

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

export default function ProcessDetailClient({ process: initialProcess, canManage }: ProcessDetailClientProps) {
  const router = useRouter()
  const [process, setProcess] = useState(initialProcess)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [reordering, setReordering] = useState(false)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  async function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id || reordering) return

    const oldIndex = process.steps.findIndex((s) => s.id === active.id)
    const newIndex = process.steps.findIndex((s) => s.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    // Optimistic reorder: update the visible order immediately, persist in
    // the background. Step ids never change — only `position` — so
    // next_step_id and transitions (which reference ids) stay valid.
    const reordered = arrayMove(process.steps, oldIndex, newIndex)
    setProcess((prev) => ({ ...prev, steps: reordered }))

    setReordering(true)
    setSaveState('saving')
    try {
      const res = await fetch(`/api/setting-processes/${process.id}/steps/reorder`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reordered.map((step, index) => ({ id: step.id, position: index }))),
      })
      if (!res.ok) throw new Error('reorder failed')
      const { data } = await res.json()
      setProcess((prev) => ({ ...prev, steps: data }))
      setSaveState('saved')
      setTimeout(() => setSaveState('idle'), 1500)
    } catch {
      // Revert to the server's last known order rather than leaving a
      // visible order that silently didn't persist.
      await refetchSteps()
      setSaveState('error')
      setTimeout(() => setSaveState('idle'), 3000)
    } finally {
      setReordering(false)
    }
  }

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
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {saveState !== 'idle' && (
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 12,
                color:
                  saveState === 'error' ? '#E53E3E' : saveState === 'saved' ? '#38A169' : 'var(--text-secondary)',
              }}
            >
              {saveState === 'saving' && <Loader2 size={13} className="animate-spin" />}
              {saveState === 'saved' && <Check size={13} />}
              {saveState === 'saving' ? 'Enregistrement…' : saveState === 'saved' ? 'Enregistré' : "Échec de l'enregistrement"}
            </span>
          )}
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
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={process.steps.map((s) => s.id)} strategy={verticalListSortingStrategy}>
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
        </SortableContext>
      </DndContext>

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
