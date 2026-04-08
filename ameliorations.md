# Améliorations — ClosRM

> Ce fichier recense toutes les améliorations identifiées au fil du développement.
> Mis à jour obligatoirement à la fin de chaque tâche.
>
> **RÈGLE ABSOLUE : aucune amélioration listée ici ne doit être implémentée**
> **sans validation explicite d'un des deux développeurs (Rémy ou Pierre).**

---

## Comment lire ce fichier

Chaque amélioration suit ce format :

```
### [ID] Titre court
- **Contexte :** d'où vient cette idée / quelle tâche l'a fait émerger
- **Description :** ce que ça apporte concrètement
- **Priorité estimée :** Haute / Moyenne / Basse
- **Effort estimé :** Faible / Moyen / Élevé
- **Statut :** En attente de validation / Validée / Rejetée / Implémentée (tâche N)
```

---

## Améliorations en attente de validation

### A-001 — Trigger SQL `handle_new_user` sans error handling
- **Contexte :** Identifié pendant T-002 (audit auth)
- **Description :** Si l'insert dans `users` échoue après la création du workspace, l'utilisateur se retrouve orphelin (auth.user existe mais pas de profil). Ajouter un BEGIN/EXCEPTION dans le trigger.
- **Priorité estimée :** Haute
- **Effort estimé :** Faible
- **Statut :** En attente de validation

### A-002 — RLS policies basées sur owner_id uniquement
- **Contexte :** Identifié pendant T-002 (audit auth)
- **Description :** Les policies actuelles vérifient `owner_id = auth.uid()` via la table workspaces. En V2 avec setter/closer, il faudra changer pour `workspace_id IN (SELECT workspace_id FROM users WHERE id = auth.uid())` pour que les membres invités puissent accéder.
- **Priorité estimée :** Moyenne (bloquant pour V2)
- **Effort estimé :** Moyen
- **Statut :** En attente de validation

### A-003 — Rate limiting sur login/register
- **Contexte :** Identifié pendant T-002 (audit sécurité)
- **Description :** Aucun rate limiting — brute force possible sur les endpoints auth. Ajouter un throttle par IP ou par email.
- **Priorité estimée :** Haute
- **Effort estimé :** Moyen
- **Statut :** En attente de validation

### A-004 — Confirmation email après inscription
- **Contexte :** Identifié pendant T-002 (audit auth)
- **Description :** Actuellement les utilisateurs peuvent s'inscrire avec n'importe quel email sans vérification. Activer la confirmation email dans Supabase Auth settings.
- **Priorité estimée :** Moyenne
- **Effort estimé :** Faible
- **Statut :** En attente de validation

### A-005 — Pages 404 et error avec design system
- **Contexte :** Identifié pendant T-002 (audit)
- **Description :** Pas de page 404 ni error boundary customisée. Créer `src/app/not-found.tsx` et `src/app/error.tsx` avec le design ClosRM.
- **Priorité estimée :** Basse
- **Effort estimé :** Faible
- **Statut :** En attente de validation

### A-006 — Détection d'expiration de session côté client
- **Contexte :** Identifié pendant T-002 (audit auth)
- **Description :** Quand la session expire, l'utilisateur est redirigé silencieusement vers /login sans notification. Détecter via `onAuthStateChange` et afficher un toast.
- **Priorité estimée :** Basse
- **Effort estimé :** Faible
- **Statut :** En attente de validation

### A-007 — Sources de leads : Follow Ads + Instagram DM channel
- **Contexte :** Discussion avec Pierre pendant T-007
- **Description :** Ajouter `follow_ads` comme source de lead + `instagram_dm` comme channel de follow-up. Permet de filtrer les relances Instagram dans la page follow-ups. Simple à implémenter (ajout dans les enums SQL + types TS + filtres UI).
- **Priorité estimée :** Haute
- **Effort estimé :** Faible
- **Statut :** ✅ Implémentée le 2026-04-07 par Rémy (migration 014, types TS, validations Zod, badges, filtres, exports, workflows). Suite directe de T-025.

