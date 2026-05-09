import React from 'react'
import { View, Text } from 'react-native'
import { colors } from '../../theme/colors'
import { type, spacing, radius } from '../../theme/tokens'

interface ListSectionProps {
  /** Header uppercase au-dessus de la section (style iOS Settings). */
  header?: string
  /** Texte d'aide sous la section (gris, footnote). */
  footer?: string
  /** Padding horizontal — par défaut 16, mais ListSection peut être en
   *  bord à bord (0) si l'écran le souhaite. */
  inset?: number
  children: React.ReactNode
}

/** Wrapper iOS-native pour les listes groupées. Match exact des sections
 *  Settings : header uppercase tertiary, card rounded #1c1c1e, footer
 *  optionnel en footnote. Children = ListRow. */
export function ListSection({ header, footer, inset = spacing.lg, children }: ListSectionProps) {
  return (
    <View>
      {header ? (
        <Text
          style={{
            ...type.footnote,
            color: colors.textSecondary,
            marginLeft: inset + spacing.lg,
            marginRight: inset + spacing.lg,
            marginBottom: spacing.sm,
            textTransform: 'uppercase',
            letterSpacing: 0.4,
          }}
        >
          {header}
        </Text>
      ) : null}
      <View
        style={{
          marginHorizontal: inset,
          backgroundColor: colors.bgSecondary,
          borderRadius: radius.xl,
          overflow: 'hidden',
        }}
      >
        {children}
      </View>
      {footer ? (
        <Text
          style={{
            ...type.footnote,
            color: colors.textSecondary,
            marginLeft: inset + spacing.lg,
            marginRight: inset + spacing.lg,
            marginTop: spacing.sm,
          }}
        >
          {footer}
        </Text>
      ) : null}
    </View>
  )
}
