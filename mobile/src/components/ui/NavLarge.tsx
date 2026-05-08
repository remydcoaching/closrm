import React from 'react'
import { View, Text } from 'react-native'
import { colors } from '../../theme/colors'

interface NavLargeProps {
  title: string
  /** Si présent, affiché comme chip sous le titre (premium feel). */
  subtitle?: string
  /** Optionnel : précédé d'un eyebrow uppercase (ex: "VENDREDI · TEMPS RÉEL"). */
  eyebrow?: string
  rightSlot?: React.ReactNode
}

export function NavLarge({ title, subtitle, eyebrow, rightSlot }: NavLargeProps) {
  return (
    <View
      style={{
        paddingHorizontal: 20,
        paddingTop: 8,
        paddingBottom: 16,
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: 12,
      }}
    >
      <View style={{ flex: 1 }}>
        {eyebrow ? (
          <Text
            style={{
              color: colors.textTertiary,
              fontSize: 11,
              fontWeight: '700',
              letterSpacing: 0.8,
              marginBottom: 4,
            }}
          >
            {eyebrow.toUpperCase()}
          </Text>
        ) : null}
        <Text
          style={{
            color: colors.textPrimary,
            // Display title 34pt SF style — lettres légèrement resserrées
            // pour un feel premium type Linear/Superhuman.
            fontSize: 34,
            fontWeight: '800',
            letterSpacing: -0.6,
            lineHeight: 40,
          }}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={{ color: colors.textSecondary, fontSize: 14, marginTop: 4, fontWeight: '500' }}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {rightSlot ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>{rightSlot}</View>
      ) : null}
    </View>
  )
}
