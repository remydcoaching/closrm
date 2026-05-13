import React from 'react'
import { Pressable } from 'react-native'
import { colors } from '../../theme/colors'

interface NavIconProps {
  onPress?: () => void
  children: React.ReactNode
  size?: number
}

export function NavIcon({ onPress, children, size = 36 }: NavIconProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.bgSecondary,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.7 : 1,
      })}
    >
      {children}
    </Pressable>
  )
}
