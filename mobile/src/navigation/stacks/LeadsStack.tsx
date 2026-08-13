import React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import type { LeadsStackParamList } from '../types'
import { LeadsListScreen } from '../../app/leads/LeadsListScreen'
import { LeadDetailScreen } from '../../app/leads/LeadDetailScreen'
import { ImportScreenshotsScreen } from '../../app/leads/ImportScreenshotsScreen'

const Stack = createNativeStackNavigator<LeadsStackParamList>()

export default function LeadsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="LeadsList" component={LeadsListScreen} />
      <Stack.Screen name="LeadDetail" component={LeadDetailScreen} />
      <Stack.Screen name="ImportScreenshots" component={ImportScreenshotsScreen} />
    </Stack.Navigator>
  )
}
