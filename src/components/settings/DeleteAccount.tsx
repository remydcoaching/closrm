'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { AlertTriangle } from 'lucide-react'

interface Props {
  workspaceName: string
}

export default function DeleteAccount({ workspaceName }: Props) {
  const router = useRouter()
  const [showModal, setShowModal] = useState(false)
  const [confirmation, setConfirmation] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isMatch = confirmation === workspaceName

  async function handleDelete() {
    setDeleting(true)
    setError(null)

    try {
      const res = await fetch('/api/user/account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmation }),
      })

      if (!res.ok) {
        const json = await res.json()
        setError(json.error || 'Erreur suppression')
        setDeleting(false)
        return
      }

      // Sign out locally and redirect
      const supabase = createClient()
      await supabase.auth.signOut()
      router.push('/login')
    } catch {
      setError('Erreur lors de la suppression')
      setDeleting(false)
    }
  }

  return (
    <>
      <div
        style={{
          background: '#141416',
          border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: 10,
          padding: 24,
        }}
      >
        <h2 style={{ fontSize: 16, fontWeight: 600, color: '#ef4444', marginBottom: 8 }}>
          Zone dangereuse
        </h2>
        <p style={{ fontSize: 13, color: '#888', marginBottom: 16 }}>
          La suppression de votre compte est irréversible. Toutes vos données seront définitivement supprimées.
        </p>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          style={{
            padding: '8px 16px',
            fontSize: 13,
            fontWeight: 500,
            color: '#fff',
            background: '#ef4444',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
          }}
        >
          Supprimer mon compte
        </button>
      </div>

      {/* Modal */}
      {showModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 200,
          }}
          onClick={() => { if (!deleting) { setShowModal(false); setConfirmation(''); setError(null) } }}
        >
          <div
            style={{
              background: '#141416',
              border: '1px solid rgba(255,255,255,0.10)',
              borderRadius: 12,
              padding: 28,
              width: 440,
              maxWidth: '90vw',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <AlertTriangle size={20} color="#ef4444" />
              <h3 style={{ fontSize: 16, fontWeight: 600, color: '#fff' }}>
                Supprimer votre compte
              </h3>
            </div>

            <p style={{ fontSize: 13, color: '#888', marginBottom: 20, lineHeight: 1.5 }}>
              Cette action est <strong style={{ color: '#ef4444' }}>irréversible</strong>.
              Toutes vos données (leads, appels, follow-ups, workflows, intégrations) seront
              définitivement supprimées.
            </p>

            <p style={{ fontSize: 13, color: '#888', marginBottom: 8 }}>
              Tapez <strong style={{ color: '#fff' }}>{workspaceName}</strong> pour confirmer :
            </p>

            <input
              type="text"
              value={confirmation}
              onChange={(e) => { setConfirmation(e.target.value); setError(null) }}
              placeholder={workspaceName}
              autoFocus
              style={{
                width: '100%',
                padding: '8px 12px',
                fontSize: 14,
                color: '#fff',
                background: '#0f0f11',
                border: '1px solid rgba(255,255,255,0.10)',
                borderRadius: 6,
                outline: 'none',
                marginBottom: 16,
              }}
            />

            {error && (
              <p style={{ fontSize: 13, color: '#ef4444', marginBottom: 12 }}>{error}</p>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => { setShowModal(false); setConfirmation(''); setError(null) }}
                disabled={deleting}
                style={{
                  padding: '8px 16px',
                  fontSize: 13,
                  color: '#888',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.10)',
                  borderRadius: 6,
                  cursor: 'pointer',
                }}
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={!isMatch || deleting}
                style={{
                  padding: '8px 16px',
                  fontSize: 13,
                  fontWeight: 500,
                  color: '#fff',
                  background: isMatch ? '#ef4444' : '#333',
                  border: 'none',
                  borderRadius: 6,
                  cursor: isMatch && !deleting ? 'pointer' : 'not-allowed',
                  opacity: isMatch && !deleting ? 1 : 0.5,
                }}
              >
                {deleting ? 'Suppression...' : 'Supprimer définitivement'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
