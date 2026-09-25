// Probe real response shapes before committing to a parser.
// One call per endpoint family — cheap, just to see actual JSON structure.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const envPath = resolve(import.meta.dirname, '.env.local')
for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m) process.env[m[1]] = m[2].trim()
}

const KEY = process.env.HIKER_API_KEY!
const USERNAME = process.env.TEST_USERNAME!
const BASE = 'https://api.hikerapi.com'

async function probe(path: string) {
  const res = await fetch(`${BASE}${path}`, { headers: { accept: 'application/json', 'x-access-key': KEY } })
  const text = await res.text()
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    json = text
  }
  const shape = Array.isArray(json)
    ? `array[${json.length}] first-keys=${json[0] ? Object.keys(json[0]).slice(0, 6).join(',') : 'n/a'}`
    : json && typeof json === 'object'
      ? `object keys=${Object.keys(json as object).join(',')}`
      : typeof json
  console.log(`\n=== ${path} ===\nHTTP ${res.status} | shape: ${shape}`)
  console.log(JSON.stringify(json, null, 2).slice(0, 1500))
}

async function main() {
  const { pk: userId } = await fetch(`${BASE}/v1/user/by/username?username=${USERNAME}`, {
    headers: { accept: 'application/json', 'x-access-key': KEY },
  }).then((r) => r.json())

  console.log(`target user_id = ${userId}`)

  await probe(`/gql/user/medias?user_id=${userId}`)
  await probe(`/gql/user/clips?user_id=${userId}`)
  await probe(`/g2/user/followers?user_id=${userId}`)
  await probe(`/v2/user/stories?user_id=${userId}`)
}

main().catch((e) => {
  console.error('probe failed:', e instanceof Error ? e.message : e)
  process.exit(1)
})
