# Meta Ads Integration (T-013 Bloc A) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connecter Meta Business via OAuth, stocker le token chiffré, et recevoir les leads en temps réel via webhook.

**Architecture:** OAuth Facebook Login → long-lived page access token → chiffré en AES-256-GCM dans `integrations.credentials_encrypted`. Le webhook POST de Meta reçoit les leads, retrouve le workspace via `meta_page_id`, puis insère en base avec `source: facebook_ads | instagram_ads`.

**Tech Stack:** Next.js 14 App Router, Supabase (service role pour webhook), Node.js `crypto` (AES-256-GCM), Meta Graph API v18.0

---

## Contexte codebase

- `src/types/index.ts` — type `Integration` (sans `credentials_encrypted` ni `meta_page_id`)
- `supabase/schema.sql` — table `integrations` avec `credentials_encrypted TEXT` déjà présente
- `src/lib/supabase/server.ts` — client Supabase avec cookies auth
- `src/lib/supabase/get-workspace.ts` — `getWorkspaceId()` retourne `{ userId, workspaceId }`
- `src/app/(dashboard)/parametres/integrations/page.tsx` — placeholder vide à remplacer
- `src/lib/stats/queries.ts` — `fetchMetaStats()` lit déjà `integrations` pour `isConnected`

## Variables d'environnement requises

```env
# Déjà présentes
META_APP_ID=xxx
NEXT_PUBLIC_APP_URL=https://closrm.vercel.app

# À ajouter dans .env.local ET Vercel
META_APP_SECRET=xxx
META_WEBHOOK_VERIFY_TOKEN=closrm_webhook_2026   # chaîne aléatoire, vous la choisissez
ENCRYPTION_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx  # 64 hex chars = 32 bytes
SUPABASE_SERVICE_ROLE_KEY=xxx
```

Générer `ENCRYPTION_KEY` : `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

## Fichiers à créer / modifier

| Fichier | Action | Rôle |
|---------|--------|------|
| `supabase/schema.sql` | Modifier | Ajouter `meta_page_id` (doc) |
| `src/types/index.ts` | Modifier | Ajouter `credentials_encrypted`, `meta_page_id` à `Integration` |
| `src/lib/supabase/service.ts` | Créer | Client Supabase avec service role key (pour webhook) |
| `src/lib/meta/encryption.ts` | Créer | `encrypt()` / `decrypt()` AES-256-GCM |
| `src/lib/meta/client.ts` | Créer | Appels Meta Graph API (OAuth, pages, lead data) |
| `src/app/api/integrations/meta/route.ts` | Créer | GET — initie le redirect OAuth Meta |
| `src/app/api/integrations/meta/callback/route.ts` | Créer | GET — reçoit le code, stocke le token |
| `src/app/api/integrations/meta/disconnect/route.ts` | Créer | POST — désactive l'intégration |
| `src/app/api/webhooks/meta/route.ts` | Créer | GET (verify) + POST (leads) |
| `src/app/(dashboard)/parametres/integrations/page.tsx` | Remplacer | Page complète des intégrations |

---

## Task 1 : DB migration + type update

**Files:**
- Modify: `supabase/schema.sql:151-167`
- Modify: `src/types/index.ts:122-131`

### Étape 1.1 — Ajouter `meta_page_id` dans Supabase

Exécuter dans **Supabase > SQL Editor** :

```sql
ALTER TABLE integrations ADD COLUMN IF NOT EXISTS meta_page_id TEXT;
```

### Étape 1.2 — Mettre à jour schema.sql (documentation)

Remplacer le bloc `create table integrations` dans `supabase/schema.sql` :

```sql
create table integrations (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  type text not null check (type in ('google_calendar', 'meta', 'whatsapp', 'stripe', 'telegram')),
  credentials_encrypted text,
  meta_page_id text,           -- Pour Meta : ID de la page Facebook, utilisé par le webhook
  connected_at timestamptz,
  is_active boolean not null default false,
  unique(workspace_id, type)
);
```

### Étape 1.3 — Mettre à jour le type TypeScript

Dans `src/types/index.ts`, remplacer le bloc `Integration` :

```typescript
export interface Integration {
  id: string
  workspace_id: string
  type: IntegrationType
  credentials_encrypted: string | null
  meta_page_id: string | null
  connected_at: string | null
  is_active: boolean
}
```

### Étape 1.4 — Valider

```bash
cd /c/Users/remyd/Desktop/coaching/closrm && npm run lint
```

Attendu : pas d'erreur TypeScript sur le type Integration.

- [ ] Exécuter le SQL dans Supabase
- [ ] Modifier schema.sql
- [ ] Modifier types/index.ts
- [ ] `npm run lint` — 0 erreurs

---

## Task 2 : Service Supabase (service role)

**Files:**
- Create: `src/lib/supabase/service.ts`

Le webhook Meta est appelé par Meta (pas par un utilisateur authentifié). On a besoin d'un client Supabase avec le service role key pour bypasser RLS.

### Étape 2.1 — Créer `src/lib/supabase/service.ts`

```typescript
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    throw new Error('Missing Supabase service role configuration')
  }

  return createSupabaseClient(url, serviceKey, {
    auth: { persistSession: false },
  })
}
```

### Étape 2.2 — Valider

```bash
npm run lint
```

- [ ] Créer `src/lib/supabase/service.ts`
- [ ] `npm run lint` — 0 erreurs

---

## Task 3 : Chiffrement AES-256-GCM

**Files:**
- Create: `src/lib/meta/encryption.ts`

On stocke le token Meta dans `credentials_encrypted`. Format du blob :
`iv_hex:authTag_hex:ciphertext_hex` (tout en hex, séparé par `:`).

### Étape 3.1 — Créer `src/lib/meta/encryption.ts`

```typescript
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY
  if (!hex || hex.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be a 64-character hex string (32 bytes)')
  }
  return Buffer.from(hex, 'hex')
}

