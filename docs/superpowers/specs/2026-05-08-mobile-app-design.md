# Spec — Application Mobile ClosRM (React Native)

> Date : 2026-05-08
> Auteur : Rémy (réflexion/validation) + Claude Code
> Implémentation : Pierre (principal) + Rémy (ponctuel)

---

## 1. Vision

Application mobile React Native pour ClosRM, permettant aux coachs de gérer leur pipeline de vente en mobilité : consulter et agir sur les leads, suivre les calls du jour, communiquer avec les prospects via DM, recevoir des notifications push en temps réel, et visualiser les KPIs.

L'app mobile réutilise la même base de données Supabase et les mêmes API routes que l'app web existante.

---

## 2. Scope

### In scope (9 écrans)

| # | Écran | Description |
|---|-------|-------------|
| 1 | Leads List | 3 vues : flat, groupé par statut, priorité/à traiter |
| 2 | Lead Detail | Vue actions-first + KPIs (variante B uniquement) |
| 3 | Calls Day | Agenda du jour avec day strip + KPI summary |
| 4 | Call Detail | Countdown + contexte + objectif + notes pré-call |
| 5 | Schedule Sheet | Bottom sheet modal global pour planifier un call |
| 6 | Inbox | Messagerie unifiée (Instagram DM, SMS, Email) |
| 7 | Conversation | Thread DM avec contexte lead |
| 8 | Notifications | Feed d'activité temps réel groupé par jour |
| 9 | Pulse Dashboard | KPIs, funnel, team leaderboard, heatmap |

### Out scope

- **Call Live** (transcription temps réel, WebRTC, enregistrement)
- **Toutes les features IA** (briefs, suggestions, prep cards, réponses suggérées)
- **Funnels / Lead Magnets** (gestion depuis le web uniquement)
- **Automations / Workflows** (configuration depuis le web uniquement)
- **Emails** (broadcasts, séquences — depuis le web uniquement)
- **Paramètres avancés** (intégrations, réglages — depuis le web uniquement)

---

## 3. Stack technique

| Couche | Choix | Justification |
|--------|-------|---------------|
| Framework | React Native CLI (PAS Expo) | Contrôle natif complet |
| Navigation | React Navigation | Bottom Tab + Stack, standard RN |
| UI / Styling | NativeWind (Tailwind pour RN) | Cohérence avec le web (Tailwind), productivité |
| Composants | Custom, from scratch | Design system très spécifique aux maquettes |
| Auth | Supabase Auth + SecureStore | Même compte que le web, token stocké nativement |
| Lectures données | @supabase/supabase-js direct | Queries + subscriptions temps réel |
| Écritures données | API routes Next.js existantes | Logique métier côté serveur préservée |
| Push notifications | APNs (iOS) + FCM (Android) | react-native-push-notification |
| Charts / SVG | react-native-svg | Sparklines, funnel, heatmap — pas de lib lourde |
| Bottom sheet | @gorhom/bottom-sheet | Standard pour les modales RN |
| Plateformes | iOS + Android | Tests prioritaires sur iOS |

---

## 4. Architecture repo

Mono-repo dans le repo `closrm` existant :

```
closrm/
├── src/                          ← app web Next.js (INCHANGÉE)
├── mobile/
│   ├── android/
│   ├── ios/
│   ├── src/
│   │   ├── app/
│   │   │   ├── auth/             ← LoginScreen
│   │   │   ├── leads/            ← LeadsListScreen, LeadDetailScreen
│   │   │   ├── calls/            ← CallsDayScreen, CallDetailScreen
│   │   │   ├── messages/         ← InboxScreen, ConversationScreen
│   │   │   ├── pulse/            ← PulseScreen
│   │   │   └── more/             ← MoreMenuScreen, NotificationsScreen
│   │   ├── components/
│   │   │   ├── ui/               ← Avatar, Badge, Button, Card, etc.
│   │   │   ├── leads/            ← LeadCard, LeadRow
│   │   │   ├── calls/            ← CallSlot, DayStrip
│   │   │   └── layout/           ← TabBar, NavLarge, SearchField, FAB
│   │   ├── navigation/           ← navigators config
│   │   ├── hooks/                ← useLeads, useCalls, useAuth, etc.
│   │   ├── services/             ← supabase client, api client, push service
│   │   ├── theme/                ← tokens, tailwind config
│   │   └── utils/
│   ├── tailwind.config.js
│   ├── package.json
│   └── tsconfig.json
├── shared/
│   ├── types/                    ← extraits de src/types/index.ts
│   └── validations/              ← schémas Zod partagés
├── supabase/
└── CLAUDE.md
```

