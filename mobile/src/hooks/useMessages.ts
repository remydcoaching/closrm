import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../services/supabase'
import type { IgMessage } from '@shared/types'

export function useMessages(conversationId: string | null) {
  const [messages, setMessages] = useState<IgMessage[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!conversationId) {
      setMessages([])
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error } = await supabase
      .from('ig_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('sent_at', { ascending: true })
    if (!error && data) setMessages(data as IgMessage[])
    setLoading(false)
  }, [conversationId])

  useEffect(() => {
    void fetch()
  }, [fetch])

  // Subscription ciblée : INSERT sur cette conversation = nouveau message.
  useEffect(() => {
    if (!conversationId) return
    const channel = supabase
      .channel(`messages-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ig_messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => {
          void fetch()
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [conversationId, fetch])

  return { messages, loading, refetch: fetch }
}
