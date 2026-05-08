import React from 'react'
import { View, Pressable, Text } from 'react-native'
import { colors } from '../../theme/colors'

interface SegmentedItem {
  label: string
  count?: number
}

interface SegmentedProps {
  items: SegmentedItem[]
  activeIndex: number
  onChange: (index: number) => void
}

export function Segmented({ items, activeIndex, onChange }: SegmentedProps) {
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: colors.bgSecondary,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: colors.border,
        padding: 3,
      }}
    >
      {items.map((it, i) => {
        const active = i === activeIndex
        return (
          <Pressable
            key={i}
            onPress={() => onChange(i)}
            style={{
              flex: 1,
              paddingVertical: 7,
              borderRadius: 8,
              backgroundColor: active ? colors.bgElevated : 'transparent',
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <Text
              style={{
                color: active ? colors.textPrimary : colors.textSecondary,
                fontSize: 13,
                fontWeight: '600',
              }}
            >
              {it.label}
            </Text>
            {typeof it.count === 'number' && (
              <View
                style={{
                  backgroundColor: active ? colors.primary + '22' : colors.border,
                  borderRadius: 999,
                  paddingHorizontal: 6,
                  paddingVertical: 1,
                }}
              >
                <Text
                  style={{
                    color: active ? colors.primary : colors.textSecondary,
                    fontSize: 10,
                    fontWeight: '700',
                  }}
                >
                  {it.count}
                </Text>
              </View>
            )}
          </Pressable>
        )
      })}
    </View>
  )
}
