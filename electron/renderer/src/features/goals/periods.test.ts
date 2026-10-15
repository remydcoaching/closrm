import { describe, expect, it } from 'vitest'
import {
  addPeriods, childHorizon, formatDayRange, isCurrentPeriod, isoWeek, parentHorizon, periodEnd,
  periodLabel, periodRange, periodStart, shortDateLabel,
} from './periods'

describe('isoWeek', () => {
  it('15 oct. 2026 est en S42', () => expect(isoWeek('2026-10-15')).toEqual({ week: 42, year: 2026 }))
  it('5 oct. 2026 est en S41', () => expect(isoWeek('2026-10-05')).toEqual({ week: 41, year: 2026 }))
  it('1er janv. 2027 (vendredi) appartient à S53 de 2026', () => expect(isoWeek('2027-01-01')).toEqual({ week: 53, year: 2026 }))
  it('29 déc. 2025 (lundi) est en S1 de 2026', () => expect(isoWeek('2025-12-29')).toEqual({ week: 1, year: 2026 }))
  it('4 janv. est toujours en S1', () => expect(isoWeek('2021-01-04').week).toBe(1))
})

describe('periodStart', () => {
  it('semaine → lundi', () => {
    expect(periodStart('week', '2026-10-15')).toBe('2026-10-12')
    expect(periodStart('week', '2026-10-18')).toBe('2026-10-12') // dimanche
    expect(periodStart('week', '2026-10-12')).toBe('2026-10-12')
  })
  it('mois, trimestre, année', () => {
    expect(periodStart('month', '2026-10-15')).toBe('2026-10-01')
    expect(periodStart('quarter', '2026-10-15')).toBe('2026-10-01')
    expect(periodStart('quarter', '2026-08-31')).toBe('2026-07-01')
    expect(periodStart('quarter', '2026-03-31')).toBe('2026-01-01')
    expect(periodStart('year', '2026-10-15')).toBe('2026-01-01')
  })
  it('rejette une date invalide', () => expect(() => periodStart('day', '2026-02-30')).toThrow())
})

describe('addPeriods / periodEnd', () => {
  it('jours et semaines traversent les mois et années', () => {
    expect(addPeriods('day', '2026-10-31', 1)).toBe('2026-11-01')
    expect(addPeriods('week', '2026-12-28', 1)).toBe('2027-01-04')
    expect(addPeriods('week', '2026-10-12', -1)).toBe('2026-10-05')
  })
  it('mois, trimestres, années', () => {
    expect(addPeriods('month', '2026-12-01', 1)).toBe('2027-01-01')
    expect(addPeriods('month', '2026-01-01', -1)).toBe('2025-12-01')
    expect(addPeriods('quarter', '2026-10-01', 1)).toBe('2027-01-01')
    expect(addPeriods('year', '2026-01-01', -2)).toBe('2024-01-01')
  })
  it('fin de période inclusive', () => {
    expect(periodEnd('week', '2026-10-12')).toBe('2026-10-18')
    expect(periodEnd('month', '2026-02-01')).toBe('2026-02-28')
    expect(periodEnd('month', '2028-02-01')).toBe('2028-02-29')
    expect(periodEnd('quarter', '2026-10-01')).toBe('2026-12-31')
    expect(periodEnd('year', '2026-01-01')).toBe('2026-12-31')
  })
})

describe('periodRange', () => {
  it('liste les semaines couvrant un intervalle', () => {
    expect(periodRange('week', '2026-10-07', '2026-10-20')).toEqual(['2026-10-05', '2026-10-12', '2026-10-19'])
  })
  it('liste les trimestres', () => {
    expect(periodRange('quarter', '2026-02-10', '2026-11-01')).toEqual(['2026-01-01', '2026-04-01', '2026-07-01', '2026-10-01'])
  })
})

describe('periodLabel (en-têtes de colonnes)', () => {
  it('semaine : « S42, 2026 » / « 12–18 oct. »', () => {
    expect(periodLabel('week', '2026-10-12')).toEqual({ title: 'S42, 2026', subtitle: '12–18 oct.' })
    expect(periodLabel('week', '2026-10-05')).toEqual({ title: 'S41, 2026', subtitle: '5–11 oct.' })
  })
  it('semaine à cheval sur deux mois : « 26 oct.–1 nov. »', () => {
    expect(periodLabel('week', '2026-10-26').subtitle).toBe('26 oct.–1 nov.')
  })
  it('semaine à cheval sur deux années', () => {
    expect(periodLabel('week', '2025-12-29')).toEqual({ title: 'S1, 2026', subtitle: '29 déc. 2025–4 janv. 2026' })
  })
  it('jour : « Jeudi » / « 15 octobre »', () => {
    expect(periodLabel('day', '2026-10-15')).toEqual({ title: 'Jeudi', subtitle: '15 octobre' })
  })
  it('mois, trimestre, année', () => {
    expect(periodLabel('month', '2026-10-01')).toEqual({ title: 'Octobre', subtitle: '2026' })
    expect(periodLabel('quarter', '2026-10-01')).toEqual({ title: 'T4 2026', subtitle: 'oct.–déc.' })
    expect(periodLabel('quarter', '2026-01-01')).toEqual({ title: 'T1 2026', subtitle: 'janv.–mars' })
    expect(periodLabel('year', '2026-01-01')).toEqual({ title: '2026', subtitle: '' })
  })
})

describe('divers', () => {
  it('période courante', () => {
    expect(isCurrentPeriod('week', '2026-10-12', '2026-10-15')).toBe(true)
    expect(isCurrentPeriod('week', '2026-10-05', '2026-10-15')).toBe(false)
  })
  it('formatDayRange même mois', () => expect(formatDayRange('2026-10-12', '2026-10-18')).toBe('12–18 oct.'))
  it('libellés courts des sous-objectifs', () => {
    expect(shortDateLabel('day', '2026-10-15')).toBe('15 octobre')
    expect(shortDateLabel('week', '2026-10-12')).toBe('S42 · 12–18 oct.')
    expect(shortDateLabel('inbox', null)).toBe('Inbox')
  })
  it('horizon parent / enfant', () => {
    expect(parentHorizon('week')).toBe('month')
    expect(parentHorizon('month')).toBe('quarter')
    expect(parentHorizon('year')).toBeNull()
    expect(childHorizon('week')).toBe('day')
    expect(childHorizon('year')).toBe('quarter')
    expect(childHorizon('day')).toBe('day')
  })
})
