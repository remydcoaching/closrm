import React from 'react'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import type { TabParamList } from './types'
import LeadsStack from './stacks/LeadsStack'
import CallsStack from './stacks/CallsStack'
import MessagesStack from './stacks/MessagesStack'
import MoreStack from './stacks/MoreStack'
import { PlaceholderScreen } from '../components/screens/Placeholder'

const Tab = createBottomTabNavigator<TabParamList>()

// Icônes : on les ajoutera dans Task 5 (design system) avec un set custom SVG.
// Pour l'instant uniquement labels.
export default function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#09090b',
          borderTopColor: '#262626',
          borderTopWidth: 1,
        },
        tabBarActiveTintColor: '#00C853',
        tabBarInactiveTintColor: '#A0A0A0',
        tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
      }}
    >
      <Tab.Screen name="LeadsTab" component={LeadsStack} options={{ title: 'Leads' }} />
      <Tab.Screen name="CallsTab" component={CallsStack} options={{ title: 'Calls' }} />
      <Tab.Screen name="MessagesTab" component={MessagesStack} options={{ title: 'Messages' }} />
      <Tab.Screen name="PulseTab" options={{ title: 'Pulse' }}>
        {() => <PlaceholderScreen name="Pulse" />}
      </Tab.Screen>
      <Tab.Screen name="MoreTab" component={MoreStack} options={{ title: 'Plus' }} />
    </Tab.Navigator>
  )
}
