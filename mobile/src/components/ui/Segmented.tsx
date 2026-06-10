import React from 'react'
import { View, Pressable, Text } from 'react-native'
import { colors } from '../../theme/colors'
import { type, spacing } from '../../theme/tokens'

interface SegmentedItem {
  label: string
  count?: number
}

interface SegmentedProps {
  items: SegmentedItem[]
  activeIndex: number
  onChange: (index: number) => void
}

/** UISegmentedControl iOS — bg secondary, segment actif elevated avec
 *  shadow subtile. Hauteur 32, radius 8. */
export function Segmented({ items, activeIndex, onChange }: SegmentedProps) {
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: colors.bgSecondary,
        borderRadius: 8,
        padding: 2,
        height: 32,
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
              borderRadius: 6,
              backgroundColor: active ? '#48484a' : 'transparent',
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'center',
              gap: spacing.xs,
              ...(active
                ? {
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.3,
                    shadowRadius: 2,
                    elevation: 1,
                  }
                : null),
            }}
          >
            <Text
              style={{
                ...type.subheadline,
                color: active ? colors.textPrimary : colors.textSecondary,
                fontWeight: active ? '600' : '500',
              }}
            >
              {it.label}
            </Text>
            {typeof it.count === 'number' && it.count > 0 ? (
              <Text
                style={{
                  ...type.caption2,
                  color: active ? colors.textSecondary : colors.textTertiary,
                }}
              >
                ({it.count})
              </Text>
            ) : null}
          </Pressable>
        )
      })}
    </View>
  )
}
