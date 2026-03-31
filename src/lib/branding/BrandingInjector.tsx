'use client'

import { useEffect } from 'react'
import { darkenHex, hexToRgb } from './utils'

interface Props {
  accentColor: string
}

export function BrandingInjector({ accentColor }: Props) {
  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--color-primary', accentColor)
    root.style.setProperty('--color-primary-hover', darkenHex(accentColor, 15))
    const rgb = hexToRgb(accentColor)
    if (rgb) {
      root.style.setProperty('--bg-active', `rgba(${rgb.r},${rgb.g},${rgb.b},0.08)`)
    }
  }, [accentColor])

  return null
}
