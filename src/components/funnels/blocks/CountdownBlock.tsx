'use client'

import { useState, useEffect } from 'react'
import type { CountdownBlockConfig } from '@/types'

interface Props {
  config: CountdownBlockConfig
}

interface TimeLeft {
  days: number
  hours: number
  minutes: number
  seconds: number
}

function computeTimeLeft(targetDate: string): TimeLeft | null {
  const diff = new Date(targetDate).getTime() - Date.now()
  if (diff <= 0) return null
  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
  }
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function TimeUnit({ value, label }: { value: string; label: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{
        fontSize: 42,
        fontWeight: 800,
        color: '#111',
        fontVariantNumeric: 'tabular-nums',
        lineHeight: 1,
      }}>
        {value}
      </div>
      <div style={{ fontSize: 12, color: '#888', marginTop: 6, textTransform: 'uppercase', letterSpacing: 1 }}>
        {label}
      </div>
    </div>
  )
}

export default function CountdownBlock({ config }: Props) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(() =>
    config.targetDate ? computeTimeLeft(config.targetDate) : null
  )

  useEffect(() => {
    if (!config.targetDate) return
    const id = setInterval(() => {
      setTimeLeft(computeTimeLeft(config.targetDate))
    }, 1000)
    return () => clearInterval(id)
  }, [config.targetDate])

  if (!config.targetDate) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center', color: '#999' }}>
        Aucune date cible configurée
      </div>
    )
  }

  if (!timeLeft) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center' }}>
        {config.title && (
          <h2 style={{ fontSize: 24, fontWeight: 700, color: '#111', margin: '0 0 16px' }}>{config.title}</h2>
        )}
        <p style={{ fontSize: 18, color: '#555' }}>
          {config.expiredMessage || 'Cette offre a expiré.'}
        </p>
      </div>
    )
  }

  return (
    <div style={{ padding: '40px 20px', textAlign: 'center' }}>
      {config.title && (
        <h2 style={{ fontSize: 24, fontWeight: 700, color: '#111', margin: '0 0 24px' }}>{config.title}</h2>
      )}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 24 }}>
        <TimeUnit value={pad(timeLeft.days)} label="Jours" />
        <div style={{ fontSize: 36, fontWeight: 700, color: '#ccc', alignSelf: 'flex-start', marginTop: 2 }}>:</div>
        <TimeUnit value={pad(timeLeft.hours)} label="Heures" />
        <div style={{ fontSize: 36, fontWeight: 700, color: '#ccc', alignSelf: 'flex-start', marginTop: 2 }}>:</div>
        <TimeUnit value={pad(timeLeft.minutes)} label="Minutes" />
        <div style={{ fontSize: 36, fontWeight: 700, color: '#ccc', alignSelf: 'flex-start', marginTop: 2 }}>:</div>
        <TimeUnit value={pad(timeLeft.seconds)} label="Secondes" />
      </div>
    </div>
  )
}
