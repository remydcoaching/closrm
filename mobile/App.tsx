import { StatusBar } from 'expo-status-bar';
import { Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import './global.css';

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
