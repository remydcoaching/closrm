'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, LayoutTemplate } from 'lucide-react'
import { PlanningTemplate } from '@/types'
import TemplateCard from '@/components/templates/TemplateCard'
import ConfirmModal from '@/components/shared/ConfirmModal'

export default function TemplatesPage() {
  const router = useRouter()
  const [templates, setTemplates] = useState<PlanningTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  async function fetchTemplates() {
    try {
      const res = await fetch('/api/planning-templates')
      if (!res.ok) throw new Error('Impossible de charger les templates')
      const json = await res.json()
      setTemplates(json.data ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTemplates()
  }, [])

  async function handleCreate() {
    setCreating(true)
    try {
      const res = await fetch('/api/planning-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Nouveau template', blocks: [] }),
      })
      if (res.ok) {
        const json = await res.json()
        router.push(`/agenda/templates/${json.data.id}`)
      }
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/planning-templates/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setTemplates(prev => prev.filter(t => t.id !== id))
    }
    setDeleteTarget(null)
  }

  if (loading) {
    return (
      <div style={{ padding: 32 }}>
        <p style={{ color: 'var(--text-tertiary)', fontSize: 14 }}>Chargement...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: 32 }}>
        <p style={{ color: '#ef4444', fontSize: 14 }}>{error}</p>
      </div>
    )
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 960 }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 24,
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: 'var(--text-primary)',
              margin: 0,
            }}
          >
            Templates de planning
          </h1>
          <p
            style={{
              fontSize: 13,
              color: 'var(--text-tertiary)',
              margin: '4px 0 0',
            }}
          >
            Créez des plannings types et importez-les sur votre agenda
          </p>
        </div>
        <button
          onClick={handleCreate}
          disabled={creating}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'var(--color-primary)',
            border: 'none',
            borderRadius: 8,
            padding: '9px 16px',
            fontSize: 13,
            fontWeight: 600,
            color: '#fff',
            cursor: creating ? 'not-allowed' : 'pointer',
            opacity: creating ? 0.6 : 1,
            transition: 'opacity 0.15s ease',
          }}
        >
          <Plus size={15} strokeWidth={2.5} />
          {creating ? 'Création...' : 'Nouveau template'}
        </button>
      </div>

      {/* Empty state */}
      {templates.length === 0 && (
        <div
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-primary)',
            borderRadius: 12,
            padding: '56px 32px',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: 'var(--bg-active)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
            }}
          >
            <LayoutTemplate size={22} style={{ color: 'var(--color-primary)' }} />
          </div>
          <p
            style={{
              color: 'var(--text-primary)',
              fontSize: 15,
              fontWeight: 600,
              margin: '0 0 6px',
            }}
          >
            Aucun template
          </p>
          <p
            style={{
              color: 'var(--text-tertiary)',
              fontSize: 13,
              margin: '0 0 20px',
              maxWidth: 340,
              marginLeft: 'auto',
              marginRight: 'auto',
            }}
          >
            Créez votre premier template de planning pour l&apos;importer rapidement sur votre agenda.
          </p>
          <button
            onClick={handleCreate}
            disabled={creating}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: 'var(--color-primary)',
              border: 'none',
              borderRadius: 8,
              padding: '9px 18px',
              fontSize: 13,
              fontWeight: 600,
              color: '#fff',
              cursor: creating ? 'not-allowed' : 'pointer',
            }}
          >
            <Plus size={15} strokeWidth={2.5} />
            Créer un template
          </button>
        </div>
      )}

      {/* Grid */}
      {templates.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: 14,
          }}
        >
          {templates.map(template => (
            <TemplateCard
              key={template.id}
              template={template}
              onEdit={id => router.push(`/agenda/templates/${id}`)}
              onDelete={id => setDeleteTarget(id)}
            />
          ))}
        </div>
      )}

      {/* Delete confirm modal */}
      {deleteTarget && (
        <ConfirmModal
          title="Supprimer le template"
          message="Cette action est irréversible. Le template sera définitivement supprimé."
          confirmLabel="Supprimer"
          confirmDanger
          onConfirm={() => handleDelete(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
