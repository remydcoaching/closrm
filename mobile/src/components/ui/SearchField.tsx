import React from 'react'
import { View, TextInput, Pressable } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../../theme/colors'
import { type, spacing, radius } from '../../theme/tokens'

interface SearchFieldProps {
  placeholder?: string
  value?: string
  onChangeText?: (s: string) => void
}

/** SearchField iOS-native — match exact des UISearchBar dark mode :
 *  bg #1c1c1e, icone secondary, texte body 17pt, hauteur 36pt, radius 10. */
export function SearchField({
  placeholder = 'Rechercher…',
  value,
  onChangeText,
}: SearchFieldProps) {
  return (
    <View
      style={{
        backgroundColor: colors.bgSecondary,
        borderRadius: radius.lg,
        height: 36,
        paddingHorizontal: spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
      }}
    >
      <Ionicons name="search" size={15} color={colors.textSecondary} />
      <TextInput
        placeholder={placeholder}
        placeholderTextColor={colors.textSecondary}
        value={value}
        onChangeText={onChangeText}
        clearButtonMode="while-editing"
        style={{
          ...type.body,
          color: colors.textPrimary,
          flex: 1,
          padding: 0,
        }}
      />
      {value && value.length > 0 ? (
        <Pressable onPress={() => onChangeText?.('')} hitSlop={8}>
          <Ionicons name="close-circle" size={16} color={colors.textTertiary} />
        </Pressable>
      ) : null}
    </View>
  )
}
