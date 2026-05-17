import type { NavigatorScreenParams } from '@react-navigation/native'

export type LeadsStackParamList = {
  LeadsList: undefined
  LeadDetail: { leadId: string }
}

export type CallsStackParamList = {
  CallsDay: undefined
  CallDetail: { callId: string }
}

// AgendaStack : timeline jour (bookings + calls fusionnés). Contient ses propres
// CallDetail / LeadDetail pour rester un stack auto-suffisant (navigation par push).
export type AgendaStackParamList = {
  AgendaDay: undefined
  CallDetail: { callId: string }
  LeadDetail: { leadId: string }
}

export type MessagesStackParamList = {
  Inbox: undefined
  Conversation: { conversationId: string; leadId?: string }
}

export type MoreStackParamList = {
  MoreMenu: undefined
  Notifications: undefined
  NotificationSettings: undefined
  Branding: undefined
  TournageSessions: undefined
  SocialPosts: undefined
  SocialPostDetail: { postId: string }
  SocialPostForm: { initialDate?: string }
  ReelsPrep: { reelIds: string[] | null; sessionId?: string | null }
  ReelsJourJ: { reelIds: string[] | null; sessionId?: string | null }
}

export type TabParamList = {
  LeadsTab: NavigatorScreenParams<LeadsStackParamList>
  AgendaTab: NavigatorScreenParams<AgendaStackParamList>
  MessagesTab: NavigatorScreenParams<MessagesStackParamList>
  PulseTab: undefined
  MoreTab: NavigatorScreenParams<MoreStackParamList>
}

export type RootStackParamList = {
  Login: undefined
  Main: NavigatorScreenParams<TabParamList>
}
