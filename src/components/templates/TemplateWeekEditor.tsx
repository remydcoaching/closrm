'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { TemplateBlock, DayOfWeek } from '@/types'
import BlockModal from './BlockModal'

interface TemplateWeekEditorProps {
  blocks: TemplateBlock[]
  onChange: (blocks: TemplateBlock[]) => void
}

const CELL_HEIGHT = 30
const START_HOUR = 6
const END_HOUR = 23
const SLOTS_COUNT = (END_HOUR - START_HOUR) * 2 // 34 half-hour slots
const TOTAL_HEIGHT = SLOTS_COUNT * CELL_HEIGHT
const HOUR_COL_WIDTH = 72

const DAY_KEYS: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
const DAY_LABELS: Record<DayOfWeek, string> = {
  monday: 'LUNDI',
  tuesday: 'MARDI',
  wednesday: 'MERCREDI',
  thursday: 'JEUDI',
  friday: 'VENDREDI',
  saturday: 'SAMEDI',
  sunday: 'DIMANCHE',
}

const GRID_BORDER = '1px solid rgba(128,128,128,0.25)'
const GRID_BORDER_DASHED = '1px dashed rgba(128,128,128,0.12)'

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

function minutesToSlotIndex(minutes: number): number {
  return (minutes - START_HOUR * 60) / 30
}