### A-008 — Import auto des leads Follow Ads via API Instagram
- **Contexte :** Discussion avec Pierre pendant T-007
- **Description :** À terme, les prospects qui follow le compte via une pub seront loggés automatiquement comme leads via l'API Instagram/Meta. Nécessite l'intégration de l'API Instagram Graph pour détecter les nouveaux followers issus des pubs.
- **Priorité estimée :** Moyenne
- **Effort estimé :** Élevé
- **Statut :** Fiche T-026 créée le 2026-04-07 (`taches/tache-026-followers-as-prospects.md`). En attente de validation pour démarrage.

### A-010 — Dashboard : variations % par rapport à la période précédente
- **Contexte :** Identifié pendant T-003 (dashboard)
- **Description :** Afficher sur chaque KPI card la variation par rapport à la période précédente (ex: "+12% vs 30j précédents"). Nécessite une 2ème query pour la période N-1 en parallèle.
- **Priorité estimée :** Moyenne
- **Effort estimé :** Faible
- **Statut :** En attente de validation

### A-011 — Dashboard : "Statut changé" dans l'activité récente
- **Contexte :** Identifié pendant T-003 (dashboard)
- **Description :** L'activité récente n'affiche que les leads créés et appels loggués. Ajouter les changements de statut nécessiterait une table d'audit dédiée (`lead_events`). Utile pour avoir un historique complet.
- **Priorité estimée :** Basse
- **Effort estimé :** Moyen (nouvelle table + trigger SQL + query)
- **Statut :** En attente de validation

### A-012 — Dashboard : borne de date sur l'activité récente
- **Contexte :** Identifié pendant T-003 (code review)
- **Description :** La query d'activité récente fait 10 leads + 10 calls sans borne de date. Si un coach a 10 leads vieux de 6 mois et 0 appels récents, la timeline sera biaisée. Ajouter `.gte('created_at', sevenDaysAgo)` pour limiter aux 7 derniers jours.
- **Priorité estimée :** Basse
- **Effort estimé :** Faible
- **Statut :** En attente de validation

### A-013 — Automations CTA Instagram : réponse DM/Story → lead + nurturing auto
- **Contexte :** Discussion avec Pierre pendant T-007
- **Description :** Quand un prospect répond à un CTA en story ou DM (ex: "envoie CHAUSSETTE en DM"), il est automatiquement créé comme lead et une séquence de nurturing se lance (envoi de contenu, qualification, prise de RDV). Nécessite : webhook Instagram DM, détection de mots-clés, lancement auto de séquences de follow-ups, et potentiellement un builder de séquences.
- **Priorité estimée :** Haute
- **Effort estimé :** Élevé
- **Statut :** En attente de validation

---

## Améliorations validées (à implémenter)

*Aucune pour l'instant.*

---

## Améliorations rejetées

*Aucune pour l'instant.*

---

## Améliorations implémentées

*Aucune pour l'instant.*

---

## T-013 Meta Ads Bloc A — Améliorations identifiées

### A-013-01 · Token Meta : rafraîchissement automatique avant expiration (60 jours)
**Priorité :** Haute
**Contexte :** Le token long-lived Meta expire après 60 jours. Actuellement aucun mécanisme de renouvellement automatique.
**Proposition :** Ajouter une cron job (Vercel Cron ou Supabase Edge Function) qui vérifie les tokens expirés sous 7 jours et les rafraîchit via l'endpoint `fb_exchange_token`.

### A-013-02 · Sélection de page Meta : permettre plusieurs pages par workspace
**Priorité :** Basse
**Contexte :** La V1 prend automatiquement `pages[0]`. Un coach peut avoir plusieurs pages Facebook.
**Proposition :** Après l'OAuth, si l'utilisateur a plusieurs pages, afficher un sélecteur dans `/parametres/integrations` pour choisir quelle page connecter.

### A-013-03 · Source lead : détecter Facebook vs Instagram depuis l'ad_id
**Priorité :** Moyenne
**Contexte :** Le webhook insère tous les leads avec `source: 'facebook_ads'`. L'API Meta ne retourne pas directement la plateforme (FB vs IG) dans le webhook payload.
**Proposition :** Appeler `GET /{ad_id}?fields=effective_object_story_spec` pour détecter si l'annonce est Instagram et mettre `source: 'instagram_ads'` dans ce cas.

