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

### A-028b-01 · Quiz funnel template (template complet)
**Priorité :** Moyenne
**Contexte :** Demandé par Rémy pendant la Phase 12 de T-028 (2026-04-07). Format très en vogue dans le coaching.
**Description :** Funnel sous forme de quiz interactif : le visiteur répond à quelques questions (multi-steps), reçoit un résultat personnalisé, puis une offre adaptée au profil détecté. Excellent taux de capture car il engage activement l'utilisateur au lieu de lui demander passivement son email.
**Proposition :**
1. Créer un nouveau type de bloc `quiz` avec config `{ questions: QuizQuestion[], results: QuizResult[], scoring: 'points' | 'categories' }`
2. Chaque `QuizQuestion` a un label + plusieurs options avec une valeur scorée
3. Le résultat affiché dépend du cumul des scores ou de la catégorie dominante
4. Créer le template `tpl-quiz-funnel` dans `src/lib/funnels/templates.ts` avec une structure : Page 1 quiz (3-5 questions) → Page 2 résultat + offre personnalisée → Page 3 merci
5. Déjà visible comme template "À venir" grisé dans `/acquisition/funnels/new` depuis la Phase 12 (cf. `templates.ts` entrée `tpl-quiz-funnel`)
**Ne pas faire sans validation** : Rémy veut réfléchir au modèle de données quiz et aux variations possibles (skip logic, conditionnelles) avant implémentation.

### A-028b-02 · Webinar funnel template (template complet)
**Priorité :** Moyenne
**Contexte :** Demandé par Rémy pendant la Phase 12 de T-028 (2026-04-07). Format classique des lancements de programmes de coaching.
**Description :** Funnel d'inscription à un webinaire composé de plusieurs pages : inscription + confirmation + replay + vente post-webinar. Permet au coach de capturer des leads qualifiés et de les convertir à la fin du webinar quand l'engagement est maximal.
**Proposition :**
1. Créer le template `tpl-webinar-funnel` dans `src/lib/funnels/templates.ts` avec 4 pages :
   - **Page 1 — Inscription** : Hero + promesse du webinar + formulaire d'inscription + témoignages
   - **Page 2 — Confirmation** : Hero "Tu es inscrit !" + détails date/heure + rappel Google Agenda + texte "vérifie ta boîte mail"
   - **Page 3 — Replay** : Hero "Revoir le webinar" + Video + CTA principal
   - **Page 4 — Vente post-webinar** : Hero offre spéciale + Pricing + FAQ + Countdown (offre limitée) + Testimonials + CTA final
2. Intégration future avec le module Calendriers (T-022) pour créer un événement associé au webinar et envoyer des rappels automatiques aux inscrits
3. Intégration future avec le module Emails (T-020) pour la séquence "rappel J-1", "le webinar commence", "merci + replay disponible"
4. Déjà visible comme template "À venir" grisé dans `/acquisition/funnels/new` depuis la Phase 12 (cf. `templates.ts` entrée `tpl-webinar-funnel`)
**Ne pas faire sans validation** : dépend de T-022 (Calendriers) + T-020 (Emails) pour l'intégration complète. À reprendre une fois les 2 modules en place.

---

### [A-010] ✅ Linktree interne — liens trackables par lead (livré 2026-04-17)
- **Contexte :** Session IA assistant — le coach envoie des lead magnets via DM
- **Description :** Systeme de liens trackables integre dans ClosRM (style Linktree). Chaque contenu a un titre + lien + redirect. On sait quel lead a clique, combien de fois, quel contenu convertit le mieux. Redirect intelligent qui ouvre YouTube/Spotify directement au lieu du browser IG.
- **Priorite estimee :** Moyenne
- **Effort estime :** Eleve

**Proposition :** Table `content_links` (titre, url, short_code, workspace_id), table `content_clicks` (link_id, lead_id, clicked_at, referrer). Route publique `/c/[code]` qui redirige + log le clic. Dashboard analytics par contenu. En V1 simple : utiliser les liens Linktree du coach directement.

### [A-011] Champ contenus en 2 colonnes (titre + lien) dans Assistant IA
- **Contexte :** Session IA assistant — le champ lead magnets est un textarea simple
- **Description :** Remplacer le textarea par une liste structuree : chaque contenu = titre + URL. Affiche en 2 colonnes dans les parametres. L'IA peut citer le titre ET inclure le lien dans le message suggere.
- **Priorite estimee :** Haute
- **Effort estime :** Faible

