# État du projet — ClosRM

> Fichier mis à jour obligatoirement à la fin de chaque tâche.
> Dernière mise à jour : 2026-03-27

---

## Statut global

**Phase actuelle :** Setup initial
**Version :** 0.1 (pré-développement)
**Branche principale active :** `develop`

---

## Modules — État d'avancement

| Module | Responsable | Statut | Tâche(s) associée(s) |
|--------|-------------|--------|----------------------|
| Setup projet (Next.js + Supabase + Auth + Layout) | Rémy | ✅ Terminé | — |
| Module Leads — Liste | Rémy | ⬜ Non démarré | — |
| Module Leads — Fiche lead | Rémy | ⬜ Non démarré | — |
| Module Closing | Pierre | ⬜ Non démarré | — |
| Module Follow-ups | Pierre | ⬜ Non démarré | — |
| Intégration Meta Ads | Rémy | ⬜ Non démarré | — |
| Module Statistiques | Rémy | ⬜ Non démarré | — |
| Module Automations | Pierre | ⬜ Non démarré | — |
| Intégration Google Agenda | Rémy | ⬜ Non démarré | — |
| Module Publicités (Meta Ads dashboard) | Rémy | ⬜ Non démarré | — |
| Base de données (vue globale) | Rémy/Pierre | ⬜ Non démarré | — |
| Paramètres + Auth | Pierre | ⬜ Non démarré | — |
| API routes + Webhooks | Pierre | ⬜ Non démarré | — |
| V2 — Tunnels | — | 🔒 Bloqué (V2) | — |
| V2 — Emails | — | 🔒 Bloqué (V2) | — |
| V2 — Stripe | — | 🔒 Bloqué (V2) | — |
| V2 — Multi-membres équipe | — | 🔒 Bloqué (V2) | — |

**Légende :** ✅ Terminé · 🔄 En cours · ⬜ Non démarré · 🔒 Bloqué (V2)

---

## Ce qui existe actuellement

### Infrastructure
- [x] Projet Next.js 14 initialisé (App Router + TypeScript)
- [x] Tailwind CSS configuré
- [x] shadcn/ui installé
- [x] Supabase connecté (client + types)
- [x] Schéma SQL initial (`supabase/schema.sql`) — tables de base définies
- [x] Design system défini (couleurs, layout, typographie)
- [x] `package.json` configuré avec toutes les dépendances

### Fichiers clés existants
- `CLAUDE.md` — instructions projet
- `AGENTS.md` — instructions agents
- `supabase/schema.sql` — schéma base de données
- `src/` — structure Next.js initialisée

### Ce qui manque encore
- Pages et composants de toutes les fonctionnalités
- Système d'authentification fonctionnel (UI + logique)
- Layout sidebar + navigation
- Toutes les routes API
- Variables d'environnement (chaque dev a les siennes en local)

---

## Prochaines étapes prioritaires

1. **Tâche suivante (Rémy)** : Layout principal — sidebar + navigation + structure (dashboard)
2. **Tâche suivante (Pierre)** : Système Auth — login/register + middleware Supabase

---

## Historique des tâches complétées

| Date | Développeur | Tâche | Branche |
|------|-------------|-------|---------|
| 2026-03-27 | Rémy | Setup initial projet | `main` (commit initial) |

---

*Mis à jour par Claude Code — ClosRM*
