'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

function UnsubscribeContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const [status, setStatus] = useState<'confirm' | 'done' | 'error'>('confirm')
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    if (!token) setStatus('error')
  }, [token])

  async function handleUnsubscribe() {
    setProcessing(true)
    const res = await fetch('/api/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
    setProcessing(false)
    setStatus(res.ok ? 'done' : 'error')
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#f4f4f5', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
    }}>
      <div style={{
        background: '#fff', borderRadius: 12, padding: '40px 48px',
        maxWidth: 440, width: '100%', textAlign: 'center',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      }}>
        {status === 'confirm' && (
          <>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111', marginBottom: 8 }}>
              Se désinscrire
            </h1>
            <p style={{ fontSize: 14, color: '#666', marginBottom: 24, lineHeight: 1.5 }}>
              Tu ne recevras plus d&apos;emails marketing de notre part.
              Les emails transactionnels (confirmations de rendez-vous, etc.) continueront.
            </p>
            <button
              onClick={handleUnsubscribe}
              disabled={processing}
              style={{
                padding: '10px 28px', fontSize: 14, fontWeight: 600,
                background: '#E53E3E', color: '#fff', border: 'none',
                borderRadius: 8, cursor: 'pointer', opacity: processing ? 0.6 : 1,
              }}
            >
              {processing ? 'En cours...' : 'Confirmer la désinscription'}
            </button>
          </>
        )}
        {status === 'done' && (
          <>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111', marginBottom: 8 }}>
              C&apos;est fait
            </h1>
            <p style={{ fontSize: 14, color: '#666' }}>
              Tu as été désinscrit avec succès.
            </p>
          </>
        )}
        {status === 'error' && (
          <>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: '#E53E3E', marginBottom: 8 }}>
              Erreur
            </h1>
            <p style={{ fontSize: 14, color: '#666' }}>
              Ce lien de désinscription est invalide ou a expiré.
            </p>
          </>
        )}
      </div>
    </div>
  )
}

export default function UnsubscribePage() {
  return (
    <Suspense fallback={
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#f4f4f5',
      }}>
        <p>Chargement...</p>
      </div>
    }>
      <UnsubscribeContent />
    </Suspense>
  )
}
