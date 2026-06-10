import React, { useEffect, useRef } from 'react'
import { View, Text, FlatList, type NativeSyntheticEvent, type NativeScrollEvent } from 'react-native'
import { colors } from '../../theme/colors'

interface WheelPickerProps<T extends string | number> {
  values: T[]
  selected: T
  onSelect: (value: T) => void
  format?: (value: T) => string
  width?: number
}

const ITEM_HEIGHT = 36
const VISIBLE_COUNT = 5 // 2 above + selected + 2 below
const TOTAL_HEIGHT = ITEM_HEIGHT * VISIBLE_COUNT
const PAD_VERTICAL = (TOTAL_HEIGHT - ITEM_HEIGHT) / 2

/** WheelPicker — wheel scroll natif iOS UIDatePicker style.
 *  La row du milieu = valeur sélectionnée, highlight pill primary,
 *  rows haut/bas atténuées par opacité décroissante. */
export function WheelPicker<T extends string | number>({
  values,
  selected,
  onSelect,
  format,
  width = 80,
}: WheelPickerProps<T>) {
  const listRef = useRef<FlatList<T>>(null)
  const selectedIdx = values.indexOf(selected)

  // Scroll programmatique sur la valeur sélectionnée à l'ouverture / au
  // changement externe (pas au scroll user — sinon boucle infinie).
  useEffect(() => {
    if (selectedIdx < 0) return
    const t = setTimeout(() => {
      listRef.current?.scrollToOffset({
        offset: selectedIdx * ITEM_HEIGHT,
        animated: false,
      })
    }, 50)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIdx])

  const handleEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offset = e.nativeEvent.contentOffset.y
    const idx = Math.round(offset / ITEM_HEIGHT)
    const clamped = Math.max(0, Math.min(values.length - 1, idx))
    const next = values[clamped]
    if (next !== undefined && next !== selected) onSelect(next)
  }

  return (
    <View style={{ width, height: TOTAL_HEIGHT, position: 'relative' }}>
      {/* Bande de sélection au centre */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: PAD_VERTICAL,
          left: 0,
          right: 0,
          height: ITEM_HEIGHT,
          backgroundColor: colors.primary + '14',
          borderRadius: 10,
          borderTopWidth: 0.5,
          borderBottomWidth: 0.5,
          borderColor: colors.primary + '40',
        }}
      />

      <FlatList
        ref={listRef}
        data={values}
        keyExtractor={(v) => String(v)}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        onMomentumScrollEnd={handleEnd}
        // initialScrollIndex peut crasher si idx invalide → on initialise
        // via le useEffect.
        getItemLayout={(_, index) => ({
          length: ITEM_HEIGHT,
          offset: index * ITEM_HEIGHT,
          index,
        })}
        contentContainerStyle={{
          paddingTop: PAD_VERTICAL,
          paddingBottom: PAD_VERTICAL,
        }}
        renderItem={({ item, index }) => {
          // Distance à la sélection en lignes — pour fade-out progressif
          const dist = Math.abs(index - selectedIdx)
          const opacity = dist === 0 ? 1 : dist === 1 ? 0.5 : dist === 2 ? 0.25 : 0.15
          return (
            <View
              style={{
                height: ITEM_HEIGHT,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text
                style={{
                  fontSize: 22,
                  fontWeight: dist === 0 ? '600' : '400',
                  color: dist === 0 ? colors.textPrimary : colors.textPrimary,
                  opacity,
                  letterSpacing: -0.5,
                }}
              >
                {format ? format(item) : String(item).padStart(2, '0')}
              </Text>
            </View>
          )
        }}
      />
    </View>
  )
}
