# PHASE 3 — Intégration HikerAPI dans ClosRM

Statut : **construction terminée, aucun appel Hiker réel effectué, aucun crédit consommé, en attente de validation avant premier run réel.**

## 1. Fichiers créés

### Module de production Hiker
- `src/lib/hiker/errors.ts` — taxonomie d'erreurs (`AUTH_ERROR`, `RATE_LIMIT`, `INSUFFICIENT_FUNDS`, `NOT_FOUND`, `INVALID_REQUEST`, `SERVER_ERROR`, `UNKNOWN`) + classification depuis le statut HTTP et le corps de réponse.
- `src/lib/hiker/types.ts` — types des formes de réponse **réellement confirmées** pendant le POC (pas celles de la doc OpenAPI officielle, qui s'est avérée imprécise sur plusieurs endpoints).
- `src/lib/hiker/client.ts` — `HikerClient` : auth via header, timeout, retry avec backoff exponentiel (uniquement sur RATE_LIMIT/SERVER_ERROR), jamais de retry sur INSUFFICIENT_FUNDS/NOT_FOUND, callback `onCall` pour l'observabilité (jamais la clé).
- `src/lib/hiker/normalizer.ts` — normalisation pure (users, contenus), déduplication de contenus par id puis shortcode.
- `src/lib/hiker/deduplicator.ts` — `UserDeduplicator`, clé primaire `instagramUserId`, fallback `username` uniquement si l'id est absent, avec fusion différée si l'id apparaît plus tard.
- `src/lib/hiker/discovery.ts` — `discoverInstagramAccount()`, orchestre tout le pipeline, arrêt propre sur 402, jamais de `Promise.all` massif (boucles séquentielles contrôlées), pagination pilotée par curseur réel.
- `src/lib/hiker/persist.ts` — `persistDiscoveryResult()`, écrit dans `leads` + `instagram_interactions` en réutilisant exactement le pattern déjà validé par `src/lib/apify/process-likers.ts` (lookup-then-insert-or-update pour contourner la limite PostgREST sur l'expression index de dédup).

### Tests (aucun appel réseau réel)
- `src/lib/hiker/__tests__/fixtures/responses.ts` — fixtures modelées sur les formes de réponse confirmées par le POC, données synthétiques, aucune clé.
- `src/lib/hiker/__tests__/normalizer.test.ts` (8 tests)
- `src/lib/hiker/__tests__/deduplicator.test.ts` (6 tests)
- `src/lib/hiker/__tests__/client.test.ts` (10 tests) — couvre explicitement 402, 404, 429 avec retry, 500 avec abandon, pagination chunk et page_id, non-fuite de la clé dans l'URL.
- `src/lib/hiker/__tests__/discovery.test.ts` (6 tests) — couvre l'arrêt propre sur 402 avec conservation des données déjà collectées, le traitement d'un 404 comme erreur de contenu (pas zéro commentaire), la déduplication media/clips, l'exclusion des followers des interactions, l'idempotence du moteur.
- `src/lib/hiker/__tests__/persist.test.ts` (5 tests) — couvre la création/le matching de lead, la mise à jour au lieu du doublon, le groupement par personne, l'idempotence sur double exécution.

**Total : 37 tests, tous passants, zéro appel réseau réel.**

### API
- `src/app/api/instagram/discovery/route.ts` — `POST` déclenche une discovery (auth via `getWorkspaceId()`, RLS-scopée, clé Hiker jamais exposée), `GET` liste les 20 derniers runs du workspace.
- `src/lib/validations/hiker.ts` — schéma Zod (`startDiscoverySchema`) pour valider `instagramUsername` et les options de pagination.

### Documentation
- `docs/hiker-integration.md` — architecture, endpoints, pagination, limitations (story/reel viewers absents, likers plafonnés, `like_count` non fiable, 404 non conflaté avec zéro commentaire, billing non confirmé à 100%, Hiker non conforme CGU Instagram en amont), variables d'env, comment lancer une discovery et les tests.
- Ce fichier (`PHASE_3_REPORT.md`).

## 2. Fichiers modifiés

- `.env.local.example` — ajout de `HIKER_API_KEY` et `HIKER_API_BASE_URL` (documentés comme server-side only).

Aucun autre fichier existant n'a été modifié. (Le `git status` montre aussi des modifications préexistantes sur `src/lib/apify/process-likers.ts`, `src/lib/instagram/api.ts`, `src/app/(dashboard)/parametres/integrations/page.tsx` et `src/lib/validations/integrations.ts` — ces changements étaient déjà présents dans le worktree avant le début de cette Phase 3, hors de mon intervention ; vérifié via `git diff` qu'aucun d'eux n'a été retouché pendant cette phase.)

## 3. Migrations

### `supabase/migrations/096_instagram_interactions_source_content.sql`
Remplace la FK stricte `instagram_interactions.source_post_id → apify_watched_posts(id)` par une colonne texte libre, et ajoute `source_provider` (`'apify'` | `'hiker'`, backfillé à `'apify'` pour toutes les lignes existantes).

**Pourquoi nécessaire** : un contenu découvert par Hiker n'est jamais pré-enregistré dans `apify_watched_posts` (Hiker résout et scanne un compte à la volée, sans étape de "surveillance" préalable comme Apify). Réutiliser cette table pour Hiker aurait créé un couplage sémantique faux (nom de table, colonnes `instagram_post_url`/`last_run_id`/`likers_count` toutes spécifiques à un run Apify). `ig_reels` (module contenu Meta) a aussi été écarté : il modélise le contenu *propre* du coach connecté (pilier éditorial, format, taux d'engagement), pas des comptes tiers scannés. Aucune donnée Apify existante n'est modifiée dans son comportement — `watchedPostId` reste un `string`, écrit tel quel dans la nouvelle colonne texte.

