import { useRef } from 'react'
import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { NavigationContainer, type NavigationContainerRef } from '@react-navigation/native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import RootNavigator from './src/navigation/RootNavigator'
import { ScheduleSheetProvider } from './src/components/schedule/ScheduleSheetProvider'
import { CreateLeadSheetProvider } from './src/components/leads/CreateLeadSheet'
import { useExpoPush } from './src/hooks/useExpoPush'
import { ThemeProvider } from './src/theme/ThemeProvider'
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
  useExpoPush(navRef)
  return null
}

export default function App() {
  const navRef = useRef<NavigationContainerRef<Record<string, object | undefined>>>(null)

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
