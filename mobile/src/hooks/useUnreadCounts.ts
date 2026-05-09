import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../services/supabase'
import { useAuth } from './useAuth'

export function useUnreadCounts() {
  const { session } = useAuth()
  const [unreadMessages, setUnreadMessages] = useState(0)
  const [unreadNotifications, setUnreadNotifications] = useState(0)

  const fetchMessages = useCallback(async () => {
    const { data, error } = await supabase
      .from('ig_conversations')
      .select('unread_count')
    if (!error && data) {
      const total = (data as { unread_count: number | null }[]).reduce(
        (sum, row) => sum + (row.unread_count ?? 0),
        0,
      )
      setUnreadMessages(total)
    }
  }, [])

  const fetchNotifications = useCallback(async () => {
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('read', false)
    if (!error && typeof count === 'number') {
      setUnreadNotifications(count)
    }
  }, [])

  useEffect(() => {
    if (!session) {
      setUnreadMessages(0)
      setUnreadNotifications(0)
      return
    }
    void fetchMessages()
    void fetchNotifications()
  }, [session, fetchMessages, fetchNotifications])

  useEffect(() => {
    if (!session) return
    const channel = supabase
      .channel('unread-counts-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ig_conversations' }, () => {
        void fetchMessages()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => {
        void fetchNotifications()
      })
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [session, fetchMessages, fetchNotifications])

  return { unreadMessages, unreadNotifications }
}
