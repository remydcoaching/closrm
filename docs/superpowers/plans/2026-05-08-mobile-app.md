# ClosRM Mobile — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Créer une application mobile React Native pour ClosRM, connectée à la même base Supabase que l'app web, avec 9 écrans et des push notifications.

**Architecture:** Mono-repo (dossier `mobile/` dans le repo existant) + dossier `shared/` pour les types/validations. Lectures via Supabase direct avec subscriptions temps réel, écritures via API routes Next.js existantes sur Vercel. React Navigation (tab + stacks), NativeWind pour le styling.

**Tech Stack:** React Native CLI (PAS Expo), NativeWind, React Navigation, @supabase/supabase-js, @gorhom/bottom-sheet, react-native-svg, react-native-push-notification, react-native-keychain

**Spec de référence:** `docs/superpowers/specs/2026-05-08-mobile-app-design.md`

**Maquettes:** `C:\Users\remyd\Downloads\ClosRM Mobile High fidelity-handoff\closrm-mobile-high-fidelity\project\screens\`

---

## Phase 1 — Fondations

### Task 1: Setup projet React Native CLI + NativeWind

**Files:**
- Create: `mobile/package.json`
- Create: `mobile/tsconfig.json`
- Create: `mobile/tailwind.config.js`
- Create: `mobile/babel.config.js`
- Create: `mobile/metro.config.js`
- Create: `mobile/App.tsx`
- Create: `mobile/nativewind-env.d.ts`
- Create: `mobile/.gitignore`

- [ ] **Step 1: Initialiser le projet React Native**

```bash
cd closrm
npx @react-native-community/cli init ClosRMMobile --directory mobile --skip-git-init
```

- [ ] **Step 2: Installer les dépendances core**

```bash
cd mobile
npm install nativewind tailwindcss@3.3.2
npm install --save-dev @types/react @types/react-native
```

- [ ] **Step 3: Configurer NativeWind — tailwind.config.js**

```js
// mobile/tailwind.config.js
module.exports = {
  content: ['./App.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: '#09090b',
          secondary: '#0c0c0e',
          elevated: '#141414',
        },
        sheet: '#1c1c1e',
        border: '#262626',
        primary: '#00C853',
        warning: '#f59e0b',
        danger: '#ef4444',
        info: '#3b82f6',
        purple: '#a855f7',
        cyan: '#06b6d4',
        pink: '#ec4899',
        orange: '#f97316',
        'text-primary': '#FFFFFF',
        'text-secondary': '#A0A0A0',
      },
      fontSize: {
        'large-title': ['28px', { lineHeight: '34px', fontWeight: '700' }],
        title: ['22px', { lineHeight: '28px', fontWeight: '700' }],
        headline: ['17px', { lineHeight: '22px', fontWeight: '600' }],
        body: ['15px', { lineHeight: '20px', fontWeight: '400' }],
        subheadline: ['13px', { lineHeight: '18px', fontWeight: '400' }],
        caption: ['11px', { lineHeight: '13px', fontWeight: '400' }],
      },
      spacing: {
        xs: '4px',
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '20px',
        xxl: '24px',
      },
      borderRadius: {
        xs: '6px',
        sm: '8px',
        md: '10px',
        lg: '14px',
        xl: '20px',
        sheet: '28px',
        pill: '999px',
      },
    },
  },
  plugins: [],
}
```

- [ ] **Step 4: Configurer babel.config.js pour NativeWind**

```js
// mobile/babel.config.js
module.exports = {
  presets: ['module:@react-native/babel-preset', 'nativewind/babel'],
}
```

- [ ] **Step 5: Créer le fichier nativewind-env.d.ts**

```ts
// mobile/nativewind-env.d.ts
/// <reference types="nativewind/types" />
```

- [ ] **Step 6: Configurer metro.config.js pour le dossier shared/**

```js
// mobile/metro.config.js
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config')
const path = require('path')

const defaultConfig = getDefaultConfig(__dirname)

const config = {
  watchFolders: [path.resolve(__dirname, '../shared')],
  resolver: {
    nodeModulesPaths: [
      path.resolve(__dirname, 'node_modules'),
    ],
    extraNodeModules: {
      '@shared': path.resolve(__dirname, '../shared'),
    },
  },
}

