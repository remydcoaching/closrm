import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../services/supabase'
import type { AppNotification } from '@shared/types'

export function useNotifications() {
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)
    if (!error && data) setNotifications(data as AppNotification[])
    setLoading(false)
  }, [])

  useEffect(() => {
    void fetch()
  }, [fetch])

  useEffect(() => {
    const channel = supabase
      .channel('notifications-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => {
        void fetch()
      })
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [fetch])

  const markAllRead = useCallback(async () => {
    const ids = notifications.filter((n) => !n.read).map((n) => n.id)
    if (ids.length === 0) return
    await supabase.from('notifications').update({ read: true }).in('id', ids)
  }, [notifications])

  return { notifications, loading, refetch: fetch, markAllRead }
}
