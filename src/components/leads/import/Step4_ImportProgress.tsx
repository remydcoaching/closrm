'use client'

import { useState, useEffect, useRef } from 'react'
import { Loader2, CheckCircle2 } from 'lucide-react'
import type { WizardState } from '@/app/(dashboard)/leads/import/import-client'
import type { LeadImportBatch } from '@/types'

interface Props {
  state: WizardState
  updateState: (partial: Partial<WizardState>) => void
  onNext: () => void
}

const CHUNK_SIZE = 2000

export default function Step4_ImportProgress({ state, updateState, onNext }: Props) {
  const [progress, setProgress] = useState(0)
  const [statusText, setStatusText] = useState("Préparation de l'import...")
  const [done, setDone] = useState(false)
  const [hasError, setHasError] = useState(false)
  const startedRef = useRef(false)

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true

    const runImport = async () => {
      const totalRows = state.mappedRows.length
      const chunks: Record<string, string>[][] = []
      for (let i = 0; i < totalRows; i += CHUNK_SIZE) {
        chunks.push(state.mappedRows.slice(i, i + CHUNK_SIZE))
      }

      let batchId: string | null = null

      for (let c = 0; c < chunks.length; c++) {
        setStatusText(chunks.length > 1
          ? `Import en cours... (lot ${c + 1}/${chunks.length})`
          : 'Import en cours...'
        )

        const res: Response = await fetch('/api/leads/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rows: chunks[c],
            config: state.config,
            fileName: state.fileName,
            ...(batchId ? { batchId } : {}),
          }),
        })

        const json: { data?: { id: string }; error?: string } = await res.json()
        if (!res.ok) {
          setStatusText(`Erreur au lot ${c + 1} : ${json.error}`)
          setHasError(true)
          return
        }

        // First chunk creates the batch, subsequent chunks reuse it
        if (!batchId) {
          batchId = json.data!.id
        }

        setProgress(Math.round(((c + 1) / chunks.length) * 100))
      }

      // Fetch final consolidated batch state
      if (batchId) {
        const res = await fetch(`/api/leads/import/${batchId}`)
        const json = await res.json()
        if (res.ok) {
          updateState({ batch: json.data as LeadImportBatch })
        }
      }

      setProgress(100)
      setStatusText('Import terminé !')
      setDone(true)
    }

    runImport()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div style={{ textAlign: 'center', padding: '40px 0' }}>
      {done ? (
        <CheckCircle2 size={48} color="#38A169" style={{ marginBottom: 16 }} />
      ) : (
        <Loader2 size={48} color="var(--color-primary)" style={{ animation: 'spin 1s linear infinite', marginBottom: 16 }} />
      )}
      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>

      <p style={{ fontSize: 16, fontWeight: 600, color: hasError ? '#E53E3E' : 'var(--text-primary)', marginBottom: 8 }}>
        {statusText}
      </p>

      <div style={{
        width: 400, maxWidth: '100%', height: 8, borderRadius: 4,
        background: 'var(--border-primary)', margin: '0 auto 12px',
        overflow: 'hidden',
      }}>
        <div style={{
          width: `${progress}%`, height: '100%', borderRadius: 4,
          background: hasError ? '#E53E3E' : done ? '#38A169' : 'var(--color-primary)',
          transition: 'width 0.5s ease',
        }} />
      </div>

      <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
        {progress}%
        {state.totalRows > 1000 && !done && !hasError && (
          <span> — cela peut prendre quelques secondes</span>
        )}
      </p>

      {done && (
        <button onClick={onNext} style={{
          marginTop: 24, padding: '10px 24px', borderRadius: 8, fontSize: 14, fontWeight: 600,
          background: 'var(--color-primary)', border: 'none', color: '#000', cursor: 'pointer',
        }}>
          Voir le récapitulatif
        </button>
      )}
    </div>
  )
}
