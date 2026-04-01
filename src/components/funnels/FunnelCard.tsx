'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, FileText } from 'lucide-react'

interface FunnelData {
  id: string
  name: string
  status: 'draft' | 'published'
  page_count: number
  created_at: string
}

interface Props {
  funnel: FunnelData
  onDelete: (id: string) => void
}

export default function FunnelCard({ funnel, onDelete }: Props) {
  const router = useRouter()
  const [hovered, setHovered] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const isPublished = funnel.status === 'published'
  const date = new Date(funnel.created_at).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'short', year: 'numeric',
  })

  return (
    <div
      onClick={() => router.push(`/acquisition/funnels/${funnel.id}`)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setConfirmDelete(false) }}
      style={{
        background: '#141414',
        border: '1px solid',
        borderColor: hovered ? '#333' : '#262626',
        borderRadius: 12,
        padding: 20,
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        position: 'relative',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          background: isPublished ? 'rgba(56,161,105,0.12)' : 'rgba(255,255,255,0.05)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <FileText size={18} color={isPublished ? '#38A169' : '#555'} />
        </div>
        <span style={{
          padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
          background: isPublished ? 'rgba(56,161,105,0.12)' : 'rgba(255,255,255,0.06)',
          color: isPublished ? '#38A169' : '#888',
        }}>
          {isPublished ? 'Publie' : 'Brouillon'}
        </span>
      </div>

      {/* Name */}
      <div style={{ fontSize: 15, fontWeight: 600, color: '#fff', marginBottom: 4 }}>
        {funnel.name}
      </div>

      {/* Meta */}
      <div style={{ fontSize: 12, color: '#666', display: 'flex', gap: 12 }}>
        <span>{funnel.page_count} page{funnel.page_count > 1 ? 's' : ''}</span>
        <span>{date}</span>
      </div>

      {/* Delete button */}
      {hovered && (
        <div style={{ position: 'absolute', top: 16, right: 16 }}>
          {confirmDelete ? (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <button
                onClick={e => { e.stopPropagation(); onDelete(funnel.id) }}
                style={{
                  padding: '4px 10px', fontSize: 11, fontWeight: 600,
                  background: '#E53E3E', color: '#fff', border: 'none',
                  borderRadius: 6, cursor: 'pointer',
                }}
              >
                Supprimer
              </button>
              <button
                onClick={e => { e.stopPropagation(); setConfirmDelete(false) }}
                style={{
                  padding: '4px 10px', fontSize: 11,
                  background: '#262626', color: '#aaa', border: 'none',
                  borderRadius: 6, cursor: 'pointer',
                }}
              >
                Annuler
              </button>
            </div>
          ) : (
            <button
              onClick={e => { e.stopPropagation(); setConfirmDelete(true) }}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 28, height: 28, borderRadius: 6,
                background: 'rgba(255,255,255,0.04)', border: '1px solid #333',
                color: '#666', cursor: 'pointer', padding: 0,
              }}
              onMouseEnter={e => { e.currentTarget.style.color = '#E53E3E'; e.currentTarget.style.borderColor = '#E53E3E' }}
              onMouseLeave={e => { e.currentTarget.style.color = '#666'; e.currentTarget.style.borderColor = '#333' }}
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
