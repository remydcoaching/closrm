'use client'

import { useState } from 'react'
import { TemplateBlock, DayOfWeek } from '@/types'
import BlockModal from './BlockModal'

interface TemplateWeekEditorProps {
  blocks: TemplateBlock[]
  onChange: (blocks: TemplateBlock[]) => void
}

const CELL_HEIGHT = 48
const START_HOUR = 7
const END_HOUR = 21
const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => i + START_HOUR)
const TOTAL_HEIGHT = HOURS.length * CELL_HEIGHT
const HOUR_COL_WIDTH = 60

const DAY_KEYS: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
const DAY_LABELS: Record<DayOfWeek, string> = {
  monday: 'Lun',
  tuesday: 'Mar',
  wednesday: 'Mer',
  thursday: 'Jeu',
  friday: 'Ven',
  saturday: 'Sam',
  sunday: 'Dim',
}

const GRID_BORDER = '1px solid var(--agenda-grid-border, rgba(128,128,128,0.15))'

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

function getBlockPosition(block: TemplateBlock) {
  const startMin = timeToMinutes(block.start)
  const endMin = timeToMinutes(block.end)
  const top = (startMin - START_HOUR * 60) / 60 * CELL_HEIGHT
  const height = Math.max((endMin - startMin) / 60 * CELL_HEIGHT, 16)
  return { top, height }
}

// Round a pixel offset to the nearest 30-min slot time string
function slotFromOffset(offsetY: number): string {
  const totalMinutesFromStart = Math.floor(offsetY / (CELL_HEIGHT / 2)) * 30
  const h = Math.floor(totalMinutesFromStart / 60) + START_HOUR
  const m = totalMinutesFromStart % 60
  const clampedH = Math.max(START_HOUR, Math.min(END_HOUR - 1, h))
  return `${String(clampedH).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

interface EditState {
  block: TemplateBlock
  index: number
}

interface AddState {
  day: DayOfWeek
  start: string
}

export default function TemplateWeekEditor({ blocks, onChange }: TemplateWeekEditorProps) {
  const [editState, setEditState] = useState<EditState | null>(null)
  const [addState, setAddState] = useState<AddState | null>(null)

  function handleBlockClick(e: React.MouseEvent, block: TemplateBlock, index: number) {
    e.stopPropagation()
    setEditState({ block, index })
    setAddState(null)
  }

  function handleCellClick(e: React.MouseEvent, day: DayOfWeek) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const offsetY = e.clientY - rect.top
    const start = slotFromOffset(offsetY)
    setAddState({ day, start })
    setEditState(null)
  }

  function handleSaveEdit(updated: TemplateBlock) {
    if (!editState) return
    const next = [...blocks]
    next[editState.index] = updated
    onChange(next)
    setEditState(null)
  }

  function handleDeleteEdit() {
    if (!editState) return
    const next = blocks.filter((_, i) => i !== editState.index)
    onChange(next)
    setEditState(null)
  }

  function handleSaveAdd(newBlock: TemplateBlock) {
    onChange([...blocks, newBlock])
    setAddState(null)
  }

  function closeModal() {
    setEditState(null)
    setAddState(null)
  }

  return (
    <div style={{ overflowX: 'auto', userSelect: 'none' }}>
      <div style={{ minWidth: 560 }}>
        {/* Day headers */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: `${HOUR_COL_WIDTH}px repeat(7, 1fr)`,
          borderBottom: '2px solid var(--border-secondary)',
          position: 'sticky',
          top: 0,
          zIndex: 5,
          background: 'var(--bg-primary)',
        }}>
          <div style={{ borderRight: GRID_BORDER }} />
          {DAY_KEYS.map(day => (
            <div
              key={day}
              style={{
                textAlign: 'center',
                padding: '8px 0',
                borderRight: GRID_BORDER,
                fontSize: 12,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'var(--text-secondary)',
              }}
            >
              {DAY_LABELS[day]}
            </div>
          ))}
        </div>

        {/* Time grid + blocks overlay */}
        <div style={{ position: 'relative' }}>
          {/* Grid lines */}
          <div style={{ display: 'grid', gridTemplateColumns: `${HOUR_COL_WIDTH}px repeat(7, 1fr)` }}>
            {HOURS.map(hour => (
              <div key={hour} style={{ display: 'contents' }}>
                {/* Hour label */}
                <div style={{
                  height: CELL_HEIGHT,
                  padding: '0 8px 0 0',
                  textAlign: 'right',
                  fontSize: 10,
                  fontWeight: 500,
                  color: 'var(--text-secondary)',
                  borderRight: GRID_BORDER,
                  borderBottom: GRID_BORDER,
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'flex-end',
                  paddingTop: 3,
                }}>
                  {String(hour).padStart(2, '0')}:00
                </div>
                {/* Day cells */}
                {DAY_KEYS.map(day => (
                  <div
                    key={`${day}-${hour}`}
                    style={{
                      height: CELL_HEIGHT,
                      position: 'relative',
                      cursor: 'pointer',
                      borderRight: GRID_BORDER,
                      borderBottom: GRID_BORDER,
                    }}
                    onClick={e => handleCellClick(e, day)}
                  >
                    <div style={{
                      height: '50%',
                      borderBottom: '1px dashed rgba(128,128,128,0.08)',
                    }} />
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* Blocks overlay */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: HOUR_COL_WIDTH,
            right: 0,
            bottom: 0,
            pointerEvents: 'none',
            height: TOTAL_HEIGHT,
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', height: '100%' }}>
              {DAY_KEYS.map(day => {
                const dayBlocks = blocks
                  .map((b, i) => ({ ...b, _index: i }))
                  .filter(b => b.day === day)
                return (
                  <div key={day} style={{ position: 'relative', pointerEvents: 'none' }}>
                    {dayBlocks.map(b => {
                      const pos = getBlockPosition(b)
                      return (
                        <div
                          key={b._index}
                          onClick={e => handleBlockClick(e, b, b._index)}
                          style={{
                            position: 'absolute',
                            top: pos.top,
                            height: pos.height,
                            left: 2,
                            right: 2,
                            background: b.color,
                            borderRadius: 4,
                            cursor: 'pointer',
                            pointerEvents: 'all',
                            overflow: 'hidden',
                            padding: '3px 5px',
                            boxSizing: 'border-box',
                            opacity: 0.9,
                            transition: 'opacity 0.1s',
                          }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '1' }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '0.9' }}
                        >
                          <div style={{
                            fontSize: 10,
                            fontWeight: 700,
                            color: '#fff',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            lineHeight: 1.3,
                          }}>
                            {b.title}
                          </div>
                          {pos.height >= 30 && (
                            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.8)', lineHeight: 1.3 }}>
                              {b.start}–{b.end}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Edit modal */}
      {editState && (
        <BlockModal
          block={editState.block}
          day={editState.block.day}
          onSave={handleSaveEdit}
          onDelete={handleDeleteEdit}
          onClose={closeModal}
        />
      )}

      {/* Add modal */}
      {addState && (
        <BlockModal
          block={null}
          day={addState.day}
          onSave={handleSaveAdd}
          onClose={closeModal}
        />
      )}
    </div>
  )
}
