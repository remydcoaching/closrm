import React from 'react'
import { Pressable, View, Text } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../../theme/colors'
import { type, spacing } from '../../theme/tokens'

interface ListRowProps {
  /** Slot gauche : avatar / icône / illustration. */
  leading?: React.ReactNode
  /** Texte principal — body emphasis (17pt regular). */
  title: string
  /** Texte secondaire (15pt subheadline secondary). */
  subtitle?: string
  /** Slot adjacent au titre (ex: status pill discret). */
  titleAccessory?: React.ReactNode
  /** Slot droit : amount, dot, badge. */
  trailing?: React.ReactNode
  /** Chevron-forward iOS standard à droite. Default true. */
  showChevron?: boolean
  /** Hairline separator au bottom. Géré par ListSection en général. */
  separator?: boolean
  /** Inset du séparateur depuis la gauche. Default 60 (= aligné après l'avatar 40 + padding 16 + gap 4). */
  separatorInset?: number
  onPress?: () => void
}

/** ListRow iOS-native — match strict des cellules Mail / Settings / Reminders.
 *  Layout figé pour éviter les bugs flex. Avatar | Title+Subtitle | Trailing | Chevron. */
export function ListRow({
  leading,
  title,
  subtitle,
  titleAccessory,
  trailing,
  showChevron = true,
  separator = true,
  separatorInset,
  onPress,
}: ListRowProps) {
  const inset = separatorInset ?? (leading ? 60 : spacing.lg)

  const containerStyle = {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: subtitle ? 10 : 12,
    paddingHorizontal: spacing.lg,
    minHeight: 44,
  }

  const Inner = (
    <>
      {leading ? <View style={{ marginRight: spacing.md }}>{leading}</View> : null}

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
              ...type.body,
              color: colors.textPrimary,
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
              ...type.subheadline,
              color: colors.textSecondary,
              marginTop: 2,
            }}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>

      {trailing ? <View style={{ marginLeft: spacing.sm }}>{trailing}</View> : null}
      {showChevron ? (
        <Ionicons
          name="chevron-forward"
          size={14}
          color={colors.textTertiary}
          style={{ marginLeft: spacing.xs }}
        />
      ) : null}
    </>
  )

  return (
    <View>
      {onPress ? (
        // Bug RN observé : un style fonction `({pressed}) => ({...})` sur
        // Pressable casse parfois le flexDirection: 'row' du containerStyle
        // au premier render → la row apparaît verticale (icône au-dessus
        // du title). Le wrap explicite par un `View` interne avec le
        // containerStyle évite le problème : Pressable ne porte plus que
        // le hit-test + opacité, le layout est figé dans la View.
        <Pressable
          onPress={onPress}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
          android_ripple={{ color: '#ffffff10' }}
        >
          <View style={containerStyle}>{Inner}</View>
        </Pressable>
      ) : (
        <View style={containerStyle}>{Inner}</View>
      )}
      {separator ? (
        <View
          style={{
            height: 0.33,
            backgroundColor: colors.border,
            marginLeft: inset,
          }}
        />
      ) : null}
    </View>
  )
}
