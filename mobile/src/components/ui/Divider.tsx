import React from 'react'
import { View } from 'react-native'
import { colors } from '../../theme/colors'

interface DividerProps {
  marginVertical?: number
  marginHorizontal?: number
}

export function Divider({ marginVertical = 0, marginHorizontal = 0 }: DividerProps) {
  return (
    <View
      style={{
        height: 1,
        backgroundColor: colors.border,
        marginVertical,
        marginHorizontal,
      }}
    />
  )
}
