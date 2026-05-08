import React, { useMemo } from 'react'
import { View, Text, Pressable, ScrollView } from 'react-native'
import { colors } from '../../theme/colors'

interface DayStripProps {
  selectedDate: Date
  onSelect: (d: Date) => void
  /** Nombre de jours à afficher autour de today. Default 14 (-3 / +10). */
  range?: { before: number; after: number }
  /** Map ISO date (YYYY-MM-DD) → count de calls pour afficher un dot. */
  countsByDate?: Record<string, number>
}

const DAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

const isoDate = (d: Date) => d.toISOString().slice(0, 10)
const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

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
      contentContainerStyle={{ paddingHorizontal: 16, gap: 6 }}
    >
      {days.map((d) => {
        const isSelected = sameDay(d, selectedDate)
        const isToday = sameDay(d, today)
        // dayOfWeek : 0=dimanche → on remappe en 0=lundi
        const dayIdx = (d.getDay() + 6) % 7
        const count = countsByDate?.[isoDate(d)] ?? 0
        return (
          <Pressable
            key={isoDate(d)}
            onPress={() => onSelect(d)}
            style={{
              width: 48,
              paddingVertical: 8,
              borderRadius: 12,
              alignItems: 'center',
              backgroundColor: isSelected ? colors.primary : colors.bgSecondary,
              borderWidth: 1,
              borderColor: isSelected ? colors.primary : colors.border,
            }}
          >
            <Text
              style={{
                color: isSelected ? '#fff' : colors.textSecondary,
                fontSize: 10,
                fontWeight: '600',
                textTransform: 'uppercase',
              }}
            >
              {DAY_LABELS[dayIdx]}
            </Text>
            <Text
              style={{
                color: isSelected ? '#fff' : isToday ? colors.primary : colors.textPrimary,
                fontSize: 16,
                fontWeight: '700',
                marginTop: 2,
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
                  backgroundColor: isSelected ? '#fff' : colors.primary,
                  marginTop: 3,
                }}
              />
            ) : (
              <View style={{ height: 7 }} />
            )}
          </Pressable>
        )
      })}
    </ScrollView>
  )
}
