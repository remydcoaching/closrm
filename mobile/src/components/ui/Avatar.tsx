import React from 'react'
import { View, Text } from 'react-native'
import { getAvatarColor, colors } from '../../theme/colors'

interface AvatarProps {
  name: string
  size?: number
  online?: boolean
}

export function Avatar({ name, size = 40, online }: AvatarProps) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const bg = getAvatarColor(name || '?')
  const fontSize = Math.round(size * 0.38)

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: '#fff', fontSize, fontWeight: '600' }}>{initials || '?'}</Text>
      {online && (
        <View
          style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: size * 0.28,
            height: size * 0.28,
            borderRadius: size * 0.14,
            backgroundColor: colors.primary,
            borderWidth: 2,
            borderColor: colors.bgPrimary,
          }}
        />
      )}
    </View>
  )
}
