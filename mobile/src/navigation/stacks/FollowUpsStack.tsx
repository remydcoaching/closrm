import React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import type { FollowUpsStackParamList } from '../types'
import { FollowUpsScreen } from '../../app/follow-ups/FollowUpsScreen'
import { LeadDetailScreen } from '../../app/leads/LeadDetailScreen'
import { DmSessionConfigScreen } from '../../app/dm-session/DmSessionConfigScreen'
import { DmSessionLeadScreen } from '../../app/dm-session/DmSessionLeadScreen'
import { DmSessionCompleteScreen } from '../../app/dm-session/DmSessionCompleteScreen'

const Stack = createNativeStackNavigator<FollowUpsStackParamList>()

export default function FollowUpsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="FollowUpsList" component={FollowUpsScreen} />
      <Stack.Screen name="LeadDetail" component={LeadDetailScreen} />
      <Stack.Screen name="DmSessionConfig" component={DmSessionConfigScreen} />
      <Stack.Screen name="DmSessionLead" component={DmSessionLeadScreen} options={{ gestureEnabled: false }} />
      <Stack.Screen name="DmSessionComplete" component={DmSessionCompleteScreen} options={{ gestureEnabled: false }} />
    </Stack.Navigator>
  )
}
