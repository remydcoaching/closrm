import React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import type { MoreStackParamList } from '../types'
import { MoreMenuScreen } from '../../app/more/MoreMenuScreen'
import { NotificationsScreen } from '../../app/more/NotificationsScreen'
import { SocialPostsScreen } from '../../app/social/SocialPostsScreen'
import { SocialPostDetailScreen } from '../../app/social/SocialPostDetailScreen'
import { SocialPostFormScreen } from '../../app/social/SocialPostFormScreen'

const Stack = createNativeStackNavigator<MoreStackParamList>()

export default function MoreStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MoreMenu" component={MoreMenuScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="SocialPosts" component={SocialPostsScreen} />
      <Stack.Screen name="SocialPostDetail" component={SocialPostDetailScreen} />
      <Stack.Screen name="SocialPostForm" component={SocialPostFormScreen} />
    </Stack.Navigator>
  )
}
