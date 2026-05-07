'use client'

import { useSearchParams } from 'next/navigation'
import { CheckCircle } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'

export default function BookingConfirmationPage() {
  const searchParams = useSearchParams()
  const dateParam = searchParams.get('date') ?? ''
  const timeParam = searchParams.get('time') ?? ''

  let dateLabel = ''
  try {
    if (dateParam) {
      dateLabel = format(parseISO(dateParam), 'EEEE d MMMM yyyy', { locale: fr })
    }
  } catch {
    dateLabel = dateParam
  }

  return (
    <div
      style={{
        textAlign: 'center',
        padding: '40px 24px',
        maxWidth: '480px',
        margin: '0 auto',
      }}
    >
      <CheckCircle
        size={48}
        style={{ color: '#38A169', margin: '0 auto 24px' }}
      />

      <h1
        style={{
          color: 'var(--text-primary)',
          fontSize: '24px',
          fontWeight: 700,
          marginBottom: '16px',
        }}
      >
        Rendez-vous enregistré !
      </h1>

      {dateLabel && timeParam && (
        <p
          style={{
            color: 'var(--text-secondary)',
            fontSize: '16px',
            marginBottom: '12px',
            textTransform: 'capitalize',
          }}
        >
          {dateLabel} à {timeParam}
        </p>
      )}

      <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.6 }}>
        Vous recevrez un email de confirmation dès que votre coach aura confirmé le rendez-vous.
      </p>
    </div>
  )
}
