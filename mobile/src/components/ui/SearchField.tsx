import React from 'react'
import { View, TextInput } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../../theme/colors'

interface SearchFieldProps {
  placeholder?: string
  value?: string
  onChangeText?: (s: string) => void
}

export function SearchField({ placeholder = 'Rechercher…', value, onChangeText }: SearchFieldProps) {
  return (
    <View
      style={{
        backgroundColor: colors.bgSecondary,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: colors.border,
        paddingHorizontal: 12,
        paddingVertical: 8,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <Ionicons name="search" size={16} color={colors.textSecondary} />
      <TextInput
        placeholder={placeholder}
        placeholderTextColor={colors.textSecondary}
        value={value}
        onChangeText={onChangeText}
        style={{ color: colors.textPrimary, fontSize: 15, flex: 1, padding: 0 }}
      />
    </View>
  )
}
