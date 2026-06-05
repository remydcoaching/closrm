/**
 * Identity helpers for lead dedup.
 *
 * Normalize email/phone so that Meta webhook, booking endpoints, funnel submit
 * and manual imports all match the same lead across sources, regardless of
 * casing, spacing or French phone formatting.
 */

export function normalizeEmail(input: string | null | undefined): string | null {
  if (!input) return null
  const trimmed = input.trim().toLowerCase()
  if (!trimmed) return null
  if (!trimmed.includes('@')) return null
  return trimmed
}

/**
 * Normalize a phone number to E.164-like form for matching.
 * - Strips all non-digits except a leading '+'.
 * - French heuristic: bare 0XXXXXXXXX (10 digits starting with 0) → +33XXXXXXXXX.
 * - Returns null for empty/garbage input.
 *
 * This is *match-only*. We do not overwrite the stored lead.phone with the
 * normalized form — display fidelity stays as the user typed it.
 */
export function normalizePhone(input: string | null | undefined): string | null {
  if (!input) return null
  let raw = input.trim()
  if (!raw) return null

  const hasPlus = raw.startsWith('+')
  raw = raw.replace(/[^\d]/g, '')
  if (!raw) return null

  // French shape: 10 digits starting with 0 → +33...
  if (!hasPlus && raw.length === 10 && raw.startsWith('0')) {
    return '+33' + raw.slice(1)
  }

  // Already-prefixed FR variants: 0033... → +33...
  if (!hasPlus && raw.startsWith('0033')) {
    return '+' + raw.slice(2)
  }

  // 33XXXXXXXXX without plus → +33XXXXXXXXX
  if (!hasPlus && raw.length === 11 && raw.startsWith('33')) {
    return '+' + raw
  }

  return hasPlus ? '+' + raw : raw
}

export interface LeadIdentityLookup {
  email: string | null
  phone: string | null
}

/**
 * Resolve an existing lead in a workspace by normalized email then phone.
 * Returns the lead id or null. Caller decides whether to update or skip.
 *
 * Email lookup uses ilike (case-insensitive) on the raw column. Phone lookup
 * widens with the last 9 digits then filters with normalizePhone() in memory,
 * so 0612345678 / +33612345678 / 33 6 12 34 56 78 all match.
 */
export async function findExistingLeadId(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  workspaceId: string,
  identity: LeadIdentityLookup,
): Promise<string | null> {
  const email = normalizeEmail(identity.email)
  const phone = normalizePhone(identity.phone)

  if (email) {
    const { data } = await supabase
      .from('leads')
      .select('id, email, phone')
      .eq('workspace_id', workspaceId)
      .ilike('email', email)
      .limit(5)
    const match = (data as Array<{ id: string; email: string | null; phone: string | null }> | null ?? [])
      .find(row => normalizeEmail(row.email) === email)
    if (match) return match.id
  }

  if (phone) {
    const last9 = phone.replace(/\D/g, '').slice(-9)
    if (last9.length >= 8) {
      const { data } = await supabase
        .from('leads')
        .select('id, email, phone')
        .eq('workspace_id', workspaceId)
        .ilike('phone', `%${last9}%`)
        .limit(20)
      const match = (data as Array<{ id: string; email: string | null; phone: string | null }> | null ?? [])
        .find(row => normalizePhone(row.phone) === phone)
      if (match) return match.id
    }
  }

  return null
}