export function encrypt(plaintext: string): string {
  const key = getKey()
  const iv = randomBytes(12) // 96-bit IV for GCM
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`
}

export function decrypt(blob: string): string {
  const key = getKey()
  const parts = blob.split(':')
  if (parts.length !== 3) throw new Error('Invalid encrypted blob format')
  const [ivHex, authTagHex, ciphertextHex] = parts
  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')
  const ciphertext = Buffer.from(ciphertextHex, 'hex')
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(authTag)
  return decipher.update(ciphertext).toString('utf8') + decipher.final('utf8')
}
```

### Étape 3.2 — Valider manuellement (dans Node REPL)

```bash
node -e "
process.env.ENCRYPTION_KEY = require('crypto').randomBytes(32).toString('hex');
const { encrypt, decrypt } = require('./src/lib/meta/encryption.ts');
// (avec tsx ou ts-node si dispo, sinon compiler d'abord)
"
```

Ou simplement vérifier que `npm run build` passe à la fin de la tâche.

- [ ] Créer `src/lib/meta/encryption.ts`
- [ ] `npm run lint` — 0 erreurs

---

## Task 4 : Client Meta Graph API

**Files:**
- Create: `src/lib/meta/client.ts`

Ce module encapsule tous les appels à l'API Meta Graph v18.0.

### Types internes

```typescript
export interface MetaPage {
  id: string
  name: string
  access_token: string
}

export interface MetaLeadField {
  name: string
  values: string[]
}

export interface MetaLeadData {
  id: string
  created_time: string
  field_data: MetaLeadField[]
  ad_id: string | null
  adset_id: string | null
  campaign_id: string | null
  page_id: string | null
}

export interface MetaTokenResponse {
  access_token: string
  token_type: string
  expires_in?: number
}

export interface MetaCredentials {
  user_access_token: string
  token_expires_at: string | null  // ISO date ou null si pas d'expiry
  page_id: string
  page_name: string
  page_access_token: string
}
```

### Étape 4.1 — Créer `src/lib/meta/client.ts`

```typescript
const GRAPH_URL = 'https://graph.facebook.com/v18.0'

function appId(): string {
  return process.env.META_APP_ID!
}

function appSecret(): string {
  const s = process.env.META_APP_SECRET
  if (!s) throw new Error('META_APP_SECRET not set')
  return s
}

function callbackUrl(): string {
  return `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/meta/callback`
}

// ─── OAuth ───────────────────────────────────────────────────────────────────

export function buildOAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: appId(),
    redirect_uri: callbackUrl(),
    state,
    scope: 'leads_retrieval,pages_show_list,pages_manage_metadata,pages_read_engagement',
    response_type: 'code',
  })
  return `https://www.facebook.com/v18.0/dialog/oauth?${params.toString()}`
}

