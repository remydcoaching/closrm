'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Workflow } from '@/types'

interface SequencesClientProps {
  initialSequences: Workflow[]
}

export default function SequencesClient({ initialSequences }: SequencesClientProps) {
  const [sequences, setSequences] = useState<Workflow[]>(initialSequences)
  const router = useRouter()

  async function handleCreate() {
    const res = await fetch('/api/emails/sequences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Nouvelle séquence' }),
    })
    if (res.ok) {
      const seq = await res.json()
      router.push(`/acquisition/emails/sequences/${seq.id}`)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Supprimer cette séquence ?')) return
    await fetch(`/api/emails/sequences/${id}`, { method: 'DELETE' })
    setSequences(s => s.filter(seq => seq.id !== id))
  }

  const statusBadge = (status: string) => {
    const colors: Record<string, { bg: string; color: string }> = {
      brouillon: { bg: 'rgba(150,150,150,0.1)', color: '#888' },
      actif: { bg: 'rgba(0,200,83,0.1)', color: '#00C853' },
      inactif: { bg: 'rgba(229,62,62,0.1)', color: '#E53E3E' },
    }
    const c = colors[status] || colors.brouillon
    return (
      <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: c.bg, color: c.color }}>
        {status}
      </span>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#fff', margin: 0 }}>Séquences</h2>
          <p style={{ fontSize: 12, color: '#555', margin: '4px 0 0' }}>
            Séries d&apos;emails automatiques envoyés à intervalles définis
          </p>
        </div>
        <button onClick={handleCreate} style={{
          padding: '8px 18px', fontSize: 13, fontWeight: 600,
          background: 'var(--color-primary)', color: '#fff', border: 'none',
          borderRadius: 8, cursor: 'pointer',
        }}>
          + Nouvelle séquence
        </button>
      </div>

      {sequences.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: 60, color: '#555', fontSize: 13,
          background: '#141414', borderRadius: 12, border: '1px solid #262626',
        }}>
          Aucune séquence. Crée ta première séquence d&apos;emails !
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {sequences.map(seq => (
            <div key={seq.id} style={{
              background: '#141414', border: '1px solid #262626', borderRadius: 12,
              padding: '16px 20px', display: 'flex', alignItems: 'center',
              justifyContent: 'space-between', cursor: 'pointer',
            }}
              onClick={() => router.push(`/acquisition/emails/sequences/${seq.id}`)}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>{seq.name}</span>
                  {statusBadge(seq.status)}
                </div>
                <div style={{ fontSize: 12, color: '#555' }}>
                  {seq.execution_count} exécution{seq.execution_count !== 1 ? 's' : ''}
                </div>
              </div>
              <button onClick={e => { e.stopPropagation(); handleDelete(seq.id) }} style={{
                fontSize: 11, color: '#555', background: 'none', border: '1px solid #333',
                borderRadius: 6, padding: '4px 10px', cursor: 'pointer',
              }}>
                Supprimer
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
