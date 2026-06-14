import React, { useEffect, useState } from 'react'
import { View, Text, Pressable, Alert } from 'react-native'
import * as Clipboard from 'expo-clipboard'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../../services/supabase'
import { api } from '../../services/api'
import { colors } from '../../theme/colors'
import { type as t, spacing, radius } from '../../theme/tokens'
import type { Lead } from '@shared/types'

const DEFAULT_TEMPLATE = `Salut {{first_name}},
C'est {{coach_name}}, merci d'avoir pris rendez-vous 😃


Le but est de faire un point sur ta situation, comprendre où tu en es actuellement et voir si on peut t'aider.


Ton rendez-vous est planifié le {{date}} à {{time}}.


À très vite.`

function fillTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`)
}

function formatDate(d: Date): string {
  const months = [
    'janvier',
    'février',
    'mars',
    'avril',
    'mai',
    'juin',
    'juillet',
    'août',
    'septembre',
    'octobre',
    'novembre',
    'décembre',
  ]
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`
}

function formatTime(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

interface Props {
  lead: Pick<Lead, 'id' | 'first_name' | 'last_name' | 'status'>
}

/**
 * Affiché uniquement pour les leads en setting_planifie / closing_planifie.
 * Fetch le prochain call planifié et rend le message de confirmation
 * pré-rempli avec un bouton Copier.
 */
export default function ConfirmationMessageBlock({ lead }: Props) {
  const [scheduledAt, setScheduledAt] = useState<Date | null>(null)
  const [coachName, setCoachName] = useState<string>('le coach')
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)

  const visible = lead.status === 'setting_planifie' || lead.status === 'closing_planifie'

  useEffect(() => {
    if (!visible) return
    let cancelled = false

    // Fetch coach name
    api
      .get<{ data: { full_name: string | null } }>('/api/auth/me')
      .then((j) => {
        if (!cancelled && j?.data?.full_name) setCoachName(j.data.full_name)
      })
      .catch(() => {})

    // Fetch next pending call
    supabase
      .from('calls')
      .select('scheduled_at, outcome')
      .eq('lead_id', lead.id)
      .eq('outcome', 'pending')
      .gte('scheduled_at', new Date().toISOString())
      .order('scheduled_at', { ascending: true })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return
        if (data?.scheduled_at) {
          setScheduledAt(new Date(data.scheduled_at as string))
        } else {
          // Fallback : dernier call planifié même passé
          supabase
            .from('calls')
            .select('scheduled_at')
            .eq('lead_id', lead.id)
            .order('scheduled_at', { ascending: false })
            .limit(1)
            .maybeSingle()
            .then(({ data: latest }) => {
              if (!cancelled && latest?.scheduled_at) {
                setScheduledAt(new Date(latest.scheduled_at as string))
              }
            })
        }
      })

    return () => {
      cancelled = true
    }
  }, [lead.id, visible])

  if (!visible) return null

  const dateLabel = scheduledAt ? formatDate(scheduledAt) : null
  const timeLabel = scheduledAt ? formatTime(scheduledAt) : null

  const message = fillTemplate(DEFAULT_TEMPLATE, {
    first_name: lead.first_name || '',
    last_name: lead.last_name || '',
    coach_name: coachName,
    date: scheduledAt ? formatDate(scheduledAt) : '—',
    time: scheduledAt ? formatTime(scheduledAt) : '—',
  })

  async function copy() {
    try {
      await Clipboard.setStringAsync(message)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      Alert.alert('Erreur', err instanceof Error ? err.message : 'Copie échouée')
    }
  }

  return (
    <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.xl, gap: 10 }}>
      {/* Badge RDV visible direct — date/heure du prochain call planifié.
          Le coach n'a plus à ouvrir l'agenda pour savoir quand c'est. */}
      {dateLabel && timeLabel ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            paddingVertical: 12,
            paddingHorizontal: 14,
            borderRadius: radius.lg,
            backgroundColor: colors.primary + '14',
            borderWidth: 1,
            borderColor: colors.primary + '40',
          }}
        >
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: colors.primary + '33',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="calendar" size={18} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ ...t.caption1, color: colors.textTertiary, marginBottom: 2 }}>
              Prochain rendez-vous
            </Text>
            <Text style={{ ...t.bodyEmphasis, color: colors.textPrimary }}>
              {dateLabel} à {timeLabel}
            </Text>
          </View>
        </View>
      ) : null}

      <Pressable
        onPress={() => setExpanded((e) => !e)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          alignSelf: 'flex-start',
          paddingVertical: 6,
          paddingHorizontal: 12,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: '#a855f7' + '40',
          backgroundColor: '#a855f7' + '14',
        }}
      >
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={14}
          color="#a855f7"
        />
        <Text style={{ ...t.footnote, color: '#a855f7', fontWeight: '600' }}>
          Message de confirmation
        </Text>
      </Pressable>

      {expanded && (
        <View
          style={{
            backgroundColor: colors.bgSecondary,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radius.lg,
            padding: spacing.md,
            gap: 10,
          }}
        >
          <Text style={{ ...t.body, color: colors.textPrimary, lineHeight: 21 }}>
            {message}
          </Text>
          <Pressable
            onPress={copy}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              alignSelf: 'flex-start',
              gap: 6,
              paddingVertical: 8,
              paddingHorizontal: 14,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: copied ? colors.primary : '#a855f7',
              backgroundColor: copied ? colors.primary + '14' : '#a855f7' + '14',
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Ionicons
              name={copied ? 'checkmark' : 'copy-outline'}
              size={14}
              color={copied ? colors.primary : '#a855f7'}
            />
            <Text style={{ ...t.footnote, color: copied ? colors.primary : '#a855f7', fontWeight: '600' }}>
              {copied ? 'Copié !' : 'Copier'}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  )
}
