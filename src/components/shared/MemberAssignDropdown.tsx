'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Plus, Check, UserMinus } from 'lucide-react'
import { WorkspaceMemberWithUser, WorkspaceRole } from '@/types'

const ROLE_COLORS: Record<WorkspaceRole, string> = {
  admin: '#E53E3E',
  setter: '#3b82f6',
  closer: '#38A169',
}

function getInitials(fullName: string | null | undefined, email: string): string {
  if (fullName) {
    return fullName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  }
  return email.slice(0, 2).toUpperCase()
}

interface MemberAssignDropdownProps {
  /** Currently assigned user ID (null = unassigned) */
  assignedTo: string | null
  /** All workspace members */
  members: WorkspaceMemberWithUser[]
  /** Called when assignment changes */
  onAssign: (userId: string | null) => void
  /** If false, shows readonly display only */
  canEdit?: boolean
  /** Compact mode for table cells -- shows only initials circle + first name */
  compact?: boolean
}

export default function MemberAssignDropdown({
  assignedTo,
  members,
  onAssign,
  canEdit = true,
  compact = false,
}: MemberAssignDropdownProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (ref.current && !ref.current.contains(e.target as Node)) {
      setOpen(false)
    }
  }, [])

  useEffect(() => {
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open, handleClickOutside])

  const activeMembers = members.filter(m => m.status === 'active')
  const assignedMember = assignedTo
    ? activeMembers.find(m => m.user_id === assignedTo) ?? null
    : null

  function handleSelect(userId: string | null) {
    onAssign(userId)
    setOpen(false)
  }

  // --- Readonly view ---
  if (!canEdit) {
    if (!assignedMember) {
      return <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Non assigne</span>
    }
    const color = ROLE_COLORS[assignedMember.role]
    const initials = getInitials(assignedMember.user.full_name, assignedMember.user.email)
    const name = assignedMember.user.full_name || assignedMember.user.email
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          width: 28, height: 28, borderRadius: '50%',
          background: `${color}20`, color,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10, fontWeight: 700, flexShrink: 0,
        }}>
          {initials}
        </div>
        <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{name}</span>
        <span style={{
          fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 99,
          background: `${color}18`, color,
        }}>
          {assignedMember.role}
        </span>
      </div>
    )
  }

  // --- Editable trigger button ---
  const triggerContent = assignedMember ? (() => {
    const color = ROLE_COLORS[assignedMember.role]
    const initials = getInitials(assignedMember.user.full_name, assignedMember.user.email)
    const name = assignedMember.user.full_name || assignedMember.user.email
    const firstName = name.split(' ')[0]

    if (compact) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{
            width: 24, height: 24, borderRadius: '50%',
            background: `${color}20`, color,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 9, fontWeight: 700, flexShrink: 0,
          }}>
            {initials}
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{firstName}</span>
        </div>
      )
    }

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          width: 28, height: 28, borderRadius: '50%',
          background: `${color}20`, color,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10, fontWeight: 700, flexShrink: 0,
        }}>
          {initials}
        </div>
        <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{name}</span>
        <span style={{
          fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 99,
          background: `${color}18`, color,
        }}>
          {assignedMember.role}
        </span>
      </div>
    )
  })() : (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{
        width: compact ? 24 : 28, height: compact ? 24 : 28, borderRadius: '50%',
        border: '1.5px dashed var(--border-primary)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <Plus size={compact ? 11 : 13} color="var(--text-muted)" />
      </div>
      {!compact && <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Assigner</span>}
    </div>
  )

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(prev => !prev) }}
        style={{
          display: 'flex', alignItems: 'center',
          padding: compact ? '2px 4px' : '6px 10px',
          borderRadius: 10,
          border: open ? '1px solid var(--border-primary)' : '1px solid transparent',
          background: open ? 'var(--bg-elevated)' : 'transparent',
          cursor: 'pointer',
          transition: 'all 0.15s',
        }}
        onMouseEnter={e => {
          if (!open) e.currentTarget.style.background = 'var(--bg-hover)'
        }}
        onMouseLeave={e => {
          if (!open) e.currentTarget.style.background = 'transparent'
        }}
      >
        {triggerContent}
      </button>

      {open && (
        <div
          style={{
            position: 'fixed',
            top: (() => {
              const rect = ref.current?.getBoundingClientRect()
              if (!rect) return 0
              const spaceBelow = window.innerHeight - rect.bottom
              // Open above if not enough space below
              if (spaceBelow < 200) return rect.top - 4
              return rect.bottom + 4
            })(),
            left: (() => {
              const rect = ref.current?.getBoundingClientRect()
              return rect ? Math.min(rect.left, window.innerWidth - 270) : 0
            })(),
            transform: (() => {
              const rect = ref.current?.getBoundingClientRect()
              if (!rect) return 'none'
              const spaceBelow = window.innerHeight - rect.bottom
              if (spaceBelow < 200) return 'translateY(-100%)'
              return 'none'
            })(),
            zIndex: 99999,
            minWidth: 260,
            maxHeight: 300,
            overflowY: 'auto',
            background: '#1a1a1a',
            border: '1px solid var(--border-primary)',
            borderRadius: 10,
            padding: 4,
            boxShadow: '0 12px 40px rgba(0,0,0,0.55)',
          }}
        >
          {/* Non assigne option */}
          <button
            onClick={(e) => { e.stopPropagation(); handleSelect(null) }}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, width: '100%',
              padding: '8px 10px', borderRadius: 8, fontSize: 13, fontWeight: 500,
              border: 'none', textAlign: 'left',
              background: !assignedTo ? 'rgba(255,255,255,0.05)' : 'transparent',
              color: !assignedTo ? 'var(--text-primary)' : 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'background 0.1s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)' }}
            onMouseLeave={e => { e.currentTarget.style.background = !assignedTo ? 'rgba(255,255,255,0.05)' : 'transparent' }}
          >
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: 'rgba(255,255,255,0.06)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <UserMinus size={13} color="var(--text-muted)" />
            </div>
            <span>Non assigne</span>
            {!assignedTo && (
              <Check size={14} color="var(--color-primary)" style={{ marginLeft: 'auto' }} />
            )}
          </button>

          {/* Separator */}
          <div style={{
            height: 1, background: 'var(--border-primary)',
            margin: '4px 8px',
          }} />

          {/* Members list */}
          {activeMembers.map(m => {
            const color = ROLE_COLORS[m.role]
            const initials = getInitials(m.user.full_name, m.user.email)
            const name = m.user.full_name || m.user.email
            const isActive = assignedTo === m.user_id

            return (
              <button
                key={m.user_id}
                onClick={(e) => { e.stopPropagation(); handleSelect(m.user_id) }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                  padding: '8px 10px', borderRadius: 8, fontSize: 13, fontWeight: 500,
                  border: 'none', textAlign: 'left',
                  background: isActive ? `${color}12` : 'transparent',
                  color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = isActive ? `${color}18` : 'rgba(255,255,255,0.05)' }}
                onMouseLeave={e => { e.currentTarget.style.background = isActive ? `${color}12` : 'transparent' }}
              >
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: `${color}20`, color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 700, flexShrink: 0,
                }}>
                  {initials}
                </div>
                <span style={{ flex: 1 }}>{name}</span>
                <span style={{
                  fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 99,
                  background: `${color}18`, color,
                  textTransform: 'capitalize',
                }}>
                  {m.role}
                </span>
                {isActive && (
                  <Check size={14} color={color} style={{ flexShrink: 0 }} />
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
