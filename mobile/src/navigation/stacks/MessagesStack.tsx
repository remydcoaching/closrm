import React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import type { MessagesStackParamList } from '../types'
import { PlaceholderScreen } from '../../components/screens/Placeholder'

const Stack = createNativeStackNavigator<MessagesStackParamList>()

export default function MessagesStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Inbox">{() => <PlaceholderScreen name="Inbox" />}</Stack.Screen>
      <Stack.Screen name="Conversation">{() => <PlaceholderScreen name="Conversation" />}</Stack.Screen>
    </Stack.Navigator>
  )
}
