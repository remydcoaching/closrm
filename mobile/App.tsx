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
import { ThemeProvider } from './src/theme/ThemeProvider'
import { checkAndApplyUpdate } from './src/services/updates'
import { darkColors, lightColors, getAccentColor } from './src/theme/colors'
import './global.css'

type NavMode = 'dark' | 'light'

const buildNavTheme = (mode: NavMode) => {
  const c = mode === 'dark' ? darkColors : lightColors
  const accent = getAccentColor()
  const primary = (mode === 'dark' ? accent.dark : accent.light) ?? c.primary
  return {
    dark: mode === 'dark',
    colors: {
      primary,
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
  useExpoPush(navRef)
  useAgendaReminders()
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
          {(theme: NavMode, remountKey: string) => (
            // key inclut accent + theme : force le remount de tout l'arbre
            // au moindre changement → composants relisent le proxy `colors`.
            <NavigationContainer
              key={remountKey}
              ref={navRef}
              theme={buildNavTheme(theme)}
            >
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