### A-013-04 · Lint baseline : 8 erreurs pré-existantes non liées à T-013
**Priorité :** Haute
**Contexte :** `closing/page.tsx`, `follow-ups/page.tsx`, `LeadSidePanel.tsx` ont des erreurs ESLint pré-existantes. Bloque la vérification propre de "0 erreurs" sur les nouvelles tâches.
**Proposition :** Corriger ces erreurs dans une tâche dédiée avant la prochaine PR majeure.

---

## T-011 Statistiques — Améliorations identifiées

### A-011-01 · Queries stats : agrégation côté serveur via RPC Supabase
**Priorité :** Moyenne
**Contexte :** `fetchLeadsPerDay`, `fetchSourceData` et `fetchFunnelData` (DISTINCT) rapatrient toutes les lignes côté client pour agréger en JS. Sur un workspace avec 5000+ leads, la période "Tout" peut devenir lente.
**Proposition :** Créer des fonctions Postgres via `supabase.rpc()` qui retournent directement les données agrégées.

### A-011-02 · Recharts charts stats : gestion des erreurs Supabase
**Priorité :** Basse
**Contexte :** Les queries retournent `?? 0` / `?? []` sur erreur Supabase, produisant une page silencieusement vide plutôt qu'un message d'erreur.
**Proposition :** Propager les erreurs Supabase et afficher un état d'erreur dans `StatsClient` si une query échoue.

### A-011-03 · KpiCards stats vs dashboard : unifier le pattern formatter
**Priorité :** Basse
**Contexte :** `stats/kpi-cards.tsx` retourne `string` depuis ses formatters (via `String()`), tandis que `dashboard/kpi-cards.tsx` retourne `number | string`. Les deux composants co-existent sans conflit mais créent une légère incohérence.
**Proposition :** Lors d'un prochain refactor, aligner les deux sur `string` (plus propre pour JSX).

---

## T-012 — Base de données

### A-012-01 · Export > 1000 contacts
**Priorité :** Basse
**Contexte :** Identifié pendant T-012 (vue globale contacts)
**Description :** Actuellement plafonné à 1000 contacts dans le CSV. Si le coach a beaucoup de leads, ajouter une route `/api/contacts/export` dédiée qui streame le CSV côté serveur. Pas d'AbortController sur le fetch export actuel.
**Proposition :** Créer un endpoint streamable et ajouter annulation côté client via AbortController.

### A-012-02 · group_by=tags
**Priorité :** Basse
**Contexte :** Identifié pendant T-012 (groupement de contacts)
**Description :** Retiré de V1 car un lead peut avoir N tags — tri non trivial. À implémenter via une vue agrégée Supabase ou une requête avec DISTINCT ON.
**Proposition :** Créer une fonction Postgres RPC `get_contacts_grouped_by_tags()`.

### A-012-03 · Suppression en masse
**Priorité :** Moyenne
**Contexte :** Identifié pendant T-012 (actions sur les contacts)
**Description :** Sélectionner des contacts dans le tableau et les archiver (statut Dead) en une action. Nécessite des checkboxes et un bouton d'action.
**Proposition :** Ajouter checkboxes au tableau, état sélection global, bouton "Archiver sélection".

### A-012-04 · Groupes collapsibles
**Priorité :** Basse
**Contexte :** Identifié pendant T-012 (groupement par statut)
**Description :** Les séparateurs de groupe actuellement flat. Rendre cliquables pour réduire/afficher les groupes individuels.
**Proposition :** Ajouter state `collapsedGroups` et icône chevron dans les headers de groupe.

### A-012-05 · ILIKE injection dans filtres
**Priorité :** Moyenne
**Contexte :** Identifié pendant T-012 (sécurité filtres)
**Description :** Le filtre search dans `/api/contacts` (et `/api/leads`) interpole la chaîne directement dans le filtre PostgREST. Un input avec une virgule pourrait malformer le filtre. Sanitiser les caractères PostgREST (`,`, `.`, `(`, `)`) avant interpolation.
**Proposition :** Créer une fonction `sanitizePostgRESTFilter()` et l'appliquer sur tous les filtres texte.