export async function exchangeCodeForToken(code: string): Promise<string> {
  const params = new URLSearchParams({
    client_id: appId(),
    redirect_uri: callbackUrl(),
    client_secret: appSecret(),
    code,
  })
  const res = await fetch(`${GRAPH_URL}/oauth/access_token?${params.toString()}`)
  if (!res.ok) {
    const err = await res.json()
    throw new Error(`Meta token exchange failed: ${JSON.stringify(err)}`)
  }
  const data: MetaTokenResponse = await res.json()
  return data.access_token
}

export async function getLongLivedToken(
  shortToken: string
): Promise<{ access_token: string; expires_at: string | null }> {
  const params = new URLSearchParams({
    grant_type: 'fb_exchange_token',
    client_id: appId(),
    client_secret: appSecret(),
    fb_exchange_token: shortToken,
  })
  const res = await fetch(`${GRAPH_URL}/oauth/access_token?${params.toString()}`)
  if (!res.ok) {
    const err = await res.json()
    throw new Error(`Meta long-lived token exchange failed: ${JSON.stringify(err)}`)
  }
  const data: MetaTokenResponse & { expires_in?: number } = await res.json()
  const expires_at = data.expires_in
    ? new Date(Date.now() + data.expires_in * 1000).toISOString()
    : null
  return { access_token: data.access_token, expires_at }
}

// ─── Pages ───────────────────────────────────────────────────────────────────

export async function getPages(userToken: string): Promise<MetaPage[]> {
  const res = await fetch(
    `${GRAPH_URL}/me/accounts?fields=id,name,access_token&access_token=${userToken}`
  )
  if (!res.ok) {
    const err = await res.json()
    throw new Error(`Meta get pages failed: ${JSON.stringify(err)}`)
  }
  const data: { data: MetaPage[] } = await res.json()
  return data.data ?? []
}

export async function subscribePageToLeadgen(
  pageId: string,
  pageToken: string
): Promise<void> {
  const res = await fetch(
    `${GRAPH_URL}/${pageId}/subscribed_apps`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        subscribed_fields: 'leadgen',
        access_token: pageToken,
      }).toString(),
    }
  )
  if (!res.ok) {
    const err = await res.json()
    throw new Error(`Meta page subscription failed: ${JSON.stringify(err)}`)
  }
}

export async function unsubscribePageFromLeadgen(
  pageId: string,
  pageToken: string
): Promise<void> {
  const res = await fetch(
    `${GRAPH_URL}/${pageId}/subscribed_apps?access_token=${pageToken}`,
    { method: 'DELETE' }
  )
  // Ignore erreurs — la page était peut-être déjà désinscrite
  if (!res.ok) {
    console.warn('Meta unsubscribe warning (ignored):', await res.text())
  }
}

// ─── Lead data ───────────────────────────────────────────────────────────────

export async function getLeadData(
  leadgenId: string,
  pageToken: string
): Promise<MetaLeadData> {
  const res = await fetch(
    `${GRAPH_URL}/${leadgenId}?fields=field_data,created_time,ad_id,adset_id,campaign_id,page_id&access_token=${pageToken}`
  )
  if (!res.ok) {
    const err = await res.json()
    throw new Error(`Meta get lead failed: ${JSON.stringify(err)}`)
  }
  return res.json()
}

// ─── Helpers mapping champs Meta → Lead ──────────────────────────────────────

export interface ParsedLead {
  first_name: string
  last_name: string
  email: string | null
  phone: string
}

const FIELD_ALIASES: Record<string, keyof ParsedLead> = {
  first_name: 'first_name',
  prenom: 'first_name',
  'prénom': 'first_name',
  last_name: 'last_name',
  nom: 'last_name',
  family_name: 'last_name',
  full_name: 'first_name',        // géré spécialement ci-dessous
  email: 'email',
  email_address: 'email',
  phone_number: 'phone',
  phone: 'phone',
  mobile_phone: 'phone',
  telephone: 'phone',
}

