# État du projet — ClosRM

> Fichier mis à jour obligatoirement à la fin de chaque tâche.
> Dernière mise à jour : 2026-03-27

---

## Statut global

**Phase actuelle :** Développement V1
**Version :** 0.2
**Branche principale active :** `develop`
**Palette couleur :** Noir (#09090b) + Vert (#00C853)

---

## Modules — État d'avancement

| Module | Responsable | Statut | Tâche(s) associée(s) |
|--------|-------------|--------|----------------------|
| Setup projet (Next.js + Supabase + Auth + Layout) | Rémy | ✅ Terminé | — |
| Auth (login, register, reset, middleware, hooks) | Pierre | ✅ Terminé | T-002 |
| Landing page | Pierre | ✅ Terminé | T-002 |
| Refonte visuelle (design system vert) | Pierre | ✅ Terminé | T-002 |
| Module Leads — Liste + API | Rémy | ⬜ Non démarré | — |
| Module Leads — Fiche lead | Rémy | ⬜ Non démarré | — |
| Module Closing — API + Frontend | Pierre | ⬜ Non démarré | T-007 |
| Module Follow-ups — API + Frontend | Pierre | ⬜ Non démarré | T-008 |
| Intégration Meta Ads | Pierre | ⬜ Non démarré | T-013 |
| Module Statistiques | Rémy | ⬜ Non démarré | — |
| Module Automations | Pierre | ⬜ Non démarré | T-014 |
| Intégration Google Agenda | Rémy | ⬜ Non démarré | — |
| Module Publicités (Meta Ads dashboard) | Rémy | ⬜ Non démarré | — |
| Base de données (vue globale) | Rémy/Pierre | ⬜ Non démarré | — |
| Paramètres Réglages | Pierre | ⬜ Non démarré | T-018 |
| Paramètres Intégrations | Pierre | ⬜ Non démarré | T-019 |
| Notifications WhatsApp/Telegram | Pierre | ⬜ Non démarré | T-016 |
| V2 — Tunnels | — | 🔒 Bloqué (V2) | — |
| V2 — Emails | — | 🔒 Bloqué (V2) | — |
| V2 — Stripe | — | 🔒 Bloqué (V2) | — |
| V2 — Multi-membres équipe | — | 🔒 Bloqué (V2) | — |

**Légende :** ✅ Terminé · 🔄 En cours · ⬜ Non démarré · 🔒 Bloqué (V2)

---

## Ce qui existe actuellement

### Infrastructure
- [x] Next.js 16 (App Router + TypeScript)
- [x] Tailwind CSS v4 configuré (avec variables container)
- [x] Supabase connecté (client browser + serveur + middleware)
- [x] Schéma SQL complet (7 tables + RLS + trigger auto-création workspace)
- [x] Types TypeScript complets
- [x] Design system vert (#00C853) + noir (#09090b)

### Auth (T-002 — Pierre)
- [x] Login avec validation Zod + messages d'erreur génériques
- [x] Register avec validation Zod + mapping erreurs (pas d'info disclosure)
- [x] Reset password (demande + update + auth callback)
- [x] Middleware protège TOUTES les routes (whitelist publique)
- [x] Hook `useUser()` côté client
- [x] Helper `getWorkspaceId()` côté serveur
- [x] Try-catch sur getUser() dans middleware

### UI
- [x] Landing page (hero + particules + features + pricing + social proof + CTA + footer)
- [x] Sidebar navigation (collapsible, inline styles)
- [x] Dashboard d'accueil (KPI cards + sections)
- [x] Pages auth refaites (glass card, glow, icônes dans inputs)
- [x] Toutes les pages modules en placeholder

### Ce qui manque
- [ ] Toutes les API routes (calls, follow-ups, leads, automations)
- [ ] Tous les modules fonctionnels (closing, follow-ups, etc.)
- [ ] Intégrations tierces (Meta, Google, WhatsApp)
- [ ] Test flow inscription complet (à vérifier manuellement)

---

## Prochaines étapes prioritaires

1. **Pierre** : T-007 — Module Closing (API + Frontend)
2. **Pierre** : T-008 — Module Follow-ups (API + Frontend)
3. **Rémy** : T-004 — Module Leads (API + Liste + Fiche lead)
4. **Rémy** : T-003 — Dashboard d'accueil avec vraies données

---

## Historique des tâches complétées

| Date | Développeur | Tâche | Branche |
|------|-------------|-------|---------|
| 2026-03-27 | Rémy | Setup initial projet | `main` |
| 2026-03-27 | Pierre | T-001 — Roadmap & priorisation | `feature/pierre-fix-layout` |
| 2026-03-27 | Pierre | T-002 — Auth + refonte visuelle | `feature/pierre-auth-system` |

---

*Mis à jour par Claude Code — ClosRM*
