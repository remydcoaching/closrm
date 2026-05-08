import React from 'react'
import { Pressable, View, Text } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../../theme/colors'

interface ListRowProps {
  /** Slot gauche : avatar, icône, illustration. Hauteur fixe, aligné center. */
  leading?: React.ReactNode
  /** Texte principal (17pt regular, white). */
  title: string
  /** Texte secondaire optionnel (15pt secondary, 1 ligne). */
  subtitle?: string
  /** Slot adjacent au titre (ex: status badge inline). */
  titleAccessory?: React.ReactNode
  /** Slot droit : amount, badge, dot. */
  trailing?: React.ReactNode
  /** Affiche un chevron-forward iOS standard à droite. Default true. */
  showChevron?: boolean
  /** Si true, hairline separator au bottom. ListSection passe ça automatiquement. */
  separator?: boolean
  onPress?: () => void
}

/** Row iOS-native (style Settings/Mail). Layout figé pour éviter les
 *  bugs flex (avatar | content flex 1 | trailing | chevron) avec
 *  `minWidth: 0` partout pour le shrink correct du middle. */
export function ListRow({
  leading,
  title,
  subtitle,
  titleAccessory,
  trailing,
  showChevron = true,
  separator = true,
  onPress,
}: ListRowProps) {
  const Container = onPress ? Pressable : View
  return (
    <View>
      <Container
        onPress={onPress}
        style={
          onPress
            ? ({ pressed }: { pressed: boolean }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 12,
                paddingHorizontal: 16,
                gap: 12,
                backgroundColor: pressed ? colors.bgSecondary : 'transparent',
                minHeight: 56,
              })
            : {
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 12,
                paddingHorizontal: 16,
                gap: 12,
                minHeight: 56,
              }
        }
      >
        {leading ? <View>{leading}</View> : null}

        <View style={{ flex: 1, minWidth: 0 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              minWidth: 0,
            }}
          >
            <Text
              numberOfLines={1}
              style={{
                color: colors.textPrimary,
                fontSize: 17,
                fontWeight: '500',
                flexShrink: 1,
                minWidth: 0,
              }}
            >
              {title}
            </Text>
            {titleAccessory}
          </View>
          {subtitle ? (
            <Text
              numberOfLines={1}
              style={{
                color: colors.textSecondary,
                fontSize: 14,
                fontWeight: '400',
                marginTop: 2,
              }}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>

        {trailing ? <View>{trailing}</View> : null}
        {showChevron ? (
          <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
        ) : null}
      </Container>
      {/* Hairline separator iOS native — inset à 16+leading width pour laisser
          la respiration sous l'avatar. Custom inset cf Apple HIG. */}
      {separator ? (
        <View
          style={{
            height: 0.5,
            backgroundColor: colors.border,
            marginLeft: leading ? 68 : 16,
          }}
        />
      ) : null}
    </View>
  )
}