module.exports = mergeConfig(defaultConfig, config)
```

- [ ] **Step 7: Configurer tsconfig.json avec les paths**

```json
{
  "extends": "@react-native/typescript-config/tsconfig.json",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@shared/*": ["../shared/*"]
    },
    "strict": true
  },
  "include": ["src/**/*", "App.tsx", "../shared/**/*"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 8: Créer App.tsx minimal pour vérifier que tout compile**

```tsx
// mobile/App.tsx
import React from 'react'
import { View, Text } from 'react-native'
import './global.css'

export default function App() {
  return (
    <View className="flex-1 bg-bg-primary items-center justify-center">
      <Text className="text-large-title text-text-primary">ClosRM</Text>
      <Text className="text-body text-text-secondary mt-sm">Mobile App</Text>
    </View>
  )
}
```

- [ ] **Step 9: Build et run sur iOS pour vérifier**

```bash
cd mobile/ios && pod install && cd ..
npx react-native run-ios
```

Expected: écran noir avec "ClosRM" en blanc et "Mobile App" en gris.

- [ ] **Step 10: Commit**

```bash
git add mobile/
git commit -m "feat(mobile): init React Native project with NativeWind"
```

---

### Task 2: Dossier shared/ — Extraire types et validations

**Files:**
- Create: `shared/types/index.ts`
- Create: `shared/validations/leads.ts`
- Create: `shared/validations/calls.ts`

- [ ] **Step 1: Créer shared/types/index.ts**

Copier depuis `src/types/index.ts` uniquement les types nécessaires au mobile. Au minimum :

```ts
// shared/types/index.ts
// Copier les interfaces et types suivants depuis src/types/index.ts :
// - Workspace, User, WorkspaceMember, WorkspaceMemberWithUser
// - LeadStatus, LeadSource, Lead
// - DealStatus, Deal
// - CallType, CallOutcome, Call
// - FollowUp (si utilisé)
// - IgConversation, IgMessage (pour l'inbox)
// Plus le nouveau type Notification :

export interface AppNotification {
  id: string
  workspace_id: string
  type: 'new_lead' | 'no_show' | 'deal_closed' | 'dm_reply' | 'call_reminder' | 'booking'
  title: string
  subtitle: string | null
  entity_type: 'lead' | 'call' | 'deal' | 'conversation' | null
  entity_id: string | null
  read: boolean
  created_at: string
}
```

**Important :** Ne pas créer de nouveau fichier dans `src/types/` — copier les types pertinents dans `shared/types/index.ts`. Les deux apps importent depuis ce dossier partagé. À terme, migrer aussi l'app web pour importer depuis `shared/` au lieu de `src/types/`.

- [ ] **Step 2: Créer shared/validations/leads.ts**

Copier les schémas Zod pertinents depuis `src/lib/validations/leads.ts` : `createLeadSchema`, `updateLeadSchema`.

- [ ] **Step 3: Créer shared/validations/calls.ts**

Copier les schémas Zod pertinents depuis `src/lib/validations/calls.ts` : `createCallSchema`, `updateCallSchema`.

- [ ] **Step 4: Vérifier que mobile/ peut importer depuis shared/**

Ajouter un import test dans `App.tsx` :

```tsx
import type { Lead } from '@shared/types'
```

Build et vérifier qu'il n'y a pas d'erreur.

- [ ] **Step 5: Commit**

```bash
git add shared/
git commit -m "feat(shared): extract types and validations for mobile"
```

---

### Task 3: Services — Client Supabase + API client

**Files:**
- Create: `mobile/src/services/supabase.ts`
- Create: `mobile/src/services/api.ts`
- Create: `mobile/src/services/auth.ts`

- [ ] **Step 1: Installer les dépendances**

```bash
cd mobile
npm install @supabase/supabase-js react-native-keychain react-native-url-polyfill
cd ios && pod install && cd ..
```

- [ ] **Step 2: Créer le client Supabase — mobile/src/services/supabase.ts**

```ts
// mobile/src/services/supabase.ts
import 'react-native-url-polyfill/auto'
import { createClient } from '@supabase/supabase-js'
import * as Keychain from 'react-native-keychain'

const SUPABASE_URL = 'https://YOUR_PROJECT.supabase.co' // à remplacer par env var
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY' // à remplacer par env var

const keychainStorage = {
  async getItem(key: string): Promise<string | null> {
    const credentials = await Keychain.getGenericPassword({ service: key })
    return credentials ? credentials.password : null
  },
  async setItem(key: string, value: string): Promise<void> {
    await Keychain.setGenericPassword(key, value, { service: key })
  },
  async removeItem(key: string): Promise<void> {
    await Keychain.resetGenericPassword({ service: key })
  },
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: keychainStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})
```

**Note :** Les variables SUPABASE_URL et SUPABASE_ANON_KEY doivent être extraites dans un fichier de config ou env. Utiliser `react-native-config` si besoin.

- [ ] **Step 3: Créer le client API — mobile/src/services/api.ts**

```ts
// mobile/src/services/api.ts
import { supabase } from './supabase'

const API_BASE_URL = 'https://YOUR_VERCEL_DOMAIN' // à remplacer

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error('Not authenticated')
  return {
    'Authorization': `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  }
}

export const api = {
  async get<T>(path: string): Promise<T> {
    const headers = await getAuthHeaders()
    const res = await fetch(`${API_BASE_URL}${path}`, { headers })
    if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`)
    return res.json()
  },

  async post<T>(path: string, body: unknown): Promise<T> {
    const headers = await getAuthHeaders()
    const res = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`)
    return res.json()
  },

  async patch<T>(path: string, body: unknown): Promise<T> {
    const headers = await getAuthHeaders()
    const res = await fetch(`${API_BASE_URL}${path}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`)
    return res.json()
  },

  async delete(path: string): Promise<void> {
    const headers = await getAuthHeaders()
    const res = await fetch(`${API_BASE_URL}${path}`, {
      method: 'DELETE',
      headers,
    })
    if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`)
  },
}
```

- [ ] **Step 4: Créer le service auth — mobile/src/services/auth.ts**

```ts
// mobile/src/services/auth.ts
import { supabase } from './supabase'

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}
```

- [ ] **Step 5: Commit**

```bash
git add mobile/src/services/
git commit -m "feat(mobile): add Supabase client, API client, and auth service"
```

---

### Task 4: Navigation complète

**Files:**
- Create: `mobile/src/navigation/RootNavigator.tsx`
- Create: `mobile/src/navigation/TabNavigator.tsx`
- Create: `mobile/src/navigation/stacks/LeadsStack.tsx`
- Create: `mobile/src/navigation/stacks/CallsStack.tsx`
- Create: `mobile/src/navigation/stacks/MessagesStack.tsx`
- Create: `mobile/src/navigation/stacks/MoreStack.tsx`
- Create: `mobile/src/navigation/types.ts`
- Modify: `mobile/App.tsx`

- [ ] **Step 1: Installer React Navigation et dépendances**

```bash
cd mobile
npm install @react-navigation/native @react-navigation/native-stack @react-navigation/bottom-tabs
npm install react-native-screens react-native-safe-area-context react-native-gesture-handler react-native-reanimated
cd ios && pod install && cd ..
```

Ajouter `react-native-reanimated/plugin` dans `babel.config.js` (en dernier plugin).

- [ ] **Step 2: Créer les types de navigation — mobile/src/navigation/types.ts**

```ts
// mobile/src/navigation/types.ts
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
```

- [ ] **Step 3: Créer les stacks pour chaque tab**

Créer `LeadsStack.tsx`, `CallsStack.tsx`, `MessagesStack.tsx`, `MoreStack.tsx` dans `mobile/src/navigation/stacks/`. Chaque stack suit ce pattern :

```tsx
// mobile/src/navigation/stacks/LeadsStack.tsx
import React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import type { LeadsStackParamList } from '../types'
// Placeholder screens — seront remplacés par les vrais écrans
import { View, Text } from 'react-native'

const PlaceholderScreen = ({ name }: { name: string }) => (
  <View className="flex-1 bg-bg-primary items-center justify-center">
    <Text className="text-title text-text-primary">{name}</Text>
  </View>
)

const Stack = createNativeStackNavigator<LeadsStackParamList>()

export default function LeadsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="LeadsList">
        {() => <PlaceholderScreen name="Leads" />}
      </Stack.Screen>
      <Stack.Screen name="LeadDetail">
        {() => <PlaceholderScreen name="Lead Detail" />}
      </Stack.Screen>
    </Stack.Navigator>
  )
}
```

Même pattern pour CallsStack (CallsDay + CallDetail), MessagesStack (Inbox + Conversation), MoreStack (MoreMenu + Notifications).

- [ ] **Step 4: Créer le TabNavigator — mobile/src/navigation/TabNavigator.tsx**

```tsx
// mobile/src/navigation/TabNavigator.tsx
import React from 'react'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { View, Text } from 'react-native'
import type { TabParamList } from './types'
import LeadsStack from './stacks/LeadsStack'
import CallsStack from './stacks/CallsStack'
import MessagesStack from './stacks/MessagesStack'
import MoreStack from './stacks/MoreStack'

const PlaceholderScreen = ({ name }: { name: string }) => (
  <View className="flex-1 bg-bg-primary items-center justify-center">
    <Text className="text-title text-text-primary">{name}</Text>
  </View>
)

const Tab = createBottomTabNavigator<TabParamList>()

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
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
        },
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
```

**Note :** Les icônes de tab seront ajoutées dans la Task 5 (Design System). Pour l'instant, les tabs ont uniquement des labels.

- [ ] **Step 5: Créer le RootNavigator — mobile/src/navigation/RootNavigator.tsx**

```tsx
// mobile/src/navigation/RootNavigator.tsx
import React, { useEffect, useState } from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { ActivityIndicator, View } from 'react-native'
import type { RootStackParamList } from './types'
import { supabase } from '../services/supabase'
import TabNavigator from './TabNavigator'
// LoginScreen sera créé dans Task 6
import { View as PlaceholderLogin, Text } from 'react-native'

const Stack = createNativeStackNavigator<RootStackParamList>()

export default function RootNavigator() {
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsAuthenticated(!!session)
      setIsLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (isLoading) {
    return (
      <View className="flex-1 bg-bg-primary items-center justify-center">
        <ActivityIndicator color="#00C853" size="large" />
      </View>
    )
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {isAuthenticated ? (
        <Stack.Screen name="Main" component={TabNavigator} />
      ) : (
        <Stack.Screen name="Login">
          {() => (
            <View className="flex-1 bg-bg-primary items-center justify-center">
              <Text className="text-title text-text-primary">Login</Text>
            </View>
          )}
        </Stack.Screen>
      )}
    </Stack.Navigator>
  )
}
```

- [ ] **Step 6: Mettre à jour App.tsx**

```tsx
// mobile/App.tsx
import React from 'react'
import { NavigationContainer } from '@react-navigation/native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import RootNavigator from './src/navigation/RootNavigator'
import './global.css'

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NavigationContainer>
          <RootNavigator />
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
```

- [ ] **Step 7: Build et vérifier que la navigation fonctionne**

```bash
npx react-native run-ios
```

Expected: L'app affiche le placeholder Login (ou les tabs si une session existe).

- [ ] **Step 8: Commit**

```bash
git add mobile/src/navigation/ mobile/App.tsx
git commit -m "feat(mobile): add React Navigation with tab bar and stacks"
```

---

### Task 5: Design System — Composants UI

**Files:**
- Create: `mobile/src/components/ui/Avatar.tsx`
- Create: `mobile/src/components/ui/StatusBadge.tsx`
- Create: `mobile/src/components/ui/SourceBadge.tsx`
- Create: `mobile/src/components/ui/Button.tsx`
- Create: `mobile/src/components/ui/Card.tsx`
- Create: `mobile/src/components/ui/SearchField.tsx`
- Create: `mobile/src/components/ui/Segmented.tsx`
- Create: `mobile/src/components/ui/FilterChips.tsx`
- Create: `mobile/src/components/ui/NavLarge.tsx`
- Create: `mobile/src/components/ui/NavIcon.tsx`
- Create: `mobile/src/components/ui/FAB.tsx`
- Create: `mobile/src/components/ui/Divider.tsx`
- Create: `mobile/src/components/ui/KpiCard.tsx`
- Create: `mobile/src/components/ui/index.ts` (barrel export)
- Create: `mobile/src/theme/colors.ts`
- Create: `mobile/src/theme/status.ts`

Ce sont les composants du design system tirés des maquettes `00-design-system.jsx`. Chaque composant doit suivre fidèlement les tokens définis dans la spec (section 6).

- [ ] **Step 1: Créer mobile/src/theme/colors.ts**

```ts
// mobile/src/theme/colors.ts
export const colors = {
  bgPrimary: '#09090b',
  bgSecondary: '#0c0c0e',
  bgElevated: '#141414',
  sheet: '#1c1c1e',
  border: '#262626',
  primary: '#00C853',
  warning: '#f59e0b',
  danger: '#ef4444',
  info: '#3b82f6',
  purple: '#a855f7',
  cyan: '#06b6d4',
  pink: '#ec4899',
  orange: '#f97316',
  textPrimary: '#FFFFFF',
  textSecondary: '#A0A0A0',
} as const

// 8 teintes pour les avatars, dérivées du nom
export const avatarHues = [
  '#ef4444', '#f97316', '#f59e0b', '#22c55e',
  '#3b82f6', '#a855f7', '#ec4899', '#06b6d4',
] as const

export function getAvatarColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return avatarHues[Math.abs(hash) % avatarHues.length]
}
```

- [ ] **Step 2: Créer mobile/src/theme/status.ts**

```ts
// mobile/src/theme/status.ts
import type { LeadStatus, LeadSource } from '@shared/types'

export const statusConfig: Record<LeadStatus, { label: string; color: string; bg: string }> = {
  nouveau:          { label: 'Nouveau',          color: '#a1a1aa', bg: '#27272a' },
  scripte:          { label: 'Scripté',          color: '#06b6d4', bg: '#164e63' },
  setting_planifie: { label: 'Setting planifié', color: '#3b82f6', bg: '#1e3a5f' },
  no_show_setting:  { label: 'No-show Setting',  color: '#f59e0b', bg: '#78350f' },
  closing_planifie: { label: 'Closing planifié', color: '#a855f7', bg: '#581c87' },
  no_show_closing:  { label: 'No-show Closing',  color: '#f97316', bg: '#7c2d12' },
  clos:             { label: 'Closé',            color: '#00C853', bg: '#14532d' },
  dead:             { label: 'Dead',             color: '#ef4444', bg: '#7f1d1d' },
}

export const sourceConfig: Record<LeadSource, { label: string; color: string; bg: string }> = {
  manuel:        { label: 'Manuel',        color: '#a1a1aa', bg: '#27272a' },
  facebook_ads:  { label: 'Facebook Ads',  color: '#3b82f6', bg: '#1e3a5f' },
  instagram_ads: { label: 'Instagram Ads', color: '#ec4899', bg: '#831843' },
  follow_ads:    { label: 'Follow Ads',    color: '#a855f7', bg: '#581c87' },
  formulaire:    { label: 'Formulaire',    color: '#06b6d4', bg: '#164e63' },
  funnel:        { label: 'Funnel',        color: '#f97316', bg: '#7c2d12' },
}
```

- [ ] **Step 3: Créer Avatar.tsx**

Référence maquette : `00-design-system.jsx` — composant Avatar avec initiales, couleur dérivée du nom, tailles 26-76px, online indicator optionnel.

```tsx
// mobile/src/components/ui/Avatar.tsx
import React from 'react'
import { View, Text } from 'react-native'
import { getAvatarColor } from '../../theme/colors'

interface AvatarProps {
  name: string
  size?: number
  online?: boolean
}

export function Avatar({ name, size = 40, online }: AvatarProps) {
  const initials = name
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const bg = getAvatarColor(name)
  const fontSize = size * 0.38

  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#fff', fontSize, fontWeight: '600' }}>{initials}</Text>
      {online && (
        <View style={{
          position: 'absolute', bottom: 0, right: 0,
          width: size * 0.28, height: size * 0.28, borderRadius: size * 0.14,
          backgroundColor: '#00C853', borderWidth: 2, borderColor: '#09090b',
        }} />
      )}
    </View>
  )
}
```

- [ ] **Step 4: Créer StatusBadge.tsx et SourceBadge.tsx**

```tsx
// mobile/src/components/ui/StatusBadge.tsx
import React from 'react'
import { View, Text } from 'react-native'
import type { LeadStatus } from '@shared/types'
import { statusConfig } from '../../theme/status'

interface StatusBadgeProps {
  status: LeadStatus
  size?: 'sm' | 'md'
}

export function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const config = statusConfig[status]
  const py = size === 'sm' ? 2 : 4
  const px = size === 'sm' ? 8 : 12
  const fontSize = size === 'sm' ? 11 : 13

  return (
    <View style={{ backgroundColor: config.bg, paddingVertical: py, paddingHorizontal: px, borderRadius: 999 }}>
      <Text style={{ color: config.color, fontSize, fontWeight: '600' }}>{config.label}</Text>
    </View>
  )
}
```

`SourceBadge.tsx` suit exactement le même pattern avec `sourceConfig`.

- [ ] **Step 5: Créer les composants restants (Button, Card, SearchField, Segmented, FilterChips, NavLarge, NavIcon, FAB, Divider, KpiCard)**

Chaque composant doit :
- Suivre les tokens de la spec (couleurs, spacing, radius)
- Utiliser NativeWind (`className`) autant que possible
- Accepter les props documentées dans la spec section 6.2
- Référencer la maquette `00-design-system.jsx` pour les détails visuels

Consulter les maquettes dans `C:\Users\remyd\Downloads\ClosRM Mobile High fidelity-handoff\closrm-mobile-high-fidelity\project\screens\00-design-system.jsx` pour les tailles exactes, les ombres, les états hover/pressed.

- [ ] **Step 6: Créer le barrel export — mobile/src/components/ui/index.ts**

```ts
export { Avatar } from './Avatar'
export { StatusBadge } from './StatusBadge'
export { SourceBadge } from './SourceBadge'
export { Button } from './Button'
export { Card } from './Card'
export { SearchField } from './SearchField'
export { Segmented } from './Segmented'
export { FilterChips } from './FilterChips'
export { NavLarge } from './NavLarge'
export { NavIcon } from './NavIcon'
export { FAB } from './FAB'
export { Divider } from './Divider'
export { KpiCard } from './KpiCard'
```

- [ ] **Step 7: Ajouter les icônes à la TabBar**

Installer `react-native-vector-icons` ou utiliser des icônes SVG custom. Mettre à jour `TabNavigator.tsx` pour afficher les icônes correctes sur chaque tab (leads, phone, message, pulse/chart, more/ellipsis).

- [ ] **Step 8: Build et vérifier visuellement sur iOS**

Créer un écran de test temporaire qui affiche tous les composants du design system pour valider les couleurs, tailles et spacings.

- [ ] **Step 9: Commit**

```bash
git add mobile/src/components/ui/ mobile/src/theme/
git commit -m "feat(mobile): add design system components and theme tokens"
```

---

### Task 6: Écran Login + Auth flow

**Files:**
- Create: `mobile/src/app/auth/LoginScreen.tsx`
- Create: `mobile/src/hooks/useAuth.ts`
- Modify: `mobile/src/navigation/RootNavigator.tsx`

- [ ] **Step 1: Créer le hook useAuth — mobile/src/hooks/useAuth.ts**

```tsx
// mobile/src/hooks/useAuth.ts
import { useState, useEffect } from 'react'
import { Session, User } from '@supabase/supabase-js'
import { supabase } from '../services/supabase'

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  return { session, user, loading }
}
```

- [ ] **Step 2: Créer LoginScreen**

Écran simple : logo ClosRM, champs email + password, bouton "Se connecter" (vert primary), lien "Pas encore de compte ? Inscrivez-vous sur closrm.com", gestion erreurs (email invalide, mot de passe incorrect), loading state.

Fond `bgPrimary`, inputs avec fond `bgSecondary`, bordure `border`, texte `textPrimary`.

- [ ] **Step 3: Brancher LoginScreen dans RootNavigator**

Remplacer le placeholder Login par le vrai `LoginScreen`.

- [ ] **Step 4: Tester le flow complet**

1. Build et run
2. L'app affiche LoginScreen
3. Se connecter avec un compte existant (remydcoaching@gmail.com)
4. L'app bascule sur les tabs
5. Fermer et rouvrir l'app → la session persiste (pas de re-login)

- [ ] **Step 5: Commit**

```bash
git add mobile/src/app/auth/ mobile/src/hooks/useAuth.ts mobile/src/navigation/RootNavigator.tsx
git commit -m "feat(mobile): add login screen and auth flow"
```

---

## Phase 2 — Écrans

### Task 7: Leads List (vue flat)

**Files:**
- Create: `mobile/src/app/leads/LeadsListScreen.tsx`
- Create: `mobile/src/components/leads/LeadCard.tsx`
- Create: `mobile/src/hooks/useLeads.ts`
- Modify: `mobile/src/navigation/stacks/LeadsStack.tsx`

**Maquette de référence :** `01-leads-list.jsx` — Variation A (Cards denses / Flat list)

- [ ] **Step 1: Créer le hook useLeads — mobile/src/hooks/useLeads.ts**

```ts
// mobile/src/hooks/useLeads.ts
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../services/supabase'
import type { Lead } from '@shared/types'

interface UseLeadsOptions {
  status?: string
  search?: string
  segment?: 'actifs' | 'mes_leads' | 'archives'
}

export function useLeads(options: UseLeadsOptions = {}) {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [counts, setCounts] = useState({ actifs: 0, mes_leads: 0, archives: 0 })

  const fetchLeads = useCallback(async () => {
    setLoading(true)
    let query = supabase.from('leads').select('*').order('created_at', { ascending: false })

    if (options.segment === 'archives') {
      query = query.eq('status', 'dead')
    } else {
      query = query.neq('status', 'dead')
    }

    if (options.status && options.status !== 'tous') {
      query = query.eq('status', options.status)
    }

    if (options.search) {
      query = query.or(`first_name.ilike.%${options.search}%,last_name.ilike.%${options.search}%,phone.ilike.%${options.search}%`)
    }

    const { data, error } = await query
    if (!error && data) setLeads(data)
    setLoading(false)
  }, [options.status, options.search, options.segment])

  useEffect(() => {
    fetchLeads()
  }, [fetchLeads])

  // Subscription temps réel
  useEffect(() => {
    const channel = supabase
      .channel('leads-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => {
        fetchLeads()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [fetchLeads])

  return { leads, loading, counts, refetch: fetchLeads }
}
```

- [ ] **Step 2: Créer LeadCard — mobile/src/components/leads/LeadCard.tsx**

Composant dense basé sur la maquette : Avatar (40px) + Nom + StatusBadge + SourceBadge en ligne 1, dernier contact + tentatives + montant en ligne 2. Swipe actions (utiliser `react-native-gesture-handler` Swipeable).

- [ ] **Step 3: Créer LeadsListScreen**

Assembler : NavLarge + SearchField + Segmented (Actifs/Mes leads/Archivés) + FilterChips + FlatList de LeadCard + FAB. Pull-to-refresh via `RefreshControl`.

- [ ] **Step 4: Brancher dans LeadsStack**

Remplacer le placeholder par le vrai `LeadsListScreen`. La navigation vers LeadDetail se fait via `navigation.navigate('LeadDetail', { leadId: lead.id })` au tap sur une card.

- [ ] **Step 5: Build, tester avec données réelles Supabase**

L'écran doit afficher les vrais leads du workspace. Vérifier : filtres, search, pull-to-refresh, FAB visible.

- [ ] **Step 6: Commit**

```bash
git add mobile/src/app/leads/ mobile/src/components/leads/ mobile/src/hooks/useLeads.ts
git commit -m "feat(mobile): add leads list screen with flat view"
```

---

### Task 8: Leads List — Vues groupée et priorité

**Files:**
- Modify: `mobile/src/app/leads/LeadsListScreen.tsx`
- Create: `mobile/src/components/leads/LeadCardLarge.tsx`
- Create: `mobile/src/components/leads/LeadGroupSection.tsx`

**Maquettes :** `01-leads-list.jsx` — Variations B (Groupé) et C (À traiter)

- [ ] **Step 1: Ajouter un sélecteur de vue dans le header**

3 modes : flat (défaut) | groupé | priorité. Icône dans le NavLarge pour switcher.

- [ ] **Step 2: Implémenter la vue groupée**

`LeadGroupSection` : sections collapsibles par statut, header avec dot + label + count + chevron. Groupes chauds ouverts par défaut. SectionList au lieu de FlatList.

- [ ] **Step 3: Implémenter la vue priorité**

`LeadCardLarge` : card grande avec bande couleur haut (4px), badge urgence calculé côté client (delta entre maintenant et le prochain call planifié), CTA dynamique, score si >= 80.

- [ ] **Step 4: Tester les 3 vues et le switch entre elles**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(mobile): add grouped and priority views to leads list"
```

---

### Task 9: Lead Detail

**Files:**
- Create: `mobile/src/app/leads/LeadDetailScreen.tsx`
- Create: `mobile/src/components/leads/LeadTimeline.tsx`
- Create: `mobile/src/hooks/useLeadDetail.ts`
- Modify: `mobile/src/navigation/stacks/LeadsStack.tsx`

**Maquette :** `02-lead-detail.jsx` — Variante B (Actions-first + KPIs) uniquement.

- [ ] **Step 1: Créer useLeadDetail hook**

Query Supabase : `leads` par id + `calls` du lead + `deals` du lead. Subscription temps réel sur le lead.

- [ ] **Step 2: Créer LeadDetailScreen**

Layout scroll (pas de tabs) :
1. Header : retour + more
2. Avatar XXL (76px) centré + nom + StatusBadge + SourceBadge
3. KPI Grid (3 colonnes) : Deal montant | Tentatives count | Score
4. CTA Hero : bouton vert pleine largeur, texte dynamique basé sur le statut/prochain call
5. Quick Actions (grille 2x2) : Appeler (`Linking.openURL('tel:...')`), DM Insta, Email (`Linking.openURL('mailto:...')`), Reprogrammer (ouvre ScheduleSheet)
6. Section Infos : rows pour téléphone, email, instagram, source, assigné
7. Section Tags : pills + bouton ajouter
8. Timeline en bas

- [ ] **Step 3: Créer LeadTimeline**

Liste d'events chronologiques avec connecteur vertical. Construite à partir des données calls + lead status history. Chaque event : icône couleur + titre + détail + timestamp relatif.

- [ ] **Step 4: Brancher dans LeadsStack**

Remplacer le placeholder. Recevoir `leadId` via les params de navigation.

- [ ] **Step 5: Tester : navigation Leads List → Lead Detail → retour. Tap to call. Vérifier les KPIs.**

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(mobile): add lead detail screen with actions-first layout"
```

---

### Task 10: Calls Day (Agenda)

**Files:**
- Create: `mobile/src/app/calls/CallsDayScreen.tsx`
- Create: `mobile/src/components/calls/CallSlot.tsx`
- Create: `mobile/src/components/calls/DayStrip.tsx`
- Create: `mobile/src/hooks/useCalls.ts`
- Modify: `mobile/src/navigation/stacks/CallsStack.tsx`

**Maquette :** `03-calls-day.jsx`

- [ ] **Step 1: Créer useCalls hook**

Query Supabase : `calls` filtré par date sélectionnée, join avec `leads` (first_name, last_name, status, deal_amount). Subscription temps réel.

- [ ] **Step 2: Créer DayStrip**

Bande horizontale scrollable : 7 jours autour d'aujourd'hui. Chaque jour : label court + date + dots count. Jour sélectionné = fond vert.

- [ ] **Step 3: Créer CallSlot**

Card avec gutter temps (heure + durée), bordure gauche colorée (closing=purple, setting=bleu), label type, badge live si prochain call (dot pulsant via `Animated`), avatar + nom lead + infos. Opacité 0.55 si call passé (done/no_show).

- [ ] **Step 4: Créer CallsDayScreen**

Assembler : NavLarge "Calls" + DayStrip + KPI Summary (3 KpiCard en ligne) + FlatList de CallSlot + divider fin de journée.

- [ ] **Step 5: Brancher dans CallsStack, tester avec données réelles**

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(mobile): add calls day screen with agenda view"
```

---

### Task 11: Call Detail

**Files:**
- Create: `mobile/src/app/calls/CallDetailScreen.tsx`
- Create: `mobile/src/hooks/useCallDetail.ts`
- Modify: `mobile/src/navigation/stacks/CallsStack.tsx`

**Maquette :** `04-call-detail.jsx`

- [ ] **Step 1: Créer useCallDetail hook**

Query Supabase : `calls` par id + join `leads` + `deals`.

- [ ] **Step 2: Créer CallDetailScreen**

Layout scroll :
1. Countdown hero : dot pulsant + "CLOSING · DANS X MIN" (calculé avec `setInterval`), avatar + nom, date/heure, boutons Zoom (`Linking.openURL(meetUrl)`) + téléphone
2. Card "Contexte clé" (bordure verte) : bullet points construits côté client depuis les données lead (statut, montant deal, tentatives, tags)
3. Card "Objectif du call" (bordure purple) : templates statiques selon type (closing → closer le deal, répondre aux objections, valider paiement ; setting → qualifier, présenter offre, planifier closing)
4. Notes pré-call : TextInput multiline avec dashed border, sauvegarde via `PATCH /api/calls/[id]` au blur

- [ ] **Step 3: Brancher dans CallsStack**

- [ ] **Step 4: Tester : navigation Calls Day → Call Detail → countdown dynamique → notes**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(mobile): add call detail screen with countdown and context"
```

---

### Task 12: Schedule Sheet (composant global)

**Files:**
- Create: `mobile/src/components/schedule/ScheduleSheet.tsx`
- Create: `mobile/src/components/schedule/AgendaStrip.tsx`
- Create: `mobile/src/hooks/useSchedule.ts`
- Create: `mobile/src/context/ScheduleSheetContext.tsx`
- Modify: `mobile/App.tsx`

**Maquette :** `06-schedule-sheet.jsx`

- [ ] **Step 1: Installer @gorhom/bottom-sheet**

```bash
cd mobile
npm install @gorhom/bottom-sheet
```

- [ ] **Step 2: Créer le context ScheduleSheetContext**

```tsx
// mobile/src/context/ScheduleSheetContext.tsx
import React, { createContext, useContext, useRef, useCallback } from 'react'
import type BottomSheet from '@gorhom/bottom-sheet'

interface ScheduleSheetContextValue {
  open: (leadId: string) => void
  close: () => void
  sheetRef: React.RefObject<BottomSheet>
  leadId: string | null
}

const ScheduleSheetContext = createContext<ScheduleSheetContextValue | null>(null)

export function useScheduleSheet() {
  const ctx = useContext(ScheduleSheetContext)
  if (!ctx) throw new Error('useScheduleSheet must be used within ScheduleSheetProvider')
  return ctx
}

// Provider wraps App, ScheduleSheet component mounted at root level
```

- [ ] **Step 3: Créer useSchedule hook**

Query les calls + bookings du jour sélectionné pour détecter les conflits. Calcule les créneaux libres.

- [ ] **Step 4: Créer AgendaStrip**

Bande visuelle 8h-19h avec blocs occupés (rouge), curseur vert (créneau sélectionné), pills de suggestions pour les créneaux libres.

- [ ] **Step 5: Créer ScheduleSheet**

Bottom sheet avec : grabber, header "Planifier un call", lead chip, segmented type (Setting/Closing/Follow-up), day picker, time picker (heures + minutes), AgendaStrip, toggle invitation, boutons annuler/planifier.

Écriture : `api.post('/api/calls', { lead_id, type, scheduled_at })`.

- [ ] **Step 6: Monter le ScheduleSheet au niveau root dans App.tsx**

Le ScheduleSheetProvider enveloppe le NavigationContainer. Le composant ScheduleSheet est monté en dehors du navigator, accessible depuis n'importe quel écran via `useScheduleSheet().open(leadId)`.

- [ ] **Step 7: Tester : ouvrir le sheet depuis Lead Detail (bouton "Reprogrammer") et depuis Calls Day**

- [ ] **Step 8: Commit**

```bash
git commit -m "feat(mobile): add global schedule sheet with conflict detection"
```

---

### Task 13: Inbox (messagerie unifiée)

**Files:**
- Create: `mobile/src/app/messages/InboxScreen.tsx`
- Create: `mobile/src/components/messages/ConvRow.tsx`
- Create: `mobile/src/hooks/useConversations.ts`
- Modify: `mobile/src/navigation/stacks/MessagesStack.tsx`

**Maquette :** `07-inbox.jsx`

- [ ] **Step 1: Créer useConversations hook**

Query Supabase : `ig_conversations` avec derniers messages, join avec `leads` pour le statut. Subscription temps réel sur `ig_messages` pour mettre à jour la liste.

- [ ] **Step 2: Créer ConvRow**

Avatar (42px) + badge canal (Instagram pink, SMS vert, Email bleu) en bas-droite de l'avatar, nom + timestamp, dernier message (2 lignes clamp, bold si non lu), StatusBadge ou "@handle", dot non-lu.

- [ ] **Step 3: Créer InboxScreen**

NavLarge "Inbox" + subtitle (non lus / total) + SearchField + Segmented (Tous/Instagram/SMS/Email) + SectionList groupé par "NON LUS" / "PRÉCÉDEMMENT".

- [ ] **Step 4: Brancher dans MessagesStack. Navigation vers Conversation au tap.**

- [ ] **Step 5: Tester avec données Instagram réelles**

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(mobile): add inbox screen with unified messaging"
```

---

### Task 14: Conversation (thread DM)

**Files:**
- Create: `mobile/src/app/messages/ConversationScreen.tsx`
- Create: `mobile/src/components/messages/MessageBubble.tsx`
- Create: `mobile/src/components/messages/Composer.tsx`
- Create: `mobile/src/hooks/useMessages.ts`

**Maquette :** `08-conversation.jsx`

- [ ] **Step 1: Créer useMessages hook**

Query Supabase : `ig_messages` filtré par conversation_id, ordonné chronologiquement. Subscription temps réel pour les nouveaux messages.

- [ ] **Step 2: Créer MessageBubble**

Bulles lead : fond `#262629`, alignées gauche, radius arrondi droite. Bulles coach : fond primary, alignées droite, radius arrondi gauche. Timestamp + réactions emoji pills.

- [ ] **Step 3: Créer Composer**

Bar fixed en bas : bouton "+" + TextInput "Message..." + icônes image/micro + bouton send (cercle vert). KeyboardAvoidingView pour que le composer remonte avec le clavier.

- [ ] **Step 4: Créer ConversationScreen**

Header avec avatar online + nom + "@handle" + icônes téléphone/more. Lead context strip (bandeau vert avec StatusBadge + infos call/deal + "Voir fiche"). FlatList inversée de MessageBubble. Composer en bas.

Envoi de message : `api.post('/api/instagram/messages', { conversation_id, text })`.

- [ ] **Step 5: Tester : envoi/réception de messages, scroll, keyboard avoiding**

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(mobile): add conversation screen with DM thread"
```

---

### Task 15: Notifications — Table SQL + écran + push

**Files:**
- Create: `supabase/migrations/073_create_notifications_table.sql`
- Create: `mobile/src/app/more/NotificationsScreen.tsx`
- Create: `mobile/src/components/notifications/NotifRow.tsx`
- Create: `mobile/src/hooks/useNotifications.ts`
- Create: `mobile/src/services/push.ts`
- Modify: `mobile/src/navigation/stacks/MoreStack.tsx`
- Modify: `mobile/App.tsx`

**Maquette :** `09-notifications.jsx`

- [ ] **Step 1: Créer la migration SQL**

```sql
-- supabase/migrations/073_create_notifications_table.sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('new_lead', 'no_show', 'deal_closed', 'dm_reply', 'call_reminder', 'booking')),
  title TEXT NOT NULL,
  subtitle TEXT,
  entity_type TEXT CHECK (entity_type IN ('lead', 'call', 'deal', 'conversation')),
  entity_id UUID,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_notifications_workspace ON notifications(workspace_id, created_at DESC);
CREATE INDEX idx_notifications_unread ON notifications(workspace_id, read) WHERE read = false;

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_isolation" ON notifications
  FOR ALL USING (workspace_id = (SELECT workspace_id FROM users WHERE id = auth.uid()));

-- Table pour les push tokens (multi-device)
CREATE TABLE push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, token)
);

ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_tokens" ON push_tokens
  FOR ALL USING (user_id = auth.uid());
```

- [ ] **Step 2: Appliquer la migration**

```bash
npx supabase db push
```

- [ ] **Step 3: Créer useNotifications hook**

Query + subscription temps réel sur table `notifications`. Grouper par jour (aujourd'hui, hier, etc.).

- [ ] **Step 4: Créer NotifRow**

Icon box (36x36, fond coloré par type) + nom + timestamp + titre bold + sous-titre gris + CTA contextuel + dot non-lu.

- [ ] **Step 5: Créer NotificationsScreen**

NavLarge "Activité" + subtitle + FilterChips (Tout/Deals/Leads/No-shows/Rappels) + SectionList groupée par jour. Bouton "marquer tout lu" dans le header.

Tap sur une notif → navigation contextuelle basée sur `entity_type` + `entity_id`.

- [ ] **Step 6: Installer et configurer react-native-push-notification**

```bash
cd mobile
npm install @react-native-firebase/app @react-native-firebase/messaging react-native-push-notification
cd ios && pod install && cd ..
```

Configurer Firebase (google-services.json pour Android, GoogleService-Info.plist pour iOS).

- [ ] **Step 7: Créer le service push — mobile/src/services/push.ts**

```ts
// mobile/src/services/push.ts
import messaging from '@react-native-firebase/messaging'
import { supabase } from './supabase'
import { Platform } from 'react-native'

export async function requestPushPermission(): Promise<string | null> {
  const authStatus = await messaging().requestPermission()
  const enabled = authStatus === messaging.AuthorizationStatus.AUTHORIZED
    || authStatus === messaging.AuthorizationStatus.PROVISIONAL

  if (!enabled) return null

  const token = await messaging().getToken()
  return token
}

export async function registerPushToken(token: string) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await supabase.from('push_tokens').upsert({
    user_id: user.id,
    token,
    platform: Platform.OS,
  }, { onConflict: 'user_id,token' })
}

export function setupPushListeners(onNotification: (data: any) => void) {
  // Foreground
  const unsubscribe = messaging().onMessage(async remoteMessage => {
    onNotification(remoteMessage.data)
  })

  // Background tap
  messaging().onNotificationOpenedApp(remoteMessage => {
    if (remoteMessage.data) onNotification(remoteMessage.data)
  })

  // App killed tap
  messaging().getInitialNotification().then(remoteMessage => {
    if (remoteMessage?.data) onNotification(remoteMessage.data)
  })

  return unsubscribe
}
```

- [ ] **Step 8: Intégrer les push dans App.tsx**

Au lancement : demander la permission push, enregistrer le token, setup les listeners pour la navigation deep link.

- [ ] **Step 9: Créer l'écran MoreMenu**

Liste simple avec rows : Notifications (avec badge count) + Paramètres (placeholder). Navigation vers NotificationsScreen.

- [ ] **Step 10: Tester : notifications in-app + push (nécessite un device physique pour les push)**

- [ ] **Step 11: Commit**

```bash
git add supabase/migrations/ mobile/src/app/more/ mobile/src/components/notifications/ mobile/src/hooks/useNotifications.ts mobile/src/services/push.ts
git commit -m "feat(mobile): add notifications screen, push notifications, and SQL migration"
```

---

### Task 16: Pulse Dashboard

**Files:**
- Create: `mobile/src/app/pulse/PulseScreen.tsx`
- Create: `mobile/src/components/pulse/RevenueHero.tsx`
- Create: `mobile/src/components/pulse/FunnelChart.tsx`
- Create: `mobile/src/components/pulse/TeamLeaderboard.tsx`
- Create: `mobile/src/components/pulse/ActivityHeatmap.tsx`
- Create: `mobile/src/components/pulse/Sparkline.tsx`
- Create: `mobile/src/hooks/usePulseKpis.ts`

**Maquette :** `10-pulse.jsx`

- [ ] **Step 1: Installer react-native-svg**

```bash
cd mobile
npm install react-native-svg
cd ios && pod install && cd ..
```

- [ ] **Step 2: Créer usePulseKpis hook**

Queries agrégées Supabase sur `leads`, `calls`, `deals`, `workspace_members` pour la période sélectionnée. Calcule les KPIs : revenue total, calls faits/prévus, taux show, closing rate, panier moyen, funnel, team performance, heatmap hebdo.

Pas de subscription temps réel — pull-to-refresh uniquement.

- [ ] **Step 3: Créer Sparkline**

Composant SVG : 7 points avec stroke blanc, gradient fill vert, dot final. Utilise `react-native-svg` (Path, LinearGradient, Circle).

- [ ] **Step 4: Créer RevenueHero**

Card gradient vert, label "REVENUE · MAI", montant XXL, trend vs mois précédent, Sparkline en bas.

- [ ] **Step 5: Créer FunnelChart**

4 barres horizontales : Leads entrants → Setting → Closing → Deals. Chaque barre : label + count + % + barre proportionnelle colorée (bleu, cyan, purple, vert).

- [ ] **Step 6: Créer TeamLeaderboard**

4 rows avec médaille (1er or, 2e argent, 3e bronze, 4e plain) + Avatar + Nom + Rôle + Valeur + Détail.

- [ ] **Step 7: Créer ActivityHeatmap**

7 colonnes bar chart (L-D) avec SVG. Hauteur proportionnelle aux valeurs. Jour actuel en vert primary. Footer avec total semaine.

- [ ] **Step 8: Créer PulseScreen**

ScrollView avec RefreshControl :
1. Header custom (date + "Pulse" + bouton période)
2. RevenueHero
3. Mini KPI Grid (2x2 de KpiCard)
4. FunnelChart
5. TeamLeaderboard
6. ActivityHeatmap

- [ ] **Step 9: Brancher dans TabNavigator (remplacer le placeholder PulseTab)**

- [ ] **Step 10: Tester avec données réelles, pull-to-refresh**

- [ ] **Step 11: Commit**

```bash
git commit -m "feat(mobile): add pulse dashboard with KPIs, funnel, team, and heatmap"
```

---

### Task 17: Badges tab bar + polish final

**Files:**
- Modify: `mobile/src/navigation/TabNavigator.tsx`
- Create: `mobile/src/hooks/useUnreadCounts.ts`

- [ ] **Step 1: Créer useUnreadCounts hook**

Subscription Supabase sur `ig_messages` (non lus) et `notifications` (non lues) pour alimenter les badges de la tab bar.

- [ ] **Step 2: Ajouter les badges dans TabNavigator**

Messages tab : badge rouge avec count non-lus. Pulse tab : dot vert optionnel.

- [ ] **Step 3: Deep linking depuis les push notifications**

Quand l'utilisateur tape une push notification, naviguer vers le bon écran :
- `new_lead` → LeadDetail
- `no_show` / `call_reminder` → CallDetail
- `dm_reply` → Conversation
- `deal_closed` → LeadDetail
- `booking` → CallsDay

Utiliser React Navigation linking config.

- [ ] **Step 4: Tester le flow complet end-to-end**

1. Login → tabs avec données réelles
2. Leads List → Lead Detail → tap to call → retour
3. Calls Day → Call Detail → notes → retour
4. Schedule Sheet depuis Lead Detail → planifier un call → vérifier dans Calls Day
5. Inbox → Conversation → envoyer message → retour
6. Notifications → tap → navigation contextuelle
7. Pulse → pull-to-refresh → KPIs à jour
8. Push notification → tap → deep link correct

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(mobile): add tab badges, deep linking, and final polish"
```

---

## Fichiers de suivi à créer

À créer au début de l'implémentation (Task 1) :

### etat-mobile.md

```markdown
# État — Application Mobile ClosRM

## Phase 1 — Fondations
- [ ] Task 1: Setup projet React Native CLI + NativeWind
- [ ] Task 2: Dossier shared/ (types + validations)
- [ ] Task 3: Services (Supabase + API + Auth)
- [ ] Task 4: Navigation complète
- [ ] Task 5: Design System (composants UI)
- [ ] Task 6: Login + Auth flow

## Phase 2 — Écrans
- [ ] Task 7: Leads List (vue flat)
- [ ] Task 8: Leads List (vues groupée + priorité)
- [ ] Task 9: Lead Detail
- [ ] Task 10: Calls Day (Agenda)
- [ ] Task 11: Call Detail
- [ ] Task 12: Schedule Sheet
- [ ] Task 13: Inbox
- [ ] Task 14: Conversation
- [ ] Task 15: Notifications + Push
- [ ] Task 16: Pulse Dashboard
- [ ] Task 17: Badges + Deep linking + Polish
```

### ameliorations-mobile.md

Fichier vide au départ, mis à jour pendant le dev avec les améliorations identifiées.
