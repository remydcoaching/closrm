import React from 'react'
import { View, Text } from 'react-native'
import { colors } from '../../theme/colors'

interface NavLargeProps {
  title: string
  subtitle?: string
  rightSlot?: React.ReactNode
}

export function NavLarge({ title, subtitle, rightSlot }: NavLargeProps) {
  return (
    <View
      style={{
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 12,
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
      }}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.textPrimary, fontSize: 28, fontWeight: '700', lineHeight: 34 }}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 2 }}>{subtitle}</Text>
        ) : null}
      </View>
      {rightSlot ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>{rightSlot}</View>
      ) : null}
    </View>
  )
}
