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

const sizeStyle: Record<Size, { paddingV: number; paddingH: number; fontSize: number; radius: number }> = {
  sm: { paddingV: 8, paddingH: 14, fontSize: 13, radius: 10 },
  md: { paddingV: 12, paddingH: 18, fontSize: 15, radius: 12 },
  lg: { paddingV: 16, paddingH: 22, fontSize: 17, radius: 14 },
}

function variantStyle(variant: Variant, disabled: boolean) {
  const dim = disabled ? 0.4 : 1
  switch (variant) {
    case 'primary':
      return {
        bg: colors.primary,
        fg: '#fff',
        borderColor: colors.primary,
        opacity: dim,
        // Glow vert subtil sur primary CTA — premium feel.
        shadow: {
          shadowColor: colors.primary,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.4,
          shadowRadius: 8,
          elevation: 4,
        },
      }
    case 'danger':
      return {
        bg: colors.danger,
        fg: '#fff',
        borderColor: colors.danger,
        opacity: dim,
        shadow: {
          shadowColor: colors.danger,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 6,
          elevation: 3,
        },
      }
    case 'outline':
      return {
        bg: 'transparent',
        fg: colors.textPrimary,
        borderColor: colors.border,
        opacity: dim,
        shadow: {},
      }
    case 'ghost':
      return {
        bg: 'transparent',
        fg: colors.textPrimary,
        borderColor: 'transparent',
        opacity: dim,
        shadow: {},
      }
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
        borderRadius: s.radius,
        opacity: v.opacity * (pressed ? 0.85 : 1),
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        alignSelf: fullWidth ? 'stretch' : 'flex-start',
        ...(v.shadow as object),
      })}
    >
      {loading ? (
        <ActivityIndicator color={v.fg} size="small" />
      ) : (
        <>
          {iconLeft ? <View>{iconLeft}</View> : null}
          <Text
            style={{
              color: v.fg,
              fontSize: s.fontSize,
              fontWeight: '700',
              letterSpacing: 0.1,
            }}
          >
            {label}
          </Text>
          {iconRight ? <View>{iconRight}</View> : null}
        </>
      )}
    </Pressable>
  )
}