### [A-012] Trigger comment_keyword + dm_keyword (T-021)
- **Contexte :** Deja dans les types du moteur workflow mais stub non branche
- **Description :** Reponse auto aux commentaires reels/posts contenant un mot-cle → DM automatique. Comme Mochi (delai configurable, 5min recommande).
- **Priorite estimee :** Haute
- **Effort estime :** Moyen

---

### [A-013] Indicateurs personnalises dans la table Ads
- **Contexte :** Le coach veut creer ses propres KPIs comme sur Meta Ads Manager
- **Description :** Builder d'indicateurs custom : nom + formule (2 metriques + operateur) + format (%, €, nombre) + seuils couleur (vert/orange/rouge). Stocke en DB par workspace. Apparait dans le column picker.
- **Priorite estimee :** Moyenne
- **Effort estime :** Eleve

### [A-014] Selecteur de compte publicitaire Meta dans Integrations
- **Contexte :** Si le coach a plusieurs comptes pub Meta, ClosRM prend le premier automatiquement (souvent le mauvais)
- **Description :** Dropdown dans la carte Meta sur la page Integrations pour choisir parmi les comptes pub disponibles. Appelle /api/integrations/meta/switch-ad-account.
- **Priorite estimee :** Haute
- **Effort estime :** Faible

---

## Module Instagram — Partie 2 : Browser Automation (post-validation API Meta)

> **IMPORTANT : Ne pas implémenter avant que les permissions API officielles soient validées par Meta.**
> Une fois l'API officielle approuvée, cette partie peut être développée en parallèle.
> Inspiration directe : Orsay.ai (app.orsay.ai) — SaaS français qui fait exactement ça.

