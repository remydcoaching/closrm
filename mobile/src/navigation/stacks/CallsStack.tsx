import React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import type { CallsStackParamList } from '../types'
import { PlaceholderScreen } from '../../components/screens/Placeholder'

const Stack = createNativeStackNavigator<CallsStackParamList>()

export default function CallsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="CallsDay">{() => <PlaceholderScreen name="Calls" />}</Stack.Screen>
      <Stack.Screen name="CallDetail">{() => <PlaceholderScreen name="Call Detail" />}</Stack.Screen>
    </Stack.Navigator>
  )
}
