# Relances Intuitives + Meta CAPI Signaux Négatifs — Plan d'Implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendre le logging d'appel rapide et complet (joint ? notes ?) sur toutes les pages où on traite des leads + envoyer à Meta CAPI tous les signaux de qualification négative manquants (`pas_qualifie`, `dead`, `no_show_setting`, `no_show_closing`).

**Architecture:** Factoriser le code CAPI existant (dupliqué) en helper `fireStatusChangeCapi(supabase, ws, lead, newStatus)` dans `src/lib/meta/capi.ts`, étendre la table de mapping pour couvrir les 4 nouveaux statuts, l'appeler depuis `PATCH /api/leads/[id]` (status changes) et `PATCH /api/calls/[id]` (no_show auto-status). Côté UX, créer un composant `LogCallModal` (Joint ? + Notes) réutilisable, et un endpoint `POST /api/calls/log-attempt` qui crée une ligne calls "rétro" sans changer le statut du lead. Câbler dans liste leads (remplace `ConfirmModal`), follow-ups (bouton inline + 3 colonnes Tentatives/Joint/Dernier contact via agrégat SQL), fiche lead.

**Tech Stack:** Next.js 14 App Router, TypeScript, Supabase (Postgres), Zod, React 19. Pas de framework de tests : vérification par `next build` (typecheck) + tests manuels avec `META_CAPI_TEST_EVENT_CODE`.

**Spec source:** `docs/superpowers/specs/2026-06-12-relances-meta-capi-design.md`

**Branche:** `feature/pierre-relances-meta-capi` (déjà créée et active).

---

## File Structure

**À créer :**
- `src/components/leads/LogCallModal.tsx` — composant Modal réutilisable Joint?/Notes.
- `src/app/api/calls/log-attempt/route.ts` — endpoint POST pour logger une tentative rétroactive.

**À modifier :**
- `src/lib/meta/capi.ts` — ajout helper `fireStatusChangeCapi` + table de mapping `LeadStatus → CapiEventConfig`.
- `src/lib/validations/calls.ts` — ajout `logCallAttemptSchema`.
- `src/app/api/leads/[id]/route.ts` — remplacer les deux blocs CAPI dupliqués (lignes 129-159 et 192-221) par un appel au helper, + déclencher le helper pour les 4 nouveaux statuts.
- `src/app/api/calls/[id]/route.ts` — fire CAPI helper quand l'outcome passe à `no_show` (les branches lignes 57-58 changent le statut lead sans passer par leads/[id]).
- `src/components/leads/LeadActionModal.tsx` — ajouter l'action `log_call` au menu + handler.
- `src/app/(dashboard)/leads/leads-client.tsx` — remplacer `callLead` (ligne 184-193) par ouverture de `LogCallModal` + ajouter le cas `log_call` dans `handleLeadAction`.
- `src/app/(dashboard)/follow-ups/follow-ups-client.tsx` — 3 nouvelles colonnes + bouton inline "Logger un appel" + cas `log_call` dans `handleAction`.
- `src/app/(dashboard)/closing/closing-client.tsx` — cas `log_call` dans `handleAction` (LeadActionModal y est aussi utilisé).
- `src/app/(dashboard)/leads/[id]/page.tsx` — bouton "Logger un appel" dans la zone actions de la fiche.
- `src/app/api/follow-ups/route.ts` — étendre la réponse GET avec `call_attempts`, `last_call_reached`, `last_call_at` (agrégat SQL).

**Aucune migration DB.**

---

## Task 1: Helper `fireStatusChangeCapi` + mapping table

**Files:**
- Modify: `src/lib/meta/capi.ts` (ajout après le code existant ligne 249)

- [ ] **Step 1: Ajouter le mapping `LeadStatus → CapiEventConfig` et le helper**

Ajouter à la fin de `src/lib/meta/capi.ts` :

```ts
/**
 * Mapping `LeadStatus` → Meta CAPI event configuration.
 * - `Lead`/`Purchase` are Meta standard events. The 4 negative ones are
 *   custom events the coach can wire to Custom Conversions in Ads Manager
 *   to optimize away from these profiles.
 * - Returning null means: don't fire anything for this status.
 */
type StatusCapiMapping = {
  eventName: string
  customData: CapiCustomData
}

export function mapStatusToCapiEvent(
  newStatus: string,
  context: { dealAmount?: number | null } = {},
): StatusCapiMapping | null {
  switch (newStatus) {
    case 'setting_planifie':
    case 'closing_planifie':
      return {
        eventName: 'Lead',
        customData: {
          lead_event_source: 'crm_manual_qualification',
          status: newStatus,
        },
      }
    case 'clos':
      return {
        eventName: 'Purchase',
        customData: {
          value: context.dealAmount ?? undefined,
          currency: 'EUR',
          content_name: 'Coaching',
        },
      }
    case 'pas_qualifie':
      return {
        eventName: 'LeadDisqualified',
        customData: {
          lead_event_source: 'crm_status_change',
          status: 'pas_qualifie',
        },
      }
    case 'dead':
      return {
        eventName: 'LeadLost',
        customData: {
          lead_event_source: 'crm_status_change',
          status: 'dead',
        },
      }
    case 'no_show_setting':
      return {
        eventName: 'LeadNoShowSetting',
        customData: {
          lead_event_source: 'crm_status_change',
          status: 'no_show_setting',
        },
      }
    case 'no_show_closing':
      return {
        eventName: 'LeadNoShowClosing',
        customData: {
          lead_event_source: 'crm_status_change',
          status: 'no_show_closing',
        },
      }
    default:
      return null
  }
}

/**
 * Single entry point for "send a CAPI event because the lead status changed".
 * - Resolves the pixel via funnel attribution.
 * - Maps the status to an event name + custom data.
 * - Fires the event (non-blocking; errors are logged not thrown).
 *
 * Callers wrap this in `after(...)` so it never blocks the API response.
 */
export async function fireStatusChangeCapi(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  workspaceId: string,
  lead: {
    id: string
    first_name: string | null
    last_name: string | null
    email: string | null
    phone: string | null
    tags: string[] | null
    visitor_id: string | null
    deal_amount?: number | null
  },
  newStatus: string,
): Promise<void> {
  try {
    const mapping = mapStatusToCapiEvent(newStatus, { dealAmount: lead.deal_amount })
    if (!mapping) return

    const { resolveMetaPixelForLead } = await import('@/lib/meta/pixel-resolver')
    const pixel = await resolveMetaPixelForLead(supabase, workspaceId, {
      id: lead.id,
      tags: lead.tags,
      visitor_id: lead.visitor_id,
    })
    if (!pixel) return

    await sendCapiEventForLead(
      supabase,
      workspaceId,
      pixel.pixelId,
      {
        id: lead.id,
        first_name: lead.first_name,
        last_name: lead.last_name,
        email: lead.email,
        phone: lead.phone,
      },
      mapping.eventName,
      mapping.customData,
    )
  } catch (err) {
    console.error(`[capi-status-change] non-blocking error (status=${newStatus})`, err)
  }
}
```

- [ ] **Step 2: Vérifier le typecheck**

