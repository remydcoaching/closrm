'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import ImportStepper from '@/components/leads/import/ImportStepper'
import Step1_UploadPreview from '@/components/leads/import/Step1_UploadPreview'
import Step2_MappingConfig from '@/components/leads/import/Step2_MappingConfig'
import Step3_PreviewDiff from '@/components/leads/import/Step3_PreviewDiff'
import Step4_ImportProgress from '@/components/leads/import/Step4_ImportProgress'
import Step5_Recap from '@/components/leads/import/Step5_Recap'
import type { ColumnMapping } from '@/lib/leads/csv-parser'
import type { ImportConfig, ImportPreviewResult, LeadImportBatch } from '@/types'

export interface WizardState {
  // Step 1
  fileName: string
  headers: string[]
  rows: Record<string, string>[]
  totalRows: number
  detectedDelimiter: string
  columnMappings: ColumnMapping[]
  // Step 2
  config: ImportConfig
  mappedRows: Record<string, string>[]
  // Step 3
  previewResult: ImportPreviewResult | null
  // Step 4-5
  batch: LeadImportBatch | null
}

const INITIAL_CONFIG: ImportConfig = {
  mapping: {},
  default_source: null,
  default_status: 'nouveau',
  batch_tags: [],
  dedup_strategy: 'email',
  dedup_action: 'skip',
  status_value_mapping: {},
  source_value_mapping: {},
}

export default function ImportClient() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [state, setState] = useState<WizardState>({
    fileName: '',
    headers: [],
    rows: [],
    totalRows: 0,
    detectedDelimiter: ',',
    columnMappings: [],
    config: INITIAL_CONFIG,
    mappedRows: [],
    previewResult: null,
    batch: null,
  })

  const updateState = (
    updater: Partial<WizardState> | ((prev: WizardState) => Partial<WizardState>),
  ) => {
    setState((prev) => {
      const partial = typeof updater === 'function' ? updater(prev) : updater
      return { ...prev, ...partial }
    })
  }

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
          Importer des leads
        </h1>
        <button
          onClick={() => router.push('/leads')}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 14px', borderRadius: 8, fontSize: 13,
            background: 'transparent', border: '1px solid var(--border-primary)',
            color: 'var(--text-secondary)', cursor: 'pointer',
          }}
        >
          <X size={14} />
          Annuler
        </button>
      </div>

      <ImportStepper currentStep={step} />

      {step === 0 && (
        <Step1_UploadPreview
          state={state}
          updateState={updateState}
          onNext={() => setStep(1)}
        />
      )}
      {step === 1 && (
        <Step2_MappingConfig
          state={state}
          updateState={updateState}
          onBack={() => setStep(0)}
          onNext={() => setStep(2)}
        />
      )}
      {step === 2 && (
        <Step3_PreviewDiff
          state={state}
          updateState={updateState}
          onBack={() => setStep(1)}
          onNext={() => setStep(3)}
        />
      )}
      {step === 3 && (
        <Step4_ImportProgress
          state={state}
          updateState={updateState}
          onNext={() => setStep(4)}
        />
      )}
      {step === 4 && (
        <Step5_Recap
          state={state}
          updateState={updateState}
        />
      )}
    </div>
  )
}