export function parseLeadFields(fields: MetaLeadField[]): ParsedLead {
  const result: ParsedLead = { first_name: '', last_name: '', email: null, phone: '' }

  for (const { name, values } of fields) {
    const value = values[0] ?? ''
    const key = name.toLowerCase()

    if (key === 'full_name') {
      const parts = value.trim().split(/\s+/)
      result.first_name = parts[0] ?? ''
      result.last_name = parts.slice(1).join(' ')
      continue
    }

    const mapped = FIELD_ALIASES[key]
    if (mapped) {
      (result as Record<string, string | null>)[mapped] = value || null
    }
  }

  // Fallback : si pas de prénom, utiliser l'email ou 'Inconnu'
  if (!result.first_name) {
    result.first_name = result.email?.split('@')[0] ?? 'Inconnu'
  }

  return result
}
```

### Étape 4.2 — Valider

```bash
npm run lint
```

- [ ] Créer `src/lib/meta/client.ts`
- [ ] `npm run lint` — 0 erreurs

---

## Task 5 : Route OAuth — Initiation

**Files:**
- Create: `src/app/api/integrations/meta/route.ts`

Cette route est visitée quand l'utilisateur clique "Connecter Meta". Elle vérifie l'auth, génère un state anti-CSRF dans un cookie, et redirige vers Meta.

### Étape 5.1 — Créer `src/app/api/integrations/meta/route.ts`

```typescript
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { randomBytes } from 'crypto'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { buildOAuthUrl } from '@/lib/meta/client'

export async function GET() {
  try {
    await getWorkspaceId() // Vérifie que l'utilisateur est connecté

    const state = randomBytes(16).toString('hex')
    const cookieStore = await cookies()

    cookieStore.set('meta_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600, // 10 minutes
      path: '/',
    })

    return NextResponse.redirect(buildOAuthUrl(state))
  } catch {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/parametres/integrations?error=auth_required`
    )
  }
}
```

### Étape 5.2 — Valider

```bash
npm run lint
```

- [ ] Créer `src/app/api/integrations/meta/route.ts`
- [ ] `npm run lint` — 0 erreurs

---

## Task 6 : Route OAuth — Callback

**Files:**
- Create: `src/app/api/integrations/meta/callback/route.ts`

Reçoit `code` + `state` de Meta, échange le code contre un token long-lived, récupère la première page, la subscribe au webhook, et stocke le tout en base.

### Étape 6.1 — Créer `src/app/api/integrations/meta/callback/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { createClient } from '@/lib/supabase/server'
import { encrypt } from '@/lib/meta/encryption'
import {
  exchangeCodeForToken,
  getLongLivedToken,
  getPages,
  subscribePageToLeadgen,
  type MetaCredentials,
} from '@/lib/meta/client'

const REDIRECT_BASE = `${process.env.NEXT_PUBLIC_APP_URL}/parametres/integrations`

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const errorParam = searchParams.get('error')

  // Accès refusé par l'utilisateur sur Meta
  if (errorParam) {
    return NextResponse.redirect(`${REDIRECT_BASE}?error=meta_denied`)
  }

  if (!code || !state) {
    return NextResponse.redirect(`${REDIRECT_BASE}?error=invalid_callback`)
  }

  // Vérification CSRF
  const cookieStore = await cookies()
  const storedState = cookieStore.get('meta_oauth_state')?.value
  cookieStore.delete('meta_oauth_state')

  if (!storedState || storedState !== state) {
    return NextResponse.redirect(`${REDIRECT_BASE}?error=invalid_state`)
  }

  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    // 1. Échanger le code pour un token court
    const shortToken = await exchangeCodeForToken(code)

    // 2. Convertir en token long (60 jours)
    const { access_token: longToken, expires_at } = await getLongLivedToken(shortToken)

    // 3. Récupérer les pages de l'utilisateur
    const pages = await getPages(longToken)
    if (pages.length === 0) {
      return NextResponse.redirect(`${REDIRECT_BASE}?error=no_pages`)
    }

    // On prend la première page (V1 : une seule page par workspace)
    const page = pages[0]

    // 4. Souscrire la page aux événements leadgen
    await subscribePageToLeadgen(page.id, page.access_token)

    // 5. Chiffrer et stocker les credentials
    const credentials: MetaCredentials = {
      user_access_token: longToken,
      token_expires_at: expires_at,
      page_id: page.id,
      page_name: page.name,
      page_access_token: page.access_token,
    }
    const encrypted = encrypt(JSON.stringify(credentials))

    const { error } = await supabase
      .from('integrations')
      .upsert(
        {
          workspace_id: workspaceId,
          type: 'meta',
          credentials_encrypted: encrypted,
          meta_page_id: page.id,
          connected_at: new Date().toISOString(),
          is_active: true,
        },
        { onConflict: 'workspace_id,type' }
      )

    if (error) {
      console.error('Supabase upsert error:', error)
      return NextResponse.redirect(`${REDIRECT_BASE}?error=db_error`)
    }

    return NextResponse.redirect(`${REDIRECT_BASE}?success=meta_connected`)
  } catch (err) {
    console.error('Meta OAuth callback error:', err)
    return NextResponse.redirect(`${REDIRECT_BASE}?error=oauth_failed`)
  }
}
```

### Étape 6.2 — Valider

```bash
npm run lint
```

- [ ] Créer `src/app/api/integrations/meta/callback/route.ts`
- [ ] `npm run lint` — 0 erreurs

---

## Task 7 : Route Disconnect

**Files:**
- Create: `src/app/api/integrations/meta/disconnect/route.ts`

### Étape 7.1 — Créer `src/app/api/integrations/meta/disconnect/route.ts`

```typescript
import { NextResponse } from 'next/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { createClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/meta/encryption'
import { unsubscribePageFromLeadgen, type MetaCredentials } from '@/lib/meta/client'

