#!/usr/bin/env node
/**
 * Génère un fichier WAV d'alarme de 30s (klaxon en alternance 800Hz/600Hz
 * avec silence entre chaque bip). Pour iOS notifications il faut ensuite
 * convertir en CAF via afconvert.
 *
 * Usage : node scripts/gen-alarm-sound.js
 */

const fs = require('fs')
const path = require('path')

const SAMPLE_RATE = 16000
const DURATION_S = 30
const BEEP_DURATION_S = 0.25
const SILENCE_DURATION_S = 0.15
const FREQ_HIGH = 880
const FREQ_LOW = 660
const AMPLITUDE = 0.55 // ~max sans clipping

const totalSamples = SAMPLE_RATE * DURATION_S
const beepSamples = Math.floor(SAMPLE_RATE * BEEP_DURATION_S)
const silenceSamples = Math.floor(SAMPLE_RATE * SILENCE_DURATION_S)
const cycleSamples = beepSamples + silenceSamples

// PCM 16-bit mono
const data = Buffer.alloc(totalSamples * 2)
for (let i = 0; i < totalSamples; i++) {
  const cyclePos = i % cycleSamples
  const cycleIdx = Math.floor(i / cycleSamples)
  let sample = 0
  if (cyclePos < beepSamples) {
    const freq = cycleIdx % 2 === 0 ? FREQ_HIGH : FREQ_LOW
    // Enveloppe attaque/release pour éviter les clics
    const env =
      cyclePos < 0.02 * SAMPLE_RATE
        ? cyclePos / (0.02 * SAMPLE_RATE)
        : cyclePos > beepSamples - 0.02 * SAMPLE_RATE
          ? (beepSamples - cyclePos) / (0.02 * SAMPLE_RATE)
          : 1
    sample = AMPLITUDE * env * Math.sin((2 * Math.PI * freq * i) / SAMPLE_RATE)
  }
  const s16 = Math.max(-1, Math.min(1, sample)) * 32767
  data.writeInt16LE(Math.round(s16), i * 2)
}

// WAV header
const header = Buffer.alloc(44)
header.write('RIFF', 0)
header.writeUInt32LE(36 + data.length, 4)
header.write('WAVE', 8)
header.write('fmt ', 12)
header.writeUInt32LE(16, 16) // PCM chunk size
header.writeUInt16LE(1, 20) // format = PCM
header.writeUInt16LE(1, 22) // mono
header.writeUInt32LE(SAMPLE_RATE, 24)
header.writeUInt32LE(SAMPLE_RATE * 2, 28) // byte rate
header.writeUInt16LE(2, 32) // block align
header.writeUInt16LE(16, 34) // bits per sample
header.write('data', 36)
header.writeUInt32LE(data.length, 40)

const out = Buffer.concat([header, data])
const outDir = path.join(__dirname, '..', 'assets', 'sounds')
fs.mkdirSync(outDir, { recursive: true })
const outPath = path.join(outDir, 'alarm.wav')
fs.writeFileSync(outPath, out)
console.log(`✓ Alarm sound generated: ${outPath} (${(out.length / 1024).toFixed(1)} KB)`)
