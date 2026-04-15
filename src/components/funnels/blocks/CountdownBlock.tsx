'use client'

/**
 * T-028c — CountdownBlock migré vers le design system v2.
 *
 * Garde sa propre logique de tick (computeTimeLeft / setInterval) — c'est
 * un composant historique avec son propre style en boxes inline. On NE
 * réutilise PAS le `<Countdown />` de T-028a (qui est destiné aux nouveaux
 * usages via le toggle E10) parce que le format historique a une `targetDate`
 * sous forme de string ISO et un `expiredMessage` configurable côté coach.
 *
 * Adopte le langage visuel :
 * - chiffres en `--fnl-primary` au lieu de `#111`
 * - séparateurs `:` en `--fnl-primary` opacité 0.5 (au lieu de `#ccc`)
 * - labels en `--fnl-text-secondary` (au lieu de `#888`)
 * - cards en boxes teintées `rgba(--fnl-primary-rgb, 0.1)` avec border arrondi
 * - typo Poppins 900 sur les chiffres + tabular-nums pour éviter le saut de largeur
 *
 * L'effet E10 toggleable (qui contrôle l'affichage via `.fx-e10-countdown`)
 * reste destiné à des usages "next gen" via le composant `<Countdown />` de T-028a.
 * Ce CountdownBlock historique reste toujours visible — il sert au coach qui
 * veut un compte à rebours sans avoir à activer un effet global.
 */

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
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 84,
        padding: '14px 10px',
        background:
          'linear-gradient(135deg, rgba(var(--fnl-primary-rgb), 0.15) 0%, rgba(var(--fnl-primary-rgb), 0.05) 100%)',
        border: '1px solid rgba(var(--fnl-primary-rgb), 0.25)',
        borderRadius: 14,
        boxShadow: '0 4px 20px rgba(var(--fnl-primary-rgb), 0.12)',
      }}
    >
      <div
        style={{
          fontSize: 44,
          fontWeight: 900,
          color: 'var(--fnl-primary)',
          fontFamily: 'Poppins, sans-serif',
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: 11,
          color: 'var(--fnl-text-secondary)',
          marginTop: 8,
          textTransform: 'uppercase',
          letterSpacing: 1,
          fontWeight: 600,
        }}
      >
        {label}
      </div>
    </div>
  )
}

const SEPARATOR_STYLE: React.CSSProperties = {
  fontSize: 36,
  fontWeight: 900,
  color: 'var(--fnl-primary)',
  opacity: 0.4,
  alignSelf: 'flex-start',
  marginTop: 16,
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

  // État vide : pas de date configurée
  if (!config.targetDate) {
    return (
      <div
        style={{
          padding: '40px 20px',
          textAlign: 'center',
          color: 'var(--fnl-text-secondary)',
          fontSize: 14,
        }}
      >
        Aucune date cible configurée
      </div>
    )
  }

  // État expiré : afficher juste le message
  if (!timeLeft) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center' }}>
        {config.title && (
          <h2
            style={{
              fontSize: 28,
              fontWeight: 800,
              color: 'var(--fnl-primary)',
              margin: '0 0 16px',
            }}
          >
            {config.title}
          </h2>
        )}
        <p style={{ fontSize: 18, color: 'var(--fnl-text-secondary)' }}>
          {config.expiredMessage || 'Cette offre a expiré.'}
        </p>
      </div>
    )
  }

  return (
    <div style={{ padding: '50px 20px', textAlign: 'center' }}>
      {config.title && (
        <h2
          style={{
            fontSize: 28,
            fontWeight: 800,
            color: 'var(--fnl-primary)',
            margin: '0 0 32px',
            lineHeight: 1.3,
          }}
        >
          {config.title}
        </h2>
      )}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <TimeUnit value={pad(timeLeft.days)} label="Jours" />
        <div style={SEPARATOR_STYLE}>:</div>
        <TimeUnit value={pad(timeLeft.hours)} label="Heures" />
        <div style={SEPARATOR_STYLE}>:</div>
        <TimeUnit value={pad(timeLeft.minutes)} label="Minutes" />
        <div style={SEPARATOR_STYLE}>:</div>
        <TimeUnit value={pad(timeLeft.seconds)} label="Secondes" />
      </div>
    </div>
  )
}
