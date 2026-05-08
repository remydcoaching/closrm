import React from 'react'
import { Pressable, Text, ActivityIndicator, View } from 'react-native'
import { colors } from '../../theme/colors'

type Variant = 'primary' | 'outline' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps {
  label: string
  onPress?: () => void
  variant?: Variant
  size?: Size
  loading?: boolean
  disabled?: boolean
  iconLeft?: React.ReactNode
  iconRight?: React.ReactNode
  fullWidth?: boolean
}

const sizeStyle: Record<Size, { paddingV: number; paddingH: number; fontSize: number }> = {
  sm: { paddingV: 6, paddingH: 12, fontSize: 13 },
  md: { paddingV: 10, paddingH: 16, fontSize: 15 },
  lg: { paddingV: 14, paddingH: 20, fontSize: 17 },
}

function variantStyle(variant: Variant, disabled: boolean) {
  const dim = disabled ? 0.4 : 1
  switch (variant) {
    case 'primary':
      return { bg: colors.primary, fg: '#fff', borderColor: colors.primary, opacity: dim }
    case 'danger':
      return { bg: colors.danger, fg: '#fff', borderColor: colors.danger, opacity: dim }
    case 'outline':
      return { bg: 'transparent', fg: colors.textPrimary, borderColor: colors.border, opacity: dim }
    case 'ghost':
      return { bg: 'transparent', fg: colors.textPrimary, borderColor: 'transparent', opacity: dim }
  }
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  loading,
  disabled,
  iconLeft,
  iconRight,
  fullWidth,
}: ButtonProps) {
  const s = sizeStyle[size]
  const v = variantStyle(variant, !!disabled || !!loading)
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => ({
        backgroundColor: v.bg,
        borderColor: v.borderColor,
        borderWidth: 1,
        paddingVertical: s.paddingV,
        paddingHorizontal: s.paddingH,
        borderRadius: 10,
        opacity: v.opacity * (pressed ? 0.85 : 1),
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        alignSelf: fullWidth ? 'stretch' : 'flex-start',
      })}
    >
      {loading ? (
        <ActivityIndicator color={v.fg} size="small" />
      ) : (
        <>
          {iconLeft ? <View>{iconLeft}</View> : null}
          <Text style={{ color: v.fg, fontSize: s.fontSize, fontWeight: '600' }}>{label}</Text>
          {iconRight ? <View>{iconRight}</View> : null}
        </>
      )}
    </Pressable>
  )
}