export async function POST() {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    // Récupérer l'intégration existante pour avoir les credentials
    const { data: integration } = await supabase
      .from('integrations')
      .select('credentials_encrypted, meta_page_id')
      .eq('workspace_id', workspaceId)
      .eq('type', 'meta')
      .maybeSingle()

    // Tenter de désabonner la page (best effort)
    if (integration?.credentials_encrypted && integration?.meta_page_id) {
      try {
        const creds: MetaCredentials = JSON.parse(decrypt(integration.credentials_encrypted))
        await unsubscribePageFromLeadgen(creds.page_id, creds.page_access_token)
      } catch {
        // Ignore — la page était peut-être déjà désinscrite ou token expiré
      }
    }

    // Désactiver l'intégration en base
    const { error } = await supabase
      .from('integrations')
      .update({
        is_active: false,
        credentials_encrypted: null,
        meta_page_id: null,
        connected_at: null,
      })
      .eq('workspace_id', workspaceId)
      .eq('type', 'meta')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
```

### Étape 7.2 — Valider

```bash
npm run lint
```

- [ ] Créer `src/app/api/integrations/meta/disconnect/route.ts`
- [ ] `npm run lint` — 0 erreurs

---

## Task 8 : Webhook Meta

**Files:**
- Create: `src/app/api/webhooks/meta/route.ts`

Le webhook reçoit les événements de Meta. Deux handlers :
- **GET** : vérification du endpoint (Meta envoie `hub.challenge` à confirmer)
- **POST** : réception des leads en temps réel

Le webhook est appelé par Meta (pas par un utilisateur), donc on utilise le client service role pour bypasser RLS.

### Étape 8.1 — Créer `src/app/api/webhooks/meta/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { decrypt } from '@/lib/meta/encryption'
import { getLeadData, parseLeadFields, type MetaCredentials } from '@/lib/meta/client'

// ─── GET : vérification du webhook ───────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === process.env.META_WEBHOOK_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 })
  }

  return new NextResponse('Forbidden', { status: 403 })
}

// ─── POST : réception leads ──────────────────────────────────────────────────

interface LeadgenChange {
  value: {
    form_id: string
    leadgen_id: string
    created_time: number
    page_id: string
    ad_id?: string
    adset_id?: string
    campaign_id?: string
  }
  field: 'leadgen'
}

interface WebhookEntry {
  id: string
  time: number
  changes: LeadgenChange[]
}

interface WebhookPayload {
  object: string
  entry: WebhookEntry[]
}

