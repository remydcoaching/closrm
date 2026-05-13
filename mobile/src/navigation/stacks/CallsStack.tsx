import React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import type { CallsStackParamList } from '../types'
import { CallsDayScreen } from '../../app/calls/CallsDayScreen'
import { CallDetailScreen } from '../../app/calls/CallDetailScreen'

const Stack = createNativeStackNavigator<CallsStackParamList>()

export default function CallsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="CallsDay" component={CallsDayScreen} />
      <Stack.Screen name="CallDetail" component={CallDetailScreen} />
    </Stack.Navigator>
  )
}
