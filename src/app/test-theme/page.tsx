'use client'

import { useState } from 'react'

export default function TestTheme() {
  const [current, setCurrent] = useState('?')

  function toggle() {
    const el = document.documentElement
    const now = el.getAttribute('data-theme')
    const next = now === 'light' ? 'dark' : 'light'
    el.setAttribute('data-theme', next)
    setCurrent(next)
  }

  function check() {
    const el = document.documentElement
    const dt = el.getAttribute('data-theme')
    const bg = getComputedStyle(el).getPropertyValue('--bg-primary').trim()
    setCurrent(`data-theme="${dt}" | --bg-primary="${bg}"`)
  }

  return (
    <div style={{ padding: 40, background: 'var(--bg-primary)', color: 'var(--text-primary)', minHeight: '100vh' }}>
      <h1 style={{ fontSize: 24, marginBottom: 20 }}>Test Theme</h1>
      <button onClick={toggle} style={{ padding: '10px 20px', fontSize: 16, cursor: 'pointer', marginRight: 10 }}>
        Toggle Theme
      </button>
      <button onClick={check} style={{ padding: '10px 20px', fontSize: 16, cursor: 'pointer' }}>
        Check State
      </button>
      <p style={{ marginTop: 20, fontSize: 14 }}>{current}</p>
      <div style={{ marginTop: 20, padding: 20, background: 'var(--bg-elevated)', border: '1px solid var(--border-secondary)', borderRadius: 8 }}>
        Card test (bg-elevated)
      </div>
    </div>
  )
}