Le dossier `shared/` est importé par les deux apps via des chemins relatifs. Pas de Turborepo ni de workspaces npm.

---

## 5. Navigation

```
BottomTabNavigator (5 onglets)
├── Tab "Leads"     → LeadsStack
│   ├── LeadsListScreen
│   └── LeadDetailScreen
│
├── Tab "Calls"     → CallsStack
│   ├── CallsDayScreen
│   └── CallDetailScreen
│
├── Tab "Messages"  → MessagesStack
│   ├── InboxScreen
│   └── ConversationScreen
│
├── Tab "Pulse"     → PulseScreen (écran unique, pas de stack)
│
└── Tab "More"      → MoreStack
    ├── MoreMenuScreen
    └── NotificationsScreen
```

**ScheduleSheet** : composant global `@gorhom/bottom-sheet`, accessible depuis n'importe quel écran (leads, calls, notifications). Monté au niveau du root navigator.

**Tab bar** : icônes + labels, tab active en vert `#00C853`. Badges sur Messages (count non-lus) et Pulse (dot optionnel).

---

## 6. Design System

### 6.1 Tokens (theme)

Basés sur les maquettes `00-design-system.jsx` et `tokens.js`.

#### Couleurs

| Token | Hex | Usage |
|-------|-----|-------|
| bgPrimary | `#09090b` | Fond principal |
| bgSecondary | `#0c0c0e` | Fond search, inputs |
| bgElevated | `#141414` | Cards, surfaces élevées |
| sheet | `#1c1c1e` | Bottom sheets |
| border | `#262626` | Bordures, dividers |
| primary | `#00C853` | Actions principales, CTA, tab active |
| warning | `#f59e0b` | No-shows, en attente |
| danger | `#ef4444` | Dead, erreurs, supprimer |
| info | `#3b82f6` | Setting, liens |
| purple | `#a855f7` | Closing |
| cyan | `#06b6d4` | Scripté |
| pink | `#ec4899` | Instagram, DM |
| orange | `#f97316` | No-show closing, reprogrammé |
| textPrimary | `#FFFFFF` | Texte principal |
| textSecondary | `#A0A0A0` | Texte secondaire, timestamps |

> Note : le primary mobile est `#00C853` (vert), différent du web `#E53E3E` (rouge). Choix de design volontaire.

#### Typographie

Utilise la font système (SF Pro sur iOS, Roboto sur Android).

| Style | Taille | Weight |
|-------|--------|--------|
| largeTitle | 28px | Bold |
| title | 22px | Bold |
| headline | 17px | Semibold |
| body | 15px | Regular |
| subheadline | 13px | Regular |
| caption | 11px | Regular |

#### Spacing

| Token | Valeur |
|-------|--------|
| xs | 4px |
| sm | 8px |
| md | 12px |
| lg | 16px |
| xl | 20px |
| xxl | 24px |

#### Border Radius

| Token | Valeur |
|-------|--------|
| xs | 6px |
| sm | 8px |
| md | 10px |
| lg | 14px |
| xl | 20px |
| sheet | 28px |
| pill | 999px |

### 6.2 Composants UI réutilisables

