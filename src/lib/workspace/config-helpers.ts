import type { LeadSource, LeadStatus, SourceConfig, SourceConfigEntry, StatusConfig, StatusConfigEntry } from '@/types'
import { DEFAULT_STATUS_CONFIG } from './status-defaults'
import { DEFAULT_SOURCE_CONFIG } from './source-defaults'

// ------------------------------------------------------------------
// Hex → rgba conversion (for badge background generation)
// ------------------------------------------------------------------
export function hexToRgba(hex: string, alpha = 0.12): string {
  // Accepts '#RRGGBB' or '#RGB'. Returns 'rgba(R,G,B,a)'.
  let normalized = hex.replace(/^#/, '')
  if (normalized.length === 3) {
    normalized = normalized.split('').map((c) => c + c).join('')
  }
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return `rgba(160,160,160,${alpha})`
  }
  const r = parseInt(normalized.slice(0, 2), 16)
  const g = parseInt(normalized.slice(2, 4), 16)
  const b = parseInt(normalized.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

// ------------------------------------------------------------------
// Merge stored overrides with defaults.
// - Preserves order from the stored config for keys that exist in both.
// - Appends default entries for keys present in defaults but absent from stored.
// - Filters out stored entries whose key is no longer a valid enum value.
// ------------------------------------------------------------------
export function mergeStatusConfig(stored: StatusConfig | null | undefined): StatusConfig {
  if (!stored || stored.length === 0) return DEFAULT_STATUS_CONFIG

  const validKeys = new Set<LeadStatus>(DEFAULT_STATUS_CONFIG.map((e) => e.key))
  const filtered = stored.filter((e) => validKeys.has(e.key))
  const seen = new Set<LeadStatus>(filtered.map((e) => e.key))

  const missing = DEFAULT_STATUS_CONFIG.filter((e) => !seen.has(e.key))
  return [...filtered, ...missing]
}

export function mergeSourceConfig(stored: SourceConfig | null | undefined): SourceConfig {
  if (!stored || stored.length === 0) return DEFAULT_SOURCE_CONFIG

  const validKeys = new Set<LeadSource>(DEFAULT_SOURCE_CONFIG.map((e) => e.key))
  const filtered = stored.filter((e) => validKeys.has(e.key))
  const seen = new Set<LeadSource>(filtered.map((e) => e.key))

  const missing = DEFAULT_SOURCE_CONFIG.filter((e) => !seen.has(e.key))
  return [...filtered, ...missing]
}

// ------------------------------------------------------------------
// Lookup helpers (O(n) but n ≤ 8; fine)
// ------------------------------------------------------------------
export function findStatusEntry(config: StatusConfig, key: LeadStatus): StatusConfigEntry {
  return config.find((e) => e.key === key) || DEFAULT_STATUS_CONFIG.find((e) => e.key === key)!
}

export function findSourceEntry(config: SourceConfig, key: LeadSource): SourceConfigEntry {
  return config.find((e) => e.key === key) || DEFAULT_SOURCE_CONFIG.find((e) => e.key === key)!
}
