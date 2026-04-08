'use client'

/**
 * T-028a — Composant Countdown (E10, toggleable OFF par défaut).
 *
 * Affiche un compte à rebours JJ:HH:MM:SS jusqu'à une date cible. Quand
 * la cible est atteinte, affiche `expiredMessage`.
 *
 * Le rendu est entièrement piloté par le CSS `.fnl-countdown` (cf.
 * src/styles/funnels/effects/e10-countdown.css). Si l'effet n'est pas
 * activé sur le `.fnl-root` parent (classe `.fx-e10-countdown` absente),
 * le composant est caché via `display: none`.
 *
 * Pour la sandbox, on accepte un `target` qui peut être une Date OU un
 * nombre de secondes dans le futur (plus simple à démontrer).
 */

import { useEffect, useState } from 'react'

interface CountdownProps {
  /** Date cible. Peut être un objet Date ou un nombre = secondes dans le futur depuis now. */
  target: Date | number
  /** Texte affiché au-dessus du compteur. Défaut : "L'offre se termine dans" */
  label?: string
  /** Texte affiché quand le compte à rebours est terminé. */
  expiredMessage?: string
}

interface TimeParts {
  days: number
  hours: number
  minutes: number
  seconds: number
}

function getTimeParts(diffMs: number): TimeParts {
  const totalSec = Math.max(0, Math.floor(diffMs / 1000))
  return {
    days: Math.floor(totalSec / 86400),
    hours: Math.floor((totalSec % 86400) / 3600),
    minutes: Math.floor((totalSec % 3600) / 60),
    seconds: totalSec % 60,
  }
}

function pad(n: number): string {
  return n.toString().padStart(2, '0')
}

export function Countdown({
  target,
  label = "L'offre se termine dans",
  expiredMessage = "L'offre est terminée.",
}: CountdownProps) {
  // Résolution lazy de la cible : si on reçoit un nombre, on le convertit en Date
  // au montage pour avoir une cible stable (pas recalculée à chaque rerender)
  const [targetDate] = useState<Date>(() =>
    typeof target === 'number' ? new Date(Date.now() + target * 1000) : target
  )

  const [parts, setParts] = useState<TimeParts>(() =>
    getTimeParts(targetDate.getTime() - Date.now())
  )
  const [expired, setExpired] = useState<boolean>(
    () => targetDate.getTime() <= Date.now()
  )

  useEffect(() => {
    if (expired) return

    const tick = () => {
      const diff = targetDate.getTime() - Date.now()
      if (diff <= 0) {
        setExpired(true)
        setParts({ days: 0, hours: 0, minutes: 0, seconds: 0 })
        return
      }
      setParts(getTimeParts(diff))
    }

    tick() // run once immédiatement pour synchro
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [targetDate, expired])

  if (expired) {
    return (
      <div className="fnl-countdown">
        <span className="fnl-countdown-label">{expiredMessage}</span>
      </div>
    )
  }

  return (
    <div className="fnl-countdown">
      <span className="fnl-countdown-label">{label}</span>
      <div className="fnl-countdown-boxes">
        <CountdownBox value={pad(parts.days)} unit="jours" />
        <span className="fnl-countdown-separator">:</span>
        <CountdownBox value={pad(parts.hours)} unit="heures" />
        <span className="fnl-countdown-separator">:</span>
        <CountdownBox value={pad(parts.minutes)} unit="min" />
        <span className="fnl-countdown-separator">:</span>
        <CountdownBox value={pad(parts.seconds)} unit="sec" />
      </div>
    </div>
  )
}

function CountdownBox({ value, unit }: { value: string; unit: string }) {
  return (
    <div className="fnl-countdown-box">
      <span className="fnl-countdown-value">{value}</span>
      <span className="fnl-countdown-unit">{unit}</span>
    </div>
  )
}
