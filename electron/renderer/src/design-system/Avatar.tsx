import './avatar.css'

export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')

  return (
    <div className="ds-avatar" style={{ width: size, height: size, fontSize: size * 0.38 }}>
      {initials || '?'}
    </div>
  )
}
