# PHASE 3.5 — Validation Supabase réelle

Statut : **construction et validation terminées, mais PAS contre un vrai Postgres.** Point le plus important de ce rapport, à lire avant tout le reste.

## 0. Écart majeur par rapport à la mission — à traiter en premier

La mission demandait explicitement de valider contre "une vraie base Supabase de test/staging". En pratique :

1. **Le seul projet Supabase accessible depuis ce worktree (`.env.local`) est le projet de PRODUCTION ClosRM** (`hsnqmjsckekbmmwneybb`), confirmé par recoupement avec `docs/passage-sur-vercel.md` et `docs/sql-a-executer.md`, qui documentent explicitement ce même identifiant comme la cible des variables d'environnement Vercel de production. Il n'existe aucun projet de staging séparé dans ce repo/worktree.
2. Face à ce constat, tu as explicitement demandé de **ne rien appliquer à aucune base** plutôt que de risquer la production.
3. **Docker n'est pas installé sur cette machine**, donc `supabase start` (base Postgres locale isolée, la voie normale pour tester une migration sans risque) n'était pas non plus disponible.

**Conséquence directe** : aucune des deux migrations (096, 097) n'a été exécutée contre un moteur Postgres réel, ni en production, ni en local, ni en staging. Toute la validation ci-dessous repose sur :
- une relecture statique attentive du SQL des deux migrations ;
- une connaissance certaine du comportement documenté de PostgreSQL sur les opérations utilisées (`ALTER COLUMN TYPE` avec index dépendant, `CREATE TABLE`) ;
- un mock Supabase in-memory (`src/lib/hiker/__tests__/integration/in-memory-supabase.ts`) qui **simule fidèlement les règles de contrainte** (unicité leads, unicité interactions par expression, isolation RLS par workspace) mais **n'est pas un substitut à une exécution réelle**.

Ceci n'est pas une validation Supabase réelle au sens où la mission l'entendait — c'est la meilleure validation possible avec les moyens disponibles dans cette session, documentée honnêtement plutôt que présentée comme équivalente à un vrai test contre Postgres.

## 1. Migrations — relecture (non appliquées)

### `096_instagram_interactions_source_content.sql`
Relue intégralement. Deux opérations principales :
- `alter table instagram_interactions drop constraint if exists instagram_interactions_source_post_id_fkey` — supprime la FK stricte. `if exists` la rend sûre même si le nom de contrainte généré automatiquement par Postgres diffère légèrement de ce qui est supposé (auto-nommage standard `<table>_<column>_fkey`, cohérent avec la convention Postgres par défaut utilisée dans toutes les autres migrations du repo).
- `alter table instagram_interactions alter column source_post_id type text using source_post_id::text` — change le type de `uuid` à `text`.

**Point vérifié par connaissance certaine de Postgres (non testé en exécution)** : un `ALTER COLUMN TYPE` reconstruit automatiquement tout index qui référence la colonne, y compris un index sur expression comme celui de la migration 092 (`coalesce(source_post_id::text, '')`). Le cast `uuid → text` est un cast standard sans perte (représentation textuelle canonique d'un UUID), et l'expression de l'index castait déjà explicitement en `::text` — donc son résultat est strictement identique avant/après le changement de type physique de la colonne. Ceci est un fait Postgres documenté, pas une supposition, mais je n'ai pas pu l'exécuter pour le confirmer empiriquement sur ce schéma précis.

**Non destructive** : aucune donnée n'est supprimée. `update instagram_interactions set source_provider = 'apify' where source_provider is null` backfille sans écraser de valeur existante (la colonne vient d'être créée, donc toutes les lignes sont `null` à ce stade — le backfill est total et sûr).

### `097_hiker_discovery_runs.sql`
Relue intégralement. `CREATE TABLE` pur + deux index + RLS + policy, sur le modèle exact des tables `apify_watched_posts`/`apify_runs`/`engagement_scoring_rules` déjà en place (`workspace_id in (select user_workspace_ids())`). Aucune donnée existante touchée, par construction.

