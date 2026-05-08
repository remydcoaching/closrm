import { StatusBar } from 'expo-status-bar';
import { Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { Lead } from '@shared/types';
import './global.css';

// Sanity check: l'alias @shared/* compile (pas d'usage runtime).
const _typeProbe: Lead | null = null;
void _typeProbe;

export default function App() {
  return (
    <SafeAreaProvider>
      <View className="flex-1 bg-bg-primary items-center justify-center">
        <Text className="text-large-title text-text-primary">ClosRM</Text>
        <Text className="text-body text-text-secondary mt-sm">Mobile App</Text>
      </View>
      <StatusBar style="light" />
    </SafeAreaProvider>
  );
}
