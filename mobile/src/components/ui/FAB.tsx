import React from 'react'
import { Pressable, View, Text } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../../theme/colors'

interface FABProps {
  onPress?: () => void
  icon?: keyof typeof Ionicons.glyphMap
  /** Label optionnel — si présent rend en extended FAB (pill + texte). */
  label?: string
  /** Décalage par rapport au bord bas. Default 100 = au-dessus de la TabBar
   *  iOS (49pt tab bar + 34pt safe area + 17pt margin). */
  bottom?: number
}

/** FAB — extended si label fourni (pill icon+label), sinon round 60pt.
 *  Glow primary subtle. */
export function FAB({ onPress, icon = 'add', label, bottom = 100 }: FABProps) {
  const isExtended = !!label

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        position: 'absolute',
        right: 20,
        bottom,
        flexDirection: 'row',
        alignItems: 'center',
        gap: isExtended ? 8 : 0,
        height: isExtended ? 52 : 60,
        paddingHorizontal: isExtended ? 18 : 0,
        width: isExtended ? undefined : 60,
        borderRadius: isExtended ? 26 : 30,
        backgroundColor: colors.primary,
        justifyContent: 'center',
        // Glow primary subtle
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.5,
        shadowRadius: 16,
        elevation: 10,
        // Inner border
        borderWidth: 1,
        borderColor: '#FFFFFF22',
        transform: [{ scale: pressed ? 0.96 : 1 }],
        opacity: pressed ? 0.95 : 1,
      })}
    >
      <Ionicons name={icon} size={isExtended ? 22 : 28} color="#000" />
      {label ? (
        <Text
          style={{
            color: '#000',
            fontSize: 15,
            fontWeight: '700',
            letterSpacing: -0.24,
          }}
        >
          {label}
        </Text>
      ) : null}
    </Pressable>
  )
}
