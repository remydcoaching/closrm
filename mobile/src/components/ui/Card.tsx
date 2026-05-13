import React from 'react'
import { View, ViewProps } from 'react-native'
import { colors } from '../../theme/colors'

interface CardProps extends ViewProps {
  borderColor?: string
  borderPosition?: 'left' | 'top'
  borderWidthAccent?: number
  children?: React.ReactNode
}

export function Card({
  borderColor,
  borderPosition = 'left',
  borderWidthAccent = 3,
  style,
  children,
  ...rest
}: CardProps) {
  const accent = borderColor
    ? borderPosition === 'left'
      ? { borderLeftWidth: borderWidthAccent, borderLeftColor: borderColor }
      : { borderTopWidth: borderWidthAccent, borderTopColor: borderColor }
    : null
  return (
    <View
      {...rest}
      style={[
        {
          backgroundColor: colors.bgElevated,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: colors.border,
          padding: 12,
        },
        accent,
        style,
      ]}
    >
      {children}
    </View>
  )
}
