# Intégration HikerAPI — Instagram Discovery

HikerAPI est un **fournisseur tiers** de données Instagram publiques. Ce n'est **pas** une API Meta officielle — voir la section Limitations connues avant toute décision produit basée sur ce document.

## Contexte

ClosRM a trois systèmes Instagram distincts :

1. **Meta officiel** (`src/lib/instagram/`) — données du compte Instagram Business/Creator connecté par le coach lui-même (profil, médias, stories, insights, DM entrants, publication). Passe par l'API Graph officielle, scope OAuth du coach.
2. **Apify** (`src/lib/apify/`) — collecte les likers d'un post *surveillé* d'un compte tiers, via un provider externe qui gère lui-même le scraping. `apify_watched_posts` + `apify_runs` + deux crons (lancement/poll).
3. **Hiker** (`src/lib/hiker/`, ce document) — nouveau provider de Discovery Instagram publique, sans notion de "post surveillé" pré-enregistré : on résout un compte à la volée et on parcourt son contenu accessible.

Les trois convergent vers la même table `instagram_interactions`, qui reste la source unique de vérité des interactions Instagram pour le CRM et les DM Sessions.

## Architecture

```
POST /api/instagram/discovery
        ↓
discoverInstagramAccount()          src/lib/hiker/discovery.ts
        ↓
HikerClient                         src/lib/hiker/client.ts
        ↓
Normalizer + UserDeduplicator       src/lib/hiker/normalizer.ts, deduplicator.ts
        ↓
persistDiscoveryResult()            src/lib/hiker/persist.ts
        ↓
leads + instagram_interactions      (tables existantes, inchangées dans leur usage)
        ↓
DM Sessions (buildPriorityQueue)    (déjà agnostique du provider, aucune modification nécessaire)
```

## Endpoints utilisés

Validés par un POC en conditions réelles avant intégration (`scripts/hiker-poc/`, voir `HIKER_POC_REPORT.md` pour le détail complet des runs et anomalies observées).

| Endpoint | Usage | Forme de réponse confirmée |
|---|---|---|
| `GET /v1/user/by/username` | Résolution username → profil | Objet direct |
| `GET /v1/user/medias/chunk` | Médias (posts), paginé | `[items[], cursor \| null]` |
| `GET /v1/user/clips/chunk` | Reels, paginé | `[items[], cursor \| null]` |
| `GET /v3/media/likers` | Likers d'un contenu | `{ users: [...], user_count, ... }` |
| `GET /v2/media/comments` | Commentaires d'un contenu, paginé | `{ response: { comments: [...] }, next_page_id }` |
| `GET /g2/user/followers` | Followers d'un compte, paginé | `{ response: { users: [...] }, next_page_id }` |
| `GET /v2/user/stories` | Stories actives | `{ reel: { items: [...] } \| null }` |

**Endpoints explicitement évités : `/gql/user/medias`, `/gql/user/clips`.** Le POC a montré qu'ils renvoient un format GraphQL brut à livraison incrémentale (`stream_rows`), non documenté par HikerAPI dans sa structure réelle et instable à parser — même si la documentation HikerAPI les présente comme les remplaçants "recommandés" des endpoints `/v1/*chunk`.

## Pagination

Deux styles cohabitent, tous deux gérés par le client production :

- **Style chunk** (`medias`, `clips`) : la réponse est un tuple `[items, cursor]`. `cursor === null` signale la fin.
- **Style page_id** (`followers`, `comments`) : la réponse enveloppe les items dans `response.<clé>`, avec `next_page_id` au niveau racine. `next_page_id === null` signale la fin.

Aucune limite artificielle de type "10 posts" ou "50 followers" n'est codée en dur — les plafonds (`maxMediaPages`, `maxClipsPages`, `maxFollowerPages`, `maxContentsForInteractions`) sont des options du job, avec des valeurs par défaut généreuses (200 pages) pour garantir une pagination quasi complète tout en évitant une boucle infinie en cas de bug de curseur côté provider.

## Limitations connues (à ne jamais présenter autrement)

