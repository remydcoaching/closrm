import React from 'react'
import { ScrollView, Pressable, Text } from 'react-native'
import { colors } from '../../theme/colors'
import { type, spacing } from '../../theme/tokens'

interface ChipItem {
  label: string
  count?: number
}

interface FilterChipsProps {
  items: ChipItem[]
  activeIndex: number
  onChange: (index: number) => void
}

/** Pills horizontaux scrollables — pattern type Apple Photos / Maps
 *  ('Catégories'). Sélectionné = bg primary tint, sinon bg secondary. */
export function FilterChips({ items, activeIndex, onChange }: FilterChipsProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}
    >
      {items.map((it, i) => {
        const active = i === activeIndex
        return (
          <Pressable
            key={i}
            onPress={() => onChange(i)}
            style={{
              paddingVertical: 6,
              paddingHorizontal: spacing.md,
              borderRadius: 999,
              backgroundColor: active ? colors.primary : colors.bgSecondary,
            }}
          >
            <Text
              style={{
                ...type.subheadline,
                color: active ? '#000000' : colors.textPrimary,
                fontWeight: '600',
              }}
            >
              {it.label}
              {typeof it.count === 'number' && it.count > 0 ? `  ${it.count}` : ''}
            </Text>
          </Pressable>
        )
      })}
    </ScrollView>
  )
}
