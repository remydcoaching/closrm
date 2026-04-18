'use client'

import { Sparkles } from 'lucide-react'

export default function YtInsightsTab() {
  return (
    <div style={{
      textAlign: 'center', padding: 60,
      background: 'var(--bg-secondary)', borderRadius: 12, border: '1px solid var(--border-primary)',
    }}>
      <Sparkles size={32} style={{ color: 'var(--text-muted)', marginBottom: 12, opacity: 0.4 }} />
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
        Insights & Best time to post
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
        Disponible dans une prochaine itération (heures optimales, suggestions IA).
      </div>
    </div>
  )
}