- **Aucun story viewer nominatif.** Ni Hiker ni Meta officiel n'exposent l'identité des personnes ayant vu une story d'un compte tiers — c'est une donnée privée du propriétaire du compte, jamais accessible à un tiers quel que soit le provider.
- **Aucun viewer nominatif de Reel.** `play_count`/`view_count` sont des compteurs agrégés, jamais des listes de personnes.
- **Likers plafonnés, sans pagination réelle.** `/v3/media/likers` renvoie un nombre limité de profils en un seul appel, sans mécanisme pour aller au-delà. Chaque contenu normalisé (`NormalizedContent`) porte un flag `likeCountReliable: false` — le compteur `like_count` retourné par les endpoints de listing (`medias`/`clips`) s'est montré incohérent en conditions réelles pendant le POC (valeur fixe basse observée alors que `/v3/media/likers` retournait beaucoup plus de profils pour le même contenu) et ne doit jamais être présenté à l'utilisateur comme un nombre de likes fiable.
- **404 sur `/v2/media/comments` ≠ zéro commentaire.** La cause exacte de certains 404 observés pendant le POC n'a pas pu être confirmée (commentaires désactivés ? média retiré ? restriction provider ?). Le client distingue explicitement un succès à liste vide (`status: 'success_empty'` implicite via `comments: []` + `status: 200`) d'un échec (`ContentErrorEntry` avec `status: 'not_found'`), et ce dernier ne fait jamais échouer toute la discovery — seul ce contenu est marqué en erreur.
- **Billing des erreurs non confirmé à 100%.** Le POC a trouvé une contradiction entre l'audit de la documentation publique (qui indique que les erreurs 4xx sont facturées) et le comportement observé sur le compte de test. `estimatedBilledRequests()` applique une règle simple (1× par défaut, 2× documenté pour `/user/stories`) qui reste une **estimation**, pas une valeur confirmée par un relevé de facturation HikerAPI.
- **Hiker n'est pas conforme aux CGU Instagram en amont.** HikerAPI opère via un pool de comptes Instagram qu'il détient lui-même (voir l'audit Phase 1, non reproduit ici) pour répondre aux requêtes — ClosRM ne fournit jamais de session/cookie Instagram et ne contourne aucune protection lui-même, mais la donnée provient d'un provider dont le mode de collecte n'est pas officiellement autorisé par Meta. C'est une question de risque produit/légal à trancher séparément, pas un sujet technique.

## Gestion des erreurs

Catégories (`src/lib/hiker/errors.ts`) : `AUTH_ERROR`, `RATE_LIMIT`, `INSUFFICIENT_FUNDS`, `NOT_FOUND`, `INVALID_REQUEST`, `SERVER_ERROR`, `UNKNOWN`.

- **Retry** : uniquement sur `RATE_LIMIT` et `SERVER_ERROR`, avec backoff exponentiel (500ms, 1000ms, ...), plafonné à `maxRetries` (défaut 2).
- **`INSUFFICIENT_FUNDS` (HTTP 402)** : jamais retenté. Le moteur de discovery arrête immédiatement toute nouvelle pagination/appel, conserve tout ce qui a déjà été collecté, et termine le run avec `status: 'PARTIAL'` (ou `'FAILED'` si rien n'a pu être collecté) et `stoppedReason: 'insufficient_funds'`.
- **`NOT_FOUND` sur un contenu individuel** (likers ou comments) : n'arrête jamais le run, enregistré dans `errors: ContentErrorEntry[]` avec le `contentId` concerné.

## Variables d'environnement

```
HIKER_API_KEY=xxx              # server-side uniquement, jamais NEXT_PUBLIC_*
HIKER_API_BASE_URL=https://api.hikerapi.com   # optionnel, valeur par défaut déjà correcte
```

La clé est lue exclusivement dans `HikerClient` (`process.env.HIKER_API_KEY`), jamais transmise au frontend, jamais dans les logs (`HikerCallLogEntry` ne capture que `endpoint/status/duration_ms/category/retry_count`).

## Modèle de données

Aucune nouvelle table de leads/prospects. Réutilisation stricte de l'existant :

- **`leads`** : identité par `workspace_id + instagram_user_id` (index unique déjà existant, migration 092). Le username seul n'est jamais une clé de recherche stable.
- **`instagram_interactions`** : types `like`/`comment` uniquement pour Hiker (pas de `follow`, pas de `story_view` — voir migration 096/097 et section suivante). Colonne `source_provider` (`'apify'` ou `'hiker'`) ajoutée par la migration 096 pour distinguer l'origine sans dupliquer le schéma.
- **`discovery_runs`** (migration 097) : traçabilité des runs Hiker (statut, compteurs, erreurs) — table dédiée plutôt que de dénaturer `apify_runs`, qui modélise un job Apify asynchrone externe avec un `apify_run_id` obligatoire, incompatible avec un appel Hiker synchrone déclenché directement par ClosRM.

### Migrations

- **096_instagram_interactions_source_content.sql** — `instagram_interactions.source_post_id` passe d'une FK stricte vers `apify_watched_posts(id)` à une colonne texte libre. Raison : un contenu découvert par Hiker n'a jamais été "surveillé" au préalable, donc n'a pas d'entrée dans `apify_watched_posts`. La colonne `source_provider` est ajoutée en parallèle, backfillée à `'apify'` pour toutes les lignes existantes. Aucune donnée Apify existante n'est modifiée dans son comportement.
- **097_hiker_discovery_runs.sql** — nouvelle table `discovery_runs`.

Les followers ne deviennent **jamais** des lignes `instagram_interactions` — suivre un compte n'est pas un événement d'engagement au sens du schéma actuel (`interaction_type` reste `like`/`comment`/`dm`/`mention`). Ils enrichissent uniquement le profil agrégé en mémoire (`followsTarget`) pendant la discovery, avant persistance des seules interactions like/comment.

## Comment lancer une discovery

```
POST /api/instagram/discovery
Authorization: <session utilisateur ClosRM>
Content-Type: application/json

{
  "instagramUsername": "un_compte_public",
  "options": {
    "maxContentsForInteractions": 50
  }
}
```

L'utilisateur doit être authentifié et membre du workspace (`getWorkspaceId()`) — RLS empêche tout accès cross-workspace sur `leads`/`instagram_interactions`/`discovery_runs`. La clé Hiker n'apparaît jamais dans la requête ni la réponse.

`GET /api/instagram/discovery` liste les 20 derniers runs du workspace courant.

## Comment lancer les tests (mock uniquement)

```
npx vitest run src/lib/hiker
```

Aucun de ces tests n'appelle HikerAPI — tout est mocké via `global.fetch` avec des fixtures modelées sur les formes de réponse réellement observées pendant le POC (`src/lib/hiker/__tests__/fixtures/responses.ts`). Aucune fixture ne contient de clé API réelle.

## Apify — statut

Apify reste pleinement fonctionnel, inchangé dans son comportement. Hiker est un second provider indépendant, pas un remplacement. Une future migration (hors périmètre de cette intégration) pourrait introduire une interface `InstagramDiscoveryProvider` commune si l'architecture d'Apify évolue vers un modèle synchrone comparable — non fait ici pour éviter une abstraction prématurée sur un code Apify qui reste fondamentalement asynchrone (job + poll) par nature.
