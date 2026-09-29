# ClosRM Desktop — Vision finale (CRM × Instagram Intelligence)

> Document d'audit et de planification, Phase 1 du rebuild ClosRM Desktop. Aucun code n'a été modifié pour produire ce document — c'est la référence à valider avant la Phase 2 (design system + shell).

---

## 1. Résumé exécutif

ClosRM a déjà, côté backend, presque tout ce qu'il faut pour devenir un "CRM + Instagram Intelligence" :

- **Un vrai moteur de scoring d'engagement déjà fonctionnel et jamais exposé en UI** (`GET /api/leads/hot`) — pondération configurable par workspace (`engagement_scoring_rules`), pas un chiffre inventé.
- **Deux providers Instagram indépendants qui alimentent la même source de vérité** (`instagram_interactions` + `leads`), avec un modèle d'identité unique (`instagram_user_id`) : Apify (scraping asynchrone de posts surveillés) et Hiker (discovery synchrone d'un compte entier, déjà en code, déjà testé, jamais branché à une UI).
- **Un moteur de priorisation de relance déjà écrit** (`buildPriorityQueue`, worktree `closrm-session-dm`), pas encore mergé dans l'API principale ni exposé nulle part.
- **Une fiche lead web déjà riche** (calls, follow-ups, deals, tags, notes, journey/attribution, messages Instagram) mais dispersée dans un long scroll vertical, sans mise en avant du signal Instagram.

Le travail de la Phase 1 n'est donc pas de créer de nouvelles capacités backend from scratch, mais de **relier des pièces qui existent déjà et de leur donner une UX à la hauteur** (référence Insyder), en ajoutant strictement le backend manquant pour combler les vrais trous (identifiés en §7).

---

## 2. Matrice CLOSRM DATA / INSYDER CONCEPT / HIKER DATA / ELECTRON UI / BACKEND REQUIRED / STATUS