### `supabase/migrations/097_hiker_discovery_runs.sql`
Nouvelle table `discovery_runs` (workspace_id, provider, instagram_username/user_id, status incluant `PARTIAL`, stopped_reason incluant `insufficient_funds`, compteurs, timestamps, triggered_by).

**Pourquoi nécessaire** : `apify_runs` ne convient pas — il modélise un job **asynchrone externe** (`apify_run_id text not null unique`, polling ultérieur) avec une FK obligatoire vers `apify_watched_posts`, alors qu'une discovery Hiker est un appel **synchrone** déclenché directement par le backend ClosRM, sans identifiant de run externe à poller, et avec un vocabulaire de statut plus riche que celui d'`apify_runs` (pending/running/succeeded/failed).

Les deux migrations ont été relues pour confirmer qu'elles ne cassent aucun index/contrainte existant (l'index de dédup de la migration 092 caste déjà `source_post_id` en `::text` dans son expression — le changement de type de colonne sous-jacente est transparent pour lui) et n'ont **pas été exécutées** contre une base réelle pendant cette phase (aucune commande `supabase migration up` ou équivalent lancée).

## 4. Architecture finale

```
POST /api/instagram/discovery (auth utilisateur, RLS)
        ↓
discoverInstagramAccount()  →  HikerClient  →  api.hikerapi.com
        ↓                           (server-side only, clé jamais exposée)
Normalizer + UserDeduplicator (en mémoire, pas d'I/O DB)
        ↓
persistDiscoveryResult()  →  leads (existant) + instagram_interactions (existant, provider='hiker')
        ↓
DM Sessions (buildPriorityQueue, déjà agnostique — aucune modification nécessaire)
```

Apify (`apify_watched_posts`, `apify_runs`, ses deux crons) reste un chemin totalement indépendant et intact. Meta officiel (`src/lib/instagram/`) reste intact. Aucune interface `InstagramDiscoveryProvider` commune n'a été forcée entre Hiker et Apify — leur nature (synchrone vs job+poll) est trop différente pour que l'abstraction apporte de la valeur immédiate ; ce serait à reconsidérer si Apify évolue un jour vers un modèle synchrone.

## 5. Endpoints utilisés

