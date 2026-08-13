import React, { useState } from 'react'
import { View, Text, ScrollView, Pressable, ActivityIndicator, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as ImagePicker from 'expo-image-picker'
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Ionicons } from '@expo/vector-icons'
import type { LeadsStackParamList } from '../../navigation/types'
import { api } from '../../services/api'
import { NavLarge } from '../../components/ui'
import { colors } from '../../theme/colors'
import { type as t, spacing, radius } from '../../theme/tokens'

type Nav = NativeStackNavigationProp<LeadsStackParamList, 'ImportScreenshots'>

const MAX_IMAGES = 10

interface ImportResult {
  handle: string
  already_exists: boolean
  existing_lead_id?: string
}

type Step = 'upload' | 'extracting' | 'review' | 'creating' | 'done'

const MAX_WIDTH = 1280

async function uriToDataUrl(uri: string): Promise<string> {
  const rendered = await ImageManipulator.manipulate(uri).resize({ width: MAX_WIDTH }).renderAsync()
  const saved = await rendered.saveAsync({ compress: 0.6, format: SaveFormat.JPEG, base64: true })
  return `data:image/jpeg;base64,${saved.base64}`
}

export function ImportScreenshotsScreen() {
  const navigation = useNavigation<Nav>()
  const [step, setStep] = useState<Step>('upload')
  const [previews, setPreviews] = useState<string[]>([])
  const [results, setResults] = useState<ImportResult[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [createFollowUp, setCreateFollowUp] = useState(true)
  const [summary, setSummary] = useState<{ created: number; follow_ups_created: number } | null>(null)

  const pickImages = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) {
      Alert.alert('Permission requise', "Autorise l'accès aux photos pour importer des captures.")
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: MAX_IMAGES,
      quality: 0.8,
    })
    if (result.canceled) return
    const uris = result.assets.map((a) => a.uri)
    if (uris.length > MAX_IMAGES) {
      Alert.alert("Trop d'images", `Maximum ${MAX_IMAGES} images par import.`)
      return
    }
    setPreviews(uris)
  }

  const analyze = async () => {
    setStep('extracting')
    try {
      const dataUrls = await Promise.all(previews.map(uriToDataUrl))
      const res = await api.post<{ results: ImportResult[] }>('/api/leads/import-from-screenshots', {
        images: dataUrls,
      })
      setResults(res.results ?? [])
      setSelected(new Set(res.results.filter((r) => !r.already_exists).map((r) => r.handle)))
      setStep('review')
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Erreur extraction')
      setStep('upload')
    }
  }

  const toggle = (handle: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(handle)) next.delete(handle)
      else next.add(handle)
      return next
    })
  }

  const confirm = async () => {
    setStep('creating')
    try {
      const res = await api.post<{ created: number; follow_ups_created: number }>(
        '/api/leads/import-from-screenshots/confirm',
        {
          handles: [...selected],
          create_follow_up: createFollowUp,
          follow_up_delay_days: 7,
          follow_up_reason: 'Nouveau follower — premier contact',
        },
      )
      setSummary(res)
      setStep('done')
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Erreur création')
      setStep('review')
    }
  }

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bgPrimary }}>
      <NavLarge title="Import screenshots" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100 }}>
        {step === 'upload' && (
          <View>
            <Pressable onPress={pickImages}>
              {({ pressed }) => (
                <View
                  style={{
                    borderWidth: 2, borderStyle: 'dashed', borderColor: colors.border,
                    borderRadius: radius.lg, padding: spacing.xl, alignItems: 'center',
                    opacity: pressed ? 0.7 : 1,
                  }}
                >
                  <Ionicons name="images-outline" size={32} color={colors.textTertiary} />
                  <Text style={{ ...t.body, color: colors.textPrimary, marginTop: 8, fontWeight: '600' }}>
                    Sélectionner des captures ({previews.length}/{MAX_IMAGES})
                  </Text>
                </View>
              )}
            </Pressable>
            {previews.length > 0 && (
              <Pressable onPress={analyze} style={{ marginTop: spacing.lg }}>
                {({ pressed }) => (
                  <View
                    style={{
                      backgroundColor: colors.primary, borderRadius: radius.lg,
                      paddingVertical: 14, alignItems: 'center', opacity: pressed ? 0.85 : 1,
                    }}
                  >
                    <Text style={{ color: '#000', fontWeight: '700', fontSize: 16 }}>
                      Analyser {previews.length} capture{previews.length > 1 ? 's' : ''}
                    </Text>
                  </View>
                )}
              </Pressable>
            )}
          </View>
        )}

        {step === 'extracting' && (
          <View style={{ alignItems: 'center', paddingVertical: spacing.xl }}>
            <ActivityIndicator color={colors.primary} />
            <Text style={{ ...t.body, color: colors.textSecondary, marginTop: 12 }}>
              Analyse des captures…
            </Text>
          </View>
        )}

        {step === 'review' && (
          <View>
            {results.length === 0 ? (
              <Text style={{ ...t.body, color: colors.textSecondary }}>
                Aucun nouveau follower détecté sur ces captures.
              </Text>
            ) : (
              <>
                <View style={{ backgroundColor: colors.bgSecondary, borderRadius: radius.lg, overflow: 'hidden', marginBottom: spacing.lg }}>
                  {results.map((r, idx) => {
                    const isSelected = selected.has(r.handle)
                    return (
                      <Pressable key={r.handle} onPress={() => toggle(r.handle)}>
                        {({ pressed }) => (
                          <View
                            style={{
                              flexDirection: 'row', alignItems: 'center', gap: 10,
                              paddingHorizontal: 14, paddingVertical: 12,
                              borderBottomWidth: idx === results.length - 1 ? 0 : 0.33,
                              borderBottomColor: colors.border,
                              opacity: pressed ? 0.7 : 1,
                            }}
                          >
                            <Ionicons
                              name={isSelected ? 'checkbox' : 'square-outline'}
                              size={20}
                              color={isSelected ? colors.primary : colors.textTertiary}
                            />
                            <Text style={{ ...t.body, color: colors.textPrimary, flex: 1 }}>
                              @{r.handle}
                            </Text>
                            {r.already_exists && (
                              <View
                                style={{
                                  paddingHorizontal: 8, paddingVertical: 2, borderRadius: 99,
                                  backgroundColor: colors.bgPrimary,
                                }}
                              >
                                <Text style={{ ...t.caption2, color: colors.textSecondary }}>déjà en base</Text>
                              </View>
                            )}
                          </View>
                        )}
                      </Pressable>
                    )
                  })}
                </View>

                <Pressable onPress={() => setCreateFollowUp((v) => !v)} style={{ marginBottom: spacing.lg }}>
                  {({ pressed }) => (
                    <View
                      style={{
                        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                        paddingHorizontal: 14, paddingVertical: 12, borderRadius: radius.lg,
                        backgroundColor: colors.bgSecondary, opacity: pressed ? 0.85 : 1,
                      }}
                    >
                      <Text style={{ ...t.body, color: colors.textPrimary, fontWeight: '600' }}>
                        Relance à J+7 pour les sélectionnés
                      </Text>
                      <Ionicons
                        name={createFollowUp ? 'checkbox' : 'square-outline'}
                        size={22}
                        color={createFollowUp ? colors.primary : colors.textTertiary}
                      />
                    </View>
                  )}
                </Pressable>

                <Pressable onPress={confirm} disabled={selected.size === 0}>
                  {({ pressed }) => (
                    <View
                      style={{
                        backgroundColor: colors.primary, borderRadius: radius.lg,
                        paddingVertical: 14, alignItems: 'center',
                        opacity: selected.size === 0 ? 0.5 : pressed ? 0.85 : 1,
                      }}
                    >
                      <Text style={{ color: '#000', fontWeight: '700', fontSize: 16 }}>
                        Créer {selected.size} lead{selected.size > 1 ? 's' : ''}
                      </Text>
                    </View>
                  )}
                </Pressable>
              </>
            )}
          </View>
        )}

        {step === 'creating' && (
          <View style={{ alignItems: 'center', paddingVertical: spacing.xl }}>
            <ActivityIndicator color={colors.primary} />
          </View>
        )}

        {step === 'done' && summary && (
          <View>
            <Text style={{ ...t.body, color: colors.textPrimary, marginBottom: spacing.lg }}>
              {summary.created} lead{summary.created > 1 ? 's' : ''} créé{summary.created > 1 ? 's' : ''}
              {summary.follow_ups_created > 0
                ? ` · ${summary.follow_ups_created} relance${summary.follow_ups_created > 1 ? 's' : ''} programmée${summary.follow_ups_created > 1 ? 's' : ''}`
                : ''}
              .
            </Text>
            <Pressable onPress={() => navigation.goBack()}>
              {({ pressed }) => (
                <View
                  style={{
                    backgroundColor: colors.primary, borderRadius: radius.lg,
                    paddingVertical: 14, alignItems: 'center', opacity: pressed ? 0.85 : 1,
                  }}
                >
                  <Text style={{ color: '#000', fontWeight: '700', fontSize: 16 }}>Retour aux leads</Text>
                </View>
              )}
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}