### A-INSTA-01 · Connexion Instagram par identifiants (login + mdp)
**Priorité :** Haute (première brique)
**Contexte :** Orsay demande le mdp Instagram + ville + validation 2FA via notification Instagram. C'est la base de toute l'automation non-API.
**Description :** Permettre au coach de connecter son compte Instagram via login/mdp (en plus de l'OAuth API officielle). Les identifiants sont chiffrés et stockés en DB. La connexion simule un appareil mobile depuis une IP proche de la ville du coach.
**Proposition :**
1. UI dans Paramètres > Intégrations : formulaire login + mdp + ville
2. Backend : chiffrement AES-256 des credentials, stockage dans `ig_accounts` (nouveau champ `encrypted_credentials`)
3. Gestion du 2FA : attente de la validation par notification Instagram (comme Orsay)
4. Session management : stocker les cookies de session pour réutiliser sans re-login

### A-INSTA-02 · Système de warm-up / rodage progressif
**Priorité :** Haute (obligatoire avant toute action)
**Contexte :** Orsay fait ~40 sessions de rodage où les actions augmentent progressivement (follows, likes, messages, unfollows). Sans ça, Instagram détecte le bot et bloque le compte.
**Description :** Système de montée en puissance progressive sur ~40 sessions. Les limites d'actions quotidiennes augmentent graduellement jusqu'à atteindre la capacité maximale (ex: 50 actions/jour).
**Proposition :**
1. Table `ig_warmup_progress` : account_id, sessions_completed, max_sessions, current_limits (JSON), started_at
2. Chaque session augmente les limites : jour 1 = 5 actions, jour 10 = 20 actions, jour 40 = 50 actions
3. UI : barre de progression "Rodage en cours X%" (comme Orsay)
4. Détection automatique des flags Instagram (action blocked) → pause auto + notification coach

### A-INSTA-03 · Lead Finder : scraping de followers concurrents
**Priorité :** Haute
**Contexte :** Orsay analyse les followers de comptes concurrents pour trouver des prospects qualifiés. C'est le cœur de la prospection outbound.
**Description :** Le coach configure 5-10 comptes Instagram concurrents. ClosRM scrape leurs followers, les score (1-5) selon des critères (bio, nombre de followers, activité), et les propose comme leads potentiels.
**Proposition :**
1. UI : liste de comptes concurrents à monitorer (Paramètres ou page dédiée "Lead Finder")
2. Backend : scraping des followers via browser automation (Puppeteer/Playwright headless)
3. Scoring IA : analyser bio, nombre de posts, ratio followers/following, activité récente
4. Table `ig_scraped_leads` : username, full_name, bio, score, source_account, scraped_at
5. Limite : respecter les 50 actions/jour max, scraper en background

### A-INSTA-04 · DM à froid automatisés
**Priorité :** Haute
**Contexte :** Orsay envoie des DM personnalisés aux prospects trouvés par le Lead Finder. C'est l'action qui convertit.
**Description :** Envoyer des DM automatiques aux prospects qualifiés (score élevé). Messages personnalisés avec variables (prénom, bio). Respect des limites quotidiennes.
**Proposition :**
1. Templates de DM avec variables : {{prenom}}, {{bio_extract}}, etc.
2. Séquences de DM : message initial → follow-up J+2 si pas de réponse → follow-up J+5
3. Queue de messages avec respect des limites (50/jour) et horaires de travail configurables
4. Détection de réponse : si le prospect répond, stopper la séquence et notifier le coach
5. Le prospect qui répond est automatiquement créé comme lead dans le pipeline ClosRM

### A-INSTA-05 · Auto-follow / Auto-like
**Priorité :** Moyenne
**Contexte :** Orsay fait des follows et likes automatiques pour augmenter la visibilité et déclencher la curiosité des prospects.
**Description :** Actions automatiques de follow et like sur les posts des prospects ciblés. Inclus dans le quota de 50 actions/jour.
**Proposition :**
1. Auto-follow des prospects scorés 4-5 par le Lead Finder
2. Auto-like du dernier post du prospect avant d'envoyer le DM (augmente le taux de réponse)
3. Auto-unfollow après X jours si pas de follow-back (nettoyage du ratio)
4. Tout passe par la queue d'actions avec limites quotidiennes

### A-INSTA-06 · Déclencheurs de séquences (comme Orsay)
**Priorité :** Moyenne
**Contexte :** Orsay propose des déclencheurs entrants (illimités) et sortants (50/jour) pour lancer des séquences automatiques.
**Description :** Système de triggers qui lance des séquences de messages automatiques.
**Déclencheurs entrants (illimités, via API officielle) :**
- Message reçu (votre compte)
- Réponse à une story (votre compte)
- Commentaire (vos publications)
**Déclencheurs sortants (50/jour, via browser automation) :**
- Nouvel abonné (votre compte) → DM de bienvenue
- Abonnés (autre compte) → DM de prospection
- Nouveaux likes (publication spécifique)
- Commentaires (autre compte)
**Proposition :**
1. Builder de séquences visuel (trigger → action → délai → action)
2. Intégration avec le moteur de workflows existant (T-021/T-029)
3. Distinction claire inbound (API) vs outbound (automation) dans l'UI

### A-INSTA-07 · Agent IA conversationnel pour qualification
**Priorité :** Basse (V2+)
**Contexte :** Orsay a un "Agent" IA qui qualifie les prospects par conversation automatique en DM.
**Description :** Agent IA qui mène la conversation de qualification : pose des questions, évalue les réponses, score le prospect, et propose un RDV si qualifié. Configurable par le coach (ton, questions, objectifs).
**Proposition :**
1. Réutiliser le module Assistant IA existant (T-019) comme base
2. Adapter pour les conversations DM Instagram (messages courts, ton informel)
3. Le coach configure : questions de qualification, critères de scoring, message de prise de RDV
4. L'agent gère la conversation jusqu'à la qualification ou le désengagement
5. Si qualifié → créer le lead dans le pipeline + proposer un lien de booking (T-022)

### Architecture technique recommandée
**Stack browser automation :**
- **Puppeteer ou Playwright** en headless sur un serveur dédié (pas sur Vercel — trop lourd pour serverless)
- **Serveur worker** : un VPS (Hetzner, DigitalOcean) ou un service comme BrowserBase/Browserless qui gère les sessions browser
- **Queue** : Redis + BullMQ pour gérer les actions en file d'attente avec rate limiting
- **Proxy résidentiel** : pour éviter les détections IP (ex: Bright Data, Oxylabs)
- Alternative : utiliser l'**API mobile Instagram** (non documentée mais plus stable que le browser scraping)

**Risques à gérer :**
- Instagram change son UI/détections régulièrement → maintenance continue
- Proxies résidentiels = coût (~$10-20/mois par compte)
- Si Instagram bloque un compte coach, c'est notre responsabilité
- Stocker des mots de passe = responsabilité sécurité élevée (chiffrement AES-256 + audit)

---

### [A-015] Import Excel (.xlsx) en plus du CSV
- **Contexte :** T-031 — beaucoup de coachs utilisent Excel, évite l'étape "Enregistrer sous CSV"
- **Description :** Ajouter le support .xlsx via SheetJS (lib `xlsx`). Même wizard, juste un parser additionnel côté client.
- **Priorité estimée :** Moyenne
- **Effort estimé :** Faible
- **Statut :** En attente de validation

### [A-016] Import Google Contacts via People API
- **Contexte :** T-031 — alternative au CSV pour les coachs peu techniques
- **Description :** OAuth Google → import direct via People API. Le coach connecte une fois et synchronise.
- **Priorité estimée :** Moyenne
- **Effort estimé :** Élevé (OAuth + People API)
- **Statut :** En attente de validation

### [A-017] Normalisation phone avancée (libphonenumber-js)
- **Contexte :** T-031 — la dédup par téléphone ne gère que le nettoyage basique (chiffres + +)
- **Description :** Installer libphonenumber-js pour normaliser les numéros internationaux avant comparaison. Utile si les coachs importent des leads de différents pays.
- **Priorité estimée :** Basse
- **Effort estimé :** Faible
- **Statut :** En attente de validation

### [A-018] Background job pour imports > 5000 leads
- **Contexte :** T-031 — la V1 limite à 5000 leads avec processing inline
- **Description :** Utiliser Vercel Queue ou QStash pour traiter les gros imports en arrière-plan. Permettrait de monter à 50k+ leads.
- **Priorité estimée :** Basse
- **Effort estimé :** Moyen
- **Statut :** En attente de validation

### [A-019] Wizard DNS email : UX à améliorer
- **Contexte :** Session 2026-04-22 — setup domaine pierre-coaching.fr
- **Description :** L'étape 4 "Vérification" liste les records (type + nom) sans afficher la valeur cible. Pour un coach non-technique, pas clair ce qu'il doit copier dans sa zone DNS. Pistes : (1) afficher la valeur directement sous le nom, (2) bouton "Copier" par record sur cette étape, (3) détection/warning des anciens DKIM obsolètes à supprimer, (4) tooltip OVH/Cloudflare/Gandi expliquant "sous-domaine = @" pour la racine, (5) distinction visuelle "nouveaux à ajouter" vs "déjà existants à garder".
- **Priorité estimée :** Moyenne (bloque l'onboarding des coachs non-techniques)
- **Effort estimé :** Moyen
- **Statut :** En attente de validation

### [A-020] Broadcast : ciblage par tag ou lead spécifique
- **Contexte :** Session 2026-04-21 — impossible de cibler 2 leads précis pour un test SES
- **Description :** L'UI de broadcast actuel ne permet de filtrer que par date/source/tag/statut, mais pas de sélectionner des leads spécifiques. Ajouter un multi-select ou un filtre "tag = X" qui fonctionne (actuellement non dispo dans l'UI). Critique pour tester sans risquer d'envoyer à toute la base.
- **Priorité estimée :** Haute
- **Effort estimé :** Moyen
- **Statut :** En attente de validation

### [A-022] Messages : bouton "Nouvelle conversation"
- **Contexte :** Session 2026-04-22 — user ne peut pas démarrer un email sans avoir reçu de réponse d'abord
- **Description :** L'UI `/messages` (onglet Email) n'affiche pas de bouton pour composer un nouvel email vers un lead. On ne peut que répondre à une conversation existante. Ajouter un bouton "Nouveau message" qui ouvre un modal : sélection lead → sujet → corps → envoi via `/api/emails/messages` avec création de conversation si absente.
- **Priorité estimée :** Haute (bloque un usage basique)
- **Effort estimé :** Moyen

### [A-023] Broadcasts : email libre sans template obligatoire
- **Contexte :** Session 2026-04-22 — user veut envoyer un email ponctuel sans créer de template
- **Description :** Actuellement `/acquisition/emails` → Campagnes exige de sélectionner un template. Ajouter une option "Email libre" qui permet de composer directement sujet + HTML/markdown sans passer par le workflow template. Ou bien une modale "quick send" qui crée un template éphémère automatiquement.
- **Priorité estimée :** Moyenne
- **Effort estimé :** Faible (le backend accepte déjà tout via email_broadcasts.subject + template.blocks)

### [A-021] Hardening webhook SNS — signature cryptographique
- **Contexte :** Session 2026-04-21 — ajout d'un filtre TopicArn (commit e17bb7f)
- **Description :** Implémenter la vérif de signature SNS complète (fetch SigningCertURL + verify RSA-SHA1/256 sur les champs canonicalisés) via `sns-validator` npm. Le filtre TopicArn actuel est un palliatif.
- **Priorité estimée :** Basse
- **Effort estimé :** Faible (1-2h)
- **Statut :** En attente de validation

### A-034-01 · `prepared.status` non trimmé dans `validateRow` (import-engine)
- **Contexte :** Identifié pendant la review de T-034. À la ligne `status: row.status || config.default_status` de la construction de `prepared`, aucune normalisation de whitespace n'est appliquée.
- **Description :** Si un CSV a une valeur de statut avec des espaces (ex: `"  clos  "`) et que l'utilisateur ne la mappe pas explicitement via l'UI, la vérification d'enum de fallback échoue silencieusement et le lead tombe sur `default_status`. Fix proposé : `status: (row.status || '').trim() || config.default_status`. Pre-existing (pas introduit par T-034).
- **Priorité estimée :** Basse (peu probable en pratique : l'UI trim déjà via `extractUniqueStatusValues`)
- **Effort estimé :** Faible (1 ligne)
- **Statut :** En attente de validation

### A-034-02 · Synonymes supplémentaires dans `STATUS_SYNONYMS` (csv-parser)
- **Contexte :** Suggéré pendant la review de T-034. Termes courants qui retournent `null` (pas de suggestion) alors qu'ils sont fréquents dans les CSV de coachs FR.
- **Description :** Ajouter comme synonymes exacts :
  - `scripte` : `relance`, `à relancer`, `rappel`, `suivi`
  - `setting_planifie` : `rdv confirmé`, `appel planifié`
  - `no_show_setting` : `injoignable`, `pas répondu`, `messagerie`
  - `dead` : `pas intéressé`, `sans suite`, `inactif`
  - `clos` : `client`, `payé`, `inscrit`
- **Priorité estimée :** Basse
- **Effort estimé :** Faible (additions dans un objet)
- **Statut :** En attente de validation

### A-034-03 · `STATUS_OPTIONS` incomplet dans Step2_MappingConfig (import wizard)
- **Contexte :** Identifié pendant la review de T-034 mais pre-existing. Le dropdown "Statut par défaut" de l'étape 2 d'import liste seulement 5 statuts (`nouveau`, `setting_planifie`, `closing_planifie`, `clos`, `dead`). `scripte`, `no_show_setting`, `no_show_closing` sont absents.
- **Description :** `scripte` est un default valide pour certains coachs (après contact initial). Les `no_show_*` sont exotiques comme defaults mais devraient être cohérents avec l'enum. Décider si on les ajoute ou si on documente le choix.
- **Priorité estimée :** Basse
- **Effort estimé :** Faible
- **Statut :** En attente de validation

### A-034-04 · Message d'aide si aucune valeur de statut n'est auto-reconnue
- **Contexte :** Suggéré pendant la review de T-034. Si l'utilisateur mappe une colonne statut et que toutes les valeurs retournent `null` de `suggestStatusMapping`, le `StatusValueMapper` affiche toutes les lignes en rouge (⚠ à régler) sans texte explicatif. Le bouton Continuer est désactivé et l'utilisateur peut être perdu.
- **Description :** Ajouter une ligne d'aide sous le header quand `unresolvedCount === uniqueValues.length` : « Aucune valeur n'a pu être reconnue automatiquement. Mappez-les manuellement. »
- **Priorité estimée :** Basse
- **Effort estimé :** Faible (1 bloc conditionnel dans StatusValueMapper)
- **Statut :** En attente de validation

### A-035-01 · Factoriser `StatusValueMapper` + `SourceValueMapper` en composant générique
- **Contexte :** Identifié pendant T-035. Les deux composants sont ~99 % identiques (encodeAction/decodeAction, useMemo unresolvedCount, UI table, styles inline). Duplication volontaire pour ne pas toucher T-034 fraîchement mergé.
- **Description :** Créer un composant générique `<ValueMapper<T extends string> />` paramétré par : labels map, ordered keys, action type discriminator (`'status'` | `'source'`). Remplacer les deux composants par le générique. Garder le pattern `encodeAction`/`decodeAction` interne. Ajouter aussi `aria-label` sur les icônes du résultat (lacune détectée pendant la review de T-034 et T-035).
- **Priorité estimée :** Basse
- **Effort estimé :** Moyen (~2-3h incluant re-test manuel des deux mappers)
- **Statut :** En attente de validation

### A-035-05 · Trim whitespace sur `prepared.source` dans `validateRow` (import-engine)
- **Contexte :** Identifié pendant la review de T-035, parallèle exact à A-034-01 pour `prepared.status`.
- **Description :** À la ligne `source: row.source || config.default_source || 'manuel'` de la construction de `prepared`, aucune normalisation de whitespace n'est appliquée. Si le CSV contient `" funnel"` (avec espace), `rawSource.trim()` dans le mapping donne `"funnel"` qui ne match pas la clé du `source_value_mapping` (également trimmée), donc fallback enum. Mais `prepared.source = " funnel"` fait aussi échouer l'enum check → bascule sur `default_source` ou erreur. Pre-existing (pas introduit par T-035).
- **Description fix :** `source: (row.source || '').trim() || config.default_source || 'manuel'`. Symétriser avec le fix proposé en A-034-01 (même pattern, lignes adjacentes).
- **Priorité estimée :** Basse (l'UI trim déjà via `extractUniqueSourceValues`)
- **Effort estimé :** Faible (1 ligne, couplée à A-034-01)
- **Statut :** En attente de validation

### A-035-02 · Durcissement des synonymes courts dans `SOURCE_SYNONYMS` (csv-parser)
- **Contexte :** Identifié pendant la review de T-035. `'direct'` (6) dans `manuel` et `'import'` (6) dans `manuel` peuvent produire des faux positifs Pass 2 pour des valeurs CSV comme "director", "directement", "imports". Risque faible en pratique mais cohérent avec la philosophie conservatrice.
- **Description :** Remplacer `'direct'` par `'direct contact'` ou `'direct mail'`, et `'import'` par `'import csv'` / `'import manuel'`. Garde l'intent de match sémantique tout en réduisant le risque de substring.
- **Priorité estimée :** Basse
- **Effort estimé :** Faible (quelques lignes)
- **Statut :** En attente de validation

### A-035-03 · Synonymes FR "pub"/"publicité" pour les sources ads
- **Contexte :** Identifié pendant la review de T-035. Les coachs FR utilisent "pub" comme raccourci standard de "publicité", pas "ads". Valeurs CSV comme "Pub Facebook", "Publicité Meta", "Pub Insta" retournent actuellement `null`.
- **Description :** Ajouter comme synonymes exacts :
  - `facebook_ads` : `pub facebook`, `publicité facebook`, `pub fb`, `pub meta`, `publicité meta`, `annonce facebook`
  - `instagram_ads` : `pub instagram`, `publicité instagram`, `pub insta`, `pub ig`
- **Priorité estimée :** Moyenne (touche directement les coachs FR, audience cible)
- **Effort estimé :** Faible (additions dans l'objet)
- **Statut :** En attente de validation

### A-035-04 · Synonymes FR complémentaires pour `formulaire` et `manuel`
- **Contexte :** Identifié pendant la review de T-035. Termes français plausibles qui retournent null.
- **Description :** Ajouter :
  - `formulaire` : `formulaire de contact`, `formulaire candidature`, `site web`, `site internet`
  - `manuel` : `réseau`, `réseau social`, `partenariat`
- **Priorité estimée :** Basse
- **Effort estimé :** Faible
- **Statut :** En attente de validation

---

### A-042-01 · Logo image custom uploadé par coach pour l'email
- **Contexte :** Identifié pendant T-042. Aujourd'hui le header de l'email premium affiche l'initiale du brand dans un carré coloré. Pour des coachs avec une vraie identité visuelle, un logo image rendrait l'email beaucoup plus pro.
- **Description :** Ajouter un champ `email_logo_url` à `booking_calendars` (ou au workspace), permettre l'upload via Supabase Storage, et l'afficher en `<img>` dans le header en remplacement de l'initiale.
- **Priorité estimée :** Moyenne
- **Effort estimé :** Moyen (upload + storage + UI + template)
- **Statut :** En attente de validation

### A-042-02 · Tracking delivery réel via SNS bounces/complaints AWS
- **Contexte :** Identifié pendant T-042. Aujourd'hui dans l'historique, "Envoyé" = SES a accepté l'email pour livraison, mais on ne sait pas s'il est arrivé en boîte (vs bounce/spam). Un coach pourrait voir "envoyé" alors que le prospect n'a rien reçu.
- **Description :** Brancher le webhook SNS bounce/complaint AWS (déjà code dans `src/lib/email/sns-verify.ts`) sur `booking_reminders` pour update le status réel : `delivered` / `bounced` / `complained`.
- **Priorité estimée :** Haute (impact visible sur fiabilité perçue)
- **Effort estimé :** Moyen (webhook handler + UI status + migration enum)
- **Statut :** En attente de validation

### A-042-03 · Timezone par workspace au lieu d'Europe/Paris hardcodé
- **Contexte :** Identifié pendant T-042. `formatBookingDateFR/TimeFR` hardcode `Europe/Paris`. Si Rémy onboard un coach dans une autre TZ (Belgique, Suisse, Canada FR…), les heures dans les emails seront fausses.
- **Description :** Ajouter `timezone` à la table `workspaces` (default `Europe/Paris`), passer le tz du workspace aux helpers de formatage.
- **Priorité estimée :** Basse (90% des coachs FR sont en France métropolitaine)
- **Effort estimé :** Faible (migration + propagation aux call sites)
- **Statut :** En attente de validation

### A-042-04 · Reschedule "linké" en un seul flow
- **Contexte :** Identifié pendant T-042. Aujourd'hui sur `/booking/manage/[id]`, "Reprogrammer" envoie le prospect sur le calendrier public — il crée donc un NOUVEAU booking, et l'ancien reste actif (sauf s'il clique manuellement sur "Annuler" avant). Risque : doublon visible côté coach jusqu'à ce qu'il nettoie.
- **Description :** Sur le clic "Reprogrammer", auto-cancel l'ancien booking avant le redirect (et passer un flag dans l'URL pour pré-remplir le prospect), OU une fois le nouveau booking créé, lier les deux et cancel l'ancien automatiquement.
- **Priorité estimée :** Moyenne (UX un peu confuse sinon)
- **Effort estimé :** Faible-moyen
- **Statut :** En attente de validation

### A-042-05 · Cleanup section 6 commentée du workflow-scheduler
- **Contexte :** Identifié pendant T-042. La section 6 (booking reminders) du workflow-scheduler a été déléguée à `/api/cron/booking-reminders`. Le code est resté commenté en bloc dans `workflow-scheduler/route.ts` au lieu d'être supprimé. Dette technique mineure.
- **Description :** Supprimer le bloc commenté ~218 lignes dans `src/app/api/cron/workflow-scheduler/route.ts` lignes 338-556 + nettoyer les imports devenus inutiles (`buildBookingConfirmationHtml`, certains date-fns).
- **Priorité estimée :** Basse
- **Effort estimé :** Faible
- **Statut :** En attente de validation

---

## Améliorations identifiées session T-043 (2026-05-03 → 04)

### A-043-01 · Pipeline previous + close rate previous (Dashboard v2)
- **Contexte :** Sur le dashboard v2, KPIs Pipeline et Close rate ont `previous = 0` et `delta_pct = null` (pas de calcul historique). Le delta vs N-1 affiche "—" pour ces 2 cards.
- **Description :** Pour close rate, calculer la même formule sur la période précédente. Pour pipeline, snapshot du pipeline à la date T-period (table `pipeline_snapshots` ou query historique sur deals).
- **Priorité :** Moyenne
- **Effort :** Moyen
- **Statut :** En attente de validation

### A-043-02 · Cost per booking (Dashboard v2)
- **Contexte :** Card "Coût par RDV" toujours `null`. Nécessite jointure entre Meta Ads spend et bookings de la période.
- **Description :** Si Meta Ads connecté, agréger `ads_spend` de la période / `count(bookings)` → coût par RDV.
- **Priorité :** Moyenne
- **Effort :** Faible (data déjà dispo)
- **Statut :** En attente de validation

### A-043-03 · Sparkline show rate + close rate
- **Contexte :** Show rate et close rate ont `sparkline: []` vide.
- **Description :** Étendre `fetchKpisV2` pour calculer les sparklines 14j sur ces 2 KPIs.
- **Priorité :** Faible (polish)
- **Effort :** Faible
- **Statut :** En attente de validation

### A-043-04 · Show rate / close rate par closer (dashboard équipe)
- **Contexte :** Identifié vs iClosed. `/api/finance/team` retourne deals_as_closer + revenue_closed mais pas show rate ni close rate par membre.
- **Description :** Étendre la query équipe pour calculer `show_rate` et `close_rate` par membre.
- **Priorité :** Moyenne
- **Effort :** Faible
- **Statut :** En attente de validation

### A-043-05 · Logique conditionnelle dans formulaire booking
- **Contexte :** iClosed a des forms de qualification avec branching (si "budget < 5k€" → skip + tag disqualifié). ClosRM = FormFieldsEditor linéaire.
- **Description :** Ajouter `show_if` à `FormField` (ex `{ field: 'budget', op: 'gte', value: 5000 }`).
- **Priorité :** Moyenne (différenciateur)
- **Effort :** Moyen
- **Statut :** En attente de validation

### A-043-06 · NEXT_PUBLIC_APP_URL côté Vercel
- **Contexte :** Env var Vercel prod = `https://closrm.vercel.app`. Les emails (manage URL, unsubscribe) utilisent cette URL au lieu de `closrm.fr`.
- **Description :** Pierre doit changer manuellement la variable Vercel `NEXT_PUBLIC_APP_URL` à `https://closrm.fr` (mon CLI Vercel est linké sur un autre projet).
- **Priorité :** Haute (impact pro des emails sortants)
- **Effort :** 30 secondes côté Pierre
- **Statut :** Action utilisateur requise

### A-043-07 · Historique des envois email global (pas que reminders)
- **Contexte :** Sur page calendrier, "Historique des envois" affiche uniquement les `booking_reminders`. Les emails de confirmation (sent à la création) ne sont pas listés.
- **Description :** Étendre la query pour UNIONer avec `email_sends` filtrés par `source = 'booking_confirmation'` joints au calendar via lead → bookings → calendar_id.
- **Priorité :** Moyenne
- **Effort :** Moyen (jointure complexe)
- **Statut :** En attente de validation

### A-043-08 · Resize RDV sur DayView agenda
- **Contexte :** PR #349 ajout du resize sur WeekView. DayView n'a pas reçu le même traitement.
- **Description :** Porter la logique resize de WeekView dans DayView.
- **Priorité :** Faible
- **Effort :** Faible
- **Statut :** En attente de validation

### A-043-09 · Background AI agents pour leads (Dashboard v2 V2)
- **Contexte :** Identifié pendant analyse concurrentielle (Attio/Clay). Dashboard v2 surface des leads à risque/chauds par algo seul.
- **Description :** Job nocturne IA qui enrichit les leads (research/score) et surface "X leads enrichis pendant la nuit, 3 high-fit".
- **Priorité :** Faible (gros chantier V2)
- **Effort :** Élevé
- **Statut :** En attente de validation

### A-043-10 · Show-rate optimization (confirmation interactive)
- **Contexte :** Identifié vs iClosed. Aujourd'hui rappels = message simple. iClosed envoie "are you still coming?" avec bouton confirmer/reprogrammer (réduit no-shows ~40%).
- **Description :** Reminders interactifs avec bouton confirmer / reprogrammer en 1 clic depuis SMS/email.
- **Priorité :** Haute (impact direct revenue)
- **Effort :** Moyen-élevé
- **Statut :** En attente de validation

### A-043-11 · Paiement à la réservation (deposit Stripe)
- **Contexte :** iClosed permet de bloquer un créneau avec un dépôt Stripe (réduit no-shows ~40%).
- **Description :** Option "Demander un dépôt de XX€" sur calendrier → checkout Stripe avant confirmation booking.
- **Priorité :** Haute pour coachs premium
- **Effort :** Élevé (Stripe Connect par workspace + UI)
- **Statut :** En attente de validation

### A-043-12 · A/B testing pages de réservation
- **Contexte :** iClosed permet plusieurs variantes d'une page de booking. ClosRM = 1 page par calendrier.
- **Description :** Variantes A/B avec tracking conversion par variante.
- **Priorité :** Faible
- **Effort :** Élevé
- **Statut :** En attente de validation

---

*Mis a jour le 2026-05-04 par Claude Code — ClosRM*
