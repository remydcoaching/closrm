import { useState } from 'react'
import './avatar.css'

// Photo when available (Instagram profile pic), initials otherwise — and
// initials again if the remote image fails (IG CDN URLs expire).
export function Avatar({ name, size = 36, src }: { name: string; size?: number; src?: string | null }) {
  const [broken, setBroken] = useState(false)
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')

  if (src && !broken) {
    return (
      <img
        className="ds-avatar ds-avatar--photo"
        src={src}
        alt=""
        referrerPolicy="no-referrer"
        onError={() => setBroken(true)}
        style={{ width: size, height: size }}
      />
    )
  }

  return (
    <div className="ds-avatar" style={{ width: size, height: size, fontSize: size * 0.38 }}>
      {initials || '?'}
    </div>
  )
}