Run: `cd /Users/pierrerebmann/closrm && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "src/lib/meta/capi.ts" | head -10`

Expected: aucune erreur sur `src/lib/meta/capi.ts`. (Si d'autres erreurs apparaissent dans le repo, ignorer celles qui ne sont pas dans ce fichier.)

- [ ] **Step 3: Commit**

```bash
cd /Users/pierrerebmann/closrm
git add src/lib/meta/capi.ts
git commit -m "$(cat <<'EOF'
refactor(meta): extract fireStatusChangeCapi helper + status→event mapping

Centralise la résolution pixel + l'envoi CAPI dans un helper unique
réutilisable depuis leads et calls. Prépare l'ajout des 4 events
négatifs (LeadDisqualified, LeadLost, LeadNoShowSetting, LeadNoShowClosing).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Refactor `PATCH /api/leads/[id]` pour utiliser le helper + ajouter les 4 statuts négatifs

**Files:**
- Modify: `src/app/api/leads/[id]/route.ts` (remplacer lignes 119-240)

- [ ] **Step 1: Modifier le bloc de gestion des status changes**

Dans `src/app/api/leads/[id]/route.ts`, remplacer l'import ligne 9 :

```ts
import { fireStatusChangeCapi } from '@/lib/meta/capi'
```

(supprimer l'import `sendCapiEventForLead` qui n'est plus utilisé directement)

Puis remplacer **entièrement** le bloc entre la ligne 119 (`if (oldLead && parsed.data.status && parsed.data.status !== oldLead.status) {`) et la fermeture ligne 240, par :

```ts
    if (oldLead && parsed.data.status && parsed.data.status !== oldLead.status) {
      fireTriggersForEvent(workspaceId, 'lead_status_changed', {
        lead_id: id,
        old_status: oldLead.status,
        new_status: parsed.data.status,
      }).catch(() => {})

      // Server-side CAPI: fire the right event for the new status.
      // Covers: setting_planifie/closing_planifie → Lead, clos → Purchase,
      // pas_qualifie → LeadDisqualified, dead → LeadLost,
      // no_show_setting → LeadNoShowSetting, no_show_closing → LeadNoShowClosing.
      after(async () => {
        await fireStatusChangeCapi(supabase, workspaceId, {
          id: data.id,
          first_name: data.first_name,
          last_name: data.last_name,
          email: data.email,
          phone: data.phone,
          tags: data.tags,
          visitor_id: data.visitor_id ?? null,
          deal_amount: data.deal_amount,
        }, parsed.data.status)
      })

      // Push : closing assigné au closer désigné
      if (parsed.data.status === 'closing_planifie' && data.assigned_to) {
        const fullName = `${data.first_name} ${data.last_name}`.trim() || 'Nouveau lead'
        void sendPushToWorkspace({
          workspaceId,
          type: 'closing_assigned',
          title: 'Nouveau closing',
          body: `${fullName} — closing à planifier`,
          data: { entity_type: 'lead', entity_id: id },
          userIds: [data.assigned_to],
        })
      }

      if (parsed.data.status === 'clos') {
        fireTriggersForEvent(workspaceId, 'deal_won', { lead_id: id }).catch(() => {})

        // Push deal_won : tous les membres du workspace
        const fullName = `${data.first_name} ${data.last_name}`.trim() || 'Lead'
        const amount = data.deal_amount
          ? new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(data.deal_amount)
          : null
        void sendPushToWorkspace({
          workspaceId,
          type: 'deal_won',
          title: '🎉 Deal closé',
          body: amount ? `${fullName} · ${amount}` : `${fullName}`,
          data: { entity_type: 'lead', entity_id: id },
        })

        // AI self-learning: record winning conversation outcome (non-blocking)
        Promise.resolve(
          supabase
            .from('ig_conversations')
            .select('id')
            .eq('lead_id', id)
            .eq('workspace_id', workspaceId)
            .limit(1)
            .single()
        ).then(({ data: conv }) => {
          if (conv) {
            import('@/lib/ai/brief').then(({ recordOutcome }) => {
              recordOutcome(workspaceId, conv.id, id, 'won').catch(() => {})
            })
          }
        }).catch(() => {})
      }
    }
```

**Note :** les imports `resolveMetaPixelForLead` ligne 8 et `sendCapiEventForLead` ligne 9 ne sont plus utilisés. Les retirer.

- [ ] **Step 2: Vérifier que `data.visitor_id` et `data.deal_amount` sont bien sélectionnés**

Le code ligne 86-92 fait `update(...).select().single()` qui retourne TOUS les champs. Donc `data.visitor_id`, `data.tags`, `data.deal_amount` sont disponibles. Pas d'action requise — vérifier juste qu'aucune erreur TS n'apparaît.

Run: `cd /Users/pierrerebmann/closrm && npx tsc --noEmit -p tsconfig.json 2>&1 | grep "src/app/api/leads/\[id\]/route.ts" | head -10`

Expected: aucune erreur. Si "Property 'visitor_id' does not exist on type" → c'est que le type Lead manque le champ. Dans ce cas faire un cast léger : `visitor_id: (data as { visitor_id?: string | null }).visitor_id ?? null`.

- [ ] **Step 3: Commit**

```bash
cd /Users/pierrerebmann/closrm
git add src/app/api/leads/[id]/route.ts
git commit -m "$(cat <<'EOF'
feat(meta): envoie events CAPI pour pas_qualifie/dead/no_show_*

Étend le bloc CAPI sur changement de statut lead pour couvrir tous les
statuts négatifs. Avant, seuls setting_planifie/closing_planifie (Lead)
et clos (Purchase) étaient envoyés à Meta. Maintenant pas_qualifie,
dead, no_show_setting et no_show_closing remontent aussi (events custom)
pour permettre au coach d'optimiser ses pubs contre ces profils via
Custom Conversions côté Ads Manager.

Refactor : utilise le nouveau helper fireStatusChangeCapi qui centralise
la résolution pixel + le mapping statut→event.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Fire CAPI helper dans `PATCH /api/calls/[id]` quand outcome → no_show

**Files:**
- Modify: `src/app/api/calls/[id]/route.ts` (ajouter après ligne 65)

- [ ] **Step 1: Ajouter l'import et l'appel CAPI**

Au début du fichier `src/app/api/calls/[id]/route.ts`, ajouter après les imports existants (ligne 5) :

```ts
import { after } from 'next/server'
import { fireStatusChangeCapi } from '@/lib/meta/capi'
```

Note : `after` est exporté depuis `next/server`, vérifier qu'il n'y a pas conflit avec le `NextRequest, NextResponse` déjà importé. Modifier l'import existant ligne 1 :

```ts
import { NextRequest, NextResponse, after } from 'next/server'
```

Puis après le bloc de mise à jour de status (ligne 65, juste après le `if (newLeadStatus) { ... }`), ajouter :

```ts
      // Si le statut lead a changé suite à l'outcome du call, fire CAPI.
      // Ce path-là ne passe PAS par PATCH /api/leads/[id] donc on doit
      // déclencher le helper ici manuellement pour les no_show.
      if (newLeadStatus) {
        const { data: leadForCapi } = await supabase
          .from('leads')
          .select('id, first_name, last_name, email, phone, tags, visitor_id, deal_amount')
          .eq('id', existingCall.lead_id)
          .eq('workspace_id', workspaceId)
          .single() as { data: {
            id: string
            first_name: string | null
            last_name: string | null
            email: string | null
            phone: string | null
            tags: string[] | null
            visitor_id: string | null
            deal_amount: number | null
          } | null }

        if (leadForCapi) {
          after(async () => {
            await fireStatusChangeCapi(supabase, workspaceId, leadForCapi, newLeadStatus)
          })
        }
      }
```

**Important :** ce bloc doit être PLACÉ À L'INTÉRIEUR du `if (parsed.data.outcome && parsed.data.outcome !== existingCall.outcome)` existant (ligne 54), donc juste après la fermeture du `if (newLeadStatus) { ... }` ligne 65, mais avant la fermeture du `if (parsed.data.outcome && ...)`. Le scope doit voir `newLeadStatus`.

Donc la structure résultante de ce bloc devient :

```ts
    // Auto-change lead status based on outcome
    if (parsed.data.outcome && parsed.data.outcome !== existingCall.outcome) {
      let newLeadStatus: string | null = null
      if (parsed.data.outcome === 'done' && existingCall.type === 'closing') newLeadStatus = 'clos'
      else if (parsed.data.outcome === 'no_show' && existingCall.type === 'setting') newLeadStatus = 'no_show_setting'
      else if (parsed.data.outcome === 'no_show' && existingCall.type === 'closing') newLeadStatus = 'no_show_closing'
      else if (parsed.data.outcome === 'cancelled') newLeadStatus = 'nouveau'

      if (newLeadStatus) {
        await supabase.from('leads').update({ status: newLeadStatus })
          .eq('id', existingCall.lead_id).eq('workspace_id', workspaceId)

        // Fire CAPI for the resulting lead status change. This path doesn't
        // go through PATCH /api/leads/[id], so the leads route's CAPI handler
        // would miss it. Cover all 3 outcomes that change status: clos,
        // no_show_setting, no_show_closing. 'nouveau' is mapped to null in
        // mapStatusToCapiEvent so the helper no-ops harmlessly.
        const { data: leadForCapi } = await supabase
          .from('leads')
          .select('id, first_name, last_name, email, phone, tags, visitor_id, deal_amount')
          .eq('id', existingCall.lead_id)
          .eq('workspace_id', workspaceId)
          .single() as { data: {
            id: string
            first_name: string | null
            last_name: string | null
            email: string | null
            phone: string | null
            tags: string[] | null
            visitor_id: string | null
            deal_amount: number | null
          } | null }

        if (leadForCapi) {
          after(async () => {
            await fireStatusChangeCapi(supabase, workspaceId, leadForCapi, newLeadStatus!)
          })
        }
      }
    }
```

- [ ] **Step 2: Vérifier le typecheck**

Run: `cd /Users/pierrerebmann/closrm && npx tsc --noEmit -p tsconfig.json 2>&1 | grep "src/app/api/calls/\[id\]/route.ts" | head -10`

Expected: aucune erreur.

- [ ] **Step 3: Commit**

```bash
cd /Users/pierrerebmann/closrm
git add src/app/api/calls/[id]/route.ts
git commit -m "$(cat <<'EOF'
feat(meta): fire CAPI quand outcome call → no_show (passe par calls)

Quand le coach passe un call à no_show, le status lead est mis à jour
directement depuis PATCH /api/calls/[id] sans passer par
/api/leads/[id]. Du coup le bloc CAPI côté leads ne se déclenchait
jamais pour ces transitions. On ajoute ici l'appel au helper centralisé
fireStatusChangeCapi pour couvrir no_show_setting et no_show_closing
(et 'clos' au passage, qui suivait le même chemin et n'avait pas non
plus d'event Purchase fiable depuis ce path).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Schéma + endpoint `POST /api/calls/log-attempt`

**Files:**
- Modify: `src/lib/validations/calls.ts` (ajouter le schéma)
- Create: `src/app/api/calls/log-attempt/route.ts`

- [ ] **Step 1: Ajouter `logCallAttemptSchema` à `src/lib/validations/calls.ts`**

À la fin de `src/lib/validations/calls.ts`, juste avant les exports de types ligne 43, ajouter :

```ts
export const logCallAttemptSchema = z.object({
  lead_id: z.string().uuid('ID lead invalide.'),
  reached: z.boolean(),
  notes: z.string().max(2000).optional().nullable(),
})

export type LogCallAttemptData = z.infer<typeof logCallAttemptSchema>
```

- [ ] **Step 2: Créer le endpoint**

Créer `src/app/api/calls/log-attempt/route.ts` :

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { logCallAttemptSchema } from '@/lib/validations/calls'

/**
 * Logue une tentative d'appel rétroactive (ex: "je viens d'appeler, il a
 * pas décroché").
 *
 * Comportement :
 * - Insert une ligne `calls` : type='setting', scheduled_at=now,
 *   outcome='done', reached=<input>, notes=<input>.
 * - Le compteur `attempt_number` est auto-incrémenté (cohérent avec
 *   POST /api/calls).
 * - Incrémente `leads.call_attempts` (denormalisé pour compteurs UI rapides).
 * - Met à jour `leads.last_activity_at`.
 * - NE CHANGE PAS le statut du lead. C'est juste un log d'activité.
 */
export async function POST(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    const body = await request.json()
    const parsed = logCallAttemptSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    // Vérifier que le lead appartient au workspace
    const { data: lead } = await supabase
      .from('leads')
      .select('id, call_attempts')
      .eq('id', parsed.data.lead_id)
      .eq('workspace_id', workspaceId)
      .single() as { data: { id: string; call_attempts: number } | null }

    if (!lead) {
      return NextResponse.json({ error: 'Lead introuvable' }, { status: 404 })
    }

    // Compter les tentatives précédentes (calls existants pour ce lead/type)
    const { count } = await supabase
      .from('calls')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .eq('lead_id', parsed.data.lead_id)
      .eq('type', 'setting')

    const now = new Date().toISOString()

    const { data: call, error } = await supabase
      .from('calls')
      .insert({
        workspace_id: workspaceId,
        lead_id: parsed.data.lead_id,
        type: 'setting',
        scheduled_at: now,
        outcome: 'done',
        attempt_number: (count ?? 0) + 1,
        reached: parsed.data.reached,
        notes: parsed.data.notes || null,
      })
      .select('*')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Met à jour le compteur denormalisé + last_activity_at sur le lead.
    // call_attempts compte uniquement les tentatives loggées via cet
    // endpoint (et celles bumpées par l'ancien bouton — on garde la
    // sémantique "compteur visible dans la liste").
    await supabase
      .from('leads')
      .update({
        call_attempts: (lead.call_attempts ?? 0) + 1,
        last_activity_at: now,
        // Si on a joint le lead, marquer reached=true en denormalisé pour
        // les badges UI rapides.
        ...(parsed.data.reached ? { reached: true } : {}),
      })
      .eq('id', parsed.data.lead_id)
      .eq('workspace_id', workspaceId)

    return NextResponse.json({ data: call }, { status: 201 })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
```

- [ ] **Step 3: Vérifier le typecheck**

Run: `cd /Users/pierrerebmann/closrm && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "(log-attempt|validations/calls)" | head -10`

Expected: aucune erreur.

- [ ] **Step 4: Test manuel rapide via curl (optionnel mais utile)**

Démarrer dev: `cd /Users/pierrerebmann/closrm && npm run dev` (background) puis depuis le navigateur authentifié, copier un cookie session et tester :

```bash
# Récupérer un lead_id d'un lead existant dans la DB (via l'UI)
# Puis dans la console navigateur loggué :
fetch('/api/calls/log-attempt', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ lead_id: '<LEAD_ID>', reached: false, notes: 'test plan' }),
}).then(r => r.json()).then(console.log)
```

Expected: réponse `{ data: { id: ..., reached: false, attempt_number: N, ... } }`. Vérifier dans la DB que `leads.call_attempts` a été incrémenté.

- [ ] **Step 5: Commit**

```bash
cd /Users/pierrerebmann/closrm
git add src/lib/validations/calls.ts src/app/api/calls/log-attempt/route.ts
git commit -m "$(cat <<'EOF'
feat(api): endpoint POST /api/calls/log-attempt

Endpoint dédié pour logger une tentative d'appel rétroactive
(joint/pas joint + notes optionnelles). Distinct de POST /api/calls
qui sert à PROGRAMMER un appel futur (et change le statut du lead à
setting_planifie/closing_planifie). Cet endpoint-ci n'altère pas le
statut, juste l'historique + compteur.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Composant `LogCallModal`

**Files:**
- Create: `src/components/leads/LogCallModal.tsx`

- [ ] **Step 1: Créer le composant**

Créer `src/components/leads/LogCallModal.tsx` :

```tsx
'use client'

import { useState } from 'react'
import { X, PhoneCall, PhoneOff, Check } from 'lucide-react'
import { Lead } from '@/types'

interface Props {
  lead: Pick<Lead, 'id' | 'first_name' | 'last_name'>
  onClose: () => void
  /** Appelé après enregistrement réussi. Le parent rafraîchit ses données. */
  onLogged: (result: { reached: boolean; notes: string | null }) => void
}

const inputS: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '10px 12px',
  background: 'var(--bg-input)',
  border: '1px solid var(--border-primary)',
  borderRadius: 10,
  color: 'var(--text-primary)',
  fontSize: 13,
  outline: 'none',
  resize: 'vertical',
  minHeight: 72,
}

export default function LogCallModal({ lead, onClose, onLogged }: Props) {
  const [step, setStep] = useState<'reached' | 'notes'>('reached')
  const [reached, setReached] = useState<boolean | null>(null)
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function pickReached(value: boolean) {
    setReached(value)
    setStep('notes')
  }

  async function submit() {
    if (reached === null) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/calls/log-attempt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_id: lead.id,
          reached,
          notes: notes.trim() || null,
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error?.formErrors?.[0] ?? j.error ?? 'Erreur')
      }
      onLogged({ reached, notes: notes.trim() || null })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur réseau')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
    >
      <div style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-primary)',
        borderRadius: 14,
        padding: 24,
        width: '100%',
        maxWidth: 420,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
              Logger un appel
            </h3>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
              {lead.first_name} {lead.last_name}
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>

        {step === 'reached' && (
          <div>
            <div style={{
              fontSize: 10, fontWeight: 700, color: 'var(--text-label)',
              letterSpacing: '0.15em', textTransform: 'uppercase',
              marginBottom: 12,
            }}>
              Tu as joint le lead ?
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <button
                onClick={() => pickReached(true)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                  padding: '20px 12px',
                  borderRadius: 12,
                  border: '1px solid rgba(56,161,105,0.3)',
                  background: 'rgba(56,161,105,0.08)',
                  color: '#38A169',
                  cursor: 'pointer',
                  fontSize: 13, fontWeight: 600,
                }}
              >
                <PhoneCall size={22} />
                Oui, joint
              </button>
              <button
                onClick={() => pickReached(false)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                  padding: '20px 12px',
                  borderRadius: 12,
                  border: '1px solid rgba(239,68,68,0.3)',
                  background: 'rgba(239,68,68,0.08)',
                  color: '#ef4444',
                  cursor: 'pointer',
                  fontSize: 13, fontWeight: 600,
                }}
              >
                <PhoneOff size={22} />
                Pas de réponse
              </button>
            </div>
          </div>
        )}

        {step === 'notes' && (
          <div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              marginBottom: 14,
              padding: '8px 12px', borderRadius: 8,
              background: reached ? 'rgba(56,161,105,0.08)' : 'rgba(239,68,68,0.08)',
              color: reached ? '#38A169' : '#ef4444',
              fontSize: 12, fontWeight: 600,
            }}>
              {reached ? <PhoneCall size={14} /> : <PhoneOff size={14} />}
              {reached ? 'Joint' : 'Pas de réponse'}
              <button
                onClick={() => setStep('reached')}
                style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'inherit', fontSize: 11, cursor: 'pointer', textDecoration: 'underline' }}
              >
                Modifier
              </button>
            </div>

            <div style={{
              fontSize: 10, fontWeight: 700, color: 'var(--text-label)',
              letterSpacing: '0.15em', textTransform: 'uppercase',
              marginBottom: 8,
            }}>
              Notes (optionnel)
            </div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={reached ? 'Ce que vous vous êtes dit, prochaine étape...' : 'Répondeur, sonné dans le vide...'}
              style={inputS}
              autoFocus
            />

            {error && (
              <div style={{ marginTop: 10, fontSize: 12, color: '#ef4444' }}>{error}</div>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button
                onClick={onClose}
                disabled={submitting}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 10, fontSize: 13,
                  border: '1px solid var(--border-primary)',
                  background: 'transparent',
                  color: 'var(--text-tertiary)',
                  cursor: submitting ? 'not-allowed' : 'pointer',
                }}
              >
                Annuler
              </button>
              <button
                onClick={submit}
                disabled={submitting}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 10, fontSize: 13, fontWeight: 600,
                  background: 'var(--color-primary)',
                  border: 'none',
                  color: 'var(--text-primary)',
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  opacity: submitting ? 0.6 : 1,
                }}
              >
                <Check size={14} />
                {submitting ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Vérifier le typecheck**

Run: `cd /Users/pierrerebmann/closrm && npx tsc --noEmit -p tsconfig.json 2>&1 | grep "LogCallModal" | head -10`

Expected: aucune erreur.

- [ ] **Step 3: Commit**

```bash
cd /Users/pierrerebmann/closrm
git add src/components/leads/LogCallModal.tsx
git commit -m "$(cat <<'EOF'
feat(ui): LogCallModal — modal 2 étapes pour logger un appel

Composant réutilisable. Étape 1 : 2 gros boutons Joint / Pas de réponse.
Étape 2 : notes optionnelles + Enregistrer. POST vers /api/calls/log-attempt.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Câbler LogCallModal dans `leads-client.tsx` (remplace ConfirmModal)

**Files:**
- Modify: `src/app/(dashboard)/leads/leads-client.tsx`

- [ ] **Step 1: Import + nouveau state**

Trouver les imports en haut du fichier `src/app/(dashboard)/leads/leads-client.tsx`. Ajouter :

```ts
import LogCallModal from '@/components/leads/LogCallModal'
```

Ajouter un nouveau state à côté des autres useState (chercher `const [confirm, setConfirm]`) :

```ts
const [logCallTarget, setLogCallTarget] = useState<Lead | null>(null)
```

- [ ] **Step 2: Remplacer la fonction `callLead` lignes 184-193**

Remplacer **intégralement** :

```ts
  const callLead = useCallback((lead: Lead) => {
    setConfirm({
      title: 'Enregistrer un appel',
      message: `Confirmer une tentative d'appel pour ${lead.first_name} ${lead.last_name} ? Le compteur passera à ${lead.call_attempts + 1}.`,
      onConfirm: () => {
        setConfirm(null)
        patchLead(lead.id, { call_attempts: lead.call_attempts + 1 })
      },
    })
  }, [patchLead])
```

Par :

```ts
  const callLead = useCallback((lead: Lead) => {
    setLogCallTarget(lead)
  }, [])
```

- [ ] **Step 3: Rendre le LogCallModal en fin du JSX**

Chercher la fin du JSX (probablement juste avant la dernière `</div>` ou à côté des autres modales rendues conditionnellement, ex: `{confirm && ...}`, `{scheduleTarget && ...}`). Ajouter :

```tsx
{logCallTarget && (
  <LogCallModal
    lead={logCallTarget}
    onClose={() => setLogCallTarget(null)}
    onLogged={({ reached }) => {
      // Patch local optimiste : bump compteur, mettre à jour reached badge.
      setLeads(prev => prev.map(l =>
        l.id === logCallTarget.id
          ? { ...l, call_attempts: (l.call_attempts ?? 0) + 1, reached: reached ? true : l.reached }
          : l
      ))
    }}
  />
)}
```

- [ ] **Step 4: Vérifier le typecheck + build**

Run: `cd /Users/pierrerebmann/closrm && npm run build 2>&1 | tail -30`

Expected: build success (ou erreurs uniquement sur d'autres fichiers non touchés ici).

- [ ] **Step 5: Test manuel**

Démarrer `npm run dev`, ouvrir `/leads`, cliquer sur le bouton "+1 appel" (icône téléphone) d'un lead. Vérifier que :
- Le LogCallModal s'ouvre.
- Cliquer "Pas de réponse" → étape 2 s'affiche avec badge rouge.
- Saisir notes "test", Enregistrer → modale se ferme.
- Compteur du lead s'incrémente dans la liste.
- En DB : nouvelle ligne dans `calls` avec `reached=false`, `notes='test'`.

- [ ] **Step 6: Commit**

```bash
cd /Users/pierrerebmann/closrm
git add src/app/\(dashboard\)/leads/leads-client.tsx
git commit -m "$(cat <<'EOF'
feat(leads): remplace ConfirmModal "+1 appel" par LogCallModal

Le coach peut maintenant indiquer joint/pas joint + notes en 2 clics
au lieu de juste incrémenter un compteur opaque.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Ajouter l'action `log_call` à `LeadActionModal`

**Files:**
- Modify: `src/components/leads/LeadActionModal.tsx`

- [ ] **Step 1: Étendre le type `LeadAction`**

Dans `src/components/leads/LeadActionModal.tsx`, modifier lignes 13-18 :

```ts
export type LeadAction =
  | { type: 'schedule_call'; leadId: string }
  | { type: 'follow_up'; date: string; reason: string; channel: string }
  | { type: 'won'; amount: number; installments: number; cash_collected: number; duration_months: number | null; closer_id: string | null; setter_id: string | null }
  | { type: 'pas_qualifie' }
  | { type: 'dead' }
  | { type: 'log_call' }
```

- [ ] **Step 2: Ajouter un bouton d'action "Logger un appel" dans le menu**

Trouver dans le rendu `mode === 'menu'` la section "Prospect intéressé" (ligne ~130). Ajouter un bouton AU-DESSUS du "Planifier un RDV" :

Modifier la section pour qu'elle ressemble à :

```tsx
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-label)', letterSpacing: '0.15em', textTransform: 'uppercase' as const, marginBottom: 8, paddingLeft: 4 }}>Logger une activité</div>
              <ActionButton
                icon={Phone}
                label="Logger un appel"
                desc="Joint / pas joint + notes — pour ne rien oublier"
                color="#3b82f6"
                onClick={() => { onAction({ type: 'log_call' }); onClose() }}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-label)', letterSpacing: '0.15em', textTransform: 'uppercase' as const, marginBottom: 8, paddingLeft: 4 }}>Prospect intéressé</div>
              <ActionButton icon={Phone} label="Planifier un RDV" desc="Le prospect est chaud → planifier un appel" color="var(--color-primary)" onClick={() => { onAction({ type: 'schedule_call', leadId: lead.id }); onClose() }} />
            </div>
```

Note : ce bouton `log_call` ferme le LeadActionModal et délègue l'ouverture du LogCallModal au parent (qui doit gérer ce nouveau cas dans son `handleAction`/`handleLeadAction`).

- [ ] **Step 3: Vérifier le typecheck**

Run: `cd /Users/pierrerebmann/closrm && npx tsc --noEmit -p tsconfig.json 2>&1 | grep "LeadActionModal" | head -10`

Expected: aucune erreur.

- [ ] **Step 4: Commit**

```bash
cd /Users/pierrerebmann/closrm
git add src/components/leads/LeadActionModal.tsx
git commit -m "$(cat <<'EOF'
feat(ui): ajoute l'action log_call dans LeadActionModal

Nouveau bouton "Logger un appel" en haut du menu. Délègue au parent
l'ouverture du LogCallModal (qui demande joint/pas joint + notes).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Câbler `log_call` dans `leads-client.tsx`

**Files:**
- Modify: `src/app/(dashboard)/leads/leads-client.tsx`

- [ ] **Step 1: Étendre `handleLeadAction`**

Dans `src/app/(dashboard)/leads/leads-client.tsx`, trouver la fonction `handleLeadAction` (vers ligne 214). Ajouter le cas `log_call` à la fin (avant la fermeture `}`) :

```ts
    } else if (action.type === 'log_call') {
      // Le bouton "Logger un appel" du LeadActionModal délègue ici.
      // On rouvre directement le LogCallModal sur le même lead.
      setLogCallTarget(lead)
    }
