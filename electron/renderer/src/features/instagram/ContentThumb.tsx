import { useState } from 'react'
import { safeExternalUrl } from '../../lib/safe-url'

// Instagram CDN thumbnails expire after a few days — fall back to a neutral
// placeholder instead of a broken image.
export function ContentThumb({ url, size = 48 }: { url: string | null; size?: number }) {
  const [broken, setBroken] = useState(false)
  const safe = safeExternalUrl(url)
  const style = { width: size, height: size }
  if (safe && !broken) {
    return <img className="ig-thumb" src={safe} alt="" referrerPolicy="no-referrer" onError={() => setBroken(true)} style={style} />
  }
  return (
    <div className="ig-thumb ig-thumb--placeholder" style={style}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <path d="M21 15l-5-5L5 21" />
      </svg>
    </div>
  )
}
