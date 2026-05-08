import { useRef } from 'react'
import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { NavigationContainer, type NavigationContainerRef } from '@react-navigation/native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import RootNavigator from './src/navigation/RootNavigator'
import { ScheduleSheetProvider } from './src/components/schedule/ScheduleSheetProvider'
import { useExpoPush } from './src/hooks/useExpoPush'
import './global.css'

const navTheme = {
  // Petit thème custom pour que la transition entre écrans n'affiche pas
  // un flash blanc (le default React Navigation est en light).
  dark: true,
  colors: {
    primary: '#00C853',
    background: '#09090b',
    card: '#0c0c0e',
    text: '#FFFFFF',
    border: '#262626',
    notification: '#ef4444',
  },
  fonts: {
    regular: { fontFamily: 'System', fontWeight: '400' as const },
    medium: { fontFamily: 'System', fontWeight: '500' as const },
    bold: { fontFamily: 'System', fontWeight: '700' as const },
    heavy: { fontFamily: 'System', fontWeight: '800' as const },
  },
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
        <NavigationContainer ref={navRef} theme={navTheme}>
          <ScheduleSheetProvider>
            <PushHandler navRef={navRef} />
            <RootNavigator />
          </ScheduleSheetProvider>
        </NavigationContainer>
        <StatusBar style="light" />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
