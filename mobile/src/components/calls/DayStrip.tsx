import React, { useMemo } from 'react'
import { View, Text, Pressable, ScrollView } from 'react-native'
import { colors } from '../../theme/colors'
import { type as t, spacing } from '../../theme/tokens'

interface DayStripProps {
  selectedDate: Date
  onSelect: (d: Date) => void
  range?: { before: number; after: number }
  countsByDate?: Record<string, number>
}

const DAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

const isoDate = (d: Date) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate()

/** DayStrip — pattern Apple Calendar / Fitness : pills jour avec
 *  numéro centré, today underlined, sélection = bg primary. */
export function DayStrip({
  selectedDate,
  onSelect,
  range = { before: 3, after: 10 },
  countsByDate,
}: DayStripProps) {
  const today = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  const days = useMemo(() => {
    const out: Date[] = []
    for (let i = -range.before; i <= range.after; i++) {
      const d = new Date(today)
      d.setDate(today.getDate() + i)
      out.push(d)
    }
    return out
  }, [today, range.before, range.after])

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}
    >
      {days.map((d) => {
        const isSelected = sameDay(d, selectedDate)
        const isToday = sameDay(d, today)
        const dayIdx = (d.getDay() + 6) % 7
        const count = countsByDate?.[isoDate(d)] ?? 0
        return (
          <Pressable
            key={isoDate(d)}
            onPress={() => onSelect(d)}
            style={{
              width: 52,
              paddingVertical: 8,
              borderRadius: 12,
              alignItems: 'center',
              backgroundColor: isSelected ? colors.primary : 'transparent',
              gap: 2,
            }}
          >
            <Text
              style={{
                ...t.caption2,
                color: isSelected ? '#000' : colors.textSecondary,
                fontWeight: '600',
                letterSpacing: 0.5,
              }}
            >
              {DAY_LABELS[dayIdx]}
            </Text>
            <Text
              style={{
                ...t.title3,
                color: isSelected ? '#000' : isToday ? colors.primary : colors.textPrimary,
                fontWeight: '700',
              }}
            >
              {d.getDate()}
            </Text>
            {count > 0 ? (
              <View
                style={{
                  width: 4,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: isSelected ? '#000' : colors.primary,
                }}
              />
            ) : (
              <View style={{ height: 4 }} />
            )}
          </Pressable>
        )
      })}
    </ScrollView>
  )
}
