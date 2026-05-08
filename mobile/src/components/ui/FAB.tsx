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
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        // Glow premium : 2 shadows superposées (proche + far) pour un
        // effet plus riche qu'une simple shadow.
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.55,
        shadowRadius: 20,
        elevation: 12,
        // Inner border subtil pour donner du relief
        borderWidth: 1,
        borderColor: '#FFFFFF22',
        transform: [{ scale: pressed ? 0.94 : 1 }],
        opacity: pressed ? 0.95 : 1,
      })}
    >
      <Ionicons name={icon} size={28} color="#fff" />
    </Pressable>
  )
}
