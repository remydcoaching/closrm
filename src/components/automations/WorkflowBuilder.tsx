'use client'

import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Workflow, WorkflowStep, WorkflowStepType } from '@/types'
import TriggerBlock from './TriggerBlock'
import StepBlock from './StepBlock'
import StepConnector from './StepConnector'
import AddStepButton from './AddStepButton'

interface Props {
  workflow: Workflow
  steps: WorkflowStep[]
  selectedBlockId: string | null
  onSelectTrigger: () => void
  onSelectStep: (stepId: string) => void
  onAddStep: (stepType: WorkflowStepType, afterOrder: number, parentStepId?: string, branch?: string) => void
  onDeleteStep: (stepId: string) => void
  onReorderSteps?: (reordered: WorkflowStep[]) => void
}

function SortableStep({
  step,
  selected,
  onClick,
  onDelete,
}: {
  step: WorkflowStep
  selected: boolean
  onClick: () => void
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: step.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : 0,
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <StepBlock
        step={step}
        selected={selected}
        onClick={onClick}
        onDelete={onDelete}
        dragHandleRef={setActivatorNodeRef}
        dragHandleListeners={listeners}
      />
    </div>
  )
}

/** Render a branch column (true or false) for a condition step */
function BranchColumn({
  label,
  color,
  steps: branchSteps,
  conditionStepId,
  branch,
  selectedBlockId,
  onSelectStep,
  onDeleteStep,
  onAddStep,
}: {
  label: string
  color: string
  steps: WorkflowStep[]
  conditionStepId: string
  branch: 'true' | 'false'
  selectedBlockId: string | null
  onSelectStep: (id: string) => void
  onDeleteStep: (id: string) => void
  onAddStep: (stepType: WorkflowStepType, afterOrder: number, parentStepId?: string, branch?: string) => void
}) {
  const sorted = [...branchSteps].sort((a, b) => a.step_order - b.step_order)
  const lastOrder = sorted.length > 0 ? sorted[sorted.length - 1].step_order : 0

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      flex: 1, minWidth: 200,
    }}>
      {/* Branch label */}
      <div style={{
        fontSize: 11, fontWeight: 700, color, textTransform: 'uppercase',
        letterSpacing: '0.1em', marginBottom: 8,
        padding: '3px 10px', borderRadius: 4,
        background: `${color}18`,
      }}>
        {label}
      </div>

      <StepConnector />

      {sorted.map((step) => (
        <div key={step.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <StepBlock
            step={step}
            selected={selectedBlockId === step.id}
            onClick={() => onSelectStep(step.id)}
            onDelete={() => onDeleteStep(step.id)}
          />
          <StepConnector />
        </div>
      ))}

      <AddStepButton onAdd={(stepType) => onAddStep(stepType, lastOrder, conditionStepId, branch)} />
    </div>
  )
}

export default function WorkflowBuilder({
  workflow,
  steps,
  selectedBlockId,
  onSelectTrigger,
  onSelectStep,
  onAddStep,
  onDeleteStep,
  onReorderSteps,
}: Props) {
  // Main flow = steps without a parent (branch = 'main' or null)
  const mainSteps = steps
    .filter(s => !s.parent_step_id)
    .sort((a, b) => a.step_order - b.step_order)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = mainSteps.findIndex(s => s.id === active.id)
    const newIndex = mainSteps.findIndex(s => s.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const reordered = arrayMove(mainSteps, oldIndex, newIndex).map((s, i) => ({
      ...s,
      step_order: i + 1,
    }))

    // Merge back with branch steps (unchanged)
    const branchSteps = steps.filter(s => s.parent_step_id)
    onReorderSteps?.([...reordered, ...branchSteps])
  }

  function getBranchSteps(conditionStepId: string, branch: 'true' | 'false'): WorkflowStep[] {
    return steps.filter(s => s.parent_step_id === conditionStepId && s.branch === branch)
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '40px 0',
        minHeight: '100%',
      }}
    >
      {/* Trigger */}
      <TriggerBlock
        triggerType={workflow.trigger_type}
        triggerConfig={workflow.trigger_config}
        selected={selectedBlockId === null}
        onClick={onSelectTrigger}
      />

      <StepConnector />

      {/* Add before first step */}
      <AddStepButton onAdd={(stepType) => onAddStep(stepType, 0)} />

      {/* Main steps with drag & drop */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={mainSteps.map(s => s.id)} strategy={verticalListSortingStrategy}>
          {mainSteps.map((step) => (
            <div
              key={step.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                width: '100%',
              }}
            >
              <StepConnector />

              <SortableStep
                step={step}
                selected={selectedBlockId === step.id}
                onClick={() => onSelectStep(step.id)}
                onDelete={() => onDeleteStep(step.id)}
              />

              {/* Render branches if this is a condition */}
              {step.step_type === 'condition' && (
                <>
                  <StepConnector />
                  <div style={{
                    display: 'flex', gap: 24, width: '100%',
                    justifyContent: 'center', position: 'relative',
                  }}>
                    {/* Horizontal connector line */}
                    <div style={{
                      position: 'absolute', top: 0, left: '25%', right: '25%',
                      height: 2, background: 'var(--border-primary)',
                    }} />

                    <BranchColumn
                      label="Oui"
                      color="#00C853"
                      steps={getBranchSteps(step.id, 'true')}
                      conditionStepId={step.id}
                      branch="true"
                      selectedBlockId={selectedBlockId}
                      onSelectStep={onSelectStep}
                      onDeleteStep={onDeleteStep}
                      onAddStep={onAddStep}
                    />
                    <BranchColumn
                      label="Non"
                      color="#E53E3E"
                      steps={getBranchSteps(step.id, 'false')}
                      conditionStepId={step.id}
                      branch="false"
                      selectedBlockId={selectedBlockId}
                      onSelectStep={onSelectStep}
                      onDeleteStep={onDeleteStep}
                      onAddStep={onAddStep}
                    />
                  </div>
                </>
              )}

              <StepConnector />

              {/* Add after this step */}
              <AddStepButton
                onAdd={(stepType) => onAddStep(stepType, step.step_order)}
              />
            </div>
          ))}
        </SortableContext>
      </DndContext>
    </div>
  )
}