```

- [ ] **Step 2: Vérifier le typecheck**

Run: `cd /Users/pierrerebmann/closrm && npx tsc --noEmit -p tsconfig.json 2>&1 | grep "leads-client" | head -10`

Expected: aucune erreur.

- [ ] **Step 3: Test manuel**

Depuis `/leads`, cliquer "Traiter" sur un lead → cliquer "Logger un appel" dans le menu → vérifier que le LogCallModal s'ouvre bien.

- [ ] **Step 4: Commit**

```bash
cd /Users/pierrerebmann/closrm
git add src/app/\(dashboard\)/leads/leads-client.tsx
git commit -m "$(cat <<'EOF'
feat(leads): câble action log_call depuis LeadActionModal

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Câbler `log_call` dans `follow-ups-client.tsx` + bouton inline

**Files:**
- Modify: `src/app/(dashboard)/follow-ups/follow-ups-client.tsx`

- [ ] **Step 1: Import + state**

Ajouter en haut avec les autres imports :

```ts
import LogCallModal from '@/components/leads/LogCallModal'
import { PhoneCall } from 'lucide-react'
```

Note : `Phone` est probablement déjà importé sous une autre forme. Vérifier les imports `lucide-react` existants et ajouter `PhoneCall` à la liste si elle existe, sinon créer la ligne.

