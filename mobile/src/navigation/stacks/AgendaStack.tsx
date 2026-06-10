import React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import type { AgendaStackParamList } from '../types'
import { AgendaDayScreen } from '../../app/agenda/AgendaDayScreen'
import { CallDetailScreen } from '../../app/calls/CallDetailScreen'
import { LeadDetailScreen } from '../../app/leads/LeadDetailScreen'

const Stack = createNativeStackNavigator<AgendaStackParamList>()

export default function AgendaStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="AgendaDay" component={AgendaDayScreen} />
      <Stack.Screen name="CallDetail" component={CallDetailScreen} />
      <Stack.Screen name="LeadDetail" component={LeadDetailScreen} />
    </Stack.Navigator>
  )
}
