'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, MessageSquare } from 'lucide-react'
import type { SettingProcess } from '@/types'

interface ProcessSettingClientProps {
  initialProcesses: SettingProcess[]
  canManage: boolean
}

export default function ProcessSettingClient({ initialProcesses, canManage }: ProcessSettingClientProps) {
  const router = useRouter()
  const [processes, setProcesses] = useState<SettingProcess[]>(initialProcesses)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')

  async function handleCreate() {
    if (!newName.trim()) return
    const res = await fetch('/api/setting-processes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim() }),
    })
    if (!res.ok) return
    const { data } = await res.json()
    setProcesses((prev) => [data, ...prev])
    setNewName('')
    setCreating(false)
    router.push(`/acquisition/process-setting/${data.id}`)
  }

  return (
    <div style={{ padding: '24px 32px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Process de setting
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
            Scripts et étapes utilisés pendant les sessions DM.
          </p>
        </div>
        {canManage && (
          <button
            onClick={() => setCreating(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 16px',
              borderRadius: 8,
              border: 'none',
              background: 'var(--color-primary)',
              color: '#fff',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <Plus size={16} />
            Créer un process
          </button>
        )}
      </div>

      {creating && (
        <div
          style={{
            display: 'flex',
            gap: 8,
            marginBottom: 20,
            padding: 16,
            borderRadius: 10,
            border: '1px solid var(--border-primary)',
            background: 'var(--bg-secondary)',
          }}
        >
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            placeholder="Nom du process (ex: Setting Instagram — Transformation)"
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: 6,
              border: '1px solid var(--border-primary)',
              background: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              fontSize: 13,
            }}
          />
          <button
            onClick={handleCreate}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              border: 'none',
              background: 'var(--color-primary)',
              color: '#fff',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Créer
          </button>
          <button
            onClick={() => { setCreating(false); setNewName('') }}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              border: '1px solid var(--border-primary)',
              background: 'transparent',
              color: 'var(--text-secondary)',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Annuler
          </button>
        </div>
      )}

      {processes.length === 0 ? (
        <div
          style={{
            padding: '48px 24px',
            textAlign: 'center',
            borderRadius: 10,
            border: '1px dashed var(--border-primary)',
            color: 'var(--text-secondary)',
          }}
        >
          <MessageSquare size={28} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
          <p style={{ margin: 0, fontSize: 13 }}>
            {canManage
              ? 'Aucun process pour l\'instant — crée le premier pour remplacer les messages par défaut.'
              : "Aucun process n'a encore été configuré."}
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {processes.map((process) => (
            <button
              key={process.id}
              onClick={() => router.push(`/acquisition/process-setting/${process.id}`)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 18px',
                borderRadius: 10,
                border: '1px solid var(--border-primary)',
                background: 'var(--bg-secondary)',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{process.name}</div>
                {process.description && (
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{process.description}</div>
                )}
              </div>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '4px 10px',
                  borderRadius: 20,
                  color: process.status === 'active' ? '#38A169' : 'var(--text-secondary)',
                  background: process.status === 'active' ? 'rgba(56,161,105,0.12)' : 'var(--bg-primary)',
                }}
              >
                {process.status === 'active' ? 'Actif' : 'Inactif'}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
