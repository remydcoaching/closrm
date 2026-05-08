import React from 'react'
import { Pressable } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../../theme/colors'

interface FABProps {
  onPress?: () => void
  icon?: keyof typeof Ionicons.glyphMap
  /** Décalage par rapport au bord bas. Permet d'éviter les recouvrements
   *  avec la TabBar quand le FAB est dans un écran tabulé. */
  bottom?: number
}

export function FAB({ onPress, icon = 'add', bottom = 24 }: FABProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        position: 'absolute',
        right: 20,
        bottom,
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        // shadow iOS
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
        // shadow Android
        elevation: 8,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Ionicons name={icon} size={26} color="#fff" />
    </Pressable>
  )
}
