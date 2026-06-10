import React from 'react'
import { View, Text } from 'react-native'
import { colors } from '../../theme/colors'
import { type, spacing } from '../../theme/tokens'

interface NavLargeProps {
  title: string
  /** Subtitle 13pt secondary, sous le large title. */
  subtitle?: string
  /** Slot droit : icônes / boutons à hauteur du title. */
  rightSlot?: React.ReactNode
}

/** Header style iOS Large Title (Mail/Reminders/Photos).
 *  - 34pt bold, letter-spacing 0.37
 *  - Padding horizontal 16, padding vertical 8/12
 *  - Subtitle optionnel 13pt secondary
 */
export function NavLarge({ title, subtitle, rightSlot }: NavLargeProps) {
  return (
    <View
      style={{
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.sm,
        paddingBottom: spacing.md,
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: spacing.md,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text
          style={{
            ...type.largeTitle,
            color: colors.textPrimary,
          }}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={{
              ...type.footnote,
              color: colors.textSecondary,
              marginTop: 2,
            }}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {rightSlot ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingBottom: 6 }}>
          {rightSlot}
        </View>
      ) : null}
    </View>
  )
}
