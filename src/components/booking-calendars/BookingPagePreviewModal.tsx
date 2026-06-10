'use client'

import { useEffect, useState } from 'react'
import { X, Monitor, Tablet, Smartphone } from 'lucide-react'

type Device = 'desktop' | 'tablet' | 'mobile'

interface Props {
  workspaceSlug: string
  calendarSlug: string
  onClose: () => void
}

const DEVICES: { id: Device; label: string; icon: typeof Monitor; width: number; height: number }[] = [
  { id: 'desktop', label: 'Bureau', icon: Monitor, width: 1280, height: 800 },
  { id: 'tablet', label: 'Tablette', icon: Tablet, width: 820, height: 1100 },
  { id: 'mobile', label: 'Mobile', icon: Smartphone, width: 390, height: 800 },
]

export default function BookingPagePreviewModal({ workspaceSlug, calendarSlug, onClose }: Props) {
  const [device, setDevice] = useState<Device>('desktop')

  // Fermer avec Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const url = `/book/${workspaceSlug}/${calendarSlug}`
  const current = DEVICES.find((d) => d.id === device) ?? DEVICES[0]

  // Calcul du scale pour faire tenir le viewport simulé dans la modale.
  // Hauteur dispo ≈ viewport - header (56px) - padding vertical (48px).
  // Largeur dispo ≈ viewport - padding horizontal (48px).
  const availableW = typeof window !== 'undefined' ? window.innerWidth - 96 : 1200
  const availableH = typeof window !== 'undefined' ? window.innerHeight - 160 : 800
  const scale = Math.min(1, availableW / current.width, availableH / current.height)

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(4px)',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      {/* Header */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 1400,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
          gap: 16,
        }}
      >
        <h3 style={{ fontSize: 16, fontWeight: 600, color: '#fff', margin: 0 }}>
          Prévisualisation de la page de réservation
        </h3>

        {/* Switch device */}
        <div
          role="radiogroup"
          aria-label="Type d'appareil"
          style={{
            display: 'inline-flex',
            padding: 3,
            borderRadius: 10,
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
          }}
        >
          {DEVICES.map((d) => {
            const Icon = d.icon
            const isActive = device === d.id
            return (
              <button
                key={d.id}
                type="button"
                role="radio"
                aria-checked={isActive}
                onClick={() => setDevice(d.id)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 12px',
                  fontSize: 13,
                  fontWeight: 500,
                  borderRadius: 7,
                  border: 'none',
                  cursor: 'pointer',
                  background: isActive ? '#fff' : 'transparent',
                  color: isActive ? '#111' : 'rgba(255,255,255,0.85)',
                  transition: 'all 0.15s ease',
                }}
              >
                <Icon size={14} />
                {d.label}
              </button>
            )
          })}
        </div>

        {/* Close */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 36,
            height: 36,
            borderRadius: 8,
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            color: '#fff',
            cursor: 'pointer',
          }}
        >
          <X size={18} />
        </button>
      </div>

      {/* Viewport simulé */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: current.width,
          height: current.height,
          transform: `scale(${scale})`,
          transformOrigin: 'top center',
          borderRadius: device === 'mobile' ? 32 : device === 'tablet' ? 20 : 12,
          overflow: 'hidden',
          background: '#000',
          boxShadow: '0 30px 60px rgba(0,0,0,0.5)',
          border: device === 'desktop' ? '1px solid rgba(255,255,255,0.1)' : '8px solid #1a1a1a',
        }}
      >
        <iframe
          src={url}
          title={`Prévisualisation ${current.label}`}
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            background: '#fff',
          }}
        />
      </div>

      {/* Hint */}
      <p style={{ marginTop: 12, fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>
        Pense à enregistrer pour voir les changements dans la prévisualisation.
      </p>
    </div>
  )
}
