# Tâche T-024 — Audit Instagram + Performance + Améliorations

**Développeur :** Pierre
**Branche :** `feature/pierre-funnel-builder`
**Date :** 2026-04-05 → 2026-04-07
**Statut :** ✅ Terminé
**PRs :** #59 → #148

---

## Objectif

Audit complet du module Instagram, correction de tous les bugs, polish visuel, optimisation performance du site entier, et ajout de nouvelles fonctionnalités.

---

## Ce qui a été fait

### Sécurité API
- Validation signature HMAC-SHA256 sur webhook Instagram
- Filtrage workspace_id sur messages et sequence items
- Fix unread_count (incrémentation correcte)
- Suppression du token webhook hardcodé

### Nouveau module : Commentaires Instagram
- Migration DB `012_instagram_comments.sql`
- 4 helpers API Meta (fetch, reply, delete, hide)
- 3 routes API (list+reply, sync, delete/hide)
- Composant UI `IgCommentsTab` avec sync, filtres, réponse inline, masquer/supprimer
- Intégré dans les sub-tabs du module Instagram

### Publication Instagram
- Fix upload vidéo (contentType + signed URLs pour bucket privé)
- Types Post / Reel / Story (DB constraint + Zod + API + UI)
- Fix timezone planification (heure locale → UTC correcte)
- Cron Supabase pg_cron toutes les minutes pour publier les posts programmés
- Fix cron : reconnaissance REELS/STORY comme types vidéo
- Validation date future côté client + serveur
- Check `res.ok` sur save draft (plus de fermeture silencieuse)
- Timeout publication 120s (au lieu de 30s)

### Sync automatique Instagram
- Nouveau endpoint `/api/cron/instagram-sync`
- Cron Supabase toutes les heures pour sync reels, stories, stats, conversations
- `Promise.allSettled` pour sync résiliente (erreurs partielles ne bloquent plus)
- Fix story insights : `views` au lieu de `impressions` (deprecated Meta API v22+)

### Stories
- Revamp complet : thumbnails 200x356 (taille téléphone)
- Données en encadré sous chaque story (vues, reach, replies, exits, profil, abonnés)
- Flèches drop-off colorées entre stories
- Barre de rétention funnel
- Tri chronologique (oldest first)
- Sélection par défaut = aujourd'hui
- 7 KPIs sur une ligne

### Reels
- Panel détail latéral (vidéo 9:16, 7 stats, caption, notes perso)
- Notes sauvegardées en localStorage

### Messages / DMs
- Refonte complète en Tailwind CSS
- Loading skeletons, debounce search, date separators
- Fix `platform=instagram` sur l'endpoint d'envoi

### Agenda
- Ligne de temps actuelle (couleur primaire du site, se déplace en temps réel)
- Notifications navigateur pour RDV (configurable 5/10/15/30/60 min)
- Suppression par touche Backspace/Delete
- Labels horaires Google Calendar style (sur la ligne de grille)

### Templates agenda
- Copier-coller blocs (Cmd+C / Cmd+V)
- Drag & drop pour déplacer les blocs
- Simple clic = sélection, double clic = édition
- Fix import timezone (heures correctes)
- Couleurs préservées à l'import
- Sync Google Calendar à l'import
- Protection modifications non sauvegardées
- Grid matching agenda (60px/heure, 72px labels)

### Funnels
- Fix slug dupliqué (auto-suffixe)
- Polish visuel (hover effects, spinners, dark theme preview)

### Performance (4 phases)
- Phase 1 : Dynamic imports Recharts + modales (-200KB bundle)
- Phase 2 : Fetches parallélisés (closing, follow-ups, publicités)
- Phase 3 : Queries Supabase optimisées + 11 indexes
- Phase 4 : Middleware auth skip getUser() sur API routes
- 8 pages converties en Server Components (leads, BDD, closing, follow-ups, automations, broadcasts, sequences, templates)

### Polish visuel
- 25+ composants améliorés (hover states, transitions, skeletons, responsive modals)
- Fix typos (Créer, Catégorie, Légende, Sauvegardé, Dépublier)
- Sub-tabs et boutons media type : couleur primaire au lieu de blanc
- Page réseaux sociaux : pleine largeur

---

## Fichiers créés
- `src/app/api/instagram/comments/route.ts`
- `src/app/api/instagram/comments/sync/route.ts`
- `src/app/api/instagram/comments/[id]/route.ts`
- `src/components/social/instagram/IgCommentsTab.tsx`
- `src/app/api/cron/scheduled-posts/route.ts`
- `src/app/api/cron/instagram-sync/route.ts`
- `src/components/agenda/BookingNotifications.tsx`
- `supabase/migrations/012_instagram_comments.sql`
- `supabase/migrations/013_performance_indexes.sql`
- 8 fichiers client components (leads-client, closing-client, etc.)
- 5 fichiers chart inner components (lazy loaded)

---

## Fichiers modifiés (principaux)
- 50+ fichiers modifiés au total
- PRs #59 à #148 (90 PRs)