Ajouter le state à côté des autres `useState` :

```ts
const [logCallTarget, setLogCallTarget] = useState<FUWithLead | null>(null)
```

- [ ] **Step 2: Étendre `handleAction`**

Dans la fonction `handleAction` (vers ligne 151), ajouter avant la fermeture du `}` final (juste avant `refresh()`) un nouveau cas :

```ts
    } else if (action.type === 'log_call') {
      setLogCallTarget(fu)
      return
    }
```

Note : `return` car on ne veut PAS appeler `refresh()` immédiatement — le LogCallModal va se charger d'appeler `refresh()` via son `onLogged`.

- [ ] **Step 3: Ajouter un bouton inline "Logger un appel" dans la colonne Actions**

Trouver la cellule Actions (ligne ~285, contient `display: 'flex', gap: 6, justifyContent: 'flex-end'`). Ajouter un bouton AVANT le bouton "Traiter" :

```tsx
<button
  onClick={() => setLogCallTarget(fu)}
  title="Logger un appel"
  style={{
    width: 30, height: 30, borderRadius: 8,
    border: '1px solid rgba(59,130,246,0.25)',
    background: 'rgba(59,130,246,0.06)',
    cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  }}
>
  <PhoneCall size={14} color="#3b82f6" />
</button>
```