`/v1/user/by/username`, `/v1/user/medias/chunk`, `/v1/user/clips/chunk`, `/v3/media/likers`, `/v2/media/comments`, `/g2/user/followers`, `/v2/user/stories`. Aucun `/gql/*` (jugés instables lors du POC).

## 6. Tests exécutés

```
npx vitest run src/lib/hiker
```

## 7. Résultats des tests

```
Test Files  5 passed (5)
     Tests  37 passed (37)
```

Également vérifié :
- `npx tsc --noEmit -p tsconfig.json` sur l'ensemble du repo : **aucune erreur**, y compris sur les nouveaux fichiers.
- `npx eslint src/lib/hiker src/lib/validations/hiker.ts src/app/api/instagram/discovery` : **zéro erreur, zéro warning**.
- `npx vitest run` (suite complète du repo) : 49 tests passent, dont les 37 nouveaux. Un seul fichier échoue (`src/lib/agenda/positioning.test.ts`, "No test suite found") — confirmé préexistant via `git log`, provenant du commit `5019a23` (refonte agenda), sans lien avec cette Phase 3.

## 8. Risques

- **Chevauchement medias/clips non garanti disjoint** (limite déjà identifiée en Phase 2.5) — le moteur de production déduplique explicitement (`dedupeContents`), donc le risque de double-comptage en base est neutralisé, mais le volume réel de contenu distinct par compte reste à confirmer sur un vrai run.
- **`like_count` non fiable** — marqué explicitement (`likeCountReliable: false`) mais pas encore vérifié si ce défaut est spécifique au compte de test du POC ou général à l'endpoint.
- **Cause exacte des 404 sur comments non confirmée** — traité comme "erreur de contenu non fatale", ce qui est le comportement le plus sûr en l'absence de certitude, mais pourrait masquer un vrai bug de requête si la cause s'avère différente de ce qui est supposé.
- **Billing réel non confirmé** — `estimatedBilledRequests()` reste une estimation ; un premier run réel avec un solde suffisant sera nécessaire pour comparer au relevé de facturation HikerAPI.
- **Un lead créé sans `instagram_user_id`** (fallback username-only, cas rare non rencontré en pratique lors du POC) reste vulnérable à un changement de handle créant un doublon plus tard — limitation intrinsèque du système déjà présente côté Apify, non aggravée par Hiker.

## 9. Limitations

- Story viewers et Reel viewers nominatifs : structurellement indisponibles, quel que soit le provider — documenté, jamais contourné.
- Followers ne deviennent jamais des `instagram_interactions` (pas de type `follow` ajouté au schéma, conformément à la consigne).
- Aucune UI construite (hors périmètre demandé pour cette phase).
- Aucune migration de données historiques Apify → Hiker.
- Aucun run réel n'a encore validé le comportement de `persist.ts` contre une vraie base Supabase (testé uniquement avec des mocks fidèles au schéma).

## 10. Prochaines étapes (avant le premier vrai run Hiker)

1. Appliquer les migrations 096 et 097 sur un environnement de test (pas la prod directement).
2. Recharger le compte HikerAPI à un solde suffisant (recommandation Phase 2.5 : $20-30) pour un premier run réel couvrant un compte de test complet.
3. Vérifier `persist.ts` contre une vraie instance Supabase (pas seulement des mocks) — en particulier le comportement de l'expression index de dédup en conditions réelles.
4. Confirmer le comportement réel de facturation HikerAPI (contacter leur support ou observer un relevé détaillé) pour fiabiliser `estimatedBilledRequests()`.
5. Décider si `discovery_runs` doit être exposé dans une UI, même minimale, pour que les coachs voient l'historique de leurs discoveries.
6. Statuer sur la question de conformité CGU Instagram côté HikerAPI (déjà signalée en Phase 1/2/2.5) avant tout déploiement en production réelle.

---

**Confirmations explicites demandées par la mission :**
- Aucun appel Hiker réel effectué pendant cette Phase 3.
- Aucun crédit HikerAPI consommé.
- Aucune suppression ni modification destructive d'Apify, Meta, ou DM Sessions.
- Aucune Phase 4 entamée.