| Composant | Props clés | Description |
|-----------|-----------|-------------|
| Avatar | size (26-76), name, online? | Initiales, couleur dérivée du nom (8 teintes), dot online |
| StatusBadge | status, size (sm/md) | 8 statuts lead : nouveau (gris), scripté (cyan), setting_planifié (bleu), no_show_setting (amber), closing_planifié (purple), no_show_closing (orange), closé (vert), dead (rouge) |
| SourceBadge | source, size (sm/md) | 6 sources : manuel, facebook_ads, instagram_ads, follow_ads, formulaire, funnel |
| Button | variant (primary/outline/ghost/danger), icon?, size | Bouton standard |
| Card | borderColor?, borderPosition (left/top)? | Surface bgElevated, border, radius lg |
| SearchField | placeholder, onChangeText | Input avec icône search |
| Segmented | items [{label, count?}], activeIndex | Tabs segmentées |
| FilterChips | items [{label, count?}], activeIndex | Scroll horizontal, pills |
| NavLarge | title, subtitle?, rightIcons? | Header sticky grand titre |
| NavIcon | icon, onPress | Bouton cercle 36x36 |
| FAB | icon, onPress | Floating 56px, vert, shadow |
| TabBar | — | 5 onglets, badges, géré par React Navigation |
| Divider | — | Ligne border avec padding |
| ConvRow | avatar, name, lastMessage, channel, unread?, badge? | Row de conversation inbox |
| NotifRow | icon, iconColor, title, subtitle, cta?, unread? | Row de notification |
| CallSlot | call, lead, isNext? | Slot d'appel dans l'agenda |
| LeadCard | lead, variant (dense/large), onSwipeLeft?, onSwipeRight? | Card lead avec swipe actions |
| DayStrip | days[], selectedIndex, onSelect | Bande de jours scrollable |
| KpiCard | label, value, detail?, trend?, borderColor | Mini card KPI |

---

## 7. Écrans — Spécifications détaillées

### 7.1 Leads List

**3 vues switchables** via un contrôle dans le header.

#### Vue Flat (défaut)
- NavLarge "Leads" + subtitle count
- SearchField "Rechercher un lead, un tag..."
- Segmented : Actifs | Mes leads | Archivés (avec counts)
- FilterChips scrollables : Tous, Closing, Setting, Nouveaux, No-show, VIP
- FlatList de LeadCard (variant dense) :
  - Avatar (40px) + Nom + StatusBadge + SourceBadge
  - Dernier contact + tentatives + montant deal (droite)
  - Swipe gauche → Reply/Relancer (bleu)
  - Swipe droite → Archive (gris)
- FAB vert "+" (ajout lead manuel)
- Pull-to-refresh

#### Vue Groupée
- Sections collapsibles par statut pipeline
- Header section : dot couleur + label + count + chevron
- Cards avec bordure gauche épaisse (couleur statut)
- Groupes "chauds" ouverts par défaut (Closing, Setting, Nouveau)

#### Vue Priorité ("À traiter")
- Hint : "Tri intelligent : urgence × température × valeur"
- Cards grandes avec bande couleur haut (4px)
- Badges urgence : "Dans 23 min" (vert pulsant), "En retard" (amber), "Demain 16h" (gris)
- CTA primaire par card (couleur dynamique)
- Score affiché si >= 80

**Données :** Supabase direct `leads` avec filtres. Subscription temps réel nouveaux leads.
**Écriture :** `POST /api/leads` (création), `PATCH /api/leads/[id]` (archivage, changement statut).

---

### 7.2 Lead Detail (Actions-first + KPIs)

Vue unique, pas de tabs.

**Header :** Retour + menu more

**Hero :**
- Avatar XXL (76px) centré
- Nom centré
- StatusBadge + SourceBadge

**KPI Grid (3 colonnes) :**
- Deal : montant + label (ex: "pack premium")
- Tentatives : count + "jointe"/"pas jointe"
- Score : valeur + label (ex: "lead chaud")

**CTA Hero :** Bouton vert pleine largeur + shadow. Texte dynamique : "Rejoindre le closing · 14h30" / "Planifier un setting" / etc.

**Quick Actions (grille 2x2) :**
- Appeler (tap to call natif)
- DM Insta (ouvre Conversation ou deep link Instagram)
- Email
- Reprogrammer (ouvre ScheduleSheet)

**Section Infos :** Rows — Téléphone, Email, Instagram, Source, Assigné à

**Section Tags :** Pills + bouton "ajouter" dashed

**Timeline (scroll bas de page) :** Events chronologiques (calls, statuts, messages, workflows). Icône couleur + titre + détail + timestamp. Connecteur vertical.

**Données :** Supabase direct — `leads` + `calls` + `deals` + events. Subscription sur le lead.
**Écriture :** API routes pour update lead, créer note, modifier tags.

---

