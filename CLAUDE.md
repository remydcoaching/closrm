# CLAUDE.md — ClosRM

> Fichier d'initialisation projet pour Claude Code.
> Lire ce fichier en entier avant de générer le moindre code.

---

## 🎯 Vision du projet

**ClosRM** est un CRM web full-stack destiné aux coachs indépendants qui gèrent des leads via Meta Ads (Facebook & Instagram). L'objectif est de centraliser tout le cycle de vente : acquisition des leads, suivi des appels (setting/closing), automations (WhatsApp, rappels), statistiques de performance et tunnels de vente.

Le projet est développé par **deux développeurs en parallèle** (Rémy et Pierre) via Claude Code + GitHub.

---

## 👥 Utilisateurs cibles

- Coachs indépendants (solo ou petite équipe)
- Architecture **multi-tenant** : chaque coach a son propre workspace totalement isolé
- Rôles prévus (V1 : coach seul, V2 : setter + closer au sein d'un workspace)

---

## 🏗️ Stack technique

| Couche | Technologie |
|--------|-------------|
| Frontend | Next.js 14 (App Router) + TypeScript |
| UI | Tailwind CSS + shadcn/ui |
| Backend | Next.js API Routes (serverless) |
| Base de données | Supabase (PostgreSQL) |
| Auth | Supabase Auth (email/password + OAuth) |
| Hébergement | Vercel |
| Stockage fichiers | Supabase Storage |
| Emails transactionnels | Resend |
| WhatsApp | Meta Cloud API (gratuit jusqu'à 1000 conv/mois) |
| Versioning | GitHub (workflow branches, PR obligatoires) |

---

## 🗂️ Structure des modules

### VENTES

#### 1. Leads
Pipeline de suivi des leads entrants.

**Statuts du pipeline :**
```
Nouveau lead → Setting planifié → No-show Setting → Closing planifié → No-show Closing → Closé ✅ → Dead ❌
```

**Colonnes affichées dans la liste leads :**
- Date de création
- Prénom / Nom
- Numéro de téléphone
- Email
- Source (Facebook Ads / Instagram Ads / Formulaire / Manuel)
- Nb de tentatives d'appel
- Joint (oui/non — toggle)
- Statut pipeline (badge coloré)
- Tags (froid, chaud, VIP, referral…)
- Setter assigné (V2)
- Actions : Planifier appel, Voir fiche, Archiver

**Fiche lead (vue détaillée) :**
- Informations de contact complètes
- Historique de tous les appels (date, durée, résultat, notes)
- Timeline des interactions
- Bouton "Appeler" (log automatique de la tentative)
- Bouton "Planifier RDV" (ouvre modale → sync Google Agenda)
- Champ notes libre
- Statut actuel + historique des changements de statut
- Tags éditables
- Source publicitaire (campagne, ad set, ad — si connecté Meta)

#### 2. Closing
Vue dédiée aux appels de closing planifiés.

**Onglets :**
- Appels à venir (avec badge nombre)
- Appels à actualiser (résultat non renseigné après la date prévue)
- Appels traités
- Annulés / Absents

**Vue liste ou calendrier** (toggle)

**Par appel :**
- Nom du lead + contact
- Email
- Closer assigné (dropdown)
- Setter d'origine
- Date/heure prévue
- Statut : En attente / Fait / Annulé / Absent
- Actions : Appeler, Reprogrammer, Marquer résultat, Voir fiche

#### 3. Follow-ups
Système de relances automatisées.

**Fonctionnement :**
- Un follow-up est créé automatiquement ou manuellement pour un lead
- Le coach configure ses règles d'automations dans Paramètres > Automations
- Colonnes : Nom, Raison du FU, Date prévue, Canal (WhatsApp/Email/Manuel), Statut, Notes, Actions

**Statuts :** En attente / Fait / Annulé

#### 4. Statistiques
Dashboard de performance.

**KPIs affichés :**
- Leads totaux (période sélectionnable : 7j / 30j / 90j / tout)
- Calls bookés + taux de booking
- Deals closés + win rate
- Revenue généré
- Coût par lead (si Meta connecté)
- Coût par call booké
- ROAS estimé
- Leads par jour (graphique)
- Funnel de conversion visuel (leads → setting → closing → closé)
- Performance par source (Facebook vs Instagram vs Manuel)
- Performance par campagne / ad set / ad (si Meta connecté)

#### 5. Base de données
Vue globale de tous les contacts (leads + anciens leads).

- Recherche / filtres avancés
- Export CSV
- Historique complet par contact
- Segmentation par statut, source, tags, date

---

### ACQUISITION

#### 6. Tunnels de vente
> **V1 : non inclus** — prévu en V2

Architecture prévue en V2 :
- Builder de pages (VSL page + formulaire de candidature)
- Templates par niche (coaching, sport, immobilier…)
- Stats par tunnel : vues, leads, taux de conversion
- Statuts : Brouillon / En ligne

#### 7. Emails
> **V1 : non inclus** — prévu en V2

Architecture prévue en V2 :
- Séquences automatiques (type Mailerlite)
- Broadcast à une liste segmentée
- Templates d'emails
- Stats : taux d'ouverture, clics, désinscriptions

#### 8. Automations (Workflows)
Configuration des règles d'automatisation.

**Triggers disponibles :**
- Nouveau lead reçu
- RDV planifié
- RDV dans X heures/jours
- Lead change de statut
- Follow-up en attente depuis X jours

**Actions disponibles :**
- Envoyer message WhatsApp (template configurable)
- Envoyer email
- Créer un follow-up
- Changer le statut du lead
- Envoyer notification (Telegram ou WhatsApp au coach)

**Configuration rappels RDV :**
- Canal : WhatsApp / Email / Les deux
- Délais : configurable (ex : J-1 à 9h00, H-2, H-1)
- Message template : personnalisable avec variables {{prenom}}, {{date_rdv}}, {{heure_rdv}}, {{nom_coach}}

#### 9. Publicités (Meta Ads)
Dashboard de performance des campagnes Meta.

**Connexion :** OAuth Meta Business (bouton "Connecter mon compte Meta" dans Paramètres)

**Données affichées :**
- Budget pub du mois
- Dépensé
- Leads générés
- Coût par lead
- Performance par plateforme (Facebook / Instagram)
- Performance par Campagne / Ad Set / Ad
- Graphique leads/jour
- Funnel marketing visuel

---

### PARAMÈTRES

#### 10. Intégrations
Chaque intégration a un bouton "Connecter" / "Déconnecter" et un statut visuel (connecté ✅ / non connecté).

| Intégration | Méthode de connexion | Utilité |
|-------------|---------------------|---------|
| Google Agenda | OAuth Google | Sync RDV bidirectionnel, créer RDV depuis le CRM |
| Meta (Facebook/Instagram) | OAuth Meta Business | Import leads ads, stats campagnes |
| WhatsApp Business | Meta Cloud API (token) | Messages automatiques leads + rappels RDV |
| Stripe | Clé secrète API | Suivi paiements, abonnements, impayés (V2) |
| Telegram | Bot Token | Notifications coach |

#### 11. Réglages
- Informations du compte (nom, email, photo de profil)
- Nom du workspace / marque
- Fuseau horaire
- Langue (FR par défaut)
- Gestion des membres d'équipe (V2 : inviter setter/closer)
- Suppression du compte

---

## 🔐 Architecture multi-tenant

Chaque coach = 1 workspace Supabase isolé par `workspace_id`.

**Row Level Security (RLS) Supabase :**
- Chaque table a une colonne `workspace_id`
- Les policies RLS garantissent qu'un utilisateur ne voit que les données de son workspace
- L'inscription crée automatiquement un workspace pour le coach

**Tables principales :**
```sql
workspaces (id, name, owner_id, created_at)
users (id, workspace_id, email, role, full_name, avatar_url)
leads (id, workspace_id, first_name, last_name, phone, email, status, source, tags, created_at, ...)
calls (id, workspace_id, lead_id, type, scheduled_at, outcome, notes, attempt_number, reached, duration_seconds, created_at)
follow_ups (id, workspace_id, lead_id, reason, scheduled_at, channel, status, notes, created_at)
automations (id, workspace_id, trigger_type, trigger_config, action_type, action_config, is_active)
tunnels (id, workspace_id, name, pages, status, views, leads_count, created_at) -- V2
integrations (id, workspace_id, type, credentials_encrypted, connected_at, is_active)
```

---

## 🌐 Structure des routes Next.js

```
app/
├── (auth)/
│   ├── login/
│   └── register/
├── (dashboard)/
│   ├── layout.tsx          # Sidebar + navigation principale
│   ├── dashboard/          # Vue d'accueil / résumé
│   ├── leads/
│   │   ├── page.tsx        # Liste leads
│   │   └── [id]/page.tsx   # Fiche lead
│   ├── closing/
│   ├── follow-ups/
│   ├── statistiques/
│   ├── base-de-donnees/
│   ├── acquisition/
│   │   ├── tunnels/        # V2
│   │   ├── emails/         # V2
│   │   ├── automations/
│   │   └── publicites/
│   └── parametres/
│       ├── integrations/
│       └── reglages/
└── api/
    ├── leads/
    ├── calls/
    ├── follow-ups/
    ├── webhooks/
    │   ├── meta/           # Réception leads Facebook/Instagram
    │   └── stripe/         # V2
    └── automations/
```

---

## 🎨 Design system

**Inspiration :** UpTrainer CRM (dark theme, rouge/blanc, sidebar gauche fixe)

**Palette :**
- Background : `#0A0A0A` (noir profond)
- Surface : `#141414` (cards, sidebar)
- Border : `#262626`
- Primary : `#E53E3E` (rouge vif — actions principales, badges actifs)
- Primary hover : `#C53030`
- Text primary : `#FFFFFF`
- Text secondary : `#A0A0A0`
- Success : `#38A169` (vert — closé, connecté)
- Warning : `#D69E2E` (orange — en attente)
- Danger : `#E53E3E` (rouge — dead, déconnecté)

**Layout :**
- Sidebar fixe à gauche (180px), collapsible
- Header de page avec titre + actions contextuelles
- Tables denses avec hover states
- Badges colorés pour les statuts
- Modales pour les actions (planifier, ajouter, modifier)

---

## 🤖 Protocole Claude Code — Travail à deux développeurs

Ce projet est développé par **Rémy et Pierre travaillant séparément**, chacun via sa propre instance Claude Code. Ce protocole est **obligatoire** à chaque session.

### Garde-fous obligatoires EN DÉBUT DE TÂCHE

Avant d'écrire la moindre ligne de code, Claude Code **doit** :

1. **Vérifier la branche courante** : `git branch --show-current`
2. **Vérifier le statut Git** : `git status`
3. **Vérifier si la branche est à jour avec le remote** : `git fetch origin && git log HEAD..origin/$(git branch --show-current) --oneline`
   - Si des commits distants existent → **stopper et demander de faire un `git pull` avant de continuer**
   - Si la branche courante est `main` ou `develop` → **stopper et demander de créer une branche feature**
4. **Confirmer avec le développeur** que la branche de travail est la bonne avant de démarrer

### Garde-fous obligatoires AVANT UN COMMIT

Avant tout commit, Claude Code **doit** :

1. Vérifier que la branche respecte la convention `feature/remy-*` ou `feature/pierre-*`
2. Si la branche est incorrecte (ex : on est encore sur `develop`) → **ne pas committer**, proposer de créer la bonne branche et d'y basculer
3. Vérifier que `.env.local` et `.env*.local` ne sont **jamais** inclus dans le commit
4. Si la branche est correcte → procéder au commit normalement

### Système de fichiers de suivi du projet

Claude Code maintient **obligatoirement** trois types de fichiers de suivi :

#### 1. Fichiers de tâches (`taches/tache-[N]-[description-courte].md`)
- Créer un fichier par tâche dans le dossier `taches/`
- Numérotation séquentielle globale (pas par développeur)
- Contenu obligatoire : description, objectif, fichiers créés/modifiés, tâches liées, statut
- Ne jamais supprimer un fichier de tâche terminé (archive historique)
- **Si une spec brainstorming a été validée pour cette tâche** : ajouter une section `## Spec` dans le fichier de tâche avec le chemin vers le fichier spec (`docs/superpowers/specs/YYYY-MM-DD-*.md`) et un résumé en 2-3 lignes des décisions prises. Faire cela **immédiatement après validation de la spec**, avant de passer au plan d'implémentation.

#### 2. Fichier d'état (`etat.md`)
- Mis à jour **obligatoirement à la fin de chaque tâche**
- Décrit où en est le projet : modules terminés, en cours, à faire
- Indique qui a fait quoi et quand
- Donne une vision claire de la direction du projet

#### 3. Fichier d'améliorations (`ameliorations.md`)
- Mis à jour **obligatoirement à la fin de chaque tâche**
- Liste toutes les améliorations identifiées pendant la tâche
- **RÈGLE ABSOLUE : aucune amélioration ne doit être implémentée sans validation explicite** du développeur concerné
- Format : proposition + justification + priorité estimée

---

## 🔄 Workflow GitHub (travail à deux)

### Branches
```
main          → production stable, jamais de push direct
develop       → BRANCHE PRINCIPALE de travail — point de départ de toutes les features
feature/remy-*  → branches de Rémy
feature/pierre-* → branches de Pierre
```

> **`develop` est la branche principale de référence.** Toutes les branches feature partent de `develop` et y reviennent via PR. `main` ne reçoit que les releases validées.

### Règles
1. **Toujours partir de `develop`** : `git checkout develop && git pull && git checkout -b feature/remy-ma-feature`
2. **Jamais pusher directement sur `main` ou `develop`**
3. **Pull Request obligatoire** pour merger dans `develop`
4. **Avant de commencer à coder** : `git pull origin develop` pour être à jour
5. **Répartition des modules** pour éviter les conflits (voir ci-dessous)

### Répartition suggérée V1
| Rémy | Pierre |
|------|--------|
| Leads + Fiche lead | Closing + Follow-ups |
| Intégrations Meta | Automations + Notifications |
| Statistiques | Paramètres + Auth |
| Layout / Design system | API routes + Webhooks |

### Fichiers à ne jamais commiter
```gitignore
.env.local
.env*.local
```

Chacun a son propre `.env.local` avec ses clés Supabase de développement.

---

## 🚀 Setup initial (à faire une seule fois)

### 1. Supabase
1. Créer un compte sur [supabase.com](https://supabase.com)
2. Créer un nouveau projet (noter l'URL et la clé `anon`)
3. Activer Row Level Security sur toutes les tables
4. Activer l'authentification email/password dans Auth > Providers
5. Copier les variables dans `.env.local`

### 2. Variables d'environnement
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx

# Meta (OAuth — configuré depuis l'app)
META_APP_ID=xxx
META_APP_SECRET=xxx
META_WEBHOOK_VERIFY_TOKEN=xxx

# Google (OAuth — configuré depuis l'app)
GOOGLE_CLIENT_ID=xxx
GOOGLE_CLIENT_SECRET=xxx

# WhatsApp Business API
WHATSAPP_PHONE_NUMBER_ID=xxx
WHATSAPP_ACCESS_TOKEN=xxx

# Resend (emails transactionnels)
RESEND_API_KEY=xxx

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Vercel
1. Connecter le repo GitHub à Vercel
2. Ajouter toutes les variables d'environnement dans Vercel > Settings > Environment Variables
3. Les deux développeurs travaillent en local, Vercel déploie automatiquement depuis `main`

---

## 📋 Ordre de développement V1

1. **Setup projet** : Next.js + Supabase + Auth + layout sidebar
2. **Module Leads** : liste, pipeline statuts, fiche lead, ajout manuel
3. **Module Closing** : liste appels, statuts, vue calendrier
4. **Module Follow-ups** : liste, ajout, statuts
5. **Intégration Meta Ads** : OAuth, webhook réception leads, import automatique
6. **Module Statistiques** : KPIs, graphiques, funnel
7. **Module Automations** : workflows, rappels RDV WhatsApp
8. **Intégration Google Agenda** : OAuth, sync RDV
9. **Module Publicités** : dashboard Meta Ads
10. **Base de données** : vue globale contacts, export CSV
11. **V2** : Tunnels, Emails, Stripe, multi-membres équipe

---

## 📝 Conventions de code

- **Langue du code** : anglais (variables, fonctions, composants)
- **Langue de l'UI** : français
- **Composants** : PascalCase (`LeadCard`, `CallModal`)
- **Fonctions/hooks** : camelCase (`useLeads`, `formatDate`)
- **Fichiers** : kebab-case (`lead-card.tsx`, `use-leads.ts`)
- **Types TypeScript** : toujours typer, pas de `any`
- **Commits** : `feat:`, `fix:`, `chore:`, `refactor:` + description courte en anglais

---

*Fichier généré le 26/03/2026 — ClosRM v0.1*