export async function POST(request: NextRequest) {
  let payload: WebhookPayload

  try {
    payload = await request.json()
  } catch {
    return new NextResponse('Bad Request', { status: 400 })
  }

  if (payload.object !== 'page') {
    return new NextResponse('OK', { status: 200 })
  }

  const supabase = createServiceClient()

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== 'leadgen') continue

      const { page_id, leadgen_id, ad_id, adset_id, campaign_id } = change.value

      try {
        // 1. Trouver le workspace associé à cette page
        const { data: integration } = await supabase
          .from('integrations')
          .select('workspace_id, credentials_encrypted')
          .eq('type', 'meta')
          .eq('is_active', true)
          .eq('meta_page_id', page_id)
          .maybeSingle()

        if (!integration?.credentials_encrypted) {
          console.warn(`No active Meta integration for page_id=${page_id}`)
          continue
        }

        const creds: MetaCredentials = JSON.parse(decrypt(integration.credentials_encrypted))

        // 2. Récupérer les données du lead depuis Meta
        const leadData = await getLeadData(leadgen_id, creds.page_access_token)
        const parsed = parseLeadFields(leadData.field_data)

        // 3. Déterminer la source selon la page
        // Facebook Lead Ads → facebook_ads, Instagram Lead Ads → instagram_ads
        // La distinction se fait via l'ad_id en V1 on met facebook_ads par défaut
        const source: 'facebook_ads' | 'instagram_ads' = 'facebook_ads'

        // 4. Insérer le lead en base
        const { error } = await supabase
          .from('leads')
          .insert({
            workspace_id: integration.workspace_id,
            first_name: parsed.first_name,
            last_name: parsed.last_name,
            phone: parsed.phone ?? '',
            email: parsed.email,
            status: 'nouveau',
            source,
            tags: [],
            call_attempts: 0,
            reached: false,
            meta_campaign_id: campaign_id ?? null,
            meta_adset_id: adset_id ?? null,
            meta_ad_id: ad_id ?? null,
          })

        if (error) {
          console.error('Failed to insert Meta lead:', error)
        }
      } catch (err) {
        console.error(`Error processing leadgen_id=${leadgen_id}:`, err)
        // Ne pas faire échouer la réponse — Meta ne retente que sur erreurs HTTP
      }
    }
  }

  return new NextResponse('OK', { status: 200 })
}
```

### Étape 8.2 — Valider

```bash
npm run lint
```

- [ ] Créer `src/app/api/webhooks/meta/route.ts`
- [ ] `npm run lint` — 0 erreurs

---

## Task 9 : Page Intégrations (UI)

**Files:**
- Modify (replace): `src/app/(dashboard)/parametres/integrations/page.tsx`

Page server component qui affiche les 5 intégrations. Meta a le bouton "Connecter/Déconnecter". Les autres sont en "coming soon". La page gère aussi les query params `?success=` et `?error=`.

### Étape 9.1 — Remplacer `src/app/(dashboard)/parametres/integrations/page.tsx`

```typescript
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import MetaIntegrationCard from './meta-card'

interface PageProps {
  searchParams: Promise<{ success?: string; error?: string }>
}

