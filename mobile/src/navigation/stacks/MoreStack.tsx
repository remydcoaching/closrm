import React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import type { MoreStackParamList } from '../types'
import { MoreMenuScreen } from '../../app/more/MoreMenuScreen'
import { NotificationsScreen } from '../../app/more/NotificationsScreen'

const Stack = createNativeStackNavigator<MoreStackParamList>()

export default function MoreStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MoreMenu" component={MoreMenuScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
    </Stack.Navigator>
  )
}
