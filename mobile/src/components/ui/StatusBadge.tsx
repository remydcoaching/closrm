import React from 'react'
import { View, Text } from 'react-native'
import type { LeadStatus } from '@shared/types'
import { statusConfig } from '../../theme/status'

interface StatusBadgeProps {
  status: LeadStatus
  size?: 'sm' | 'md'
}

export function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const config = statusConfig[status]
  const py = size === 'sm' ? 3 : 5
  const px = size === 'sm' ? 10 : 14
  const fontSize = size === 'sm' ? 12 : 14

  return (
    <View
      style={{
        backgroundColor: config.bg,
        paddingVertical: py,
        paddingHorizontal: px,
        borderRadius: 999,
      }}
    >
      <Text style={{ color: config.color, fontSize, fontWeight: '600' }}>{config.label}</Text>
    </View>
  )
}
