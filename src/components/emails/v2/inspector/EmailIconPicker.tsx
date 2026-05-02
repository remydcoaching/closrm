'use client'

import { useState, useMemo } from 'react'
import { Search, X } from 'lucide-react'
import { EMAIL_ICONS, EMAIL_ICON_CATEGORIES, type EmailIcon } from '@/lib/email/icons'

interface Props {
  value: string
  onChange: (iconId: string) => void
}

export default function EmailIconPicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<string | null>(null)

  const selectedIcon = EMAIL_ICONS.find((i) => i.id === value)

  const filtered = useMemo(() => {
    let icons = EMAIL_ICONS
    if (activeCategory) {
      icons = icons.filter((i) => i.category === activeCategory)
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      icons = icons.filter(
        (i) =>
          i.label.toLowerCase().includes(q) ||
          i.id.toLowerCase().includes(q) ||
          i.category.toLowerCase().includes(q),
      )
    }
    return icons
  }, [search, activeCategory])

  const grouped = useMemo(() => {
    if (activeCategory || search.trim()) return null
    const map = new Map<string, EmailIcon[]>()
    for (const icon of filtered) {
      const arr = map.get(icon.category) || []
      arr.push(icon)
      map.set(icon.category, arr)
    }
    return map
  }, [filtered, activeCategory, search])

  function handleSelect(icon: EmailIcon) {
    onChange(icon.id)
    setOpen(false)
    setSearch('')
    setActiveCategory(null)
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        style={{
          width: '100%',
          padding: '9px 11px',
          fontSize: 12.5,
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 7,
          color: '#eee',
          cursor: 'pointer',
          fontFamily: 'inherit',
          boxSizing: 'border-box',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          transition: 'border-color 0.12s',
          textAlign: 'left',
        }}
      >
        {selectedIcon ? (
          <>
            <span
              style={{ display: 'flex', alignItems: 'center', color: 'rgba(255,255,255,0.7)' }}
              dangerouslySetInnerHTML={{
                __html: renderPickerSvg(selectedIcon, 'currentColor', 18),
              }}
            />
            <span style={{ flex: 1, fontSize: 12, color: '#ccc' }}>{selectedIcon.label}</span>
          </>
        ) : (
          <span style={{ flex: 1, fontSize: 12, color: '#666' }}>Choisir une icône</span>
        )}
        <Search size={12} style={{ color: '#555', flexShrink: 0 }} />
      </button>

      {open && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 90 }}
            onClick={() => {
              setOpen(false)
              setSearch('')
              setActiveCategory(null)
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 4px)',
              left: 0,
              right: 0,
              zIndex: 91,
              background: '#141414',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 10,
              boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
              maxHeight: 380,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Search */}
            <div style={{ padding: '8px 10px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 10px',
                  background: 'rgba(255,255,255,0.04)',
                  borderRadius: 6,
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                <Search size={12} style={{ color: '#555', flexShrink: 0 }} />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher..."
                  autoFocus
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    color: '#eee',
                    fontSize: 12,
                    fontFamily: 'inherit',
                  }}
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#555',
                      cursor: 'pointer',
                      padding: 0,
                      display: 'flex',
                    }}
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>

            {/* Category tabs */}
            <div
              style={{
                display: 'flex',
                gap: 3,
                padding: '6px 10px',
                overflowX: 'auto',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                flexShrink: 0,
              }}
            >
              <CategoryTab
                label="Tout"
                active={activeCategory === null}
                onClick={() => setActiveCategory(null)}
              />
              {EMAIL_ICON_CATEGORIES.map((cat) => (
                <CategoryTab
                  key={cat}
                  label={cat}
                  active={activeCategory === cat}
                  onClick={() => setActiveCategory(cat)}
                />
              ))}
            </div>

            {/* Icon grid */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 10 }}>
              {grouped
                ? Array.from(grouped.entries()).map(([category, icons]) => (
                    <div key={category} style={{ marginBottom: 12 }}>
                      <div
                        style={{
                          fontSize: 9,
                          fontWeight: 700,
                          color: '#555',
                          textTransform: 'uppercase',
                          letterSpacing: 0.5,
                          marginBottom: 6,
                          paddingLeft: 2,
                        }}
                      >
                        {category}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 3 }}>
                        {icons.map((icon) => (
                          <IconButton
                            key={icon.id}
                            icon={icon}
                            selected={icon.id === value}
                            onClick={() => handleSelect(icon)}
                          />
                        ))}
                      </div>
                    </div>
                  ))
                : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 3 }}>
                    {filtered.map((icon) => (
                      <IconButton
                        key={icon.id}
                        icon={icon}
                        selected={icon.id === value}
                        onClick={() => handleSelect(icon)}
                      />
                    ))}
                  </div>
                )}
              {filtered.length === 0 && (
                <div
                  style={{ textAlign: 'center', padding: 20, color: '#555', fontSize: 12 }}
                >
                  Aucune icône trouvée
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function IconButton({
  icon,
  selected,
  onClick,
}: {
  icon: EmailIcon
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={icon.label}
      style={{
        width: '100%',
        aspectRatio: '1',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 6,
        border: selected ? '1.5px solid #3b82f6' : '1px solid transparent',
        background: selected ? 'rgba(59,130,246,0.12)' : 'transparent',
        cursor: 'pointer',
        color: selected ? '#3b82f6' : 'rgba(255,255,255,0.6)',
        transition: 'all 0.1s',
        padding: 0,
      }}
      onMouseEnter={(e) => {
        if (!selected) {
          e.currentTarget.style.background = 'rgba(255,255,255,0.06)'
          e.currentTarget.style.color = '#fff'
        }
      }}
      onMouseLeave={(e) => {
        if (!selected) {
          e.currentTarget.style.background = 'transparent'
          e.currentTarget.style.color = 'rgba(255,255,255,0.6)'
        }
      }}
    >
      <span
        dangerouslySetInnerHTML={{
          __html: renderPickerSvg(icon, 'currentColor', 18),
        }}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      />
    </button>
  )
}

function CategoryTab({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '4px 10px',
        fontSize: 10,
        fontWeight: 600,
        borderRadius: 50,
        border: 'none',
        background: active ? 'rgba(255,255,255,0.12)' : 'transparent',
        color: active ? '#fff' : '#666',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        transition: 'all 0.12s',
      }}
    >
      {label}
    </button>
  )
}

function renderPickerSvg(icon: EmailIcon, color: string, size: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${icon.path}"/></svg>`
}