| # | Concept | ClosRM Data (existe) | Insyder Concept (référence UX) | Hiker Data (existe) | Electron UI | Backend requis | Statut |
|---|---|---|---|---|---|---|---|
| 1 | Identité du lead | `leads.first_name/last_name/phone/email` | Header profil riche | — | Header fiche lead | Aucun | ✅ Prêt |
| 2 | Profil Instagram | `leads.instagram_handle/instagram_user_id` | Card "profil Instagram" (avatar, bio, followers) | `HikerUserProfile` (biography, follower_count, following_count, is_verified, is_private, profile_pic_url) — **jamais persisté sur `leads`, seulement utilisé en mémoire pendant une discovery** | Section "Profil Instagram" | **Oui** — persister un sous-ensemble de `HikerUserProfile` (voir §7.1) | ⚠️ Backend à étendre |
| 3 | Pipeline / statuts | `leads.status` (9 valeurs) | Statut visible en header + badge | — | `StatusSelect` (déjà construit M3-B) | Aucun | ✅ Prêt |
| 4 | Score d'engagement / Intelligence | `engagement_scoring_rules` + logique dans `/api/leads/hot` | "Pourquoi ce prospect est intéressant" | Alimente les interactions scorées | Section "Intelligence" avec raisons | Aucun (juste exposer le calcul pour 1 lead, voir §7.2) | ⚠️ Route à ajouter (dérivée d'un calcul existant) |
| 5 | Interactions Instagram (like/comment/dm/mention) | `instagram_interactions` (092, 096) | Timeline d'interactions | `DiscoveredInteraction` (Hiker) + `ApifyLikerItem` (Apify) — les deux écrivent déjà dans cette table | `ActivityTimeline` (déjà construit M3-B, à enrichir) | Aucun | ✅ Prêt |
| 6 | Contenu source d'une interaction | `instagram_interactions.source_post_id/source_post_url` (texte libre depuis 096) | Vue "Content" avec thumbnail | `NormalizedContent` (thumbnail_url absent du type actuel — **Hiker ne le persiste pas aujourd'hui**) | Vue Content + lien contenu↔prospect | **Oui** — table/vue "contenu" agrégée si on veut une vraie page Content (voir §7.3) | ❌ Manquant (agrégation, pas juste lecture) |
| 7 | Discovery (déclenchement) | `discovery_runs` (097) | Page "Discovery" | `POST /api/instagram/discovery` déjà fonctionnel, persiste dans leads+interactions | Écran Discovery (lancer + suivre un run + résultats) | Aucun (l'API existe) | ⚠️ UI manquante seulement |
| 8 | Followers / Following | Absent sur `leads` | Card "followers/following" | `HikerUserProfile.follower_count/following_count`, `getFollowersPage` | Affiché dans profil Instagram | Voir #2 | ⚠️ Dépend de #2 |
| 9 | Appels | `calls` (type, outcome, attempt_number, duration, handoff_brief) | — (pas un concept Insyder) | — | Déjà construit M3-B (lecture), écriture partielle | Aucun | ✅ Prêt |
| 10 | Relances | `follow_ups` (reason, channel, status, scheduled_at) | — | — | Déjà construit M3-B (lecture) | Aucun | ✅ Prêt |
| 11 | Priorisation de relance (Sessions DM) | `dm_conversation_active_at` sur `leads` (vu dans `priority.ts`, migration à vérifier côté repo principal) | Filtre "leads à contacter en priorité" façon Insyder | — | Vue "Sessions DM" / bandeau priorité | **Oui** — merger le module depuis `closrm-session-dm` vers l'API principale (voir §7.4) | ❌ Non mergé |
| 12 | Deals | `leads.deal_amount/cash_collected/deal_installments/closed_at` | — | — | Déjà construit M3-B | Aucun | ✅ Prêt |
| 13 | Attribution (Meta + funnel) | `leads.meta_campaign_id/adset_id/ad_id`, `GET /api/leads/:id/journey` | — | — | Déjà construit M3-B | Aucun | ✅ Prêt |
| 14 | Messages Instagram (DM) | `ig_conversations`, `ig_messages`, `/api/instagram/conversations`, `/api/instagram/messages` | Messagerie intégrée au profil | — (Hiker ne fait pas de DM) | Onglet Messages (non construit en M3-B, à ajouter) | Aucun (routes déjà là) | ⚠️ UI manquante seulement |
| 15 | Reels/posts détenus par le coach (pas les prospects) | `ig_reels`, `ig_stories`, `ig_drafts` | — | — | Hors scope Lead Intelligence Profile (c'est du contenu du coach, pas du prospect) | Aucun | ✅ Existe, hors périmètre lead |
| 16 | Watched posts (Apify) | `apify_watched_posts`, `apify_runs` | — | — | Paramètres/Intégrations | Aucun | ✅ Prêt |

---

## 3. Ce qui existe déjà et qu'il ne faut PAS reconstruire

- **Hiker** (`src/lib/hiker/*`) : client, normalizer, deduplicator, discovery engine, persist — architecture propre et déjà testée (`__tests__/integration/pipeline.test.ts`). `POST /api/instagram/discovery` est fonctionnel de bout en bout et écrit déjà dans `leads`/`instagram_interactions`. **Ne pas créer un second pipeline Hiker.**
- **Apify** (`src/lib/apify/process-likers.ts`, cron `apify-instagram-likes`/`apify-poll-results`) : pipeline asynchrone de scraping de posts surveillés, alimente la même table. **Coexiste avec Hiker, ne fusionne pas les deux logiques.**
- **Scoring d'engagement** (`GET /api/leads/hot`) : calcul déjà réel, pondérable par workspace. **Ne pas inventer un second système de score.**
- **Messages Instagram** (`ig_conversations`/`ig_messages`, routes `/api/instagram/conversations` et `/api/instagram/messages`) : réels, fonctionnels côté web (`LeadSidePanel.tsx` les consomme déjà). **Ne pas construire une fausse messagerie — brancher celle qui existe.**
- **DM Sessions** (`closrm-session-dm/src/lib/dm-sessions/*`) : moteur de priorisation réel, 5 catégories, testé. **Ne pas réécrire la logique — merger et exposer.**

## 4. Ce qui manque réellement (backend à ajouter, minimal et documenté)

### 4.1 Profil Instagram enrichi non persisté
`HikerClient.getUserByUsername` retourne déjà `biography`, `follower_count`, `following_count`, `is_verified`, `is_private`, `profile_pic_url` — mais `persistDiscoveryResult` ne les écrit jamais sur `leads`. Aujourd'hui ces données existent seulement le temps d'une requête HTTP puis sont jetées.
**Action minimale** : ajouter des colonnes nullable sur `leads` (`instagram_followers_count`, `instagram_following_count`, `instagram_is_verified`, `instagram_is_private`, `instagram_profile_pic_url`, `instagram_bio`, `instagram_profile_synced_at`) et les renseigner dans `persistDiscoveryResult` quand une discovery cible directement ce lead. Une seule migration, aucune route cassée.

### 4.2 Score exposé pour un seul lead (pas seulement la liste "hot")
`/api/leads/hot` calcule un classement pour tous les leads actifs sur une fenêtre — utile pour une liste, mais la fiche lead a besoin du score + du détail de calcul pour **un seul lead**.
**Action minimale** : soit un paramètre `?lead_id=` sur la route existante, soit une route dédiée `GET /api/leads/:id/score` réutilisant la même logique de pondération (`engagement_scoring_rules`) sans dupliquer le calcul — à factoriser dans une fonction partagée `computeEngagementScore(supabase, workspaceId, leadId)`.

### 4.3 Vue "Content" agrégée
Il n'existe aujourd'hui aucune table qui liste "un contenu Instagram" comme entité de premier niveau avec ses métriques agrégées (nombre de prospects, thumbnail) — seulement des lignes `instagram_interactions` pointant vers un `source_post_id` texte libre.
**Action minimale** : une vue Postgres (pas une nouvelle table de données dupliquées) agrégeant `instagram_interactions` par `(workspace_id, source_post_id)` avec `count(distinct lead_id)`, `count(*) filter (interaction_type)`, `min/max(last_seen_at)`. Un thumbnail réel n'existe que pour les contenus Apify (`apify_watched_posts` a probablement une URL) — **pour Hiker, `thumbnail_url` doit être explicitement ajouté à `NormalizedContent` et persisté quelque part** (aujourd'hui il est lu depuis `HikerMediaItem.thumbnail_url` mais jeté par `normalizeContent`). Sans ce stockage, la page Content n'aura pas d'image pour les contenus découverts par Hiker — à trancher en Phase 5, pas maintenant.

### 4.4 DM Sessions non exposé
Le moteur existe et est testé mais vit dans un repo/worktree séparé, non mergé. **Action minimale, hors scope Phase 1-4** : merger `src/lib/dm-sessions/` et ses routes API (`/api/dm-sessions/*`) dans le repo principal une fois que Rémy/Pierre valident le merge — ce n'est pas un blocage pour construire le Lead Intelligence Profile (Phase 3), seulement pour la Phase 8 (Sessions DM).

## 5. Ce qui n'est PAS disponible et ne doit PAS être simulé

- **Thumbnails de contenu Hiker** : non persistés aujourd'hui (voir §4.3) — tant que ce n'est pas ajouté, la page Content pour les contenus Hiker n'aura pas d'image, un placeholder neutre doit être utilisé, jamais une image inventée.
- **Fiabilité de `like_count`/`comment_count` Hiker** : le code documente lui-même (`normalizeContent`, `likeCountReliable: false`) que ces compteurs ne sont pas fiables — ne jamais les afficher comme une métrique certaine, toujours qualifiés ("estimation" ou masqués).
- **Couverture exhaustive des likers** : Hiker ne garantit pas une pagination complète sur `/v3/media/likers` (voir commentaire dans `discovery.ts`) — un compteur "X interactions" doit être présenté comme un minimum observé, pas un total absolu.
- **Followers/following en direct** : seulement disponibles au moment d'une discovery ponctuelle, pas une donnée temps réel — à afficher avec une date de dernière synchro (`instagram_profile_synced_at`, §4.1), jamais comme "live".

## 6. Architecture technique (rappel, inchangée)

```
Electron Renderer (React/Vite)
        ↓ HTTP + Bearer
ClosRM API (Next.js, Vercel)
        ↓
Supabase (leads, calls, follow_ups, instagram_interactions, discovery_runs, engagement_scoring_rules, ig_conversations…)
        ↓ (server-only)
Hiker API / Apify API / Meta Graph API
```
Aucune clé Hiker/Apify/Meta n'atteint jamais Electron — toutes les nouvelles routes proposées ci-dessus suivent le même `getWorkspaceId()` + RLS déjà en place. Le seul changement d'architecture est l'ajout de colonnes et d'une vue, pas un nouveau service.

## 7. Nouvelle structure de navigation (Electron)

```
ClosRM
├── Dashboard                         (Phase 9)
├── COMMERCE
│   ├── Leads                         (Phase 3-4 — cœur du produit)
│   ├── Pipeline                      (Phase 7)
│   ├── Relances                      (Phase 7)
│   └── Deals                         (Phase 7)
├── INSTAGRAM
│   ├── Discovery                     (Phase 5 — POST/GET /api/instagram/discovery déjà prêts)
│   ├── Interactions                  (Phase 5 — lecture instagram_interactions)
│   ├── Content                       (Phase 5 — nécessite §4.3)
│   └── Sessions DM                   (Phase 8 — nécessite merge §4.4)
├── Analytics                         (Phase 9)
└── SYSTEM
    ├── Intégrations
    └── Paramètres
```

Sidebar iconographique compacte (référence Insyder confirmée par capture : rail d'icônes gris clair, logo texte+icône en tête, pas de labels permanents, tooltip au survol) — direction déjà entamée en M3-B, à faire évoluer avec les nouvelles sections en Phase 2.

## 7bis. Les trois couches Instagram Intelligence — clarification de périmètre

Correction explicite : **Discovery n'est pas, à elle seule, le système Instagram Intelligence de ClosRM.** C'est une brique parmi trois, distinctes par leur rôle, jamais à confondre entre elles :

1. **Discovery = acquisition.** Scan ponctuel, déclenché manuellement, d'**un compte Instagram** (typiquement celui du coach) pour découvrir de nouveaux prospects à partir de qui a interagi avec son contenu. C'est ce qui est construit aujourd'hui (`POST /api/instagram/discovery`, écran Discovery). Elle crée des leads et des lignes `instagram_interactions`, mais ne tourne qu'à la demande, sur un compte à la fois.

2. **Monitoring = enrichissement continu des leads déjà connus.** Pour un lead qui existe déjà en base (créé via Discovery, import CSV, formulaire, etc.), continuer à observer dans la durée ses nouveaux signaux Instagram : nouveaux likes, nouveaux commentaires, retour régulier, réactions aux stories si un jour techniquement disponibles. **Non implémenté aujourd'hui.** C'est la pièce manquante que cette section documente — voir §7ter pour ce qu'elle demande concrètement.

3. **Intelligence = interprétation.** Utilise l'historique accumulé par les deux couches précédentes (peu importe qu'il vienne de Discovery, de Monitoring, ou d'Apify) pour produire score, niveau de confiance, raisons, récence, potentiel — déjà en grande partie construit (`computeEngagementScore`, section Intelligence du Lead Profile, §8 ci-dessous). Cette couche ne collecte rien elle-même, elle lit `instagram_interactions`.

Ne pas re-décrire Discovery comme si elle couvrait 2 et 3 — elle ne fait que 1.

## 7ter. Ce que demanderait le Monitoring (non construit, à trancher avant de coder)

Le Monitoring longitudinal n'existe dans aucun repo aujourd'hui (ni web, ni Hiker, ni Apify) sous cette forme précise — c'est une vraie lacune, pas un oubli de câblage UI comme l'étaient Discovery/Interactions/Content en Phase 1. Avant de le construire, plusieurs décisions structurantes :

- **Déclenchement** : un cron récurrent (type `pg_cron` déjà utilisé ailleurs dans le repo pour les rappels de RDV) qui, pour chaque lead ayant un `instagram_user_id` connu, relance une discovery ciblée à intervalle régulier ? Ou un mécanisme plus léger (vérifier seulement les nouveaux posts du coach depuis la dernière fois, via Apify qui fait déjà ça pour des posts surveillés) ?
- **Coût réel** : chaque cycle de monitoring consomme des requêtes Hiker facturées (voir l'incident de cette session — un seul run de test a consommé plusieurs euros de crédit HikerAPI). Un monitoring par lead à intervalle court serait potentiellement très coûteux à grande échelle — le rythme (quotidien ? hebdomadaire ?) et le nombre de leads couverts doivent être une décision produit explicite, pas un choix technique par défaut.
- **Portée technique réelle** : HikerAPI ne fournit pas d'endpoint de "webhook" ou de push d'événement — tout monitoring reposerait sur du polling actif (interroger périodiquement), avec le même type de limites de couverture déjà documentées pour Discovery (pas de garantie d'exhaustivité sur les likers/commentaires, pas de viewers de story).
- **Réutilisation obligatoire** : si construit, le Monitoring doit écrire dans `instagram_interactions` exactement comme Discovery et Apify le font déjà (même `persistDiscoveryResult`/`processLikersDataset`, même modèle d'identité) — **jamais un nouveau pipeline parallèle**.

Rien de ceci n'est implémenté à ce stade. Cette section documente le manque et son coût, elle ne préjuge pas de la faisabilité budgétaire.

## 8. Le Lead Intelligence Profile — pièce maîtresse (Phase 3)

Structure cible (tout ce qui est marqué "prêt" ne demande aucun backend nouveau) :

1. **Header** — avatar (photo IG si dispo, sinon initiales), nom, @handle cliquable, badge vérifié si connu, statut CRM, tags, actions (Appeler, Planifier, Relancer, Ouvrir Instagram). *Prêt, sauf photo/vérifié (§4.1).*
2. **Résumé Instagram** — cards : interactions totales, likes, commentaires, première/dernière interaction, followers/following si synchronisés. *Prêt pour interactions/likes/commentaires/dates ; followers nécessite §4.1.*
3. **Intelligence** — score (réutilise `/api/leads/hot`, voir §4.2) + liste des raisons réelles (ex. "3 interactions sur 2 contenus différents", "relance en retard de 2 jours", "jamais recontacté depuis 14 jours") calculées à partir des mêmes données déjà utilisées par `buildPriorityQueue`/`hot`. Aucune raison inventée.
4. **Timeline unifiée** — fusion CRM (création, changement de statut, appel, relance, booking) + Instagram (like, commentaire) triée chronologiquement. *Prêt — c'est une extension directe de `build-activity.tsx` déjà construit en M3-B, à enrichir avec les changements de statut (non capturés aujourd'hui, voir note ci-dessous).*
5. **CRM** — statut, source, assigné, tags, appels, relances, booking, deal, notes, attribution. *Prêt, déjà construit en M3-B.*

**Note** : l'historique des changements de statut n'est pas actuellement tracé par une table dédiée (`leads.status` est un champ mutable sans log). Si on veut vraiment les faire apparaître dans la timeline, cela demande soit un trigger d'audit (nouvelle table `lead_status_history`), soit de s'appuyer sur `fireTriggersForEvent('lead_status_changed', ...)` déjà déclenché côté backend pour écrire un log — **à trancher explicitement avant la Phase 3**, ce n'est pas dans le périmètre "zéro backend" comme le reste.

## 9. Ordre d'implémentation proposé

Conforme à la Phase 1 du brief — Phase 2+ non commencées, en attente de validation de ce document.

| Phase | Contenu | Bloque sur |
|---|---|---|
| 2 | Design system + shell (sidebar Insyder-like, header, navigation) | Rien |
| 3 | Lead Intelligence Profile (header, résumé IG, intelligence, timeline, CRM) | §4.1 (profil enrichi), §4.2 (score par lead), décision sur l'historique de statut |
| 4 | Liste Leads (table, filtres incluant activité Instagram/interactions) | Phase 3 (réutilise les mêmes primitives) |
| 5 | Discovery / Interactions / Content | §4.3 pour Content ; Discovery/Interactions prêts tels quels — **Discovery seule = couche 1/3, voir §7bis** |
| 6 | Hiker réel end-to-end (déjà fait côté API — vérifier le POC scripts/hiker-poc encore valide) | Rien de nouveau, vérification uniquement |
| 6bis | Monitoring longitudinal (couche 2/3, §7ter) | Décision produit sur cadence/coût — non commencé |
| 7 | Pipeline + Relances + Deals (vues transverses) | Rien |
| 8 | DM Sessions | §4.4 (merge) |
| 9 | Dashboard + Analytics | Phases 3-8 pour avoir des données réelles à agréger |
| 10 | Polish final | Tout |

## 10. Décisions à valider avant la Phase 2

1. Ajout des colonnes profil Instagram sur `leads` (§4.1) — migration simple, non destructive.
2. Fonction partagée de scoring pour un lead unique (§4.2) — pas de nouvelle table, juste une route/fonction.
3. Périmètre de la page Content en Phase 5 — avec ou sans thumbnails Hiker (§4.3), sachant que ça demande un changement de `NormalizedContent`.
4. Traitement de l'historique de statut dans la timeline (§8, note) — table d'audit ou approximation via les événements de workflow existants.
5. Calendrier du merge DM Sessions (§4.4) — dépend de Rémy/Pierre, pas seulement de moi.
6. Cadence et budget du Monitoring longitudinal (§7ter) — décision produit explicite avant tout code, vu le coût réel constaté en requêtes Hiker facturées.

---

*Document produit en Phase 1 (audit) du rebuild ClosRM Desktop. Aucun fichier de code n'a été modifié pendant sa rédaction.*
