import React from 'react'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { Ionicons } from '@expo/vector-icons'
import type { TabParamList } from './types'
import LeadsStack from './stacks/LeadsStack'
import CallsStack from './stacks/CallsStack'
import MessagesStack from './stacks/MessagesStack'
import MoreStack from './stacks/MoreStack'
import { PulseScreen } from '../app/pulse/PulseScreen'

const Tab = createBottomTabNavigator<TabParamList>()

type IoniconName = keyof typeof Ionicons.glyphMap

const iconFor = (route: keyof TabParamList, focused: boolean): IoniconName => {
  switch (route) {
    case 'LeadsTab':
      return focused ? 'people' : 'people-outline'
    case 'CallsTab':
      return focused ? 'call' : 'call-outline'
    case 'MessagesTab':
      return focused ? 'chatbubbles' : 'chatbubbles-outline'
    case 'PulseTab':
      return focused ? 'pulse' : 'pulse-outline'
    case 'MoreTab':
      return focused ? 'ellipsis-horizontal-circle' : 'ellipsis-horizontal-circle-outline'
  }
}

export default function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        // Tab bar premium : un peu translucide effet glass via solid-on-bg,
        // bordure top sobre, hauteur généreuse pour respiration.
        tabBarStyle: {
          backgroundColor: '#000000',
          borderTopColor: '#2c2c2e',
          borderTopWidth: 0.5,
          height: 88,
          paddingTop: 8,
          paddingBottom: 24,
        },
        tabBarActiveTintColor: '#00C853',
        tabBarInactiveTintColor: '#6E6E73',
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
          letterSpacing: 0.3,
          marginTop: 2,
        },
        tabBarIcon: ({ focused, color }) => (
          <Ionicons name={iconFor(route.name, focused)} size={focused ? 26 : 24} color={color} />
        ),
      })}
    >
      <Tab.Screen name="LeadsTab" component={LeadsStack} options={{ title: 'Leads' }} />
      <Tab.Screen name="CallsTab" component={CallsStack} options={{ title: 'Calls' }} />
      <Tab.Screen name="MessagesTab" component={MessagesStack} options={{ title: 'Messages' }} />
      <Tab.Screen name="PulseTab" component={PulseScreen} options={{ title: 'Pulse' }} />
      <Tab.Screen name="MoreTab" component={MoreStack} options={{ title: 'Plus' }} />
    </Tab.Navigator>
  )
}
