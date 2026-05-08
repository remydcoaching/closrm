import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import Constants from 'expo-constants'
import { Platform } from 'react-native'
import { supabase } from './supabase'

// Display config : on veut afficher le banner même en foreground.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    // Anciens flags (compat SDK 52)
    shouldShowAlert: true,
  }),
})

export interface RegisterResult {
  token: string | null
  error: string | null
}

export async function registerForPushNotifications(): Promise<RegisterResult> {
  if (!Device.isDevice) {
    // Simulator → pas de push
    return { token: null, error: 'Push notifs uniquement sur device physique.' }
  }

  // Permissions
  const { status: existingStatus } = await Notifications.getPermissionsAsync()
  let finalStatus = existingStatus
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync()
    finalStatus = status
  }
  if (finalStatus !== 'granted') {
    return { token: null, error: 'Permission refusée.' }
  }

  // Android : channel obligatoire pour catégoriser
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#00C853',
    })
  }

  try {
    // projectId vient de app.json eas.projectId — fail-soft si absent
    const projectId =
      (Constants.expoConfig?.extra?.eas as { projectId?: string } | undefined)?.projectId ??
      (Constants.easConfig as { projectId?: string } | undefined)?.projectId
    const tokenRes = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    )
    return { token: tokenRes.data, error: null }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erreur token Expo.'
    return { token: null, error: msg }
  }
}

export async function savePushToken(token: string): Promise<void> {
  // Récup user + workspace
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return
  const { data: profile } = await supabase
    .from('users')
    .select('workspace_id')
    .eq('id', user.id)
    .maybeSingle()
  const workspaceId = (profile as { workspace_id?: string } | null)?.workspace_id
  if (!workspaceId) return

  await supabase.from('push_tokens').upsert(
    {
      user_id: user.id,
      workspace_id: workspaceId,
      token,
      platform: Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web',
      device_name: Device.deviceName ?? null,
    },
    { onConflict: 'token' },
  )
}