- [ ] **Step 4: Rendre le LogCallModal**

Tout en bas du JSX (à côté des autres `{modal && ...}`) :

```tsx
{logCallTarget && (
  <LogCallModal
    lead={logCallTarget.lead}
    onClose={() => setLogCallTarget(null)}
    onLogged={() => { setLogCallTarget(null); refresh() }}
  />
)}
```

- [ ] **Step 5: Vérifier le typecheck + build**

Run: `cd /Users/pierrerebmann/closrm && npm run build 2>&1 | tail -20`

Expected: build success.

- [ ] **Step 6: Test manuel**

Depuis `/follow-ups`, cliquer sur le bouton 📞 inline d'une relance → vérifier ouverture LogCallModal → tester flow complet.

- [ ] **Step 7: Commit**

```bash
cd /Users/pierrerebmann/closrm
git add src/app/\(dashboard\)/follow-ups/follow-ups-client.tsx
git commit -m "$(cat <<'EOF'
feat(follow-ups): bouton inline + action log_call

Bouton 📞 sur chaque ligne pour logger un appel en 2 clics depuis
la liste des relances. Câble aussi l'action log_call depuis le
LeadActionModal qui s'ouvre via "Traiter".

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Câbler `log_call` dans `closing-client.tsx`

**Files:**
- Modify: `src/app/(dashboard)/closing/closing-client.tsx`

- [ ] **Step 1: Lire le fichier pour repérer le pattern**

Run: `grep -n "LeadActionModal\|action.type" /Users/pierrerebmann/closrm/src/app/\(dashboard\)/closing/closing-client.tsx | head -30`

Identifier la fonction `handleAction` ou équivalent (où `action.type === 'pas_qualifie'` est traité).

- [ ] **Step 2: Ajouter le state et l'import**

```ts
import LogCallModal from '@/components/leads/LogCallModal'
```

Et state à côté des autres :

```ts
const [logCallTarget, setLogCallTarget] = useState<<le type de lead utilisé localement> | null>(null)
```

(Adapter le type au type local — probablement quelque chose comme `Lead` ou un type qui en hérite. Si pas sûr, faire `<{ id: string; first_name: string; last_name: string }>`.)

- [ ] **Step 3: Ajouter le cas log_call dans handleAction**

Dans le `handleAction` du fichier, ajouter avant la fermeture finale :

```ts
} else if (action.type === 'log_call') {
  setLogCallTarget(<le lead courant>)
  return
}
```

(`<le lead courant>` à remplacer par la variable locale qui contient le lead — souvent `lead` ou `call.lead`. Le fichier est plus simple à lire en l'ouvrant pour adapter.)

- [ ] **Step 4: Rendre le LogCallModal en bas du JSX**

```tsx
{logCallTarget && (
  <LogCallModal
    lead={logCallTarget}
    onClose={() => setLogCallTarget(null)}
    onLogged={() => { setLogCallTarget(null); /* refresh local si nécessaire */ }}
  />
)}
```

- [ ] **Step 5: Vérifier le typecheck**

Run: `cd /Users/pierrerebmann/closrm && npx tsc --noEmit -p tsconfig.json 2>&1 | grep "closing-client" | head -10`

Expected: aucune erreur. Si erreur sur le type lead, ajuster le state typing pour matcher ce qu'on passe au LogCallModal (qui attend `Pick<Lead, 'id' | 'first_name' | 'last_name'>`).

- [ ] **Step 6: Commit**

```bash
cd /Users/pierrerebmann/closrm
git add src/app/\(dashboard\)/closing/closing-client.tsx
git commit -m "$(cat <<'EOF'
feat(closing): câble action log_call depuis LeadActionModal

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Bouton "Logger un appel" sur la fiche lead

