import { useCallback, useEffect, useState } from 'react'
import { api } from '../services/api'
import { supabase } from '../services/supabase'

export interface LeadNote {
  id: string
  lead_id: string
  workspace_id: string
  content: string
  created_at: string
  updated_at: string
  created_by: string | null
}

/** Liste les notes d'un lead via /api/lead-notes (table `lead_notes`).
 *  Realtime via supabase channel sur la table — sync instantané quand
 *  une note est ajoutée/modifiée depuis le web ou un autre device. */
export function useLeadNotes(leadId: string | null) {
  const [notes, setNotes] = useState<LeadNote[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!leadId) {
      setNotes([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await api.get<{ data: LeadNote[] }>(
        `/api/lead-notes?lead_id=${encodeURIComponent(leadId)}`,
      )
      setNotes(res.data ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur chargement notes')
    } finally {
      setLoading(false)
    }
  }, [leadId])

  useEffect(() => {
    void fetch()
  }, [fetch])

  // Realtime — refetch dès qu'une note de CE lead change
  useEffect(() => {
    if (!leadId) return
    const channel = supabase
      .channel(`lead-notes-${leadId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'lead_notes',
          filter: `lead_id=eq.${leadId}`,
        },
        () => {
          void fetch()
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [leadId, fetch])

  const addNote = useCallback(
    async (content: string): Promise<LeadNote | null> => {
      if (!leadId) return null
      const trimmed = content.trim()
      if (!trimmed) return null
      try {
        const res = await api.post<{ data: LeadNote }>('/api/lead-notes', {
          lead_id: leadId,
          content: trimmed,
        })
        const note = res.data
        setNotes((prev) => [note, ...prev])
        return note
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erreur ajout note')
        return null
      }
    },
    [leadId],
  )

  const updateNote = useCallback(
    async (noteId: string, content: string): Promise<void> => {
      const trimmed = content.trim()
      if (!trimmed) return
      // Optimistic
      setNotes((prev) => prev.map((n) => (n.id === noteId ? { ...n, content: trimmed } : n)))
      try {
        await api.patch(`/api/lead-notes/${noteId}`, { content: trimmed })
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erreur mise à jour')
        void fetch() // rollback
      }
    },
    [fetch],
  )

  const removeNote = useCallback(
    async (noteId: string): Promise<void> => {
      // Optimistic
      const prev = notes
      setNotes((curr) => curr.filter((n) => n.id !== noteId))
      try {
        await api.delete(`/api/lead-notes/${noteId}`)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erreur suppression')
        setNotes(prev) // rollback
      }
    },
    [notes],
  )

  return { notes, loading, error, refetch: fetch, addNote, updateNote, removeNote }
}
