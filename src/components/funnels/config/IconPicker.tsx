'use client'

// T-048 — Sélecteur d'icônes Lucide pour le contenu des blocs (cartes
// Problèmes/Programme, colonnes Qualifier). Jeu curaté plutôt qu'une
// recherche libre : évite de complexifier l'éditeur pour un usage occasionnel.

import { useState } from 'react'
import {
  CheckCircle2, XCircle, Target, TrendingUp, TrendingDown, Dumbbell, Utensils,
  Clock, Brain, Heart, Zap, Award, Users, Calendar, BarChart3, Flame,
  ShieldCheck, Star, ThumbsUp, AlertTriangle, Compass, Rocket, Trophy, Scale,
  Activity, Lightbulb, Timer, Sun, Moon, MapPin, Sparkles, Smile, Frown,
  Battery, Gauge, Salad,
  type LucideIcon,
} from 'lucide-react'

export const ICON_PICKER_ICONS: Record<string, LucideIcon> = {
  CheckCircle2, XCircle, Target, TrendingUp, TrendingDown, Dumbbell, Utensils,
  Clock, Brain, Heart, Zap, Award, Users, Calendar, BarChart3, Flame,
  ShieldCheck, Star, ThumbsUp, AlertTriangle, Compass, Rocket, Trophy, Scale,
  Activity, Lightbulb, Timer, Sun, Moon, MapPin, Sparkles, Smile, Frown,
  Battery, Gauge, Salad,
}

interface Props {
  value: { name: string } | null | undefined
  onChange: (icon: { name: string } | null) => void
}

export default function IconPicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const SelectedIcon = value?.name ? ICON_PICKER_ICONS[value.name] : null

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, width: '100%',
          padding: '7px 10px', fontSize: 12, background: 'var(--bg-input)',
          border: '1px solid var(--border-primary)', borderRadius: 8,
          color: 'var(--text-primary)', cursor: 'pointer',
        }}
      >
        {SelectedIcon ? (
          <SelectedIcon size={16} />
        ) : (
          <span style={{ width: 16, height: 16, display: 'inline-block', border: '1px dashed var(--border-secondary)', borderRadius: 4 }} />
        )}
        <span>{value?.name || 'Aucune icône'}</span>
      </button>

      {open && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 10 }}
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div
            style={{
              position: 'absolute', top: '100%', left: 0, marginTop: 4, zIndex: 11,
              display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 4,
              padding: 8, background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)',
              borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
              width: 240,
            }}
          >
            <button
              type="button"
              onClick={() => { onChange(null); setOpen(false) }}
              title="Aucune icône"
              style={iconBtnStyle(!value?.name)}
            >
              <XCircle size={16} />
            </button>
            {Object.entries(ICON_PICKER_ICONS).map(([name, Icon]) => (
              <button
                key={name}
                type="button"
                onClick={() => { onChange({ name }); setOpen(false) }}
                title={name}
                style={iconBtnStyle(value?.name === name)}
              >
                <Icon size={16} />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function iconBtnStyle(active: boolean): React.CSSProperties {
  return {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 32, height: 32, borderRadius: 6, cursor: 'pointer',
    background: active ? 'var(--bg-active)' : 'transparent',
    border: active ? '1px solid var(--color-primary)' : '1px solid transparent',
    color: 'var(--text-primary)',
  }
}