**Écart de nommage à signaler** : la mission mentionne `hiker_discovery_runs` (§2, §12) comme nom de table. La Phase 3 avait créé `discovery_runs` (sans préfixe), anticipant une possible généralisation multi-provider future (la colonne `provider` existe déjà, avec un `CHECK` actuellement limité à `'hiker'` seul). Ce nom n'a pas été renommé pendant cette phase — à trancher explicitement si le nom `hiker_discovery_runs` est préféré.

## 2. Validation du schéma

**Non exécutée contre une vraie base** (voir §0). Ce qui a été vérifié :
- Cohérence syntaxique SQL relue ligne par ligne, deux fois.
- Absence de conflit de nom avec les objets existants (`grep` sur tout le dossier `migrations/` pour `source_provider`, `discovery_runs`, `idx_instagram_interactions_provider` — aucune collision trouvée).
- Le `RLS`/`policy` de `097` suit exactement le pattern des policies existantes (vérifié par comparaison textuelle directe avec `090_apify_watched_posts.sql`, `091_apify_runs.sql`, `093_engagement_scoring_and_source.sql`).

Colonnes, types, contraintes, index, FK, valeurs par défaut, RLS, policies : **tous relus dans le SQL, aucun n'a pu être confirmé par une introspection réelle du schéma post-migration** (`information_schema`, `pg_indexes`, etc.) faute d'environnement exécutable.

## 3. Persistence réelle (avec mock, pas Postgres réel)

Créé `src/lib/hiker/__tests__/integration/in-memory-supabase.ts` : un mock Supabase à état persistant (contrairement aux mocks Phase 3 qui simulaient un seul appel isolé), qui applique lui-même les règles d'unicité des index réels :
- `leads` : unique `(workspace_id, instagram_user_id)` quand non-null, comme la migration 092.
- `instagram_interactions` : dédup par la même clé composite que l'expression index de 092.
- RLS simulé : toute requête scoping un `workspace_id` différent de celui du client ne voit/n'écrit rien.

Pipeline testé de bout en bout : mock Hiker (fixtures déjà présentes en Phase 3) → `persistDiscoveryResult()` → mock Supabase. Fichier : `src/lib/hiker/__tests__/integration/pipeline.test.ts`.

## 4. Tests leads

`test_hiker_user` / `instagram_user_id = 123456789` (tel que demandé) :
- **1er passage → 1 lead créé.** Vérifié (`db.leads` a exactement 1 entrée après le premier `persistDiscoveryResult`).
- **2e passage, mêmes données → toujours 1 lead**, jamais 2. Vérifié explicitement.
- **Même `instagram_user_id`, `username` différent → même lead.** Vérifié : un premier passage crée le lead sous `test_hiker_user`, un second passage avec `test_hiker_user_renamed` mais le même `instagram_user_id` matche le lead existant (`leadsMatched: 1`, `leadsCreated: 0`), aucun doublon.

## 5. Tests interactions

Scénario demandé (liker A + liker B + commenteur A, même personne) : **3 lignes d'interaction créées**, 1 seul lead. Un second passage identique produit **0 nouvelle ligne** (toujours 3 au total) — dédup confirmée.

`source_provider = 'hiker'` et `source_post_id` contenant directement un identifiant Hiker brut (`hiker_media_pk_987654321`) sans aucune ligne `apify_watched_posts` correspondante : vérifié explicitement — le mock ne possède même pas de table `apify_watched_posts`, ce qui est en soi la preuve que la persistance ne l'exige à aucun moment.

## 6. Compatibilité Apify