function slotIndexToTime(index: number): string {
  const totalMinutes = index * 30 + START_HOUR * 60
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function getBlockPosition(block: TemplateBlock) {
  const startMin = timeToMinutes(block.start)
  const endMin = timeToMinutes(block.end)
  const topSlot = minutesToSlotIndex(startMin)
  const bottomSlot = minutesToSlotIndex(endMin)
  const top = topSlot * CELL_HEIGHT
  const height = Math.max((bottomSlot - topSlot) * CELL_HEIGHT, CELL_HEIGHT)
  return { top, height }
}

interface EditState {
  block: TemplateBlock
  index: number
}

interface AddState {
  day: DayOfWeek
  start: string
  end?: string
}

interface DragState {
  day: DayOfWeek
  startSlot: number
  currentSlot: number
}

export default function TemplateWeekEditor({ blocks, onChange }: TemplateWeekEditorProps) {
  const [editState, setEditState] = useState<EditState | null>(null)
  const [addState, setAddState] = useState<AddState | null>(null)
  const [drag, setDrag] = useState<DragState | null>(null)
  const isDragging = useRef(false)
  const [copiedBlock, setCopiedBlock] = useState<TemplateBlock | null>(null)
  const [hoverCell, setHoverCell] = useState<{ day: DayOfWeek; slotIndex: number } | null>(null)
  const [selectedBlockIndex, setSelectedBlockIndex] = useState<number | null>(null)

  // Keyboard shortcuts: Cmd+C to copy, Cmd+V to paste
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Cmd+C or Ctrl+C — copy selected block
      if ((e.metaKey || e.ctrlKey) && e.key === 'c' && selectedBlockIndex !== null) {
        e.preventDefault()
        setCopiedBlock({ ...blocks[selectedBlockIndex] })
      }
      // Backspace or Delete — delete selected block
      if ((e.key === 'Backspace' || e.key === 'Delete') && selectedBlockIndex !== null) {
        e.preventDefault()
        const next = blocks.filter((_, i) => i !== selectedBlockIndex)
        onChange(next)
        setSelectedBlockIndex(null)
      }
      // Cmd+V or Ctrl+V — paste at hover position
      if ((e.metaKey || e.ctrlKey) && e.key === 'v' && copiedBlock && hoverCell) {
        e.preventDefault()
        const duration = timeToMinutes(copiedBlock.end) - timeToMinutes(copiedBlock.start)
        const newStart = slotIndexToTime(hoverCell.slotIndex)
        const newEndMin = timeToMinutes(newStart) + duration
        // Clamp to grid end
        const clampedEndMin = Math.min(newEndMin, END_HOUR * 60)
        const newEnd = `${String(Math.floor(clampedEndMin / 60)).padStart(2, '0')}:${String(clampedEndMin % 60).padStart(2, '0')}`
        const pastedBlock: TemplateBlock = {
          ...copiedBlock,
          day: hoverCell.day,
          start: newStart,
          end: newEnd,
        }
        onChange([...blocks, pastedBlock])
        setSelectedBlockIndex(blocks.length) // select the new block
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedBlockIndex, copiedBlock, hoverCell, blocks, onChange])

  const [dragBlockIndex, setDragBlockIndex] = useState<number | null>(null)

  function handleBlockClick(e: React.MouseEvent, block: TemplateBlock, index: number) {
    e.stopPropagation()
    // Single click = select only, double click = open edit modal
    if (selectedBlockIndex === index) {
      // Already selected → open edit
      setEditState({ block, index })
      setAddState(null)
    } else {
      // First click → just select
      setSelectedBlockIndex(index)
    }
  }

  function handleBlockDragStart(e: React.DragEvent, index: number) {
    setDragBlockIndex(index)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(index))
  }

  function handleCellDrop(day: DayOfWeek, slotIndex: number) {
    if (dragBlockIndex === null) return
    const block = blocks[dragBlockIndex]
    if (!block) return
    const duration = timeToMinutes(block.end) - timeToMinutes(block.start)
    const newStart = slotIndexToTime(slotIndex)
    const newEndMin = Math.min(timeToMinutes(newStart) + duration, END_HOUR * 60)
    const newEnd = `${String(Math.floor(newEndMin / 60)).padStart(2, '0')}:${String(newEndMin % 60).padStart(2, '0')}`
    const next = [...blocks]
    next[dragBlockIndex] = { ...block, day, start: newStart, end: newEnd }
    onChange(next)
    setDragBlockIndex(null)
  }

  function handleCellMouseDown(day: DayOfWeek, slotIndex: number) {
    // Check if there's already a block at this slot
    const slotTime = slotIndexToTime(slotIndex)
    const slotMin = timeToMinutes(slotTime)
    const hasBlock = blocks.some(b => {
      if (b.day !== day) return false
      const bStart = timeToMinutes(b.start)
      const bEnd = timeToMinutes(b.end)
      return slotMin >= bStart && slotMin < bEnd
    })
    if (hasBlock) return

    isDragging.current = true
    setDrag({ day, startSlot: slotIndex, currentSlot: slotIndex })
  }

  const handleCellMouseEnter = useCallback((day: DayOfWeek, slotIndex: number) => {
    setHoverCell({ day, slotIndex })
    if (!isDragging.current || !drag) return
    if (day !== drag.day) return
    setDrag(prev => prev ? { ...prev, currentSlot: slotIndex } : null)
  }, [drag])

  const handleMouseUp = useCallback(() => {
    if (!isDragging.current || !drag) {
      isDragging.current = false
      setDrag(null)
      return
    }
    isDragging.current = false
    const startSlot = Math.min(drag.startSlot, drag.currentSlot)
    const endSlot = Math.max(drag.startSlot, drag.currentSlot) + 1 // +1 because end is exclusive (next slot)
    const startTime = slotIndexToTime(startSlot)
    const endTime = slotIndexToTime(endSlot)
    setDrag(null)
    setAddState({ day: drag.day, start: startTime, end: endTime })
    setEditState(null)
  }, [drag])

  function isSlotInDrag(day: DayOfWeek, slotIndex: number): boolean {
    if (!drag || day !== drag.day) return false
    const start = Math.min(drag.startSlot, drag.currentSlot)
    const end = Math.max(drag.startSlot, drag.currentSlot)
    return slotIndex >= start && slotIndex <= end
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

  // Build slot array: 0 = 06:00, 1 = 06:30, ... 33 = 22:30
  const slots = Array.from({ length: SLOTS_COUNT }, (_, i) => i)

  return (
    <div
      style={{ overflowX: 'auto', userSelect: 'none' }}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => { if (isDragging.current) handleMouseUp() }}
    >
      <div style={{ minWidth: 700 }}>
        {/* Day headers */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: `${HOUR_COL_WIDTH}px repeat(7, 1fr)`,
          borderBottom: '2px solid rgba(128,128,128,0.35)',
          position: 'sticky',
          top: 0,
          zIndex: 10,
          background: '#111111',
        }}>
          <div style={{
            borderRight: GRID_BORDER,
            padding: '6px 0',
          }} />
          {DAY_KEYS.map(day => (
            <div
              key={day}
              style={{
                textAlign: 'center',
                padding: '6px 0',
                borderRight: GRID_BORDER,
                fontSize: 10,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: '#fff',
                background: '#111111',
              }}
            >
              {DAY_LABELS[day]}
            </div>
          ))}
        </div>

        {/* Time grid + blocks overlay */}
        <div style={{ position: 'relative' }}>
          {/* Grid rows */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: `${HOUR_COL_WIDTH}px repeat(7, 1fr)`,
          }}>
            {slots.map(slotIdx => {
              const isFullHour = slotIdx % 2 === 0
              const hour = Math.floor(slotIdx / 2) + START_HOUR
              const borderBottom = isFullHour ? GRID_BORDER_DASHED : GRID_BORDER

              return (
                <div key={slotIdx} style={{ display: 'contents' }}>
                  {/* Hour label — only on full hours, positioned on the grid line */}
                  <div style={{
                    height: CELL_HEIGHT,
                    borderRight: GRID_BORDER,
                    borderBottom,
                    position: 'relative',
                  }}>
                    {isFullHour && (
                      <span style={{
                        position: 'absolute', top: -8, right: 10,
                        fontSize: 11, fontWeight: 500, lineHeight: 1,
                        color: 'var(--text-secondary)',
                        background: '#0d0d0d', paddingTop: 2, paddingBottom: 2,
                      }}>
                        {String(hour).padStart(2, '0')}:00
                      </span>
                    )}
                  </div>
                  {/* Day cells */}
                  {DAY_KEYS.map(day => (
                    <div
                      key={`${day}-${slotIdx}`}
                      onMouseDown={() => handleCellMouseDown(day, slotIdx)}
                      onMouseEnter={() => handleCellMouseEnter(day, slotIdx)}
                      onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }}
                      onDrop={() => handleCellDrop(day, slotIdx)}
                      style={{
                        height: CELL_HEIGHT,
                        borderRight: GRID_BORDER,
                        borderBottom,
                        cursor: 'pointer',
                        boxSizing: 'border-box',
                        background: isSlotInDrag(day, slotIdx)
                          ? 'rgba(229,62,62,0.15)'
                          : 'transparent',
                        transition: 'background 0.05s',
                      }}
                    />
                  ))}
                </div>
              )
            })}
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
                          draggable
                          onDragStart={e => handleBlockDragStart(e, b._index)}
                          onClick={e => handleBlockClick(e, b, b._index)}
                          style={{
                            position: 'absolute',
                            top: pos.top,
                            height: pos.height,
                            left: 0,
                            right: 0,
                            background: b.color,
                            cursor: 'pointer',
                            pointerEvents: 'all',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderBottom: '1px solid rgba(0,0,0,0.15)',
                            borderTop: '1px solid rgba(255,255,255,0.1)',
                            boxSizing: 'border-box',
                            outline: selectedBlockIndex === b._index ? '2px solid #fff' : 'none',
                            outlineOffset: -2,
                            transition: 'filter 0.1s',
                          }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.filter = 'brightness(1.15)' }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.filter = 'none' }}
                        >
                          <span style={{
                            fontSize: 10,
                            fontWeight: 800,
                            color: '#fff',
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                            textAlign: 'center',
                            lineHeight: 1.2,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: pos.height <= CELL_HEIGHT ? 'nowrap' : 'normal',
                            padding: '0 4px',
                            textShadow: '0 1px 2px rgba(0,0,0,0.3)',
                          }}>
                            {b.title}
                          </span>
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
          defaultStart={addState.start}
          defaultEnd={addState.end}
          onSave={handleSaveAdd}
          onClose={closeModal}
        />
      )}
    </div>
  )
}
