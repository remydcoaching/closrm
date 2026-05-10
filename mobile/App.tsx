import { useEffect, useRef } from 'react'
import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { NavigationContainer, type NavigationContainerRef } from '@react-navigation/native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import RootNavigator from './src/navigation/RootNavigator'
import { ScheduleSheetProvider } from './src/components/schedule/ScheduleSheetProvider'
import { CreateLeadSheetProvider } from './src/components/leads/CreateLeadSheet'
import { useExpoPush } from './src/hooks/useExpoPush'
import { useAgendaReminders } from './src/hooks/useAgendaReminders'
import { useWorkspaceBranding } from './src/hooks/useWorkspaceBranding'
import { useTheme } from './src/theme/ThemeProvider'
import { ThemeProvider } from './src/theme/ThemeProvider'
import { checkAndApplyUpdate } from './src/services/updates'
import { darkColors, lightColors } from './src/theme/colors'
import './global.css'

type NavMode = 'dark' | 'light'

const buildNavTheme = (mode: NavMode) => {
  const c = mode === 'dark' ? darkColors : lightColors
  return {
    dark: mode === 'dark',
    colors: {
      primary: c.primary,
      background: c.bgPrimary,
      card: c.bgSecondary,
      text: c.textPrimary,
      border: c.border,
      notification: c.danger,
    },
    fonts: {
      regular: { fontFamily: 'System', fontWeight: '400' as const },
      medium: { fontFamily: 'System', fontWeight: '500' as const },
      bold: { fontFamily: 'System', fontWeight: '700' as const },
      heavy: { fontFamily: 'System', fontWeight: '800' as const },
    },
  }
}

function PushHandler({
  navRef,
}: {
  navRef: React.RefObject<NavigationContainerRef<Record<string, object | undefined>> | null>
}) {
  const { setMode, mode } = useTheme()
  useExpoPush(navRef)
  useAgendaReminders()
  // Charge l'accent color du workspace au boot + force un remount quand
  // appliquée. Sans ça la couleur cachée ne se voit qu'après navigation.
  useWorkspaceBranding(() => {
    void setMode(mode)
  })
  return null
}

export default function App() {
  const navRef = useRef<NavigationContainerRef<Record<string, object | undefined>>>(null)

  // Force OTA check au démarrage : si nouvelle version dispo, fetch + reload
  // immédiatement → 1 seul cycle close/reopen suffit (au lieu de 2).
  useEffect(() => {
    void checkAndApplyUpdate()
  }, [])

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          {(theme: NavMode) => (
            // key={theme} : force remount de tout l'arbre quand on toggle
            // dark/light → composants relisent le proxy `colors`.
            <NavigationContainer key={theme} ref={navRef} theme={buildNavTheme(theme)}>
              <ScheduleSheetProvider>
                <CreateLeadSheetProvider>
                  <PushHandler navRef={navRef} />
                  <RootNavigator />
                </CreateLeadSheetProvider>
              </ScheduleSheetProvider>
            </NavigationContainer>
          )}
        </ThemeProvider>
        <StatusBar style="auto" />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
