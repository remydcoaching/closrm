'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Zap, Users, Layers, Trash2 } from 'lucide-react'
import type { Workflow, WorkflowStep } from '@/types'

type WorkflowWithSteps = Workflow & { workflow_steps?: WorkflowStep[] }

interface SequencesClientProps {
  initialSequences: WorkflowWithSteps[]
}

const STATUS_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  brouillon: { label: 'Brouillon', color: '#888', bg: 'rgba(136,136,136,0.1)' },
  actif: { label: 'Actif', color: '#00C853', bg: 'rgba(0,200,83,0.1)' },
  inactif: { label: 'Inactif', color: '#E53E3E', bg: 'rgba(229,62,62,0.1)' },
}

export default function SequencesClient({ initialSequences }: SequencesClientProps) {
  const [sequences, setSequences] = useState<WorkflowWithSteps[]>(initialSequences)
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

  async function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    if (!confirm('Supprimer cette séquence ?')) return
    await fetch(`/api/emails/sequences/${id}`, { method: 'DELETE' })
    setSequences(s => s.filter(seq => seq.id !== id))
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#fff', margin: 0 }}>Séquences</h2>
          <p style={{ fontSize: 12, color: '#555', margin: '4px 0 0' }}>
            Séries d&apos;emails automatiques envoyés à intervalles définis
          </p>
        </div>
        <button
          onClick={handleCreate}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '9px 18px',
            fontSize: 13,
            fontWeight: 600,
            background: '#E53E3E',
            color: '#fff',
            border: 'none',
            borderRadius: 10,
            cursor: 'pointer',
          }}
        >
          <Plus size={15} />
          Nouvelle séquence
        </button>
      </div>

      {/* Empty state */}
      {sequences.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: 72,
          background: '#141414',
          borderRadius: 14,
          border: '1px solid #262626',
        }}>
          <div style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            background: 'rgba(229,62,62,0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
          }}>
            <Zap size={22} color="#E53E3E" />
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', marginBottom: 6 }}>
            Aucune séquence
          </div>
          <div style={{ fontSize: 13, color: '#555', marginBottom: 20 }}>
            Crée ta première séquence d&apos;emails automatiques
          </div>
          <button
            onClick={handleCreate}
            style={{
              padding: '8px 20px',
              fontSize: 13,
              fontWeight: 600,
              background: '#E53E3E',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
            }}
          >
            Créer une séquence
          </button>
        </div>
      ) : (
        /* Cards grid */
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: 14,
        }}>
          {sequences.map(seq => {
            const badge = STATUS_BADGE[seq.status] || STATUS_BADGE.brouillon
            const stepsCount = seq.workflow_steps?.length ?? 0

            return (
              <div
                key={seq.id}
                onClick={() => router.push(`/acquisition/emails/sequences/${seq.id}`)}
                style={{
                  background: '#141414',
                  border: '1px solid #262626',
                  borderRadius: 12,
                  padding: '20px 22px',
                  cursor: 'pointer',
                  transition: 'border-color 0.15s, transform 0.15s',
                  position: 'relative',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = '#333'
                  e.currentTarget.style.transform = 'translateY(-1px)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = '#262626'
                  e.currentTarget.style.transform = 'translateY(0)'
                }}
              >
                {/* Top row: name + badge */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                    <span style={{
                      fontSize: 15,
                      fontWeight: 600,
                      color: '#fff',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {seq.name}
                    </span>
                    <span style={{
                      fontSize: 10,
                      fontWeight: 600,
                      padding: '3px 9px',
                      borderRadius: 6,
                      background: badge.bg,
                      color: badge.color,
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                    }}>
                      {badge.label}
                    </span>
                  </div>
                  <button
                    onClick={(e) => handleDelete(e, seq.id)}
                    title="Supprimer"
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 6,
                      border: '1px solid #333',
                      background: 'transparent',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      marginLeft: 8,
                    }}
                  >
                    <Trash2 size={13} color="#666" />
                  </button>
                </div>

                {/* Stats row */}
                <div style={{ display: 'flex', gap: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Layers size={13} color="#555" />
                    <span style={{ fontSize: 12, color: '#888' }}>
                      {stepsCount} étape{stepsCount !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Users size={13} color="#555" />
                    <span style={{ fontSize: 12, color: '#888' }}>
                      {seq.execution_count} inscrit{seq.execution_count !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