### A-012-06 · Meta interface dupliquée
**Priorité :** Basse
**Contexte :** Identifié pendant T-012 (code review)
**Description :** Type `Meta` (total/page/per_page/total_pages) est redéfinie localement dans `leads/page.tsx` et `base-de-donnees/page.tsx`. Exporter depuis `src/types/index.ts`.
**Proposition :** Centraliser dans `src/types/index.ts` et importer partout.

---

## T-022 — Calendrier / Booking

### A-022-01 · Champ slug workspace dans la page Réglages
**Priorité :** Haute
**Contexte :** Identifié pendant T-022 (booking)
**Description :** La page de booking publique utilise un slug workspace (`/book/pierre-rebmann/...`), mais il n'y a pas d'endroit dans l'UI pour le configurer. Ajouter un champ "Slug public" dans Paramètres > Réglages.
**Proposition :** Ajouter un input dans la page réglages qui appelle `PUT /api/workspaces/slug`.

### A-022-02 · Annulation/reprogrammation par le client
**Priorité :** Moyenne
**Contexte :** Identifié pendant T-022 (booking)
**Description :** Actuellement le client ne peut pas annuler ou reprogrammer son RDV après réservation. Ajouter un lien dans l'email de confirmation + page publique d'annulation.
**Proposition :** Ajouter un `cancel_token` au booking + route publique `/book/cancel/[token]`.

### A-022-03 · Email de confirmation automatique après booking
**Priorité :** Haute
**Contexte :** Identifié pendant T-022 (booking)
**Description :** La page de confirmation dit "Vous recevrez un email de confirmation" mais aucun email n'est envoyé. Le workflow trigger `booking_created` existe — il suffit de créer un workflow template "Confirmation de RDV" avec action `send_email`.
**Proposition :** Ajouter un template workflow pré-configuré dans `src/lib/workflows/templates.ts`.

### A-022-04 · Notification coach quand quelqu'un réserve
**Priorité :** Haute
**Contexte :** Identifié pendant T-022 (booking)
**Description :** Quand un prospect réserve via la page publique, le coach n'est pas notifié. Utiliser le trigger `booking_created` pour envoyer une notification Telegram/WhatsApp.
**Proposition :** Ajouter un template workflow "Notification nouveau booking" avec action `send_notification`.

### A-022-05 · Supabase CLI pour les migrations
**Priorité :** Moyenne
**Contexte :** Identifié pendant T-022 — blocage récurrent
**Description :** Pierre n'a pas accès au compte Supabase, donc il ne peut pas exécuter les migrations. Le CLI Supabase est installé mais non linkable sans les credentials.
**Proposition :** Demander à Rémy de partager l'accès Supabase (invite membre) ou de configurer un access token partagé.

### A-023-01 · Cron job pour la publication programmée Instagram
**Priorité :** Haute
**Contexte :** Identifié pendant T-023 — les drafts avec status 'scheduled' ne sont pas publiés automatiquement
**Description :** Ajouter un cron job (via `/api/cron/`) qui vérifie toutes les 5 minutes les drafts avec `status = 'scheduled'` et `scheduled_at <= now()`, et les publie via le flow de publication existant.
**Proposition :** Créer `/api/cron/publish-scheduled` et l'ajouter au vercel.json cron config.

### A-023-02 · Webhook pour les DMs Instagram entrants
**Priorité :** Haute
**Contexte :** Identifié pendant T-023 — les messages reçus ne sont captés que lors du sync manuel
**Description :** Configurer un webhook Meta pour recevoir les DMs en temps réel (event `messages`), insérer dans `ig_messages` et mettre à jour `ig_conversations.unread_count`.
**Proposition :** Ajouter un endpoint `/api/webhooks/instagram/messages` et le configurer dans l'app Meta.

### A-023-03 · Auto-match conversations Instagram → leads
**Priorité :** Moyenne
**Contexte :** Identifié pendant T-023 — le champ `lead_id` sur `ig_conversations` est toujours null
**Description :** Lors du sync conversations, tenter de matcher le `participant_username` ou `participant_name` avec un lead existant (par nom/prénom). Permettre aussi le linkage manuel dans l'UI.
**Proposition :** Ajouter un bouton "Lier à un lead" dans le header de conversation + matching automatique à la sync.