export default async function IntegrationsPage({ searchParams }: PageProps) {
  const params = await searchParams
  const { workspaceId } = await getWorkspaceId()
  const supabase = await createClient()

  const { data: integrations } = await supabase
    .from('integrations')
    .select('type, is_active, connected_at, meta_page_id, credentials_encrypted')
    .eq('workspace_id', workspaceId)

  const metaIntegration = integrations?.find(i => i.type === 'meta')

  const successMessage: Record<string, string> = {
    meta_connected: 'Meta Ads connecté avec succès ! Les leads arrivent maintenant automatiquement.',
  }
  const errorMessage: Record<string, string> = {
    auth_required: 'Vous devez être connecté pour accéder à cette page.',
    meta_denied: 'Connexion Meta annulée.',
    invalid_state: 'Erreur de sécurité. Veuillez réessayer.',
    no_pages: 'Aucune page Facebook trouvée sur ce compte Meta.',
    oauth_failed: 'Erreur lors de la connexion Meta. Vérifiez votre compte et réessayez.',
    db_error: 'Erreur lors de la sauvegarde. Veuillez réessayer.',
  }

  return (
    <div style={{ padding: '32px 40px', maxWidth: 800 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#fff', marginBottom: 6 }}>
        Intégrations
      </h1>
      <p style={{ fontSize: 13, color: '#666', marginBottom: 32 }}>
        Connecte tes outils pour automatiser l'acquisition et le suivi des leads.
      </p>

      {/* Notifications */}
      {params.success && successMessage[params.success] && (
        <div style={{
          background: 'rgba(0, 200, 83, 0.08)',
          border: '1px solid rgba(0, 200, 83, 0.25)',
          borderRadius: 10,
          padding: '12px 16px',
          marginBottom: 24,
          fontSize: 13,
          color: '#00C853',
        }}>
          {successMessage[params.success]}
        </div>
      )}
      {params.error && errorMessage[params.error] && (
        <div style={{
          background: 'rgba(229, 62, 62, 0.08)',
          border: '1px solid rgba(229, 62, 62, 0.25)',
          borderRadius: 10,
          padding: '12px 16px',
          marginBottom: 24,
          fontSize: 13,
          color: '#E53E3E',
        }}>
          {errorMessage[params.error]}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Meta Ads */}
        <MetaIntegrationCard integration={metaIntegration ?? null} />

        {/* Google Agenda — coming soon */}
        <PlaceholderCard
          icon="📅"
          name="Google Agenda"
          description="Sync RDV bidirectionnel, créer des RDV depuis le CRM"
          color="#4285F4"
        />

        {/* WhatsApp Business */}
        <PlaceholderCard
          icon="💬"
          name="WhatsApp Business"
          description="Messages automatiques aux leads et rappels RDV"
          color="#25D366"
        />

        {/* Telegram */}
        <PlaceholderCard
          icon="✈️"
          name="Telegram"
          description="Notifications coach en temps réel"
          color="#229ED9"
        />

        {/* Stripe */}
        <PlaceholderCard
          icon="💳"
          name="Stripe"
          description="Suivi paiements et abonnements — V2"
          color="#635BFF"
        />
      </div>
    </div>
  )
}

function PlaceholderCard({
  icon,
  name,
  description,
  color,
}: {
  icon: string
  name: string
  description: string
  color: string
}) {
  return (
    <div style={{
      background: '#141414',
      border: '1px solid #262626',
      borderRadius: 12,
      padding: '16px 20px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          background: `${color}18`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 18,
        }}>
          {icon}
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', marginBottom: 2 }}>
            {name}
          </div>
          <div style={{ fontSize: 12, color: '#555' }}>{description}</div>
        </div>
      </div>
      <span style={{
        fontSize: 11,
        color: '#444',
        background: '#1a1a1a',
        border: '1px solid #2a2a2a',
        borderRadius: 6,
        padding: '4px 10px',
      }}>
        Bientôt
      </span>
    </div>
  )
}
```

### Étape 9.2 — Créer le composant client MetaIntegrationCard

Le bouton "Déconnecter" doit appeler une API route (POST), donc on a besoin d'un composant client.

Créer `src/app/(dashboard)/parametres/integrations/meta-card.tsx` :

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface MetaIntegration {
  is_active: boolean
  connected_at: string | null
  meta_page_id: string | null
}

interface MetaIntegrationCardProps {
  integration: MetaIntegration | null
}

export default function MetaIntegrationCard({ integration }: MetaIntegrationCardProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const isConnected = !!integration?.is_active

  async function handleDisconnect() {
    if (!confirm('Déconnecter Meta Ads ? Les leads ne seront plus importés automatiquement.')) return
    setLoading(true)
    try {
      await fetch('/api/integrations/meta/disconnect', { method: 'POST' })
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  const connectedAt = integration?.connected_at
    ? new Date(integration.connected_at).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
    : null

  return (
    <div style={{
      background: '#141414',
      border: `1px solid ${isConnected ? 'rgba(24,119,242,0.3)' : '#262626'}`,
      borderRadius: 12,
      padding: '16px 20px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          background: 'rgba(24,119,242,0.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 18,
        }}>
          📊
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>Meta Ads</span>
            {isConnected && (
              <span style={{
                fontSize: 10,
                fontWeight: 700,
                color: '#00C853',
                background: 'rgba(0,200,83,0.1)',
                border: '1px solid rgba(0,200,83,0.25)',
                borderRadius: 4,
                padding: '2px 7px',
              }}>
                CONNECTÉ
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, color: '#555' }}>
            {isConnected
              ? `Page ID : ${integration?.meta_page_id ?? '—'} · Connecté le ${connectedAt}`
              : 'Import automatique des leads Facebook & Instagram Ads'}
          </div>
        </div>
      </div>

      {isConnected ? (
        <button
          onClick={handleDisconnect}
          disabled={loading}
          style={{
            background: 'transparent',
            border: '1px solid #333',
            color: '#888',
            fontSize: 12,
            fontWeight: 600,
            padding: '7px 16px',
            borderRadius: 8,
            cursor: loading ? 'not-allowed' : 'pointer',
            flexShrink: 0,
            opacity: loading ? 0.5 : 1,
          }}
        >
          {loading ? 'Déconnexion...' : 'Déconnecter'}
        </button>
      ) : (
        <a
          href="/api/integrations/meta"
          style={{
            background: '#1877F2',
            color: '#fff',
            fontSize: 12,
            fontWeight: 600,
            padding: '7px 16px',
            borderRadius: 8,
            textDecoration: 'none',
            flexShrink: 0,
          }}
        >
          Connecter →
        </a>
      )}
    </div>
  )
}
```

### Étape 9.3 — Valider

```bash
npm run lint && npm run build
```

Attendu : build réussi, pas d'erreurs TypeScript.

- [ ] Remplacer `src/app/(dashboard)/parametres/integrations/page.tsx`
- [ ] Créer `src/app/(dashboard)/parametres/integrations/meta-card.tsx`
- [ ] `npm run lint && npm run build` — 0 erreurs

---

## Task 10 : Variables d'environnement + commit

### Étape 10.1 — Ajouter les variables dans `.env.local`

Ouvrir `.env.local` et ajouter :

```env
META_APP_SECRET=<depuis Meta for Developers > App Settings > Basic>
META_WEBHOOK_VERIFY_TOKEN=<chaîne aléatoire de ton choix, ex: closrm_webhook_abc123>
ENCRYPTION_KEY=<généré avec : node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
SUPABASE_SERVICE_ROLE_KEY=<depuis Supabase > Settings > API > service_role>
```

### Étape 10.2 — Ajouter les mêmes variables dans Vercel

Dashboard Vercel > closrm > Settings > Environment Variables → ajouter les 4 variables.

### Étape 10.3 — Créer la branche et committer

```bash
git checkout develop && git pull origin develop
git checkout -b feature/remy-meta-ads
git add src/lib/meta/ src/lib/supabase/service.ts
git add src/app/api/integrations/meta/
git add src/app/api/webhooks/meta/
git add src/app/(dashboard)/parametres/integrations/
git add src/types/index.ts supabase/schema.sql
git commit -m "feat: Meta Ads OAuth + webhook + integrations page (T-013 Bloc A)"
git push -u origin feature/remy-meta-ads
```

### Étape 10.4 — Configurer le webhook dans Meta for Developers

1. Aller sur [developers.facebook.com](https://developers.facebook.com)
2. App > Settings > Webhooks > Add Callback URL :
   - URL : `https://closrm.vercel.app/api/webhooks/meta`
   - Verify Token : valeur de `META_WEBHOOK_VERIFY_TOKEN`
3. S'abonner au champ **leadgen** sur la Page

- [ ] Ajouter les 4 variables dans `.env.local`
- [ ] Ajouter les 4 variables dans Vercel
- [ ] Créer branche `feature/remy-meta-ads` depuis `develop`
- [ ] Commit + push
- [ ] Configurer le webhook dans Meta for Developers

---

## Task 11 : Test end-to-end

### Test OAuth

1. Aller sur `https://closrm.vercel.app/parametres/integrations`
2. Cliquer "Connecter →"
3. Autoriser sur la page Meta
4. Vérifier redirection vers `/parametres/integrations?success=meta_connected`
5. Vérifier badge "CONNECTÉ" et page_id affiché

### Test webhook GET (vérification)

```bash
curl "https://closrm.vercel.app/api/webhooks/meta?hub.mode=subscribe&hub.verify_token=TON_VERIFY_TOKEN&hub.challenge=test123"
# Attendu : test123
```

### Test webhook POST (lead simulé)

```bash
curl -X POST https://closrm.vercel.app/api/webhooks/meta \
  -H "Content-Type: application/json" \
  -d '{
    "object": "page",
    "entry": [{
      "id": "PAGE_ID",
      "time": 1234567890,
      "changes": [{
        "field": "leadgen",
        "value": {
          "form_id": "FORM_ID",
          "leadgen_id": "REAL_LEADGEN_ID",
          "created_time": 1234567890,
          "page_id": "TON_PAGE_ID",
          "ad_id": "AD_ID",
          "adset_id": "ADSET_ID",
          "campaign_id": "CAMPAIGN_ID"
        }
      }]
    }]
  }'
# Attendu : "OK" + lead créé dans Supabase
```

**Note :** `leadgen_id` doit être un vrai ID Meta sinon l'appel `getLeadData` échoue. Utiliser l'outil "Leads Testing" dans Meta for Developers pour générer un lead de test réel.

---

## Checklist finale avant PR

- [ ] `npm run lint` — 0 warnings
- [ ] `npm run build` — succès
- [ ] OAuth complet testé en staging (closrm.vercel.app)
- [ ] Webhook GET vérifié via curl
- [ ] Lead de test créé via "Leads Testing" Meta et visible dans le CRM
- [ ] Bouton "Déconnecter" testé
- [ ] Fichier `taches/tache-013-meta-ads-bloc-a.md` créé
- [ ] `etat.md` mis à jour
- [ ] `ameliorations.md` mis à jour
- [ ] PR créée vers `develop`
