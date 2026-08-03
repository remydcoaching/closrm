import React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import type { FollowUpsStackParamList } from '../types'
import { FollowUpsScreen } from '../../app/follow-ups/FollowUpsScreen'
import { LeadDetailScreen } from '../../app/leads/LeadDetailScreen'

const Stack = createNativeStackNavigator<FollowUpsStackParamList>()

export default function FollowUpsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="FollowUpsList" component={FollowUpsScreen} />
      <Stack.Screen name="LeadDetail" component={LeadDetailScreen} />
    </Stack.Navigator>
  )
}
