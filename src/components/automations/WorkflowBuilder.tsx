'use client'

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
  onAddStep: (stepType: WorkflowStepType, afterOrder: number) => void
  onDeleteStep: (stepId: string) => void
}

export default function WorkflowBuilder({
  workflow,
  steps,
  selectedBlockId,
  onSelectTrigger,
  onSelectStep,
  onAddStep,
  onDeleteStep,
}: Props) {
  const sortedSteps = [...steps].sort((a, b) => a.step_order - b.step_order)

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

      {/* Steps */}
      {sortedSteps.map((step, index) => (
        <div
          key={step.id}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <StepBlock
            step={step}
            selected={selectedBlockId === step.id}
            onClick={() => onSelectStep(step.id)}
            onDelete={() => onDeleteStep(step.id)}
          />

          <StepConnector />

          <AddStepButton
            onAdd={(stepType) => onAddStep(stepType, step.step_order)}
          />

          {index < sortedSteps.length - 1 && <StepConnector />}
        </div>
      ))}

      {/* Final add button (when no steps or after last step) */}
      {sortedSteps.length === 0 && (
        <AddStepButton onAdd={(stepType) => onAddStep(stepType, 0)} />
      )}
    </div>
  )
}
