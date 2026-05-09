import React from 'react'
import { Pressable, Text } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

interface FABProps {
  onPress?: () => void
  icon?: keyof typeof Ionicons.glyphMap
  /** Label optionnel — si présent rend en extended FAB pill icon+label. */
  label?: string
  /** Bottom offset par défaut au-dessus de la TabBar iOS. */
  bottom?: number
}

const PRIMARY = '#00C853'

/** Extended FAB — pill icon + label hardcodé tailles fixes pour
 *  garantir le rendu visible quel que soit le contexte. */
export function FAB({ onPress, icon = 'add', label, bottom = 100 }: FABProps) {
  if (label) {
    // Extended pill
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => ({
          position: 'absolute',
          right: 20,
          bottom,
          height: 52,
          paddingHorizontal: 20,
          borderRadius: 26,
          backgroundColor: PRIMARY,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: PRIMARY,
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.5,
          shadowRadius: 16,
          elevation: 10,
          opacity: pressed ? 0.85 : 1,
          transform: [{ scale: pressed ? 0.96 : 1 }],
        })}
      >
        <Ionicons name={icon} size={22} color="#000" />
        <Text
          style={{
            marginLeft: 8,
            color: '#000',
            fontSize: 15,
            fontWeight: '700',
            letterSpacing: -0.24,
          }}
        >
          {label}
        </Text>
      </Pressable>
    )
  }
  // Round FAB classique
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
        backgroundColor: PRIMARY,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: PRIMARY,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.5,
        shadowRadius: 16,
        elevation: 10,
        opacity: pressed ? 0.85 : 1,
        transform: [{ scale: pressed ? 0.96 : 1 }],
      })}
    >
      <Ionicons name={icon} size={28} color="#000" />
    </Pressable>
  )
}
