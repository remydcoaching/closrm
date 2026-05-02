'use client'

import { useState } from 'react'

interface Props {
  bookingId: string
  token: string
  rescheduleUrl: string | null
  isCancelled: boolean
  isPast: boolean
}

export default function ManageActions({ bookingId, token, rescheduleUrl, isCancelled, isPast }: Props) {
  const [cancelling, setCancelling] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmingCancel, setConfirmingCancel] = useState(false)
  const [done, setDone] = useState<'cancelled' | null>(null)

  if (isCancelled || done === 'cancelled') {
    return (
      <div style={{ textAlign: 'center', padding: '8px 0' }}>
        {rescheduleUrl && (
          <a
            href={rescheduleUrl}
            style={{
              display: 'inline-block',
              padding: '12px 24px',
              background: '#0A0A0A',
              color: '#ffffff',
              textDecoration: 'none',
              borderRadius: 10,
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            Réserver un nouveau créneau
          </a>
        )}
      </div>
    )
  }

  if (isPast) return null

  async function handleCancel() {
    setCancelling(true)
    setError(null)
    try {
      const res = await fetch(`/api/public/bookings/${bookingId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error((json as { error?: string }).error ?? 'Erreur')
      }
      setDone('cancelled')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setCancelling(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {rescheduleUrl && (
        <a
          href={rescheduleUrl}
          style={{
            display: 'block',
            padding: '14px 24px',
            background: '#E53E3E',
            color: '#ffffff',
            textDecoration: 'none',
            borderRadius: 10,
            fontWeight: 600,
            fontSize: 15,
            textAlign: 'center',
            boxShadow: '0 4px 12px rgba(229,62,62,0.25)',
          }}
        >
          Reprogrammer ce rendez-vous
        </a>
      )}

      {!confirmingCancel ? (
        <button
          type="button"
          onClick={() => setConfirmingCancel(true)}
          style={{
            padding: '12px 24px',
            background: 'transparent',
            color: '#6B7280',
            border: '1px solid #E5E7EB',
            borderRadius: 10,
            fontWeight: 500,
            fontSize: 14,
            cursor: 'pointer',
          }}
        >
          Annuler le rendez-vous
        </button>
      ) : (
        <div style={{ padding: '14px 16px', background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 10 }}>
          <p style={{ margin: '0 0 12px', fontSize: 14, color: '#9A3412', fontWeight: 500 }}>
            Êtes-vous sûr·e de vouloir annuler ce rendez-vous ?
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={handleCancel}
              disabled={cancelling}
              style={{
                flex: 1,
                padding: '10px 18px',
                background: '#DC2626',
                color: '#ffffff',
                border: 'none',
                borderRadius: 8,
                fontWeight: 600,
                fontSize: 14,
                cursor: cancelling ? 'wait' : 'pointer',
              }}
            >
              {cancelling ? 'Annulation…' : 'Oui, annuler'}
            </button>
            <button
              type="button"
              onClick={() => setConfirmingCancel(false)}
              disabled={cancelling}
              style={{
                flex: 1,
                padding: '10px 18px',
                background: 'transparent',
                color: '#374151',
                border: '1px solid #E5E7EB',
                borderRadius: 8,
                fontWeight: 500,
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              Garder le RDV
            </button>
          </div>
          {error && <p style={{ margin: '10px 0 0', fontSize: 12, color: '#DC2626' }}>{error}</p>}
        </div>
      )}
    </div>
  )
}