### 7.3 Calls Day (Agenda)

**Header :** NavLarge "Calls" + Segmented Liste | Timeline

**Day Strip :** 7 jours scrollables, dots pour count calls, jour sélectionné = vert

**KPI Summary (3 cards) :** PLANIFIÉS (count) | FAITS (count) | CLOSED (montant €, fond vert)

**Call Slots (FlatList) :**
- Gutter : heure + durée
- Card avec bordure gauche colorée (closing=purple, setting=bleu, reprog=orange)
- Label type + badge "LIVE DANS X MIN" si prochain call (dot pulsant)
- Avatar + nom lead + closer/setter + montant/statut
- Bouton "Préparer" si imminent
- Opacité 0.55 si done/no-show
- Divider "FIN DE JOURNÉE · 18h30"

**Données :** Supabase direct `calls` filtré par date + join `leads`. Subscription temps réel.

---

### 7.4 Call Detail

**Countdown Hero :**
- Dot pulsant + "CLOSING · DANS X MIN"
- Avatar (56px) + Nom lead
- Date/heure : "mar. 7 mai · 14h30 · 30 min"
- Bouton "Rejoindre Zoom" (vert, large) + bouton téléphone

**Contexte clé :** Card bordure verte, bullet points construits côté client à partir des données du lead : statut actuel, montant deal, nombre de tentatives d'appel, dernier contact, tags. Pas d'IA.

**Objectif du call :** Card bordure purple. Contenu basé sur le type de call : si closing → "Closer le deal de X €", "Répondre aux objections", "Valider le mode de paiement" ; si setting → "Qualifier le lead", "Présenter l'offre", "Planifier le closing". Templates statiques adaptés au type.

**Notes pré-call :** Textbox dashed border, sauvegarde temps réel.

**Données :** Supabase direct `calls` + `leads` + `deals`.
**Écriture :** `PATCH /api/calls/[id]` pour notes et statut.

---

### 7.5 Schedule Sheet (composant global)

Bottom sheet modal `@gorhom/bottom-sheet`, monté au root.

**Contenu :**
- Grabber + "Planifier un call" + close
- Lead chip : Avatar + Nom + StatusBadge + "Changer"
- Segmented type : Setting | Closing | Follow-up
- Day picker : 7 pills scrollables + count calls/jour, sélection = vert
- Time picker :
  - Deux selects : Heures (08-19) + Minutes (0, 15, 30, 45)
  - Bande agenda visuelle 8h-19h (blocs occupés rouge, curseur vert, pills suggestions)
  - Détection de conflits : "Libre · 14h30" ou "Conflit · 14h30" (rouge)
- Toggle "Envoyer l'invitation" (SMS + DM Instagram)
- Boutons : "Annuler" (outline) | "Planifier · date · heure" (vert)

**Données :** Supabase `calls` + `bookings` du jour pour conflits.
**Écriture :** `POST /api/calls` + optionnel `POST /api/bookings`.

---

### 7.6 Inbox (messagerie unifiée)

**Header :** NavLarge "Inbox" + subtitle "X non lus · Y conversations" + filtres + nouveau

**SearchField :** "Chercher dans les conversations..."

**Segmented :** Tous | Instagram | SMS | Email (avec counts)

**Sections :** "NON LUS" puis "PRÉCÉDEMMENT"

**ConvRow :** Avatar (42px) + badge canal (Instagram pink, SMS vert, Email bleu) + Nom + timestamp + dernier message (2 lignes, bold si non lu) + StatusBadge lead ou "@handle" + dot non-lu

**Données :** Supabase direct `ig_conversations` + `ig_messages`. Subscription temps réel.

---

### 7.7 Conversation (thread DM)

**Header :** Retour + Avatar online (36px) + Nom + icône canal + "@handle · en ligne" + téléphone + more

**Lead context strip :** Bandeau gradient vert, StatusBadge + "closing 14h30 · 4 900 €" + bouton "Voir fiche"

**Messages (scroll inversé) :**
- Date dividers
- Bulles lead : fond `#262629`, alignées gauche
- Bulles coach : fond primary, alignées droite
- Réactions emoji pills
- Typing indicator (3 dots animés)