**Files:**
- Modify: `src/app/(dashboard)/leads/[id]/page.tsx`

- [ ] **Step 1: Lire la fiche lead pour repérer où placer le bouton**

Run: `grep -n "Traiter\|action\|LeadActionModal\|button" /Users/pierrerebmann/closrm/src/app/\(dashboard\)/leads/\[id\]/page.tsx | head -30`

Identifier la zone "actions" en haut de la fiche (généralement à côté des boutons "Traiter", "Programmer relance", etc.).

- [ ] **Step 2: Ajouter le state, l'import, le bouton**

```ts
'use client' // (probablement déjà présent)
import { useState } from 'react' // (probablement déjà présent)
import LogCallModal from '@/components/leads/LogCallModal'
import { PhoneCall } from 'lucide-react'
```

State :

```ts
const [showLogCall, setShowLogCall] = useState(false)
```

Bouton dans la zone actions (style à harmoniser avec les boutons existants — lire ce qui est déjà là pour suivre le pattern) :

```tsx
<button onClick={() => setShowLogCall(true)} style={{ /* mêmes styles que les autres boutons d'action */ }}>
  <PhoneCall size={14} />
  Logger un appel
</button>
```

Rendu du modal en bas :

```tsx
{showLogCall && (
  <LogCallModal
    lead={{ id: lead.id, first_name: lead.first_name, last_name: lead.last_name }}
    onClose={() => setShowLogCall(false)}
    onLogged={() => { setShowLogCall(false); /* trigger refresh local ou router.refresh() */ }}
  />
)}
```

