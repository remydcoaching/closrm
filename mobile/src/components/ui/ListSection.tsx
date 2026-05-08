import React from 'react'
import { View, Text } from 'react-native'
import { colors } from '../../theme/colors'

interface ListSectionProps {
  /** Header en uppercase au-dessus de la section (style iOS Settings). */
  header?: string
  /** Footer hint sous la section (gris, italique). */
  footer?: string
  children: React.ReactNode
}

/** Wrapper iOS-native pour les listes groupées. Children = ListRow.
 *  Match exact des Settings/Mail iOS. */
export function ListSection({ header, footer, children }: ListSectionProps) {
  return (
    <View>
      {header ? (
        <Text
          style={{
            color: colors.textTertiary,
            fontSize: 13,
            fontWeight: '500',
            letterSpacing: 0.3,
            marginLeft: 16,
            marginBottom: 6,
            textTransform: 'uppercase',
          }}
        >
          {header}
        </Text>
      ) : null}
      <View
        style={{
          backgroundColor: colors.bgElevated,
          borderRadius: 10,
          overflow: 'hidden',
        }}
      >
        {children}
      </View>
      {footer ? (
        <Text
          style={{
            color: colors.textTertiary,
            fontSize: 13,
            marginLeft: 16,
            marginRight: 16,
            marginTop: 6,
          }}
        >
          {footer}
        </Text>
      ) : null}
    </View>
  )
}
