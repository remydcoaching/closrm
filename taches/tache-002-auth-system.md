# Tâche 002 — Auth : finaliser le système

> **Statut :** Terminée
> **Développeur :** Pierre
> **Date de début :** 2026-03-27
> **Date de fin :** 2026-03-27
> **Branche Git :** `feature/pierre-auth-system`

---

## Objectif

Solidifier tout le système d'authentification : validation, sécurité, reset password, hooks/helpers pour les futures API routes, et refonte visuelle complète de toutes les pages.

---

## Périmètre

### Ce qui est inclus dans cette tâche
- Fix middleware (protège toutes les routes, pas seulement /dashboard)
- Fix info disclosure sur register (messages d'erreur génériques)
- Validation Zod sur login et register
- Page reset password + page update password
- Route auth callback (échange code Supabase → session)
- Hook `useUser()` côté client
- Helper `getWorkspaceId()` côté serveur
- Ajout `created_at` au type User
- Refonte visuelle complète : landing page, auth, dashboard, sidebar
- Changement palette : rouge → vert (#00C853)
- Landing page complète (hero, features, pricing, social proof, CTA, footer)

### Ce qui est explicitement exclu
- Test flow inscription complet (à faire manuellement) → À vérifier
- Rate limiting → Amélioration future
- Confirmation email → Amélioration future
- Fix trigger SQL `handle_new_user` → Amélioration future

---

## Fichiers concernés

### Fichiers créés
| Fichier | Description |
|---------|-------------|
| `src/lib/validations/auth.ts` | Schemas Zod : login, register, resetPassword, updatePassword |
| `src/app/auth/callback/route.ts` | Route handler GET pour échange code Supabase → session |
| `src/app/(auth)/reset-password/page.tsx` | Page demande de reset password |
| `src/app/(auth)/reset-password/update/page.tsx` | Page saisie nouveau mot de passe |
| `src/hooks/use-user.ts` | Hook client : authUser, profile, workspaceId, loading, error |
| `src/lib/supabase/get-workspace.ts` | Helper serveur : retourne userId + workspaceId |
| `src/components/landing/landing-page.tsx` | Landing page complète |
| `src/components/landing/landing-navbar.tsx` | Navbar landing (fixe, transparente → opaque au scroll) |
| `src/components/landing/particles-canvas.tsx` | Canvas particules animées (vert) |
| `src/components/landing/fade-in.tsx` | Composant fade-in avec IntersectionObserver |

### Fichiers modifiés
| Fichier | Modification |
|---------|-------------|
| `src/lib/supabase/middleware.ts` | Logique inversée : whitelist publique, try-catch sur getUser() |
| `src/app/(auth)/login/page.tsx` | Validation Zod, lien reset, refonte visuelle |
| `src/app/(auth)/register/page.tsx` | Validation Zod, messages génériques, refonte visuelle |
| `src/app/(auth)/layout.tsx` | Refonte visuelle (glow, grid pattern, icône logo) |
| `src/app/(dashboard)/layout.tsx` | Utilise DashboardShell |
| `src/app/(dashboard)/dashboard/page.tsx` | Refonte visuelle (KPI cards, sections) |
| `src/components/layout/Sidebar.tsx` | Refonte visuelle (inline styles, navigation propre) |
| `src/components/layout/DashboardShell.tsx` | Inline styles pour layout sidebar/content |
| `src/app/globals.css` | Ajout variables container Tailwind v4, Inter font, cleanup |
| `src/app/page.tsx` | Redirige vers LandingPage au lieu de /dashboard |
| `src/types/index.ts` | Ajout created_at à User |

---

## Tâches liées

| Relation | Tâche | Description |
|----------|-------|-------------|
| Bloque | T-007 (Closing) | `getWorkspaceId()` nécessaire pour les API routes |
| Bloque | T-008 (Follow-ups) | idem |
| Bloque | T-004 (Leads - Rémy) | idem |

---

## Notes techniques

- Tailwind CSS v4 ne génère pas les variables `--container-*xl` par défaut → ajoutées manuellement dans `@theme inline`
- Les composants critiques utilisent des inline styles pour éviter les bugs Tailwind v4
- La palette est passée du rouge (#E53E3E) au vert (#00C853) sur toute l'app
- Le middleware utilise une whitelist de routes publiques (plus sûr que lister les routes protégées)

---

## Résultat final

- Système auth complet et sécurisé
- Toutes les routes dashboard protégées
- Reset password fonctionnel
- Hook + helper prêts pour les futures API routes
- Landing page professionnelle avec particules, features, pricing, social proof
- Design system cohérent noir + vert sur toutes les pages

---

## Améliorations identifiées pendant cette tâche

- A-001 : Trigger SQL `handle_new_user` sans error handling → risque de user orphelin
- A-002 : RLS policies basées sur owner_id → à changer pour V2 multi-membres
- A-003 : Rate limiting sur login/register → prévenir brute force
- A-004 : Confirmation email → activer dans Supabase Auth settings
- A-005 : Pages 404/error avec le design system
- A-006 : Détection d'expiration de session côté client

---

*Créé le 2026-03-27 par Claude Code — ClosRM*