Note : si la fiche est server component avec un client component imbriqué qui possède les actions, mettre le bouton et le modal dans le client component approprié.

- [ ] **Step 3: Vérifier le typecheck**

Run: `cd /Users/pierrerebmann/closrm && npx tsc --noEmit -p tsconfig.json 2>&1 | grep "leads/\[id\]/page" | head -10`

Expected: aucune erreur.

- [ ] **Step 4: Test manuel**

Ouvrir `/leads/<id>`, vérifier que le bouton "Logger un appel" est visible et fonctionne.

- [ ] **Step 5: Commit**

```bash
cd /Users/pierrerebmann/closrm
git add src/app/\(dashboard\)/leads/\[id\]/page.tsx
git commit -m "$(cat <<'EOF'
feat(lead-detail): bouton Logger un appel sur la fiche lead

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: Agrégat SQL — exposer compteurs/joint/dernier contact dans GET /api/follow-ups

**Files:**
- Modify: `src/app/api/follow-ups/route.ts`

- [ ] **Step 1: Étendre la réponse GET avec un join sur les calls par lead**

Le supabase-js ne permet pas facilement les sous-agrégats. Approche pragmatique : après la query principale, fetch en batch les agrégats par lead_id et les attacher en post-process.

Dans `src/app/api/follow-ups/route.ts`, après la query principale (juste après `if (error) return ...`, vers ligne 75-76), ajouter :

```ts
    // Agrégat par lead : nb tentatives, dernière reach, dernier contact (joint).
    // Calculé en mémoire à partir d'un fetch batch sur calls — évite un
    // round-trip par ligne (pas de fonctions SQL custom à déployer).
    const leadIds = Array.from(new Set((data ?? []).map((fu) => fu.lead_id))).filter(Boolean) as string[]
    let aggregates: Record<string, { call_attempts: number; last_call_reached: boolean | null; last_call_at: string | null }> = {}

    if (leadIds.length > 0) {
      const { data: callsForLeads } = await supabase
        .from('calls')
        .select('lead_id, reached, scheduled_at')
        .eq('workspace_id', workspaceId)
        .in('lead_id', leadIds)
        .order('scheduled_at', { ascending: false }) as {
          data: Array<{ lead_id: string; reached: boolean | null; scheduled_at: string }> | null
        }

      for (const c of callsForLeads ?? []) {
        if (!aggregates[c.lead_id]) {
          aggregates[c.lead_id] = {
            call_attempts: 0,
            // Premier (= plus récent grâce au order desc) call rencontré : sa valeur de reached.
            last_call_reached: c.reached,
            last_call_at: c.reached ? c.scheduled_at : null,
          }
        }
        aggregates[c.lead_id].call_attempts += 1
        // Met à jour last_call_at avec le plus récent call joint si on en croise un.
        if (c.reached && !aggregates[c.lead_id].last_call_at) {
          aggregates[c.lead_id].last_call_at = c.scheduled_at
        }
      }
    }

    const enriched = (data ?? []).map((fu) => ({
      ...fu,
      _aggregates: aggregates[fu.lead_id] ?? { call_attempts: 0, last_call_reached: null, last_call_at: null },
    }))

    return NextResponse.json({
      data: enriched,
      meta: { total: count ?? 0, page: filters.page, per_page: filters.per_page, total_pages: Math.ceil((count ?? 0) / filters.per_page) },
    })
```

**Important :** retirer l'ancien `return NextResponse.json({ data: data ?? [], meta: ... })` qui existait, sinon return mort.

- [ ] **Step 2: Vérifier le typecheck**

Run: `cd /Users/pierrerebmann/closrm && npx tsc --noEmit -p tsconfig.json 2>&1 | grep "follow-ups/route" | head -10`

Expected: aucune erreur.

- [ ] **Step 3: Test manuel**

Dans la console navigateur authentifié :

```js
fetch('/api/follow-ups?per_page=5').then(r => r.json()).then(j => console.log(j.data[0]._aggregates))
```

Expected: `{ call_attempts: <N>, last_call_reached: <bool|null>, last_call_at: <date|null> }` pour le premier follow-up de la liste.

- [ ] **Step 4: Commit**

```bash
cd /Users/pierrerebmann/closrm
git add src/app/api/follow-ups/route.ts
git commit -m "$(cat <<'EOF'
feat(api): expose call attempts aggregates dans GET /api/follow-ups

Ajoute _aggregates à chaque follow-up : call_attempts, last_call_reached,
last_call_at. Permet à l'UI d'afficher les colonnes Tentatives / Joint /
Dernier contact sans un round-trip par ligne.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 13: 3 nouvelles colonnes dans le tableau follow-ups

**Files:**
- Modify: `src/app/(dashboard)/follow-ups/follow-ups-client.tsx`

- [ ] **Step 1: Étendre le type local et utiliser les aggregates**

En haut du fichier, modifier le type `FUWithLead` (ligne 18) :

```ts
type FUWithLead = FollowUp & {
  lead: Pick<Lead, 'id' | 'first_name' | 'last_name' | 'phone' | 'email' | 'status' | 'assigned_to'>
  _aggregates?: {
    call_attempts: number
    last_call_reached: boolean | null
    last_call_at: string | null
  }
}
```

- [ ] **Step 2: Ajouter les 3 en-têtes de colonnes**

Dans le `<thead>` (ligne ~244-254), insérer entre `<th>Canal</th>` et `<th>Statut</th>` :

```tsx
<th style={th}>Tentatives</th>
<th style={th}>Joint</th>
<th style={th}>Dernier contact</th>
```

- [ ] **Step 3: Ajouter les 3 cellules dans chaque `<tr>`**

Dans la `tbody` (ligne ~256), après la cellule `<td>` du Canal (ligne ~275), insérer 3 cellules :

```tsx
<td style={td}>
  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
    {fu._aggregates?.call_attempts ?? 0}
  </span>
</td>
<td style={td}>
  {fu._aggregates?.last_call_reached === true && (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 99,
      background: 'rgba(56,161,105,0.12)', color: '#38A169',
      fontSize: 11, fontWeight: 600,
    }}>✅ Joint</span>
  )}
  {fu._aggregates?.last_call_reached === false && (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 99,
      background: 'rgba(239,68,68,0.12)', color: '#ef4444',
      fontSize: 11, fontWeight: 600,
    }}>❌ Non</span>
  )}
  {(fu._aggregates?.last_call_reached === null || fu._aggregates?.last_call_reached === undefined) && (
    <span style={{ color: 'var(--text-label)', fontSize: 11 }}>—</span>
  )}
</td>
<td style={td}>
  {fu._aggregates?.last_call_at ? (
    <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>
      {formatRelativeFr(new Date(fu._aggregates.last_call_at), now)}
    </span>
  ) : (
    <span style={{ color: 'var(--text-label)', fontSize: 11 }}>—</span>
  )}
</td>
```

- [ ] **Step 4: Ajouter le helper `formatRelativeFr` en haut du fichier**

Au-dessus du `export default function FollowUpsClient(...)` (vers ligne 38), ajouter :