Une fixture représentant une interaction Apify pré-existante (créée avant l'introduction de `source_provider`, donc portant `source_provider: 'apify'` comme le ferait le backfill de la migration 096) a été insérée directement dans le mock, puis une discovery Hiker pour une **personne différente** a été persistée. Résultat vérifié :
- La ligne Apify pré-existante n'est ni modifiée ni supprimée (`last_seen_at` inchangé, tous les champs identiques).
- Le lead Apify pré-existant reste intact.
- Les deux lignes (Apify + Hiker) coexistent dans la table.

Aucun code Apify (`process-likers.ts`, `client.ts`, les deux crons, `apify_watched_posts`, `apify_runs`) n'a été touché pendant cette phase — vérifié par `git status`/`git diff`, aucun de ces fichiers n'apparaît modifié.

## 7. Discovery run

Testé (avec le mock, pas de vraie table) les 4 statuts demandés sans aucun appel Hiker réel :
- **SUCCESS** avec stats complètes.
- **PARTIAL** avec `stopped_reason: 'insufficient_funds'`, données déjà collectées préservées dans les compteurs (`interactions_found: 10` conservé, pas remis à zéro).
- **FAILED** simulant l'échec de résolution du username lui-même par manque de crédit.
- **FAILED** simulant une exception inattendue, avec le message d'erreur conservé dans `metadata`.

Champs vérifiés dans chaque cas : `status`, `started_at`, `completed_at`, `workspace_id`, `instagram_user_id`, `contents_found`, `users_found`, `interactions_found`, `http_calls`, `errors_count`, `metadata`. Un test supplémentaire vérifie que la liste des runs est bien scopée par workspace (deux runs dans workspace A, un dans workspace B, seuls les deux premiers remontent pour A).

## 8. Idempotence

Vérifiée à deux niveaux :
- **Discovery engine** (déjà couvert en Phase 3) : deux runs indépendants contre les mêmes réponses mockées produisent le même nombre d'interactions/utilisateurs.
- **Persistence** (nouveau, Phase 3.5) : exécuter `persistDiscoveryResult` deux fois de suite sur le même `DiscoveryResult` ne crée ni doublon de lead ni doublon d'interaction — `db.leads.length` et `db.interactions.length` restent strictement identiques après le second passage.

Les runs (`discovery_runs`), conformément à la mission, restent bien deux lignes distinctes à chaque déclenchement — aucune tentative de les dédupliquer, ce qui est le comportement voulu (chaque run est un événement, pas une entité idempotente).

## 9. Tests endpoint

**Ce qui a été testé** : le schéma de validation Zod (`startDiscoverySchema`) de façon isolée — 9 tests couvrant username valide, username vide, champ manquant, caractères invalides (tentative de path traversal), espaces, longueur excessive, options hors bornes, et payload de forme complètement invalide.

**Ce qui n'a pas été testé** : la route Next.js `POST /api/instagram/discovery` elle-même en conditions quasi réelles (mock de `getWorkspaceId`, `createServiceClient`, requête HTTP simulée). Aucun précédent de ce type de test n'existe ailleurs dans le repo pour ce genre de route (`find src/app/api -name "*.test.ts"` ne retourne rien), et le construire aurait demandé de mocker plusieurs couches (session Next.js, cookies, `next/headers`) pour un bénéfice incertain comparé à une revue de code directe. **Revue de code effectuée à la place** : relecture de `src/app/api/instagram/discovery/route.ts` confirmant que l'ordre des vérifications est strictement : (1) `getWorkspaceId()` — retourne 401 si non authentifié, avant toute autre logique ; (2) validation Zod du payload — retourne 400 si invalide ; (3) vérification de la présence de `HIKER_API_KEY` — retourne 503 sinon ; (4) seulement ensuite, écriture DB puis premier appel réseau vers Hiker. Un utilisateur non authentifié ou un payload invalide ne peut donc jamais déclencher le moindre appel Hiker — confirmé par lecture du code, pas par exécution.

**Isolation cross-workspace** : `getWorkspaceId()` résout le workspace de l'utilisateur authentifié depuis sa propre session ; il n'y a aucun paramètre `workspaceId` dans le corps de la requête que le endpoint accepterait tel quel — impossible de spécifier un workspace arbitraire depuis le payload. Confirmé par lecture du schéma `startDiscoverySchema`, qui ne contient aucun champ `workspaceId`.

## 10. RLS / Security

Simulé (pas de vraie policy RLS Postgres exécutée) via le mock :
- Une requête scopée sur `workspace_id: WORKSPACE_B` depuis un client construit pour `WORKSPACE_A` ne retourne jamais de données (`data: null`).
- Un lead créé via une discovery pour `WORKSPACE_A` est invisible depuis un client scopé `WORKSPACE_B`, même en interrogeant explicitement `workspace_id: WORKSPACE_A` (le mock refuse la lecture cross-scope, comme le ferait une vraie policy `workspace_id in (select user_workspace_ids())` si l'appelant n'appartient qu'à un seul workspace).
- Une tentative d'insertion avec un `workspace_id` différent de celui du client est refusée avec une erreur explicite.

Aucun contournement de RLS introduit dans le code applicatif — `route.ts` utilise `createServiceClient()` (bypass RLS légitime, même pattern que le cron Apify existant) uniquement parce que le workspace a déjà été validé via `getWorkspaceId()` juste avant, et chaque requête est explicitement filtrée par ce `workspaceId` dans le code — pas de nouveau pattern introduit, réutilisation du même modèle que `src/app/api/cron/apify-instagram-likes/route.ts`.

## 11. Tests — résultats

```
npx vitest run src/lib/hiker src/lib/validations/__tests__/hiker.test.ts
```
```
Test Files  8 passed (8)
     Tests  61 passed (61)
```
(37 tests de la Phase 3 + 24 nouveaux tests d'intégration Phase 3.5)

```
npx vitest run          (suite complète du repo)
```
```
Test Files  1 failed | 11 passed (12)
     Tests  73 passed (73)
```
Le seul échec (`src/lib/agenda/positioning.test.ts`, "No test suite found") est confirmé préexistant (`git log`, commit `5019a23`), sans rapport avec cette phase.

```
npx tsc --noEmit -p tsconfig.json
```
0 erreur sur l'ensemble du repo.

```
npx eslint src/lib/hiker src/lib/validations/hiker.ts src/lib/validations/__tests__/hiker.test.ts
```
0 erreur, 8 warnings (paramètres de mock intentionnellement ignorés, déjà préfixés `_`).

## 12. Problèmes rencontrés

- **Absence d'environnement Supabase de test/staging** — le problème le plus structurant de cette phase (voir §0). Résolu par accord explicite de ne toucher aucune base, au prix d'une validation moins forte que ce que la mission visait initialement.
- **Docker indisponible** sur cette machine — empêche `supabase start` comme alternative locale à un vrai staging distant.
- **Erreurs de typage TypeScript** sur le mock Supabase (union de types trop large sur `from()`) — corrigées par des surcharges de fonction explicites par nom de table.
- **Bug dans mon propre test** (`insertRunningRun` codait `WORKSPACE_A` en dur, cassant le test d'isolation cross-workspace) — détecté par le test lui-même échouant correctement (le mock a refusé l'insertion cross-workspace comme prévu), corrigé en paramétrant le workspace.

## 13. Corrections effectuées

- Ajout d'arguments optionnels (`_columns?: string`, `_col?: string`, `_n?: number`) sur les méthodes du mock qui ne les utilisaient pas mais devaient accepter la même signature que le vrai client Supabase-js (`.select('id')`, `.order()`, `.limit(20)`).
- Surcharges de `from()` par nom de table littéral pour restaurer une inférence de type précise.
- Correction du helper de test `insertRunningRun` pour accepter un `workspaceId` paramétrable.

---

**Confirmations explicites demandées par la mission :**
- Aucun appel Hiker réel effectué.
- Aucun crédit Hiker consommé.
- Apify intact (aucun fichier touché).
- Meta intact (aucun fichier touché).
- DM Sessions intactes (aucun fichier touché).
- Aucune suppression destructive — et, plus fondamentalement, **aucune migration appliquée à quelque base que ce soit**, prod comme staging, conformément à ta décision explicite.
- Aucune Phase 4 entamée.

**Point à trancher avant une vraie Phase 3.5 complète** : il faut soit provisionner un projet Supabase de staging séparé, soit obtenir Docker sur une machine de dev pour `supabase start` en local, avant de pouvoir exécuter réellement les migrations 096/097 et confirmer empiriquement ce que cette phase n'a pu que déduire par analyse statique.