**Composer (bottom fixed) :** Bouton "+" + input "Message..." + image + micro + send (cercle vert)

**Données :** Supabase direct `ig_messages` filtré par conversation. Subscription temps réel.
**Écriture :** API route serveur (passe par Instagram Graph API côté serveur).

---

### 7.8 Notifications

**Header :** NavLarge "Activité" + subtitle "X non lues · Y aujourd'hui" + filtres + marquer tout lu

**FilterChips :** Tout | Deals | Leads | No-shows | Rappels

**Sections :** "AUJOURD'HUI" puis "HIER" etc.

**NotifRow :** Icon box (36x36, fond coloré par type) + Nom + timestamp + titre bold + sous-titre gris + CTA contextuel optionnel + dot non-lu

**Types de notifications :**
| Type | Couleur icône | CTA |
|------|--------------|-----|
| Nouveau lead | bleu | — |
| No-show | rouge | "Reprogrammer" |
| Deal closé | vert | "Voir le deal" |
| Réponse DM | pink | "Ouvrir" |
| Rappel call | amber | — |
| Booking | purple | — |

**Tap** → navigation contextuelle (lead detail, call detail, conversation).

**Données :** Nouvelle table `notifications` à créer (id, workspace_id, type, title, subtitle, entity_type, entity_id, read, created_at). Subscription temps réel.

**Push :** Miroir de cet écran. Tap sur push → deep link vers la notif dans l'app.

---

### 7.9 Pulse Dashboard

**Header custom :** Date "MAR. 7 MAI · TEMPS RÉEL" + "Pulse" largeTitle + bouton période "Mai"

**Hero Revenue :** Card gradient vert, "REVENUE · MAI", montant XXL, trend vs mois précédent, sparkline SVG (7 points).

**Mini KPI Grid (2x2) :**
| Card | Bordure | Valeur | Détail | Trend |
|------|---------|--------|--------|-------|
| Calls faits | bleu | count | sur X prévus | +/- % |
| Taux show | purple | % | X no-shows | +/- pts |
| Closing rate | amber | % | X deals fermés | +/- pts |
| Panier moyen | pink | €€€ | détail | +/- € |

**Funnel (30j) :** 4 barres horizontales — Leads entrants (100%) → Setting validé → Closing réalisé → Deals fermés. Count + % + barre proportionnelle colorée.

**Team (semaine) :** 4 rows — médaille (or/argent/bronze/plain) + Avatar + Nom + Rôle + Valeur + Détail.

**Activity Heatmap (7j) :** 7 colonnes bar chart (L-D), hauteur proportionnelle, jour actuel = vert. Footer : total semaine.

**Données :** Supabase agrégé sur `leads`, `calls`, `deals`, `workspace_members`. Pull-to-refresh uniquement.
**Rendu :** `react-native-svg` pour sparkline, funnel, heatmap.

---

## 8. Couche données

### 8.1 Lectures (Supabase direct)

Le client Supabase est initialisé dans `mobile/src/services/supabase.ts` avec les mêmes credentials que le web. L'auth JWT garantit que les RLS policies s'appliquent — isolation par `workspace_id` automatique.

Hooks React dédiés par entité :
- `useLeads(filters)` — query + subscription `leads`
- `useCalls(date)` — query + subscription `calls` du jour
- `useConversations()` — query + subscription `ig_conversations`
- `useMessages(conversationId)` — query + subscription `ig_messages`
- `useNotifications()` — query + subscription `notifications`
- `usePulseKpis(period)` — queries agrégées, pas de subscription

### 8.2 Écritures (API routes existantes)

Le client API dans `mobile/src/services/api.ts` pointe vers le domaine Vercel. Le token Supabase est passé en header `Authorization: Bearer <token>`.

Routes utilisées :
- `POST /api/leads` — créer un lead
- `PATCH /api/leads/[id]` — modifier statut, tags, infos
- `POST /api/calls` — planifier un call
- `PATCH /api/calls/[id]` — notes, outcome, statut
- `POST /api/instagram/messages` — envoyer un DM (via Instagram Graph API serveur)
- `PATCH /api/follow-ups/[id]` — modifier un follow-up

### 8.3 Temps réel (subscriptions)

