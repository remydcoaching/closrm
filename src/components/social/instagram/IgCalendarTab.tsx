'use client'

import { useState } from 'react'
import IgCalendarView from './IgCalendarView'
import IgDraftsList from './IgDraftsList'
import IgHashtagGroups from './IgHashtagGroups'
import IgCaptionTemplates from './IgCaptionTemplates'
import IgBestTime from './IgBestTime'

const SUB_TABS = [
  { key: 'calendar', label: 'Calendrier' },
  { key: 'drafts', label: 'Brouillons' },
  { key: 'scheduled', label: 'Programmés' },
  { key: 'hashtags', label: 'Hashtags' },
  { key: 'templates', label: 'Templates' },
  { key: 'besttime', label: 'Best Time' },
] as const

export default function IgCalendarTab() {
  const [tab, setTab] = useState('calendar')

  return (
    <div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 24 }}>
        {SUB_TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '6px 14px', fontSize: 12, fontWeight: 500,
              color: tab === t.key ? '#fff' : 'var(--text-tertiary)',
              background: tab === t.key ? 'var(--bg-elevated)' : 'transparent',
              border: tab === t.key ? '1px solid var(--border-primary)' : '1px solid transparent',
              borderRadius: 6, cursor: 'pointer',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'calendar' && <IgCalendarView />}
      {tab === 'drafts' && <IgDraftsList status="draft" />}
      {tab === 'scheduled' && <IgDraftsList status="scheduled" />}
      {tab === 'hashtags' && <IgHashtagGroups />}
      {tab === 'templates' && <IgCaptionTemplates />}
      {tab === 'besttime' && <IgBestTime />}
    </div>
  )
}
