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
        tabBarStyle: {
          backgroundColor: '#09090b',
          borderTopColor: '#262626',
          borderTopWidth: 1,
          height: 84,
          paddingTop: 6,
        },
        tabBarActiveTintColor: '#00C853',
        tabBarInactiveTintColor: '#A0A0A0',
        tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
        tabBarIcon: ({ focused, color, size }) => (
          <Ionicons name={iconFor(route.name, focused)} size={size ?? 22} color={color} />
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
