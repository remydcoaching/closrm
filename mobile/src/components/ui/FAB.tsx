import React from 'react'
import { Pressable, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

interface FABProps {
  onPress?: () => void
  icon?: keyof typeof Ionicons.glyphMap
  label?: string
  bottom?: number
}

const PRIMARY = '#00C853'
const BG_PILL = '#1c1c1e'
const BORDER_PILL = '#3a3a3c'

/** FAB style FilterChip — implémenté avec Pressable (children-as-function)
 *  + View interne stylé. Évite le bug RN où Pressable.style={fn} n'applique
 *  parfois pas les styles (visible sur iOS 17/18). */
export function FAB({ onPress, icon = 'add', label, bottom = 100 }: FABProps) {
  if (label) {
    return (
      <Pressable
        onPress={onPress}
        style={{
          position: 'absolute',
          right: 20,
          bottom,
        }}
      >
        {({ pressed }) => (
          <View
            style={{
              height: 48,
              paddingHorizontal: 18,
              borderRadius: 24,
              backgroundColor: BG_PILL,
              borderWidth: 1,
              borderColor: BORDER_PILL,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.6,
              shadowRadius: 12,
              elevation: 8,
              opacity: pressed ? 0.7 : 1,
              transform: [{ scale: pressed ? 0.96 : 1 }],
            }}
          >
            <Ionicons name={icon} size={20} color={PRIMARY} />
            <Text
              style={{
                marginLeft: 7,
                color: '#FFFFFF',
                fontSize: 15,
                fontWeight: '600',
                letterSpacing: -0.24,
              }}
            >
              {label}
            </Text>
          </View>
        )}
      </Pressable>
    )
  }
  return (
    <Pressable
      onPress={onPress}
      style={{
        position: 'absolute',
        right: 20,
        bottom,
      }}
    >
      {({ pressed }) => (
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: BG_PILL,
            borderWidth: 1,
            borderColor: BORDER_PILL,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.6,
            shadowRadius: 12,
            elevation: 8,
            opacity: pressed ? 0.7 : 1,
          }}
        >
          <Ionicons name={icon} size={26} color={PRIMARY} />
        </View>
      )}
    </Pressable>
  )
}
