'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, MoreVertical, Shield, PhoneOutgoing, Target, UserX, RefreshCw, Trash2, BarChart3, AlertTriangle, CheckCircle, Settings2, Save } from 'lucide-react'
import type { WorkspaceMemberWithUser, WorkspaceRole, MemberStatus } from '@/types'
import InviteMemberModal from '@/components/team/InviteMemberModal'
import ConfirmModal from '@/components/shared/ConfirmModal'

type PageTab = 'membres' | 'reporting' | 'objectifs'

// ─── Reporting types ────────────────────────────────────────────────────────

interface MemberStats {
  messages_sent: number
  calls_total: number
  calls_reached: number
  rdv_booked: number
  closings: number
  deal_amount: number
  no_shows: number
  joignabilite: number
  closing_rate: number
}

interface MemberReport {
  user_id: string
  full_name: string
  email: string
  role: string
  stats: MemberStats
}

// ─── Objectives & Commissions types ─────────────────────────────────────────

interface TeamObjective {
  id: string
  workspace_id: string
  user_id: string | null
  role: string | null
  metric: string
  target_value: number
  created_at: string
  updated_at: string
}

interface TeamCommission {
  id: string
  workspace_id: string
  user_id: string | null
  role: string | null
  type: 'percentage' | 'fixed'
  value: number
  bonus_threshold: number | null
  bonus_amount: number | null
  created_at: string
}

type ObjectiveMetric = 'calls_per_day' | 'rdv_per_week' | 'joignabilite' | 'closings_per_month' | 'ca_per_month' | 'taux_closing'

interface ObjectiveConfig {
  metric: ObjectiveMetric
  label: string
  suffix: string
  defaultValue: number
}

const SETTER_OBJECTIVES: ObjectiveConfig[] = [
  { metric: 'calls_per_day', label: 'Appels / jour', suffix: '', defaultValue: 15 },
  { metric: 'rdv_per_week', label: 'RDV / semaine', suffix: '', defaultValue: 5 },
  { metric: 'joignabilite', label: 'Joignabilite', suffix: '%', defaultValue: 40 },
]

const CLOSER_OBJECTIVES: ObjectiveConfig[] = [
  { metric: 'closings_per_month', label: 'Closings / mois', suffix: '', defaultValue: 10 },
  { metric: 'ca_per_month', label: 'CA / mois', suffix: '\u20AC', defaultValue: 20000 },
  { metric: 'taux_closing', label: 'Taux closing', suffix: '%', defaultValue: 30 },
]

type PeriodPreset = '7' | '14' | '30' | 'custom'

function getPeriodDates(preset: PeriodPreset): { from: string; to: string } {
  const to = new Date()
  const from = new Date()
  const days = preset === 'custom' ? 30 : parseInt(preset, 10)
  from.setDate(from.getDate() - days)
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  }
}

function formatEuro(v: number): string {
  return v.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
}