```ts
function formatRelativeFr(date: Date, now: Date): string {
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / (1000 * 60))
  if (diffMin < 1) return "à l'instant"
  if (diffMin < 60) return `il y a ${diffMin}min`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `il y a ${diffH}h`
  const diffD = Math.floor(diffH / 24)
  if (diffD < 7) return `il y a ${diffD}j`
  if (diffD < 30) return `il y a ${Math.floor(diffD / 7)}sem`
  return `il y a ${Math.floor(diffD / 30)}mo`
}
```

- [ ] **Step 5: Vérifier le typecheck + build**

Run: `cd /Users/pierrerebmann/closrm && npm run build 2>&1 | tail -20`

Expected: build success.

- [ ] **Step 6: Test manuel**

Sur `/follow-ups`, vérifier :
- Les 3 nouvelles colonnes apparaissent.
- Sur un lead sans appel : "0" / "—" / "—".
- Sur un lead avec un appel non joint : "1" / "❌ Non" / "—".
- Après un nouveau LogCallModal joint=true : les colonnes reflètent.

- [ ] **Step 7: Commit**

```bash
cd /Users/pierrerebmann/closrm
git add src/app/\(dashboard\)/follow-ups/follow-ups-client.tsx
git commit -m "$(cat <<'EOF'
feat(follow-ups): colonnes Tentatives / Joint / Dernier contact

Donne au coach la visibilité sur où en est chaque lead dans le tableau
de relances : nb d'essais d'appel, si on a réussi à joindre, date relative
du dernier contact.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 14: Vérification end-to-end + PR

**Files:** (aucune modif code — vérification + PR)

- [ ] **Step 1: Build complet sans erreur**

Run: `cd /Users/pierrerebmann/closrm && npm run build 2>&1 | tail -40`

Expected: `✓ Compiled successfully` ou équivalent. Aucune erreur TypeScript sur les fichiers touchés.

- [ ] **Step 2: Test CAPI manuel avec test_event_code**

Dans `.env.local`, set temporairement :
```
META_CAPI_TEST_EVENT_CODE=TEST12345
```
(Récupérer le vrai code depuis Meta Events Manager > Test Events tab du pixel concerné.)

Redémarrer `npm run dev`.

Dans l'UI :
1. Prendre un lead Meta-attribué (tag funnel ou visitor_id reliable).
2. Changer son statut à `pas_qualifie` via l'UI.
3. Vérifier dans Meta Events Manager > Test Events que l'event `LeadDisqualified` apparaît avec `custom_data.status = 'pas_qualifie'`.
4. Recommencer avec `dead` → `LeadLost`.
5. Marquer un call setting comme `no_show` → vérifier `LeadNoShowSetting`.
6. Marquer un call closing comme `no_show` → vérifier `LeadNoShowClosing`.

Si un event n'apparaît pas, vérifier les logs serveur (`console.error('[capi-status-change]'...)`).

Une fois validé, **retirer** `META_CAPI_TEST_EVENT_CODE` du `.env.local` (ne PAS committer).

- [ ] **Step 3: Test UI complet du logging d'appel**

1. `/leads` → clic "+1 appel" sur un lead → ouvre LogCallModal → "Pas de réponse" + notes → enregistre → compteur +1, en DB nouvelle ligne calls.
2. `/leads` → "Traiter" → "Logger un appel" depuis le menu → même flow.
3. `/follow-ups` → bouton 📞 inline → ouvre LogCallModal → flow.
4. `/follow-ups` → vérifier les 3 colonnes Tentatives/Joint/Dernier contact se mettent à jour.
5. `/leads/<id>` → bouton "Logger un appel" → flow.

- [ ] **Step 4: Push + ouvrir PR**

```bash
cd /Users/pierrerebmann/closrm
git push -u origin feature/pierre-relances-meta-capi
gh pr create --base develop --title "feat: relances intuitives + Meta CAPI signaux négatifs" --body "$(cat <<'EOF'
## Summary

- LogCallModal: nouveau modal 2 étapes (Joint ? + Notes) pour logger un appel partout
- Endpoint `POST /api/calls/log-attempt` dédié au logging d'appel rétroactif
- Câblage dans `/leads`, `/follow-ups`, `/closing` et fiche lead
- 3 nouvelles colonnes (Tentatives, Joint, Dernier contact) dans le tableau follow-ups
- 4 nouveaux events Meta CAPI sur changement de statut : `LeadDisqualified` (pas_qualifie), `LeadLost` (dead), `LeadNoShowSetting`, `LeadNoShowClosing`
- Refactor : helper `fireStatusChangeCapi` centralise pixel resolution + mapping statut→event (réutilisé depuis `PATCH /api/leads/[id]` et `PATCH /api/calls/[id]`)

## Test plan

- [ ] `npm run build` passe sans erreur
- [ ] Logger un appel pas joint depuis `/leads` → compteur incrémenté
- [ ] Logger un appel joint depuis `/follow-ups` (bouton inline) → colonnes Joint/Dernier contact mises à jour
- [ ] Logger un appel depuis la fiche lead `/leads/<id>`
- [ ] Avec `META_CAPI_TEST_EVENT_CODE` : vérifier dans Meta Events Manager (Test Events tab) que `LeadDisqualified`, `LeadLost`, `LeadNoShowSetting`, `LeadNoShowClosing` arrivent bien
- [ ] Aucun event CAPI envoyé si le lead n'a pas de pixel attribué (no-op silencieux)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Récupérer l'URL de la PR et la fournir à l'utilisateur.

---

## Self-Review

**Spec coverage :**
- Composant 1 (LogCallModal) → Task 5 ✓
- Composant 2 (intégrations leads/fiche/follow-ups/LeadActionModal) → Tasks 6, 7, 8, 9, 10, 11 ✓
- Composant 3 (colonnes follow-ups + agrégat SQL) → Tasks 12, 13 ✓
- Composant 4 (4 events Meta CAPI) → Tasks 1, 2 ✓
- Refactor helper `fireStatusChangeCapi` → Task 1 ✓
- Cas particulier no_show (CAPI fire dans `PATCH /api/calls/[id]`) → Task 3 ✓
- Endpoint API pour le log d'appel rétroactif → Task 4 ✓
- Test manuel CAPI avec `META_CAPI_TEST_EVENT_CODE` → Task 14 ✓

**Placeholder scan :** une occurrence "à remplacer" volontaire dans Task 10 (closing-client.tsx) parce que je n'ai pas relu ce fichier en détail. L'agent qui exécute doit ouvrir le fichier pour adapter le typage local du lead — c'est documenté dans le step lui-même, donc ce n'est pas un "TBD" caché.

**Type consistency :**
- `fireStatusChangeCapi(supabase, workspaceId, lead, newStatus)` — signature identique dans tasks 1, 2, 3 ✓
- `LogCallModal` props `{ lead, onClose, onLogged }` — utilisées de la même manière dans 6, 9, 10, 11 ✓
- `_aggregates` shape `{ call_attempts, last_call_reached, last_call_at }` — défini dans 12, consommé dans 13 ✓
- `LeadAction` étendu avec `log_call` dans Task 7, consommé dans 8, 9, 10 ✓
