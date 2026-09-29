import { useState } from 'react'
import './tag-list.css'

export function TagList({ tags, onAdd, onRemove }: { tags: string[]; onAdd?: (tag: string) => void; onRemove?: (tag: string) => void }) {
  const [input, setInput] = useState('')

  function submit() {
    const t = input.trim().toLowerCase()
    if (!t || tags.includes(t) || !onAdd) {
      setInput('')
      return
    }
    onAdd(t)
    setInput('')
  }

  return (
    <div className="ds-tag-list">
      <div className="ds-tag-list-chips">
        {tags.map((tag) => (
          <span key={tag} className="ds-tag-chip">
            {tag}
            {onRemove && (
              <button type="button" onClick={() => onRemove(tag)} aria-label={`Retirer le tag ${tag}`}>
                ×
              </button>
            )}
          </span>
        ))}
        {tags.length === 0 && <span className="ds-tag-list-empty">Aucun tag</span>}
      </div>
      {onAdd && (
        <div className="ds-tag-list-add">
          <input
            type="text"
            value={input}
            placeholder="Ajouter un tag…"
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />
          <button type="button" onClick={submit}>
            +
          </button>
        </div>
      )}
    </div>
  )
}
