'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, MoreVertical, Shield, PhoneOutgoing, Target, UserX, RefreshCw, Trash2 } from 'lucide-react'
import type { WorkspaceMemberWithUser, WorkspaceRole, MemberStatus } from '@/types'
import InviteMemberModal from '@/components/team/InviteMemberModal'
import ConfirmModal from '@/components/shared/ConfirmModal'

const ROLE_CONFIG: Record<WorkspaceRole, { label: string; color: string; bg: string; icon: typeof Shield }> = {
  admin: { label: 'Admin', color: '#E53E3E', bg: 'rgba(229,62,62,0.12)', icon: Shield },
  setter: { label: 'Setter', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)', icon: PhoneOutgoing },
  closer: { label: 'Closer', color: '#38A169', bg: 'rgba(56,161,105,0.12)', icon: Target },
}

const STATUS_CONFIG: Record<MemberStatus, { label: string; color: string; bg: string }> = {
  active: { label: 'Actif', color: '#38A169', bg: 'rgba(56,161,105,0.12)' },
  invited: { label: 'Invite', color: '#D69E2E', bg: 'rgba(214,158,46,0.12)' },
  suspended: { label: 'Suspendu', color: '#718096', bg: 'rgba(113,128,150,0.12)' },
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(w => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export default function EquipeClient() {
  const [members, setMembers] = useState<WorkspaceMemberWithUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showInvite, setShowInvite] = useState(false)
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<{
    type: 'delete' | 'suspend' | 'reactivate' | 'role'
    member: WorkspaceMemberWithUser
    newRole?: WorkspaceRole
  } | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  const fetchMembers = useCallback(async () => {
    try {
      const res = await fetch('/api/workspaces/members')
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erreur chargement')
      setMembers(json.data ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchMembers()
  }, [fetchMembers])

  // Get current user ID from the admin member
  useEffect(() => {
    const admin = members.find(m => m.role === 'admin')
    if (admin) setCurrentUserId(admin.user_id)
  }, [members])

  // Close menu on outside click
  useEffect(() => {
    if (!openMenu) return
    function handleClick() { setOpenMenu(null) }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [openMenu])

  async function handleChangeRole(member: WorkspaceMemberWithUser, newRole: WorkspaceRole) {
    setActionLoading(true)
    try {
      const res = await fetch(`/api/workspaces/members/${member.user_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error || 'Erreur')
      }
      await fetchMembers()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setActionLoading(false)
      setConfirm(null)
    }
  }

  async function handleToggleSuspend(member: WorkspaceMemberWithUser) {
    const newStatus = member.status === 'suspended' ? 'active' : 'suspended'
    setActionLoading(true)
    try {
      const res = await fetch(`/api/workspaces/members/${member.user_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error || 'Erreur')
      }
      await fetchMembers()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setActionLoading(false)
      setConfirm(null)
    }
  }

  async function handleDelete(member: WorkspaceMemberWithUser) {
    setActionLoading(true)
    try {
      const res = await fetch(`/api/workspaces/members/${member.user_id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error || 'Erreur')
      }
      await fetchMembers()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setActionLoading(false)
      setConfirm(null)
    }
  }

  function handleConfirmAction() {
    if (!confirm) return
    if (confirm.type === 'delete') handleDelete(confirm.member)
    else if (confirm.type === 'suspend' || confirm.type === 'reactivate') handleToggleSuspend(confirm.member)
    else if (confirm.type === 'role' && confirm.newRole) handleChangeRole(confirm.member, confirm.newRole)
  }

  const isSelf = (member: WorkspaceMemberWithUser) => member.user_id === currentUserId

  return (
    <div style={{ padding: '32px 40px', maxWidth: 900 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Equipe</h1>
          <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 4 }}>Gerez les membres de votre equipe</p>
        </div>
        <button
          onClick={() => setShowInvite(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '9px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600,
            background: 'var(--color-primary)', color: '#000', border: 'none',
            cursor: 'pointer', transition: 'opacity 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.opacity = '0.85' }}
          onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
        >
          <Plus size={15} />
          Inviter un membre
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div style={{
          padding: '10px 16px', borderRadius: 8, marginBottom: 20,
          background: 'rgba(229,62,62,0.1)', border: '1px solid rgba(229,62,62,0.3)',
          color: '#E53E3E', fontSize: 13,
        }}>
          {error}
          <button
            onClick={() => setError(null)}
            style={{ marginLeft: 12, background: 'none', border: 'none', color: '#E53E3E', cursor: 'pointer', fontWeight: 600 }}
          >
            Fermer
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)', fontSize: 13 }}>
          Chargement...
        </div>
      )}

      {/* Empty state */}
      {!loading && members.length <= 1 && (
        <div style={{
          textAlign: 'center', padding: '60px 20px',
          background: 'var(--bg-elevated)', borderRadius: 12,
          border: '1px solid var(--border-primary)',
        }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>
            <Shield size={40} style={{ color: 'var(--text-muted)' }} />
          </div>
          <p style={{ fontSize: 15, color: 'var(--text-secondary)', margin: '0 0 6px', fontWeight: 600 }}>
            Vous etes seul pour l&apos;instant
          </p>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
            Invitez un setter ou closer pour commencer.
          </p>
        </div>
      )}

      {/* Members list */}
      {!loading && members.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {members.map(member => {
            const roleConf = ROLE_CONFIG[member.role]
            const statusConf = STATUS_CONFIG[member.status]
            const self = isSelf(member)
            const RoleIcon = roleConf.icon
            const userName = member.user?.full_name || 'Sans nom'
            const userEmail = member.user?.email || ''

            return (
              <div
                key={member.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 16,
                  padding: '16px 20px', borderRadius: 12,
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-primary)',
                  transition: 'border-color 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-hover, var(--border-secondary, #333))' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-primary)' }}
              >
                {/* Avatar */}
                {member.user?.avatar_url ? (
                  <img
                    src={member.user.avatar_url}
                    alt={userName}
                    style={{ width: 40, height: 40, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }}
                  />
                ) : (
                  <div style={{
                    width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                    background: roleConf.bg, color: roleConf.color,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14, fontWeight: 700,
                  }}>
                    {getInitials(userName)}
                  </div>
                )}

                {/* Name + email */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {userName}
                    {self && <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400, marginLeft: 8 }}>(vous)</span>}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {userEmail}
                  </div>
                </div>

                {/* Role badge */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '4px 10px', borderRadius: 6,
                  background: roleConf.bg, color: roleConf.color,
                  fontSize: 12, fontWeight: 600, flexShrink: 0,
                }}>
                  <RoleIcon size={12} />
                  {roleConf.label}
                </div>

                {/* Status badge */}
                <div style={{
                  padding: '4px 10px', borderRadius: 6,
                  background: statusConf.bg, color: statusConf.color,
                  fontSize: 12, fontWeight: 600, flexShrink: 0,
                }}>
                  {statusConf.label}
                </div>

                {/* Actions menu */}
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <button
                    disabled={self}
                    onClick={e => {
                      e.stopPropagation()
                      setOpenMenu(openMenu === member.id ? null : member.id)
                    }}
                    style={{
                      width: 32, height: 32, borderRadius: 8,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: 'transparent', border: '1px solid transparent',
                      color: self ? 'var(--text-muted)' : 'var(--text-tertiary)',
                      cursor: self ? 'not-allowed' : 'pointer',
                      opacity: self ? 0.4 : 1,
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => { if (!self) { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.borderColor = 'var(--border-primary)' } }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent' }}
                  >
                    <MoreVertical size={16} />
                  </button>

                  {openMenu === member.id && !self && (
                    <div
                      onClick={e => e.stopPropagation()}
                      style={{
                        position: 'absolute', right: 0, top: 38, zIndex: 100,
                        background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)',
                        borderRadius: 10, padding: 4, minWidth: 200,
                        boxShadow: '0 12px 40px var(--shadow-dropdown)',
                      }}
                    >
                      {/* Change role */}
                      <div style={{ padding: '6px 12px', fontSize: 10, fontWeight: 700, color: 'var(--text-label)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                        Changer le role
                      </div>
                      {(['setter', 'closer'] as WorkspaceRole[]).filter(r => r !== member.role).map(r => {
                        const rc = ROLE_CONFIG[r]
                        const RcIcon = rc.icon
                        return (
                          <button
                            key={r}
                            onClick={() => {
                              setOpenMenu(null)
                              setConfirm({ type: 'role', member, newRole: r })
                            }}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                              padding: '8px 12px', borderRadius: 6, fontSize: 13,
                              background: 'transparent', border: 'none',
                              color: 'var(--text-secondary)', cursor: 'pointer',
                              transition: 'background 0.1s',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)' }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                          >
                            <RcIcon size={14} style={{ color: rc.color }} />
                            Passer en {rc.label}
                          </button>
                        )
                      })}

                      <div style={{ height: 1, background: 'var(--border-primary)', margin: '4px 8px' }} />

                      {/* Suspend / Reactivate */}
                      <button
                        onClick={() => {
                          setOpenMenu(null)
                          setConfirm({
                            type: member.status === 'suspended' ? 'reactivate' : 'suspend',
                            member,
                          })
                        }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                          padding: '8px 12px', borderRadius: 6, fontSize: 13,
                          background: 'transparent', border: 'none',
                          color: 'var(--text-secondary)', cursor: 'pointer',
                          transition: 'background 0.1s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                      >
                        {member.status === 'suspended' ? (
                          <><RefreshCw size={14} style={{ color: '#38A169' }} /> Reactiver</>
                        ) : (
                          <><UserX size={14} style={{ color: '#D69E2E' }} /> Suspendre</>
                        )}
                      </button>

                      {/* Delete */}
                      <button
                        onClick={() => {
                          setOpenMenu(null)
                          setConfirm({ type: 'delete', member })
                        }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                          padding: '8px 12px', borderRadius: 6, fontSize: 13,
                          background: 'transparent', border: 'none',
                          color: '#ef4444', cursor: 'pointer',
                          transition: 'background 0.1s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                      >
                        <Trash2 size={14} />
                        Supprimer
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Invite modal */}
      {showInvite && (
        <InviteMemberModal
          onClose={() => setShowInvite(false)}
          onSuccess={() => {
            fetchMembers()
          }}
        />
      )}

      {/* Confirm modal */}
      {confirm && (
        <ConfirmModal
          title={
            confirm.type === 'delete'
              ? 'Supprimer ce membre'
              : confirm.type === 'suspend'
              ? 'Suspendre ce membre'
              : confirm.type === 'reactivate'
              ? 'Reactiver ce membre'
              : `Passer en ${confirm.newRole ? ROLE_CONFIG[confirm.newRole].label : ''}`
          }
          message={
            confirm.type === 'delete'
              ? `${confirm.member.user?.full_name || 'Ce membre'} sera supprime et ne pourra plus acceder au workspace.`
              : confirm.type === 'suspend'
              ? `${confirm.member.user?.full_name || 'Ce membre'} ne pourra plus se connecter tant qu'il sera suspendu.`
              : confirm.type === 'reactivate'
              ? `${confirm.member.user?.full_name || 'Ce membre'} pourra a nouveau se connecter.`
              : `${confirm.member.user?.full_name || 'Ce membre'} passera du role ${ROLE_CONFIG[confirm.member.role].label} au role ${confirm.newRole ? ROLE_CONFIG[confirm.newRole].label : ''}.`
          }
          confirmLabel={actionLoading ? 'En cours...' : 'Confirmer'}
          confirmDanger={confirm.type === 'delete'}
          onConfirm={handleConfirmAction}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  )
}
