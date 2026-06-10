import React from 'react'
import { View, Text } from 'react-native'

export function PlaceholderScreen({ name }: { name: string }) {
  return (
    <View className="flex-1 bg-bg-primary items-center justify-center">
      <Text className="text-title text-text-primary">{name}</Text>
      <Text className="text-subheadline text-text-secondary mt-sm">À implémenter</Text>
    </View>
  )
}
