import React from 'react'
import { ScrollView, Pressable, Text, View } from 'react-native'
import { colors } from '../../theme/colors'

interface ChipItem {
  label: string
  count?: number
}

interface FilterChipsProps {
  items: ChipItem[]
  activeIndex: number
  onChange: (index: number) => void
}

export function FilterChips({ items, activeIndex, onChange }: FilterChipsProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
    >
      {items.map((it, i) => {
        const active = i === activeIndex
        return (
          <Pressable
            key={i}
            onPress={() => onChange(i)}
            style={{
              paddingVertical: 7,
              paddingHorizontal: 14,
              borderRadius: 999,
              backgroundColor: active ? colors.primary + '22' : colors.bgSecondary,
              borderWidth: 1,
              borderColor: active ? colors.primary : colors.border,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Text
              style={{
                color: active ? colors.primary : colors.textSecondary,
                fontSize: 13,
                fontWeight: '600',
              }}
            >
              {it.label}
            </Text>
            {typeof it.count === 'number' && (
              <View
                style={{
                  backgroundColor: active ? colors.primary + '33' : colors.border,
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
    </ScrollView>
  )
}
