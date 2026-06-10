import React from 'react'
import { View, Text } from 'react-native'
import { colors } from '../../theme/colors'

interface KpiCardProps {
  label: string
  value: string | number
  detail?: string
  trend?: { value: string; positive?: boolean }
  borderColor?: string
}

export function KpiCard({ label, value, detail, trend, borderColor }: KpiCardProps) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.bgElevated,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: colors.border,
        borderTopWidth: borderColor ? 3 : 1,
        borderTopColor: borderColor ?? colors.border,
        padding: 12,
        gap: 4,
      }}
    >
      <Text style={{ color: colors.textSecondary, fontSize: 11, fontWeight: '600', letterSpacing: 0.5 }}>
        {label.toUpperCase()}
      </Text>
      <Text style={{ color: colors.textPrimary, fontSize: 22, fontWeight: '700' }}>{value}</Text>
      {detail || trend ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {detail ? (
            <Text style={{ color: colors.textSecondary, fontSize: 11 }}>{detail}</Text>
          ) : null}
          {trend ? (
            <Text
              style={{
                color: trend.positive ? colors.primary : colors.danger,
                fontSize: 11,
                fontWeight: '700',
              }}
            >
              {trend.value}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  )
}