function pctColor(pct: number): string {
  if (pct >= 50) return '#38A169'
  if (pct >= 30) return '#D69E2E'
  return '#ef4444'
}

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
  const [pageTab, setPageTab] = useState<PageTab>('membres')
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
  const [currentUserRole, setCurrentUserRole] = useState<WorkspaceRole | null>(null)

  // Reporting state
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('7')
  const [reportData, setReportData] = useState<MemberReport[]>([])
  const [reportLoading, setReportLoading] = useState(false)

  // Objectives & Commissions state
  const [objectives, setObjectives] = useState<TeamObjective[]>([])
  const [objLoading, setObjLoading] = useState(false)
  const [objDraft, setObjDraft] = useState<Record<string, number>>({})
  const [objSaving, setObjSaving] = useState<string | null>(null)
  const [commissions, setCommissions] = useState<TeamCommission[]>([])
  const [commDraft, setCommDraft] = useState<{ type: 'percentage' | 'fixed'; value: number; bonus_threshold: number; bonus_amount: number }>({
    type: 'percentage', value: 10, bonus_threshold: 10, bonus_amount: 200,
  })
  const [commSaving, setCommSaving] = useState(false)

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

  // Get current user ID and role from the admin member
  useEffect(() => {
    const admin = members.find(m => m.role === 'admin')
    if (admin) {
      setCurrentUserId(admin.user_id)
      setCurrentUserRole('admin')
    }
  }, [members])

  // Fetch reporting data when tab is reporting
  const fetchReporting = useCallback(async () => {
    setReportLoading(true)
    try {
      const { from, to } = getPeriodDates(periodPreset)
      const res = await fetch(`/api/workspaces/reporting?date_from=${from}&date_to=${to}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erreur chargement reporting')
      setReportData(json.data?.members ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur reporting')
    } finally {
      setReportLoading(false)
    }
  }, [periodPreset])

  useEffect(() => {
    if (pageTab === 'reporting') {
      fetchReporting()
    }
  }, [pageTab, fetchReporting])

  // Fetch objectives & commissions when tab is objectifs
  const fetchObjectives = useCallback(async () => {
    setObjLoading(true)
    try {
      const [objRes, commRes] = await Promise.all([
        fetch('/api/workspaces/objectives'),
        fetch('/api/workspaces/commissions'),
      ])
      const objJson = await objRes.json()
      const commJson = await commRes.json()
      if (objRes.ok) {
        const data = objJson.data as TeamObjective[]
        setObjectives(data)
        // Initialize draft values from saved objectives
        const draft: Record<string, number> = {}
        for (const obj of data) {
          const key = `${obj.role || 'none'}_${obj.metric}`
          draft[key] = obj.target_value
        }
        setObjDraft(draft)
      }
      if (commRes.ok && commJson.data?.length > 0) {
        setCommissions(commJson.data)
        const defaultComm = (commJson.data as TeamCommission[]).find(c => !c.user_id)
        if (defaultComm) {
          setCommDraft({
            type: defaultComm.type,
            value: defaultComm.value,
            bonus_threshold: defaultComm.bonus_threshold ?? 10,
            bonus_amount: defaultComm.bonus_amount ?? 200,
          })
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur chargement objectifs')
    } finally {
      setObjLoading(false)
    }
  }, [])

  useEffect(() => {
    if (pageTab === 'objectifs') {
      fetchObjectives()
    }
  }, [pageTab, fetchObjectives])

  async function saveObjective(role: string, metric: string, value: number) {
    const key = `${role}_${metric}`
    setObjSaving(key)
    try {
      const res = await fetch('/api/workspaces/objectives', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, metric, target_value: value }),
      })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error || 'Erreur sauvegarde')
      }
      // Update local state
      const json = await res.json()
      setObjectives(prev => {
        const idx = prev.findIndex(o => o.role === role && o.metric === metric && !o.user_id)
        if (idx >= 0) {
          const updated = [...prev]
          updated[idx] = json.data
          return updated
        }
        return [...prev, json.data]
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setObjSaving(null)
    }
  }

  async function saveCommission() {
    setCommSaving(true)
    try {
      const res = await fetch('/api/workspaces/commissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: 'closer',
          type: commDraft.type,
          value: commDraft.value,
          bonus_threshold: commDraft.bonus_threshold || null,
          bonus_amount: commDraft.bonus_amount || null,
        }),
      })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error || 'Erreur sauvegarde')
      }
      const json = await res.json()
      setCommissions(prev => {
        const idx = prev.findIndex(c => !c.user_id && c.role === 'closer')
        if (idx >= 0) {
          const updated = [...prev]
          updated[idx] = json.data
          return updated
        }
        return [...prev, json.data]
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setCommSaving(false)
    }
  }

  function getObjValue(role: string, metric: string, defaultValue: number): number {
    const key = `${role}_${metric}`
    if (objDraft[key] !== undefined) return objDraft[key]
    return defaultValue
  }

  function setObjValue(role: string, metric: string, value: number) {
    const key = `${role}_${metric}`
    setObjDraft(prev => ({ ...prev, [key]: value }))
  }

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

  // ─── Reporting: compute totals & alerts ──────────────────────────────────
  const reportTotals: MemberStats = reportData.reduce(
    (acc, m) => ({
      messages_sent: acc.messages_sent + m.stats.messages_sent,
      calls_total: acc.calls_total + m.stats.calls_total,
      calls_reached: acc.calls_reached + m.stats.calls_reached,
      rdv_booked: acc.rdv_booked + m.stats.rdv_booked,
      closings: acc.closings + m.stats.closings,
      deal_amount: acc.deal_amount + m.stats.deal_amount,
      no_shows: acc.no_shows + m.stats.no_shows,
      joignabilite: 0,
      closing_rate: 0,
    }),
    { messages_sent: 0, calls_total: 0, calls_reached: 0, rdv_booked: 0, closings: 0, deal_amount: 0, no_shows: 0, joignabilite: 0, closing_rate: 0 }
  )
  reportTotals.joignabilite = reportTotals.calls_total > 0
    ? Math.round((reportTotals.calls_reached / reportTotals.calls_total) * 100)
    : 0
  reportTotals.closing_rate = reportTotals.rdv_booked > 0
    ? Math.round((reportTotals.closings / reportTotals.rdv_booked) * 100)
    : 0

  interface ReportAlert {
    type: 'warning' | 'success'
    message: string
  }
  const alerts: ReportAlert[] = []
  for (const m of reportData) {
    if (m.stats.calls_total === 0) {
      alerts.push({ type: 'warning', message: `${m.full_name} n'a fait aucun appel sur cette periode` })
    }
    if (m.stats.joignabilite > 0 && m.stats.joignabilite < 30) {
      alerts.push({ type: 'warning', message: `${m.full_name} a un taux de joignabilite de ${m.stats.joignabilite}% (< 30%)` })
    }
    if (m.role === 'closer' && m.stats.closings >= 5) {
      alerts.push({ type: 'success', message: `${m.full_name} a atteint son objectif de closings` })
    }
  }

  const isAdmin = currentUserRole === 'admin'

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1000 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Equipe</h1>
          <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 4 }}>Gerez les membres de votre equipe</p>
        </div>
        {pageTab === 'membres' && (
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
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border-primary)', marginBottom: 24 }}>
        {([
          { key: 'membres' as PageTab, label: 'Membres', icon: <Shield size={14} /> },
          ...(isAdmin ? [{ key: 'reporting' as PageTab, label: 'Reporting', icon: <BarChart3 size={14} /> }] : []),
          ...(isAdmin ? [{ key: 'objectifs' as PageTab, label: 'Objectifs & Commissions', icon: <Settings2 size={14} /> }] : []),
        ]).map(t => {
          const active = pageTab === t.key
          return (
            <button
              key={t.key}
              onClick={() => setPageTab(t.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '10px 20px', fontSize: 13, fontWeight: 600,
                background: 'transparent', border: 'none',
                borderBottom: active ? '2px solid var(--color-primary)' : '2px solid transparent',
                color: active ? 'var(--color-primary)' : 'var(--text-muted)',
                cursor: 'pointer', transition: 'all 0.15s',
                marginBottom: -1,
              }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.color = 'var(--text-secondary)' }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.color = 'var(--text-muted)' }}
            >
              {t.icon}
              {t.label}
            </button>
          )
        })}
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

      {/* ══════════════ TAB: MEMBRES ══════════════ */}
      {pageTab === 'membres' && (
        <>
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

        </>
      )}

      {/* ══════════════ TAB: REPORTING ══════════════ */}
      {pageTab === 'reporting' && isAdmin && (
        <div>
          {/* Period selector */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 24 }}>
            {(['7', '14', '30'] as PeriodPreset[]).map(p => {
              const active = periodPreset === p
              return (
                <button
                  key={p}
                  onClick={() => setPeriodPreset(p)}
                  style={{
                    padding: '7px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                    background: active ? 'var(--color-primary)' : 'var(--bg-elevated)',
                    color: active ? '#000' : 'var(--text-secondary)',
                    border: active ? 'none' : '1px solid var(--border-primary)',
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.borderColor = 'var(--text-muted)' }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.borderColor = 'var(--border-primary)' }}
                >
                  {p}j
                </button>
              )
            })}
          </div>

          {/* Loading */}
          {reportLoading && (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)', fontSize: 13 }}>
              Chargement du reporting...
            </div>
          )}

          {/* Table */}
          {!reportLoading && (
            <div style={{
              background: 'var(--bg-elevated)', borderRadius: 12,
              border: '1px solid var(--border-primary)', overflow: 'hidden',
            }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {['Membre', 'Role', 'Appels', 'Repondus', '% Joign.', 'RDV', 'Closings', 'CA', 'No-shows'].map(h => (
                        <th
                          key={h}
                          style={{
                            textAlign: h === 'Membre' ? 'left' : 'right',
                            padding: '10px 12px', fontSize: 10, fontWeight: 700,
                            color: 'var(--text-label)', textTransform: 'uppercase',
                            letterSpacing: '0.15em',
                            borderBottom: '1px solid var(--border-primary)',
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.map(m => {
                      const roleConf = ROLE_CONFIG[m.role as WorkspaceRole] || ROLE_CONFIG.admin
                      return (
                        <tr
                          key={m.user_id}
                          style={{ transition: 'background 0.1s' }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)' }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                        >
                          <td style={{ padding: '12px', fontSize: 13, borderBottom: '1px solid var(--bg-hover)', color: 'var(--text-primary)', fontWeight: 500 }}>
                            {m.full_name}
                          </td>
                          <td style={{ padding: '12px', fontSize: 12, borderBottom: '1px solid var(--bg-hover)', textAlign: 'right' }}>
                            <span style={{
                              padding: '3px 8px', borderRadius: 5,
                              background: roleConf.bg, color: roleConf.color,
                              fontSize: 11, fontWeight: 600,
                            }}>
                              {roleConf.label}
                            </span>
                          </td>
                          <td style={{ padding: '12px', fontSize: 13, borderBottom: '1px solid var(--bg-hover)', textAlign: 'right', color: 'var(--text-secondary)' }}>
                            {m.stats.calls_total}
                          </td>
                          <td style={{ padding: '12px', fontSize: 13, borderBottom: '1px solid var(--bg-hover)', textAlign: 'right', color: 'var(--text-secondary)' }}>
                            {m.stats.calls_reached}
                          </td>
                          <td style={{ padding: '12px', fontSize: 13, borderBottom: '1px solid var(--bg-hover)', textAlign: 'right', fontWeight: 600, color: pctColor(m.stats.joignabilite) }}>
                            {m.stats.joignabilite}%
                          </td>
                          <td style={{ padding: '12px', fontSize: 13, borderBottom: '1px solid var(--bg-hover)', textAlign: 'right', color: 'var(--text-secondary)' }}>
                            {m.stats.rdv_booked}
                          </td>
                          <td style={{ padding: '12px', fontSize: 13, borderBottom: '1px solid var(--bg-hover)', textAlign: 'right', color: 'var(--text-secondary)' }}>
                            {m.stats.closings}
                          </td>
                          <td style={{ padding: '12px', fontSize: 13, borderBottom: '1px solid var(--bg-hover)', textAlign: 'right', color: '#38A169', fontWeight: 600 }}>
                            {formatEuro(m.stats.deal_amount)}
                          </td>
                          <td style={{ padding: '12px', fontSize: 13, borderBottom: '1px solid var(--bg-hover)', textAlign: 'right', color: m.stats.no_shows > 0 ? '#ef4444' : 'var(--text-muted)' }}>
                            {m.stats.no_shows}
                          </td>
                        </tr>
                      )
                    })}
                    {/* Totals row */}
                    {reportData.length > 0 && (
                      <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                        <td style={{ padding: '12px', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', borderTop: '1px solid var(--border-primary)' }}>
                          Total
                        </td>
                        <td style={{ padding: '12px', borderTop: '1px solid var(--border-primary)' }} />
                        <td style={{ padding: '12px', fontSize: 13, fontWeight: 700, textAlign: 'right', color: 'var(--text-primary)', borderTop: '1px solid var(--border-primary)' }}>
                          {reportTotals.calls_total}
                        </td>
                        <td style={{ padding: '12px', fontSize: 13, fontWeight: 700, textAlign: 'right', color: 'var(--text-primary)', borderTop: '1px solid var(--border-primary)' }}>
                          {reportTotals.calls_reached}
                        </td>
                        <td style={{ padding: '12px', fontSize: 13, fontWeight: 700, textAlign: 'right', color: pctColor(reportTotals.joignabilite), borderTop: '1px solid var(--border-primary)' }}>
                          {reportTotals.joignabilite}%
                        </td>
                        <td style={{ padding: '12px', fontSize: 13, fontWeight: 700, textAlign: 'right', color: 'var(--text-primary)', borderTop: '1px solid var(--border-primary)' }}>
                          {reportTotals.rdv_booked}
                        </td>
                        <td style={{ padding: '12px', fontSize: 13, fontWeight: 700, textAlign: 'right', color: 'var(--text-primary)', borderTop: '1px solid var(--border-primary)' }}>
                          {reportTotals.closings}
                        </td>
                        <td style={{ padding: '12px', fontSize: 13, fontWeight: 700, textAlign: 'right', color: '#38A169', borderTop: '1px solid var(--border-primary)' }}>
                          {formatEuro(reportTotals.deal_amount)}
                        </td>
                        <td style={{ padding: '12px', fontSize: 13, fontWeight: 700, textAlign: 'right', color: reportTotals.no_shows > 0 ? '#ef4444' : 'var(--text-muted)', borderTop: '1px solid var(--border-primary)' }}>
                          {reportTotals.no_shows}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Empty state */}
              {reportData.length === 0 && (
                <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-muted)', fontSize: 13 }}>
                  Aucune donnee pour cette periode.
                </div>
              )}
            </div>
          )}

          {/* Alerts */}
          {!reportLoading && alerts.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 20 }}>
              {alerts.map((alert, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 16px', borderRadius: 10,
                    background: alert.type === 'warning' ? 'rgba(214,158,46,0.08)' : 'rgba(56,161,105,0.08)',
                    border: `1px solid ${alert.type === 'warning' ? 'rgba(214,158,46,0.25)' : 'rgba(56,161,105,0.25)'}`,
                    fontSize: 13,
                    color: alert.type === 'warning' ? '#D69E2E' : '#38A169',
                  }}
                >
                  {alert.type === 'warning'
                    ? <AlertTriangle size={15} style={{ flexShrink: 0 }} />
                    : <CheckCircle size={15} style={{ flexShrink: 0 }} />
                  }
                  {alert.message}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════════════ TAB: OBJECTIFS & COMMISSIONS ══════════════ */}
      {pageTab === 'objectifs' && isAdmin && (
        <div>
          {objLoading ? (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)', fontSize: 13 }}>
              Chargement...
            </div>
          ) : (
            <>
              {/* ── Objectifs Setters ── */}
              <div style={{ marginBottom: 32 }}>
                <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px' }}>
                  Objectifs Setter
                </h2>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 16px' }}>
                  Objectifs par defaut pour tous les setters
                </p>
                <div style={{
                  background: 'var(--bg-elevated)', borderRadius: 12,
                  border: '1px solid var(--border-primary)', padding: 20,
                  display: 'flex', flexDirection: 'column', gap: 14,
                }}>
                  {SETTER_OBJECTIVES.map(obj => {
                    const key = `setter_${obj.metric}`
                    const val = getObjValue('setter', obj.metric, obj.defaultValue)
                    const saving = objSaving === key
                    return (
                      <div key={obj.metric} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ fontSize: 13, color: 'var(--text-secondary)', minWidth: 140, fontWeight: 500 }}>
                          {obj.label}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <input
                            type="number"
                            min={0}
                            value={val}
                            onChange={e => setObjValue('setter', obj.metric, parseFloat(e.target.value) || 0)}
                            style={{
                              width: 90, padding: '7px 10px', borderRadius: 8,
                              background: 'var(--bg-primary)', border: '1px solid var(--border-primary)',
                              color: 'var(--text-primary)', fontSize: 13, textAlign: 'right',
                              outline: 'none',
                            }}
                          />
                          {obj.suffix && (
                            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{obj.suffix}</span>
                          )}
                        </div>
                        <button
                          onClick={() => saveObjective('setter', obj.metric, val)}
                          disabled={saving}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 5,
                            padding: '6px 14px', borderRadius: 7, fontSize: 12, fontWeight: 600,
                            background: 'var(--color-primary)', color: '#000', border: 'none',
                            cursor: saving ? 'not-allowed' : 'pointer',
                            opacity: saving ? 0.6 : 1,
                            transition: 'opacity 0.15s',
                          }}
                          onMouseEnter={e => { if (!saving) e.currentTarget.style.opacity = '0.85' }}
                          onMouseLeave={e => { if (!saving) e.currentTarget.style.opacity = '1' }}
                        >
                          <Save size={12} />
                          {saving ? 'En cours...' : 'Sauvegarder'}
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* ── Objectifs Closers ── */}
              <div style={{ marginBottom: 32 }}>
                <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px' }}>
                  Objectifs Closer
                </h2>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 16px' }}>
                  Objectifs par defaut pour tous les closers
                </p>
                <div style={{
                  background: 'var(--bg-elevated)', borderRadius: 12,
                  border: '1px solid var(--border-primary)', padding: 20,
                  display: 'flex', flexDirection: 'column', gap: 14,
                }}>
                  {CLOSER_OBJECTIVES.map(obj => {
                    const key = `closer_${obj.metric}`
                    const val = getObjValue('closer', obj.metric, obj.defaultValue)
                    const saving = objSaving === key
                    return (
                      <div key={obj.metric} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ fontSize: 13, color: 'var(--text-secondary)', minWidth: 140, fontWeight: 500 }}>
                          {obj.label}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <input
                            type="number"
                            min={0}
                            value={val}
                            onChange={e => setObjValue('closer', obj.metric, parseFloat(e.target.value) || 0)}
                            style={{
                              width: 90, padding: '7px 10px', borderRadius: 8,
                              background: 'var(--bg-primary)', border: '1px solid var(--border-primary)',
                              color: 'var(--text-primary)', fontSize: 13, textAlign: 'right',
                              outline: 'none',
                            }}
                          />
                          {obj.suffix && (
                            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{obj.suffix}</span>
                          )}
                        </div>
                        <button
                          onClick={() => saveObjective('closer', obj.metric, val)}
                          disabled={saving}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 5,
                            padding: '6px 14px', borderRadius: 7, fontSize: 12, fontWeight: 600,
                            background: 'var(--color-primary)', color: '#000', border: 'none',
                            cursor: saving ? 'not-allowed' : 'pointer',
                            opacity: saving ? 0.6 : 1,
                            transition: 'opacity 0.15s',
                          }}
                          onMouseEnter={e => { if (!saving) e.currentTarget.style.opacity = '0.85' }}
                          onMouseLeave={e => { if (!saving) e.currentTarget.style.opacity = '1' }}
                        >
                          <Save size={12} />
                          {saving ? 'En cours...' : 'Sauvegarder'}
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* ── Commissions Closers ── */}
              <div style={{ marginBottom: 32 }}>
                <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px' }}>
                  Commissions Closer
                </h2>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 16px' }}>
                  Configuration par defaut des commissions pour les closers
                </p>
                <div style={{
                  background: 'var(--bg-elevated)', borderRadius: 12,
                  border: '1px solid var(--border-primary)', padding: 20,
                  display: 'flex', flexDirection: 'column', gap: 18,
                }}>
                  {/* Type selection */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)', minWidth: 140, fontWeight: 500 }}>
                      Type
                    </span>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {([
                        { value: 'percentage' as const, label: 'Pourcentage' },
                        { value: 'fixed' as const, label: 'Montant fixe' },
                      ]).map(opt => {
                        const active = commDraft.type === opt.value
                        return (
                          <button
                            key={opt.value}
                            onClick={() => setCommDraft(prev => ({ ...prev, type: opt.value }))}
                            style={{
                              padding: '7px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                              background: active ? 'var(--color-primary)' : 'var(--bg-primary)',
                              color: active ? '#000' : 'var(--text-secondary)',
                              border: active ? 'none' : '1px solid var(--border-primary)',
                              cursor: 'pointer', transition: 'all 0.15s',
                            }}
                          >
                            {opt.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Value */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)', minWidth: 140, fontWeight: 500 }}>
                      Valeur
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input
                        type="number"
                        min={0}
                        value={commDraft.value}
                        onChange={e => setCommDraft(prev => ({ ...prev, value: parseFloat(e.target.value) || 0 }))}
                        style={{
                          width: 90, padding: '7px 10px', borderRadius: 8,
                          background: 'var(--bg-primary)', border: '1px solid var(--border-primary)',
                          color: 'var(--text-primary)', fontSize: 13, textAlign: 'right',
                          outline: 'none',
                        }}
                      />
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {commDraft.type === 'percentage' ? '%' : '\u20AC'}
                      </span>
                    </div>
                  </div>

                  {/* Separator */}
                  <div style={{ height: 1, background: 'var(--border-primary)', margin: '4px 0' }} />

                  {/* Bonus section */}
                  <div>
                    <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600, marginBottom: 12, display: 'block' }}>
                      Bonus
                    </span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ fontSize: 13, color: 'var(--text-secondary)', minWidth: 140, fontWeight: 500 }}>
                          Seuil (closings)
                        </span>
                        <input
                          type="number"
                          min={0}
                          value={commDraft.bonus_threshold}
                          onChange={e => setCommDraft(prev => ({ ...prev, bonus_threshold: parseInt(e.target.value) || 0 }))}
                          style={{
                            width: 90, padding: '7px 10px', borderRadius: 8,
                            background: 'var(--bg-primary)', border: '1px solid var(--border-primary)',
                            color: 'var(--text-primary)', fontSize: 13, textAlign: 'right',
                            outline: 'none',
                          }}
                        />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ fontSize: 13, color: 'var(--text-secondary)', minWidth: 140, fontWeight: 500 }}>
                          Montant bonus
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <input
                            type="number"
                            min={0}
                            value={commDraft.bonus_amount}
                            onChange={e => setCommDraft(prev => ({ ...prev, bonus_amount: parseFloat(e.target.value) || 0 }))}
                            style={{
                              width: 90, padding: '7px 10px', borderRadius: 8,
                              background: 'var(--bg-primary)', border: '1px solid var(--border-primary)',
                              color: 'var(--text-primary)', fontSize: 13, textAlign: 'right',
                              outline: 'none',
                            }}
                          />
                          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{'\u20AC'}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Save button */}
                  <div style={{ marginTop: 4 }}>
                    <button
                      onClick={saveCommission}
                      disabled={commSaving}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                        background: 'var(--color-primary)', color: '#000', border: 'none',
                        cursor: commSaving ? 'not-allowed' : 'pointer',
                        opacity: commSaving ? 0.6 : 1,
                        transition: 'opacity 0.15s',
                      }}
                      onMouseEnter={e => { if (!commSaving) e.currentTarget.style.opacity = '0.85' }}
                      onMouseLeave={e => { if (!commSaving) e.currentTarget.style.opacity = '1' }}
                    >
                      <Save size={13} />
                      {commSaving ? 'En cours...' : 'Sauvegarder les commissions'}
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
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
