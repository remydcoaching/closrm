'use client'

import { createContext, useCallback, useContext, useMemo, useState } from 'react'
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
    setStatusConfig(next)  // optimistic
    try {
      await patch({ status_config: next })
    } catch {
      setStatusConfig(mergeStatusConfig(initialStatusConfig))  // rollback
    }
  }, [patch, initialStatusConfig])

  const updateSourceConfig = useCallback(async (next: SourceConfig) => {
    setSourceConfig(next)
    try {
      await patch({ source_config: next })
    } catch {
      setSourceConfig(mergeSourceConfig(initialSourceConfig))
    }
  }, [patch, initialSourceConfig])

  const resetStatusConfig = useCallback(async () => {
    setStatusConfig(DEFAULT_STATUS_CONFIG)
    try {
      await patch({ status_config: null })
    } catch {
      setStatusConfig(mergeStatusConfig(initialStatusConfig))
    }
  }, [patch, initialStatusConfig])

  const resetSourceConfig = useCallback(async () => {
    setSourceConfig(DEFAULT_SOURCE_CONFIG)
    try {
      await patch({ source_config: null })
    } catch {
      setSourceConfig(mergeSourceConfig(initialSourceConfig))
    }
  }, [patch, initialSourceConfig])

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
