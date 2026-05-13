import React from 'react'
import { View, Text } from 'react-native'
import type { LeadStatus } from '@shared/types'
import { statusConfig } from '../../theme/status'
import { type } from '../../theme/tokens'

interface StatusBadgeProps {
  status: LeadStatus
  size?: 'sm' | 'md'
  /** Si true, affiche juste un dot coloré (sans texte). */
  dotOnly?: boolean
}

/** Status indicator iOS-style. Default = small pill avec couleur+texte
 *  subtle. Mode dotOnly = juste le dot 8pt (idéal en inline avec un titre
 *  long pour éviter de pousser le layout). */
export function StatusBadge({ status, size = 'sm', dotOnly }: StatusBadgeProps) {
  const config = statusConfig[status]

  if (dotOnly) {
    return (
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: config.color,
        }}
      />
    )
  }

  const py = size === 'sm' ? 2 : 4
  const px = size === 'sm' ? 7 : 10
  return (
    <View
      style={{
        backgroundColor: config.color + '26', // 15% alpha
        paddingVertical: py,
        paddingHorizontal: px,
        borderRadius: 999,
      }}
    >
      <Text
        style={{
          ...type.caption2,
          color: config.color,
          fontWeight: '600',
        }}
      >
        {config.label}
      </Text>
    </View>
  )
}
