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
- **Statut :** En attente de validation

### A-008 — Import auto des leads Follow Ads via API Instagram
- **Contexte :** Discussion avec Pierre pendant T-007
- **Description :** À terme, les prospects qui follow le compte via une pub seront loggés automatiquement comme leads via l'API Instagram/Meta. Nécessite l'intégration de l'API Instagram Graph pour détecter les nouveaux followers issus des pubs.
- **Priorité estimée :** Moyenne
- **Effort estimé :** Élevé
- **Statut :** En attente de validation

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

*Mis à jour le 2026-04-01 par Claude Code — ClosRM*
