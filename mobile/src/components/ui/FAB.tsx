import React from 'react'
import { Pressable, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

interface FABProps {
  onPress?: () => void
  icon?: keyof typeof Ionicons.glyphMap
  /** Ignoré — design simplifié en bouton rond. */
  label?: string
  bottom?: number
}

const PRIMARY = '#00C853'

/** FAB rond simple — 56pt vert primary, juste un icône. Bottom-right. */
export function FAB({ onPress, icon = 'add', bottom = 100 }: FABProps) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        position: 'absolute',
        right: 20,
        bottom,
      }}
    >
      {({ pressed }) => (
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: PRIMARY,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: PRIMARY,
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.45,
            shadowRadius: 14,
            elevation: 10,
            opacity: pressed ? 0.85 : 1,
            transform: [{ scale: pressed ? 0.92 : 1 }],
          }}
        >
          <Ionicons name={icon} size={28} color="#000" />
        </View>
      )}
    </Pressable>
  )
}
