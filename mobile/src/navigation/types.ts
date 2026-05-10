import type { NavigatorScreenParams } from '@react-navigation/native'

export type LeadsStackParamList = {
  LeadsList: undefined
  LeadDetail: { leadId: string }
}

export type CallsStackParamList = {
  CallsDay: undefined
  CallDetail: { callId: string }
}

export type MessagesStackParamList = {
  Inbox: undefined
  Conversation: { conversationId: string; leadId?: string }
}

export type MoreStackParamList = {
  MoreMenu: undefined
  Notifications: undefined
  NotificationSettings: undefined
  SocialPosts: undefined
  SocialPostDetail: { postId: string }
  SocialPostForm: { initialDate?: string }
  ReelsPrep: { reelIds: string[] | null }
  ReelsJourJ: { reelIds: string[] | null }
  ReelsBrief: { reelIds: string[] | null }
}

export type TabParamList = {
  LeadsTab: NavigatorScreenParams<LeadsStackParamList>
  CallsTab: NavigatorScreenParams<CallsStackParamList>
  MessagesTab: NavigatorScreenParams<MessagesStackParamList>
  PulseTab: undefined
  MoreTab: NavigatorScreenParams<MoreStackParamList>
}

export type RootStackParamList = {
  Login: undefined
  Main: NavigatorScreenParams<TabParamList>
}
