import { useEffect, useRef } from 'react'
import { Alert } from 'react-native'
import * as Notifications from 'expo-notifications'
import { useAuth } from './useAuth'
import { registerForPushNotifications, savePushToken } from '../services/push'
import type { NavigationContainerRef } from '@react-navigation/native'

interface PushPayload {
  /** entity_type + entity_id passés par le backend dans data — permettent
   *  d'ouvrir le bon écran sur tap. */
  entity_type?: 'lead' | 'call' | 'conversation' | 'deal'
  entity_id?: string
}

/** Hook à monter UNE fois au root (ex: dans App.tsx).
 *  - Demande permissions + récupère le token Expo.
 *  - Sauve le token dans push_tokens (multi-device safe).
 *  - Branche un listener pour les taps sur push → deep link.
 */
export function useExpoPush(
  navRef: React.RefObject<NavigationContainerRef<Record<string, object | undefined>> | null>,
) {
  const { user } = useAuth()
  const responseListener = useRef<Notifications.EventSubscription | null>(null)
  const receivedListener = useRef<Notifications.EventSubscription | null>(null)

  // Register dès qu'on est authed
  useEffect(() => {
    if (!user) return
    let cancelled = false
    void (async () => {
      const { token, error } = await registerForPushNotifications()
      if (cancelled) return
      if (error) {
        // TEMP DEBUG : visible Alert pour traquer pourquoi certains tokens
        // ne s'enregistrent pas. À retirer une fois le bug compris.
        Alert.alert('Push register error', error)
        return
      }
      if (!token) {
        Alert.alert('Push register error', 'Token Expo null sans erreur')
        return
      }
      try {
        await savePushToken(token)
        Alert.alert('Push OK', `Token enregistré : ${token.slice(0, 30)}…`)
      } catch (e) {
        Alert.alert(
          'savePushToken error',
          e instanceof Error ? e.message : String(e),
        )
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user])

  // Listener tap → deep link
  useEffect(() => {
    receivedListener.current = Notifications.addNotificationReceivedListener(() => {
      // Foreground reception — pas d'action particulière, le banner s'affiche
      // automatiquement (cf setNotificationHandler dans push.ts).
    })

    responseListener.current = Notifications.addNotificationResponseReceivedListener((resp) => {
      const data = (resp.notification.request.content.data ?? {}) as PushPayload
      if (!data.entity_type || !data.entity_id) return
      const ref = navRef.current
      if (!ref) return
      switch (data.entity_type) {
        case 'lead':
          ref.navigate('Main', {
            screen: 'LeadsTab',
            params: { screen: 'LeadDetail', params: { leadId: data.entity_id } },
          })
          break
        case 'call':
          ref.navigate('Main', {
            screen: 'CallsTab',
            params: { screen: 'CallDetail', params: { callId: data.entity_id } },
          })
          break
        case 'conversation':
          ref.navigate('Main', {
            screen: 'MessagesTab',
            params: { screen: 'Conversation', params: { conversationId: data.entity_id } },
          })
          break
        case 'deal':
          // Pas d'écran deal mobile pour l'instant — fallback sur lead si
          // on connaît le lead lié. Sinon notifications screen.
          ref.navigate('Main', {
            screen: 'MoreTab',
            params: { screen: 'Notifications' },
          })
          break
      }
    })

    return () => {
      receivedListener.current?.remove()
      responseListener.current?.remove()
    }
  }, [navRef])
}
