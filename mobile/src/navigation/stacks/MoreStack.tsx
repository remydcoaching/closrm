import React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import type { MoreStackParamList } from '../types'
import { PlaceholderScreen } from '../../components/screens/Placeholder'

const Stack = createNativeStackNavigator<MoreStackParamList>()

export default function MoreStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MoreMenu">{() => <PlaceholderScreen name="Plus" />}</Stack.Screen>
      <Stack.Screen name="Notifications">{() => <PlaceholderScreen name="Notifications" />}</Stack.Screen>
    </Stack.Navigator>
  )
}
