import React, { useCallback, useEffect, useState } from 'react'
import { View, Text, ScrollView, Pressable, RefreshControl } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as Clipboard from 'expo-clipboard'
import { NavLarge } from '../../components/ui'
import { readDebugLog, clearDebugLog } from '../../services/debugLog'
import { colors } from '../../theme/colors'
import { type as t, spacing, radius } from '../../theme/tokens'

export function DebugLogScreen() {
  const [log, setLog] = useState('Chargement…')
  const [copied, setCopied] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    setLog(await readDebugLog())
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const onRefresh = async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }

  const onCopy = async () => {
    await Clipboard.setStringAsync(log)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const onClear = async () => {
    await clearDebugLog()
    await load()
  }

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bgPrimary }}>
      <NavLarge title="Logs debug" />
      <View style={{ flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, marginBottom: spacing.sm }}>
        <Pressable
          onPress={onCopy}
          style={{
            flex: 1,
            backgroundColor: copied ? '#38A169' : colors.primary,
            borderRadius: radius.md,
            paddingVertical: spacing.sm,
            alignItems: 'center',
          }}
        >
          <Text style={{ ...t.footnote, color: '#fff', fontWeight: '700' }}>
            {copied ? '✓ Copié' : 'Copier tout'}
          </Text>
        </Pressable>
        <Pressable
          onPress={onClear}
          style={{
            backgroundColor: colors.bgSecondary,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radius.md,
            paddingVertical: spacing.sm,
            paddingHorizontal: spacing.md,
            alignItems: 'center',
          }}
        >
          <Text style={{ ...t.footnote, color: colors.textSecondary, fontWeight: '700' }}>Vider</Text>
        </Pressable>
      </View>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <Text selectable style={{ ...t.footnote, color: colors.textPrimary, fontFamily: 'Menlo' }}>
          {log}
        </Text>
      </ScrollView>
    </SafeAreaView>
  )
}
