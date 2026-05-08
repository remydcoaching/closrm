import React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import type { LeadsStackParamList } from '../types'
import { PlaceholderScreen } from '../../components/screens/Placeholder'

const Stack = createNativeStackNavigator<LeadsStackParamList>()

export default function LeadsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="LeadsList">{() => <PlaceholderScreen name="Leads" />}</Stack.Screen>
      <Stack.Screen name="LeadDetail">{() => <PlaceholderScreen name="Lead Detail" />}</Stack.Screen>
    </Stack.Navigator>
  )
}