| Table | Événement | Effet UI |
|-------|-----------|----------|
| leads | INSERT | Nouveau lead dans la liste + push notification |
| leads | UPDATE | Mise à jour statut/infos dans la liste et le détail |
| calls | INSERT/UPDATE | Mise à jour agenda + badges |
| ig_messages | INSERT | Nouveau message dans conversation + badge inbox + push |
| notifications | INSERT | Nouveau item dans le feed + push |

### 8.4 Nouvelle table requise

```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  type TEXT NOT NULL, -- 'new_lead', 'no_show', 'deal_closed', 'dm_reply', 'call_reminder', 'booking'
  title TEXT NOT NULL,
  subtitle TEXT,
  entity_type TEXT, -- 'lead', 'call', 'deal', 'conversation'
  entity_id UUID,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_isolation" ON notifications
  FOR ALL USING (workspace_id = (SELECT workspace_id FROM users WHERE id = auth.uid()));
```

---

## 9. Push Notifications

### Priorités

1. **Nouveau lead entrant** — immédiat
2. **Rappel avant un call** — configurable (15min, 1h, etc.)
3. **No-show détecté** — quand un call passe en no_show
4. **Nouveau message DM** — quand un lead répond sur Instagram
5. **Deal closé** — quand un nouveau deal est créé (INSERT dans `deals`)

### Architecture

- Les push tokens (APNs/FCM) sont stockés dans une nouvelle colonne `push_token` sur la table `users` (ou une table dédiée `push_tokens` si multi-device)
- L'envoi des push se fait côté serveur (API route ou Supabase Edge Function) quand un événement se produit
- La librairie `react-native-push-notification` gère la réception côté mobile
- Tap sur une push → deep link vers l'écran approprié via React Navigation linking

---

## 10. Authentification

- Écran LoginScreen : email + password
- Supabase Auth `signInWithPassword()`
- Token JWT stocké dans `react-native-keychain` (SecureStore natif)
- Le client Supabase et le client API utilisent ce token
- Pas de register sur mobile (inscription via le web uniquement)
- Écran de login uniquement, avec lien "Pas encore de compte ? Inscrivez-vous sur closrm.com"

---

## 11. Approche d'implémentation

### Phase 1 — Fondations (Pierre seul)
- Setup projet React Native CLI + NativeWind
- Design system : tous les composants `ui/`
- Navigation complète (tab + stacks)
- Auth (login + session)
- Services Supabase + API client
- Dossier `shared/` avec types et validations extraits

### Phase 2 — Écrans (Pierre principalement)
Ordre suggéré :
1. Leads List (vue flat d'abord, puis groupée, puis priorité)
2. Lead Detail
3. Calls Day + Call Detail
4. Schedule Sheet
5. Inbox + Conversation
6. Notifications (+ table SQL + push notifications)
7. Pulse Dashboard

### Répartition
- **Rémy** : réflexion, spec, design, validation. Peu de temps pour coder.
- **Pierre** : implémentation principale. Il enchaîne les écrans.

---

## 12. Workflow de suivi

- **`etat-mobile.md`** : état d'avancement global, mis à jour après chaque écran terminé
- **`taches/tache-mobile-[N]-[description].md`** : fichier par tâche, même format que le web
- **`ameliorations-mobile.md`** : améliorations identifiées pendant le dev
- **CLAUDE.md** : mis à jour avec les conventions mobile

---

## 13. Maquettes de référence

Dossier : `C:\Users\remyd\Downloads\ClosRM Mobile High fidelity-handoff\closrm-mobile-high-fidelity\project\screens\`

| Fichier | Écran |
|---------|-------|
| 00-design-system.jsx | Design system, tokens, composants |
| 01-leads-list.jsx | Leads List (3 variations) |
| 02-lead-detail.jsx | Lead Detail (variante B retenue) |
| 03-calls-day.jsx | Calls Day / Agenda |
| 04-call-detail.jsx | Call Detail |
| 06-schedule-sheet.jsx | Schedule Sheet |
| 07-inbox.jsx | Inbox |
| 08-conversation.jsx | Conversation DM |
| 09-notifications.jsx | Notifications |
| 10-pulse.jsx | Pulse Dashboard |

Fichier `05-call-live.jsx` exclu du scope.