### A-023-04 · Refresh token Meta avant expiration
**Priorité :** Moyenne
**Contexte :** Identifié pendant T-023 — le token long-lived expire après 60 jours
**Description :** Ajouter un cron job qui vérifie `ig_accounts.token_expires_at` et refresh le token avant expiration via l'API Meta.

---

## T-017 — Module Publicités (Meta Ads Dashboard)

### A-017-01 · Cache des données Meta en DB
**Priorité :** Moyenne
**Contexte :** Identifié pendant T-017 (performance)
**Description :** Chaque visite de la page Publicités appelle la Meta Marketing API en temps réel (~1-3s). Pour un coach qui consulte souvent, ajouter un cache court (5-15 min) en DB ou en mémoire.
**Proposition :** Créer une table `meta_insights_cache` avec TTL, ou utiliser un cache edge (Vercel KV).

### A-017-02 · Sélecteur de compte publicitaire UI
**Priorité :** Basse
**Contexte :** Identifié pendant T-017 (multi-comptes)
**Description :** La V1 auto-sélectionne le premier compte pub actif. Un coach avec plusieurs comptes pub ne peut pas choisir lequel afficher.
**Proposition :** Ajouter un dropdown dans `/parametres/integrations` ou dans la page Publicités pour choisir le compte pub.

### A-017-03 · Comparaison de périodes
**Priorité :** Basse
**Contexte :** Identifié pendant T-017 (UX)
**Description :** Le dashboard ne montre qu'une seule période. Ajouter la possibilité de comparer (ex: "cette semaine vs semaine dernière") avec des indicateurs % de variation.
**Proposition :** Ajouter un mode comparaison dans le sélecteur de période, double appel API, affichage des deltas.

### A-017-04 · Export des données pub en CSV
**Priorité :** Basse
**Contexte :** Identifié pendant T-017 (fonctionnalité)
**Description :** Pas d'export CSV pour les données de campagnes. Utile pour les coachs qui veulent partager les stats avec leur équipe.
**Proposition :** Bouton "Exporter CSV" dans chaque onglet tableau.

### A-017-05 · ROAS réel basé sur le revenu par deal
**Priorité :** Haute
**Contexte :** Identifié pendant T-017 (KPI)
**Description :** Le ROAS est affiché "—" car il n'y a pas de suivi du revenu par deal. Nécessite l'ajout d'un champ `deal_value` sur les leads closés.
**Proposition :** Ajouter `deal_value DECIMAL` à la table leads, un input dans la modale de closing, et calculer le ROAS = SUM(deal_value) / spend.

---

---

## Améliorations identifiées pendant T-024 — Audit Instagram + Performance (Pierre, 2026-04-05→07)

### A-024-01 · Token Meta refresh automatique
**Priorité :** Haute
**Contexte :** Les tokens Meta expirent. Risque de panne silencieuse.
**Proposition :** Cron qui vérifie `ig_accounts.token_expires_at` et refresh via `fb_exchange_token` avant expiration.

### A-024-02 · Trigger workflow comment_keyword (backend)
**Priorité :** Moyenne
**Contexte :** Le trigger existe en UI mais le backend n'est pas implémenté.
**Proposition :** Ajouter la logique dans le webhook Instagram pour détecter les mots-clés dans les commentaires et déclencher les workflows.

### A-024-03 · Publication Stories via API
**Priorité :** Moyenne
**Contexte :** Le type STORY est supporté côté UI mais l'API Meta pour les Stories a des limitations (pas de caption, 24h max).
**Proposition :** Adapter le flow de publication pour les contraintes spécifiques des Stories.

### A-024-04 · Carousel Instagram
**Priorité :** Basse
**Contexte :** Le type CAROUSEL a été retiré de l'UI mais pourrait être utile.
**Proposition :** Réimplémenter avec le flow multi-container de l'API Meta.

### A-024-05 · Convertir page Agenda en Server Component
**Priorité :** Basse
**Contexte :** Dernière page majeure encore en client-side fetch.
**Proposition :** Même pattern que les 8 autres pages converties.

### A-024-06 · Memoization inline styles/callbacks
**Priorité :** Basse
**Contexte :** 15+ pages créent des nouveaux objets style à chaque render.
**Proposition :** Extraire les styles constants, utiliser useCallback/useMemo.

