import React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import type { MessagesStackParamList } from '../types'
import { InboxScreen } from '../../app/messages/InboxScreen'
import { ConversationScreen } from '../../app/messages/ConversationScreen'

const Stack = createNativeStackNavigator<MessagesStackParamList>()

export default function MessagesStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Inbox" component={InboxScreen} />
      <Stack.Screen name="Conversation" component={ConversationScreen} />
    </Stack.Navigator>
  )
}
