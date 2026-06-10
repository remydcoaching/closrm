import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../services/supabase'
import type { IgConversation } from '@shared/types'

export function useConversations() {
  const [conversations, setConversations] = useState<IgConversation[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('ig_conversations')
      .select('*')
      .order('last_message_at', { ascending: false, nullsFirst: false })
    if (!error && data) setConversations(data as IgConversation[])
    setLoading(false)
  }, [])

  useEffect(() => {
    void fetch()
  }, [fetch])

  useEffect(() => {
    const channel = supabase
      .channel('ig-conversations-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ig_conversations' }, () => {
        void fetch()
      })
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [fetch])

  return { conversations, loading, refetch: fetch }
}
