'use client'

import { useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/ui/Toast'

export type SocialLeadSource = 'instagram_ads' | 'manuel'

export interface CreateLeadParams {
  username: string
  firstName?: string
  lastName?: string
  source: SocialLeadSource
  notes: string
  /** Called after success with the created lead id (e.g. to link a conversation). */
  afterCreate?: (leadId: string) => Promise<void> | void
  /** Override the default redirect to /leads/{id}. */
  redirect?: boolean
}

/**
 * Centralised "create a lead from a DM/comment" helper used by IG and YT.
 * - Looks up an existing lead by `instagram_handle` (username) before creating
 *   to avoid duplicates when the user clicks twice.
 * - Replaces alert() with toast notifications.
 * - Optionally redirects to the lead detail page.
 */
export function useSocialLeadCreation() {
  const router = useRouter()
  const toast = useToast()

  return useCallback(async (params: CreateLeadParams): Promise<string | null> => {
    const username = params.username.trim().replace(/^@/, '')
    if (!username) {
      toast.error('Impossible de créer le lead — username manquant.')
      return null
    }

    try {
      // Dedup: search for an existing lead with this handle
      const searchRes = await fetch(`/api/leads?search=${encodeURIComponent(username)}&per_page=5`)
      if (searchRes.ok) {
        const searchJson = await searchRes.json()
        const existing = ((searchJson.data ?? []) as Array<{ id: string; instagram_handle: string | null; first_name: string | null }>)
          .find(l => l.instagram_handle?.toLowerCase() === username.toLowerCase())
        if (existing?.id) {
          toast.info('Lead déjà existant', `@${username} est déjà dans ta base — on l’a ouvert.`)
          if (params.afterCreate) await params.afterCreate(existing.id)
          if (params.redirect !== false) router.push(`/leads/${existing.id}`)
          return existing.id
        }
      }

      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: params.firstName ?? username,
          last_name:  params.lastName ?? '',
          instagram_handle: username,
          source: params.source,
          notes: params.notes,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.data?.id) {
        const msg = typeof json.error === 'string' ? json.error : 'Impossible de créer le lead'
        toast.error('Erreur création lead', msg)
        return null
      }

      toast.success('Lead créé', `@${username} ajouté à ta base.`)
      if (params.afterCreate) await params.afterCreate(json.data.id)
      if (params.redirect !== false) router.push(`/leads/${json.data.id}`)
      return json.data.id
    } catch (e) {
      toast.error('Erreur réseau', (e as Error).message)
      return null
    }
  }, [router, toast])
}