### A-024-07 · Notes reels en base (pas localStorage)
**Priorité :** Basse
**Contexte :** Les notes sur les reels sont en localStorage, perdues si on change de navigateur.
**Proposition :** Ajouter colonne `notes TEXT` à `ig_reels` + endpoint PATCH.

---

## T-025 — Follow Ads Classification (Rémy)

### A-025-01 · Followers comme prospects (vision ManyChat-like) ⭐ VISION PROJET MAJEURE
**Priorité :** Haute (V2)
**Contexte :** Identifié pendant T-025. Demande explicite du fondateur — direction stratégique du produit.
**Description :** À terme, les nouveaux followers Instagram doivent être traités comme des prospects à part entière dans le CRM. Ça transforme ClosRM en outil de nurturing automatisé style ManyChat. Le flow visé :
1. **Détection auto** des nouveaux followers Instagram (webhook ou polling toutes les X minutes)
2. **Création d'un lead** dans le CRM avec source `follow_ads_instagram`
3. **Workflow d'automations** déclenché : DM de bienvenue, séquence nurturing, qualification (questions), proposition de RDV
4. **Attribution** : si possible, relier le follower à la campagne Follow Ads qui l'a amené (via timing + heuristique)
5. Le follower entre dans le pipeline standard (Nouveau lead → Setting → Closing → Closé)
**Pourquoi c'est important :** Combine acquisition payante (Follow Ads), nurturing automatisé (DMs Instagram), et closing (CRM) en un seul workflow. C'est la promesse différenciante du produit pour les coachs.
**Dépendances :** Nécessite l'API Instagram avec scope `instagram_basic` + `pages_messaging` + tracking des nouveaux followers (pas d'événement webhook natif, donc polling).
**Proposition :** Créer une nouvelle tâche dédiée qui couvre : détection followers, création leads, intégration au moteur d'automations existant (T-014), attribution heuristique.

### A-025-02 · Seuils de santé configurables par le coach
**Priorité :** Basse
**Contexte :** Identifié pendant T-025 (config UI)
**Description :** Les seuils des indicateurs de santé (CPL, CTR, ROAS, CPM, Coût/clic) sont actuellement codés en dur dans `health-thresholds.ts`. Un coach pourrait vouloir des seuils différents selon sa niche.
**Proposition :** Ajouter une section dans Paramètres > Réglages "Seuils de performance" avec un input par KPI. Stocker en DB par workspace.

### A-025-03 · Attribution followers → campagnes Follow Ads
**Priorité :** Moyenne (V2)
**Contexte :** Identifié pendant T-025 (croissance Instagram)
**Description :** Actuellement on affiche les nouveaux followers Instagram totaux dans la section Follow Ads, sans pouvoir dire quelle campagne a amené quels followers. Meta ne donne pas cette info directement.
**Proposition :** Heuristique temporelle : croiser les pics de followers (snapshot daily) avec les pics de spend des campagnes Follow Ads sur la même période. Permet une attribution approximative mais utile.

### A-025-04 · Différencier `reach` et `impressions` dans Follow Ads
**Priorité :** Basse
**Contexte :** Identifié pendant T-025 (KPI Follow Ads)
**Description :** Actuellement le KPI "Reach" affiche la même valeur que "Impressions" (limitation API actuelle). Meta retourne un champ `reach` distinct mais on ne le requête pas.
**Proposition :** Ajouter `reach` aux fields demandés dans `getInsights()`, ajouter `reach: number` dans `MetaInsightRow` et `BreakdownRow`.

### A-025-05 · Performance Insights IA (recommandations auto)
**Priorité :** Basse (V2)
**Contexte :** Identifié pendant le brainstorming T-025 (couche 3 reportée)
**Description :** Couche IA avec recommandations actionnables : "Ton CPL est à 18€, voici 3 actions pour le baisser". Inspiré des screenshots du benchmark.
**Proposition :** Module séparé "Performance Insights" avec règles métier (heuristiques) ou appel à un LLM. Action steps + expected impact + statut (Action Required / On Track).

