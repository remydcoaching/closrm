'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { LeadSource, LeadStatus, SourceConfig, SourceConfigEntry, StatusConfig, StatusConfigEntry } from '@/types'
import { mergeStatusConfig, mergeSourceConfig, findStatusEntry, findSourceEntry } from './config-helpers'
import { DEFAULT_STATUS_CONFIG } from './status-defaults'
import { DEFAULT_SOURCE_CONFIG } from './source-defaults'

interface ConfigContextValue {
  statusConfig: StatusConfig
  sourceConfig: SourceConfig
  updateStatusConfig: (next: StatusConfig) => Promise<void>
  updateSourceConfig: (next: SourceConfig) => Promise<void>
  resetStatusConfig: () => Promise<void>
  resetSourceConfig: () => Promise<void>
  loading: boolean
  error: string | null
}

const WorkspaceConfigContext = createContext<ConfigContextValue | null>(null)

interface ProviderProps {
  initialStatusConfig: StatusConfig | null
  initialSourceConfig: SourceConfig | null
  children: React.ReactNode
}

export function WorkspaceConfigProvider({ initialStatusConfig, initialSourceConfig, children }: ProviderProps) {
  const [statusConfig, setStatusConfig] = useState<StatusConfig>(
    () => mergeStatusConfig(initialStatusConfig),
  )
  const [sourceConfig, setSourceConfig] = useState<SourceConfig>(
    () => mergeSourceConfig(initialSourceConfig),
  )
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const patch = useCallback(async (body: { status_config?: StatusConfig | null; source_config?: SourceConfig | null }) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/workspace/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erreur')
      if (json.data?.status_config) setStatusConfig(json.data.status_config)
      if (json.data?.source_config) setSourceConfig(json.data.source_config)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const updateStatusConfig = useCallback(async (next: StatusConfig) => {
    const previous = statusConfig  // snapshot before optimistic write
    setStatusConfig(next)
    try {
      await patch({ status_config: next })
    } catch {
      setStatusConfig(previous)  // restore snapshot, not server prop
    }
  }, [patch, statusConfig])

  const updateSourceConfig = useCallback(async (next: SourceConfig) => {
    const previous = sourceConfig
    setSourceConfig(next)
    try {
      await patch({ source_config: next })
    } catch {
      setSourceConfig(previous)
    }
  }, [patch, sourceConfig])

  const resetStatusConfig = useCallback(async () => {
    const previous = statusConfig
    setStatusConfig(DEFAULT_STATUS_CONFIG)
    try {
      await patch({ status_config: null })
    } catch {
      setStatusConfig(previous)
    }
  }, [patch, statusConfig])

  const resetSourceConfig = useCallback(async () => {
    const previous = sourceConfig
    setSourceConfig(DEFAULT_SOURCE_CONFIG)
    try {
      await patch({ source_config: null })
    } catch {
      setSourceConfig(previous)
    }
  }, [patch, sourceConfig])

  // One-shot migration: if the server returned no stored status_config
  // but the browser has a legacy localStorage Kanban pref, import it
  // into the workspace (preserves the user's existing Kanban ordering
  // and visibility choices) then clear the localStorage.
  useEffect(() => {
    if (initialStatusConfig) return  // already migrated for this workspace
    if (typeof window === 'undefined') return
    const raw = window.localStorage.getItem('closrm.leads.kanban.columns')
    if (!raw) return
    try {
      const parsed = JSON.parse(raw) as { visible?: string[]; order?: string[] }
      if (!parsed.order || !parsed.visible) return

      const visibleSet = new Set(parsed.visible)
      const migrated: StatusConfig = []
      for (const key of parsed.order) {
        const def = DEFAULT_STATUS_CONFIG.find((e) => e.key === key)
        if (def) migrated.push({ ...def, visible: visibleSet.has(key) })
      }
      for (const def of DEFAULT_STATUS_CONFIG) {
        if (!migrated.some((e) => e.key === def.key)) migrated.push(def)
      }

      fetch('/api/workspace/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status_config: migrated }),
      }).then((res) => {
        if (res.ok) {
          setStatusConfig(migrated)
          window.localStorage.removeItem('closrm.leads.kanban.columns')
        }
      }).catch(() => {})
    } catch {
      // corrupted localStorage, ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const value = useMemo<ConfigContextValue>(() => ({
    statusConfig, sourceConfig,
    updateStatusConfig, updateSourceConfig,
    resetStatusConfig, resetSourceConfig,
    loading, error,
  }), [statusConfig, sourceConfig, updateStatusConfig, updateSourceConfig, resetStatusConfig, resetSourceConfig, loading, error])

  return <WorkspaceConfigContext.Provider value={value}>{children}</WorkspaceConfigContext.Provider>
}

// ------------------------------------------------------------------
// Hooks
// ------------------------------------------------------------------
export function useWorkspaceConfig(): ConfigContextValue {
  const ctx = useContext(WorkspaceConfigContext)
  if (!ctx) throw new Error('useWorkspaceConfig must be used within WorkspaceConfigProvider')
  return ctx
}

export function useStatusConfig(): StatusConfig {
  return useWorkspaceConfig().statusConfig
}

export function useSourceConfig(): SourceConfig {
  return useWorkspaceConfig().sourceConfig
}

export function useStatusEntry(key: LeadStatus): StatusConfigEntry {
  const config = useStatusConfig()
  return findStatusEntry(config, key)
}

export function useSourceEntry(key: LeadSource): SourceConfigEntry {
  const config = useSourceConfig()
  return findSourceEntry(config, key)
}
