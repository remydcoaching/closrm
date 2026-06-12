# Spec — Relances intuitives + Meta CAPI signaux négatifs

**Date :** 2026-06-12
**Auteur :** Pierre + Claude
**Statut :** En attente de plan d'implémentation

## Contexte et problèmes

Trois douleurs convergentes remontées par le coach :

1. **Logger un appel n'est pas intuitif.** Aujourd'hui, le bouton "+1 appel" sur la liste leads (`leads-client.tsx:184-193`) ouvre juste un `ConfirmModal` qui demande "Confirmer une tentative ? Le compteur passera à X." On clique OK, le compteur `call_attempts` est incrémenté, mais **on ne capture jamais si on a joint la personne ni de notes**. Résultat : on ne sait pas qui a été contacté, qui n'a pas répondu, à quelle tentative on en est.
2. **À 20+ relances en attente, on se perd.** Le tableau des follow-ups ne montre ni nombre de tentatives, ni si le lead a été joint, ni la date du dernier contact. Impossible de prioriser.
3. **Meta optimise à l'aveugle sur les leads non-qualifiés.** Le coach pensait que tous les changements de statut remontaient à Meta. En réalité, seuls `setting_planifie`, `closing_planifie` (event `Lead`) et `clos` (event `Purchase`) sont envoyés. Les statuts `pas_qualifie`, `dead`, `no_show_setting`, `no_show_closing` ne génèrent **aucun event CAPI** (`src/app/api/leads/[id]/route.ts:119-240`). Meta ne reçoit donc jamais de signal négatif et continue à recommander des profils similaires à des leads pourris.

## Objectifs

- Rendre le logging d'appel **rapide et complet** : joint ? notes ? — partout où l'action est disponible (liste leads, fiche lead, follow-ups).
- Donner au coach une **vision claire** des relances en attente : combien de tentatives, joint ou pas, dernière interaction.
- Donner à Meta **tous les signaux** (positifs + négatifs) pour que l'algo apprenne sur la qualité du lead, pas juste le volume.

## Hors-périmètre (explicitement)

- L'app mobile (`mobile/`) : à faire dans un second temps. Le coach mentionne que l'app demande déjà joint/pas joint à certains endroits — pas vérifié dans cette spec, à traiter quand on touchera mobile.
- Un event Meta `Contact` séparé pour les leads simplement contactés sans être qualifiés. Redondant avec le flow réel : un lead joint et intéressé passe naturellement en `setting_planifie`, ce qui fire déjà `Lead`. Pas besoin d'un signal additionnel.
- Changements de schéma sur la table `calls` : la table existe et a déjà `reached`, `notes`, `attempt_number`, `outcome`. Le champ `leads.call_attempts` est conservé en denormalisé pour les compteurs UI rapides.

## Architecture

### Composant 1 — `LogCallModal` (nouveau)

Petit modal en 2 étapes, réutilisable.

**Étape 1 — Joint ?**
- Deux gros boutons : `✅ Oui, joint` / `❌ Non, pas de réponse`
- Une seule sélection requise.

**Étape 2 — Notes (optionnel)**
- Textarea libre.
- Bouton "Enregistrer".