### A-028a-01 · BookingBlock → brancher sur le module Calendriers interne (T-022)
**Priorité :** Haute (à faire dès que T-028 est validée)
**Contexte :** Identifié pendant l'audit Phase 1 de T-028a le 2026-04-07.
**Description :** Actuellement `src/components/funnels/blocks/BookingBlock.tsx` est un **simple placeholder visuel** (bordure dashed + emoji 📅 + texte "Booking intégré"). Il ne fait rien, n'est connecté à aucun calendrier, et le champ `calendarId` de la config n'est pas utilisé.
Or ClosRM dispose déjà d'un module Calendrier/Booking interne type Calendly (livré par Pierre en T-022 — voir `tache-022-module-calendrier-booking.md`) avec :
- API `/api/booking-calendars/*` et `/api/bookings/*`
- Page publique `/book/[workspaceSlug]/[calendarSlug]/page.tsx`
- Page paramètres `/parametres/calendriers/[id]/page.tsx`
- Tables `booking_calendars`, `bookings`, `booking_locations`
**Proposition :** Créer une tâche T-0XX dédiée qui :
1. Transforme BookingBlock en vrai composant qui charge un `booking_calendar` du workspace via `config.calendarId`
2. Affiche le widget de créneaux (extrait/réutilisé depuis `app/book/[workspaceSlug]/[calendarSlug]/page.tsx`) directement dans le funnel
3. Crée un `booking` au workspace quand le visiteur réserve, avec attribution `funnel_id` → traçabilité
4. Sync couleurs avec le preset du funnel (primary color du calendrier ← preset)
**Scope T-028a/c (en attendant) :** garder BookingBlock visible dans la palette de blocs mais avec un label "**À venir**" et le rendre non-draggable/non-cliquable. Documenté dans la fiche T-028c.

### A-028a-02 · FormBlock → persister les submissions + créer un lead + redirection
**Priorité :** Haute (à faire dès que T-028 est validée)
**Contexte :** Identifié pendant l'audit Phase 1 de T-028a le 2026-04-07.
**Description :** Actuellement `src/components/funnels/blocks/FormBlock.tsx` (ligne 64) fait un `console.log` sur submit et ne persiste rien. Le champ `config.redirectUrl` est défini dans le type mais jamais utilisé. Le `successMessage` est bien affiché en inline mais pas de redirection réelle.
**Ce qu'est censé faire un FormBlock dans un funnel de coaching :** c'est le **formulaire de candidature** qui vient après la VSL ou en pop-up sur une page d'optin — il collecte prénom/nom/téléphone/email/budget/réponses qualifiantes et crée automatiquement un **lead** dans le CRM avec une source qui permet de tracer d'où il vient (funnel, page). Idéalement il déclenche aussi le trigger `lead_imported` ou équivalent du workflow engine (T-029) pour que l'automation coach se déclenche (WhatsApp de bienvenue, email, etc.).
**Proposition :** Créer une tâche T-0XX dédiée qui :
1. Crée une API route publique `POST /api/public/funnels/[funnelId]/submit` qui prend les champs, crée un `lead` dans le workspace du funnel, triggue le workflow
2. Branche FormBlock sur cette API (fetch au submit, loading state, gestion erreurs)
3. Implémente la redirection `config.redirectUrl` après succès (ou fallback `successMessage`)
4. Tracking : compteurs `funnel_page_views` vs `funnel_form_submissions` pour les stats par funnel
**Scope T-028a/c (en attendant) :** même traitement que BookingBlock — visible dans la palette avec label "**À venir**", non-draggable/non-cliquable.

### A-028a-03 · Design tokens funnels partagés avec le module Email
**Priorité :** Basse (V2)
**Contexte :** Identifié pendant la planification T-028 le 2026-04-07.
**Description :** Les presets de couleurs de T-028a (20 presets) pourraient être réutilisés pour styler les emails transactionnels et les séquences email du module Emails (T-020 — non encore implémenté).
**Proposition :** Quand T-020 sera abordé, prévoir une architecture où les CSS vars `--fnl-*` sont renommées plus génériquement `--brand-*` et exposées aux deux modules (funnels + emails) pour garantir une cohérence de marque à travers toute la communication du coach.

---

*Mis à jour le 2026-04-07 par Claude Code — ClosRM*
