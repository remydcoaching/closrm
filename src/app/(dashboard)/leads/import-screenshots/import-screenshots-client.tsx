'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import UploadStep from '@/components/leads/import-screenshots/UploadStep'
import ReviewStep from '@/components/leads/import-screenshots/ReviewStep'

interface ImportResult {
  handle: string
  already_exists: boolean
  existing_lead_id?: string
}

type Step = 'upload' | 'extracting' | 'review' | 'done'

export default function ImportScreenshotsClient() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('upload')
  const [results, setResults] = useState<ImportResult[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<{ created: number; follow_ups_created: number } | null>(null)

  async function handleImagesReady(images: string[]) {
    setStep('extracting')
    setError(null)
    try {
      const res = await fetch('/api/leads/import-from-screenshots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error?.toString() ?? 'Erreur extraction')
      setResults(json.results ?? [])
      setStep('review')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur extraction')
      setStep('upload')
    }
  }

  async function handleConfirm(payload: {
    handles: string[]
    create_follow_up: boolean
    follow_up_delay_days: number
    follow_up_reason: string
  }) {
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/leads/import-from-screenshots/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error?.toString() ?? 'Erreur création')
      setSummary({ created: json.created, follow_ups_created: json.follow_ups_created })
      setStep('done')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur création')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: 24 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
        Importer depuis screenshots Instagram
      </h1>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
        Capture le centre de notifications Instagram, on détecte les nouveaux followers automatiquement.
      </p>

      {error && (
        <div style={{ padding: 10, background: '#ef444422', color: '#ef4444', borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
          {error}
        </div>
      )}

      {step === 'upload' && <UploadStep onImagesReady={handleImagesReady} />}

      {step === 'extracting' && (
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Analyse des captures en cours…</p>
      )}

      {step === 'review' && (
        <ReviewStep results={results} onConfirm={handleConfirm} submitting={submitting} />
      )}

      {step === 'done' && summary && (
        <div>
          <p style={{ fontSize: 14, color: 'var(--text-primary)', marginBottom: 12 }}>
            {summary.created} lead{summary.created > 1 ? 's' : ''} créé{summary.created > 1 ? 's' : ''}
            {summary.follow_ups_created > 0 ? ` · ${summary.follow_ups_created} relance${summary.follow_ups_created > 1 ? 's' : ''} programmée${summary.follow_ups_created > 1 ? 's' : ''}` : ''}.
          </p>
          <button
            onClick={() => router.push('/leads')}
            style={{
              padding: '10px 20px', borderRadius: 8, fontSize: 14, fontWeight: 600,
              background: 'var(--color-primary)', color: '#000', border: 'none', cursor: 'pointer',
            }}
          >
            Retour aux leads
          </button>
        </div>
      )}
    </div>
  )
}