**Effets de l'enregistrement :**
- Crée une ligne dans `calls` :
  - `type: 'setting'` (par défaut — c'est une tentative, pas un closing planifié)
  - `reached: true | false` selon étape 1
  - `notes: string | null`
  - `outcome: 'pending'` (l'appel a eu lieu mais ne change pas l'état du lead)
  - `attempt_number` : auto-incrémenté côté API (la logique existe déjà dans `POST /api/calls`)
  - `scheduled_at: now()` (le call est rétroactif, considéré comme effectué maintenant)
- Incrémente `leads.call_attempts` (denormalisé pour compteurs UI rapides).
- Met à jour `leads.last_activity_at`.

**Important :** ce modal **ne change pas le statut** du lead. Il enregistre une tentative, point. Le changement de statut reste séparé (boutons `Pas qualifié`, `Dead`, `Setting planifié`, etc. dans `LeadActionModal`).

### Composant 2 — Intégration aux points d'appel existants

#### A. Liste leads (`src/app/(dashboard)/leads/leads-client.tsx`)
Remplacer la fonction `callLead` (lignes 184-193) :
- Au lieu d'ouvrir un `ConfirmModal`, ouvrir `LogCallModal`.
- Le contrat existant (bouton "+1 appel" sur la ligne lead) reste identique côté UI parent.

#### B. Fiche lead (`src/app/(dashboard)/leads/[id]/page.tsx`)
- Vérifier qu'il y a un bouton "Logger un appel" ou équivalent. S'il existe et utilise le même pattern naïf → le remplacer par `LogCallModal`. Si absent, l'ajouter dans la section actions de la fiche.

#### C. Follow-ups (`src/app/(dashboard)/follow-ups/follow-ups-client.tsx`)
- Ajouter un bouton inline `📞 Logger un appel` sur chaque ligne, qui ouvre `LogCallModal` avec le lead pré-rempli.
- Comportement après log : la modale se ferme, le tableau se rafraîchit (ou patch local : recompter les tentatives, refresh "Dernier contact").

#### D. `LeadActionModal` (`src/components/leads/LeadActionModal.tsx`)
- Ajouter une nouvelle action `log_call` au menu principal du modal.
- Type étendu : `LeadAction = ... | { type: 'log_call'; reached: boolean; notes: string | null }`.
- Le handler dans chaque page parent (`leads-client.tsx`, `follow-ups-client.tsx`, `closing-client.tsx`) POST `/api/calls` puis patche le compteur local.

### Composant 3 — Colonnes follow-ups (`follow-ups-client.tsx`)

Ajouter au tableau (entre "Channel" et "Actions") :

| Colonne | Source | Format |
|---|---|---|
| Tentatives | `lead.call_attempts` (denormalisé) | "3" en gras |
| Joint | dernier `call.reached` du lead | Badge vert `✅ Joint` / rouge `❌ Non` / gris `—` si aucun call |
| Dernier contact | max(`call.scheduled_at` où `reached=true`) | "il y a 2j" (relative) |

Côté API : étendre `GET /api/follow-ups` pour faire un join lazy avec les calls et exposer ces champs dans la réponse. Alternative plus simple : faire un agrégat SQL (`COUNT(*) FILTER (WHERE reached)`, `MAX(scheduled_at) FILTER (WHERE reached)`) en une requête. Préférer l'agrégat pour ne pas multiplier les round-trips.

### Composant 4 — Meta CAPI : 4 nouveaux events

Étendre le bloc `PATCH /api/leads/[id]` (`src/app/api/leads/[id]/route.ts:119`) qui détecte les changements de statut. Pour chaque nouveau statut négatif, fire un event CAPI custom non-bloquant via `after(...)`, en suivant exactement le pattern existant lignes 129-159.

| Nouveau statut | Event Meta CAPI | `custom_data.status` |
|---|---|---|
| `pas_qualifie` | `LeadDisqualified` | `'pas_qualifie'` |
| `dead` | `LeadLost` | `'dead'` |
| `no_show_setting` | `LeadNoShowSetting` | `'no_show_setting'` |
| `no_show_closing` | `LeadNoShowClosing` | `'no_show_closing'` |

Tous envoyés avec :
- `action_source: 'system_generated'`
- `custom_data.lead_event_source: 'crm_status_change'`
- `event_id` unique (`lead-${id}-${event}-${now}`) pour dédup

Côté Meta Ads Manager, le coach pourra créer des Custom Conversions pour chacun de ces events s'il veut optimiser à l'envers.

**Cas particulier `no_show_*`** : ces statuts peuvent être set automatiquement par `PATCH /api/calls/:id` quand on passe l'outcome d'un call à `no_show` (`src/app/api/calls/[id]/route.ts:57-58`). Cette branche-là ne passe **pas** par `PATCH /api/leads/[id]` donc ne déclenche aucun CAPI. Il faut donc **aussi** ajouter le fire CAPI dans `PATCH /api/calls/:id`, branche `parsed.data.outcome === 'no_show'`. Pattern : copier-coller le bloc CAPI existant côté leads, factoriser éventuellement en helper `fireStatusChangeCapi(supabase, workspaceId, lead, newStatus)` dans `src/lib/meta/capi.ts`.

### Refactor opportun : helper `fireStatusChangeCapi`

Le bloc CAPI est dupliqué entre `setting_planifie`/`closing_planifie` (event `Lead`), `clos` (event `Purchase`), et maintenant les 4 nouveaux events. Le code va se dupliquer dans 2 fichiers (`leads/[id]/route.ts` et `calls/[id]/route.ts`).

→ Extraire un helper :

```ts
// src/lib/meta/capi.ts
export async function fireStatusChangeCapi(
  supabase: SupabaseClient,
  workspaceId: string,
  lead: { id: string; first_name: string | null; last_name: string | null; email: string | null; phone: string | null; tags: string[] | null; visitor_id: string | null; deal_amount: number | null },
  newStatus: LeadStatus,
): Promise<void>
```

Le helper :
- Résout le pixel (via `resolveMetaPixelForLead`).
- Mappe le statut → event name + custom_data (table ci-dessus + cas `clos` qui devient `Purchase` avec montant).
- Si aucun event mappé → no-op.
- Catch les erreurs (non-bloquant).

Les deux call sites (`PATCH /api/leads/[id]` et `PATCH /api/calls/[id]`) appellent juste `after(() => fireStatusChangeCapi(...))`. Le bloc existant des 100 lignes dans `leads/[id]/route.ts` se réduit à 5 lignes.

## Data flow

```
[Coach clique "+1 appel" sur lead Marie] 
    → LogCallModal s'ouvre
    → Coach: "❌ Pas joint" + note "essayé 14h, répondeur"
    → POST /api/calls { lead_id, type: 'setting', reached: false, notes: '...' }
        → INSERT calls (attempt_number auto-incrémenté à 3)
        → UPDATE leads SET call_attempts = 3, last_activity_at = now()
    → Modal se ferme
    → Liste leads rafraîchie : compteur passe à 3

[Coach passe Marie de "setting_planifie" à "pas_qualifie"]
    → PATCH /api/leads/marie-id { status: 'pas_qualifie' }
        → UPDATE leads SET status = 'pas_qualifie'
        → fireTriggersForEvent('lead_status_changed', ...)
        → after() → fireStatusChangeCapi(supabase, ws, marie, 'pas_qualifie')
            → resolveMetaPixelForLead → pixel 1234
            → sendCapiEventForLead(... 'LeadDisqualified', { status: 'pas_qualifie', lead_event_source: 'crm_status_change' })
            → Meta reçoit l'event, le coach voit dans Events Manager
```

## Tests à prévoir

Pas de TDD lourd ici (refonte UI + plumbing Meta), mais minimums :

1. **`POST /api/calls`** : vérifier que `reached: false` est bien persisté (test API unitaire).
2. **`fireStatusChangeCapi`** : tester le mapping statut → event name (4 nouveaux + 3 existants).
3. **Test manuel CAPI** : utiliser `META_CAPI_TEST_EVENT_CODE` (déjà supporté dans `capi.ts:177`) pour vérifier dans Meta Events Manager que les 4 nouveaux events arrivent en mode test, avec `custom_data` correct.
4. **Test UI manuel** : sur la page leads en dev, cliquer "+1 appel", choisir non-joint, vérifier que le compteur s'incrémente et que la ligne `calls` est créée avec `reached=false`.

## Migrations DB

Aucune. Tous les champs nécessaires existent :
- `calls.reached`, `calls.notes`, `calls.attempt_number`, `calls.outcome`
- `leads.call_attempts`, `leads.last_activity_at`, `leads.status` (avec `pas_qualifie` ajouté en migration récente, cf. memory ID 5887-5890)

## Risques / points d'attention

- **Double fire CAPI** sur `no_show_*` : si on log un call avec outcome `no_show` (qui change le statut leads en `no_show_setting`) **et** que le statut était déjà `no_show_setting`, on évite le double fire car le helper check `oldStatus !== newStatus` (à respecter dans `PATCH /api/calls/:id`).
- **Pixel non configuré** : si le coach n'a pas connecté de pixel sur la funnel d'origine du lead, `resolveMetaPixelForLead` retourne null et le helper no-op silencieusement. C'est OK — pas d'erreur visible.
- **Events `LeadDisqualified` / `LeadLost` / `LeadNoShow*` sont des events Meta custom**, pas standards. Ils ne créeront pas d'optimisation automatique : le coach doit créer une Custom Conversion côté Ads Manager pour les exploiter. Documenter ça dans le commit ou un README court.

## Convention de nommage et localisation

- Code en anglais (variables, types, fonctions).
- UI en français.
- Les boutons UI : `Logger un appel`, `Joint`, `Pas de réponse`, `Notes (optionnel)`, `Enregistrer`.

## Plan d'implémentation (haut niveau, à détailler en plan séparé)

1. Refactor `capi.ts` : ajouter helper `fireStatusChangeCapi` + tests unitaires sur le mapping.
2. Migrer le bloc CAPI existant de `PATCH /api/leads/[id]` vers le helper.
3. Ajouter les 4 nouveaux events au helper + le call site dans `PATCH /api/calls/[id]` pour `no_show`.
4. Créer le composant `LogCallModal`.
5. Étendre `LeadActionModal` avec l'action `log_call`.
6. Câbler `LogCallModal` dans `leads-client.tsx` (remplace `callLead`), `follow-ups-client.tsx` (nouveau bouton inline), `[id]/page.tsx` (fiche lead).
7. Ajouter colonnes `Tentatives` / `Joint` / `Dernier contact` au tableau follow-ups + agrégat SQL côté API.
8. Test manuel end-to-end avec `META_CAPI_TEST_EVENT_CODE` en dev.
9. PR depuis `feature/pierre-relances-meta-capi` vers `develop`.
