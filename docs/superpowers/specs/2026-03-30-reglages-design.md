# T-018 — Paramètres / Réglages

## Contexte

La page Réglages (`/parametres/reglages`) est actuellement un stub vide. Elle doit permettre au coach de gérer son profil utilisateur, les paramètres de son workspace et la suppression de son compte. C'est une page essentielle pour la V1 du CRM.

## Périmètre

3 sections sur une seule page :

1. **Profil utilisateur** — nom, email (lecture seule), avatar (upload Supabase Storage)
2. **Workspace** — nom du workspace, fuseau horaire
3. **Zone dangereuse** — suppression du compte avec double confirmation

---

## Base de données

### Migration : ajouter `timezone` à `workspaces`

```sql
ALTER TABLE workspaces ADD COLUMN timezone TEXT NOT NULL DEFAULT 'Europe/Paris';
```

La table `users` a déjà `full_name`, `avatar_url`, `email` — aucune modification nécessaire.

### Supabase Storage : bucket `avatars`

```sql
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);

-- Policy : seul le propriétaire peut upload/update/delete son avatar
CREATE POLICY "Users can upload their own avatar"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can update their own avatar"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete their own avatar"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Lecture publique (URLs publiques pour afficher les avatars)
CREATE POLICY "Avatars are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');
```

Structure des fichiers dans le bucket : `{user_id}/avatar.{ext}`

---

## API Routes

### `PATCH /api/user/profile`

Met à jour `full_name` et `avatar_url` dans la table `users`.

- **Auth** : `getWorkspaceId()` pour obtenir `userId`
- **Validation** : `updateProfileSchema` (Zod)
- **Body** : `{ full_name?: string, avatar_url?: string | null }`
- **Réponse** : `{ data: User }`

### `POST /api/user/avatar`

Upload d'image vers Supabase Storage.

- **Auth** : `getWorkspaceId()` pour obtenir `userId`
- **Body** : `FormData` avec un champ `file` (image)
- **Validation** : type MIME (`image/jpeg`, `image/png`, `image/webp`), taille max 2 Mo
- **Logique** : upload vers `avatars/{userId}/avatar.{ext}`, retourne l'URL publique
- **Réponse** : `{ data: { url: string } }`

### `PATCH /api/workspaces`

Met à jour `name` et `timezone` du workspace courant.

- **Auth** : `getWorkspaceId()` pour obtenir `workspaceId`
- **Validation** : `updateWorkspaceSchema` (Zod)
- **Body** : `{ name?: string, timezone?: string }`
- **Réponse** : `{ data: Workspace }`

Note : pas besoin de `[id]` dans la route car le workspace est déduit de l'utilisateur authentifié.

### `DELETE /api/user/account`

Supprime le compte et toutes les données associées.

- **Auth** : `getWorkspaceId()` pour obtenir `userId` et `workspaceId`
- **Body** : `{ confirmation: string }` (doit correspondre au nom du workspace)
- **Logique de suppression (ordre)** :
  1. Vérifier que `confirmation === workspace.name`
  2. Supprimer les données du workspace : workflow_execution_logs → workflow_executions → workflow_steps → workflows → follow_ups → calls → leads → integrations
  3. Supprimer les fichiers Storage (bucket avatars)
  4. Supprimer le user dans `users`
  5. Supprimer le workspace dans `workspaces`
  6. Supprimer le user dans `auth.users` via Supabase Admin (service role)
  7. Répondre 200 — le frontend redirige vers `/login`
- **Réponse** : `{ success: true }`

Utilise le **service role client** (`supabase/service.ts`) pour les suppressions admin (auth.users).

---

## Validations Zod

Fichier : `src/lib/validations/settings.ts`

```typescript
// Profil
export const updateProfileSchema = z.object({
  full_name: z.string().min(2, "Le nom doit faire au moins 2 caractères").max(100),
  avatar_url: z.string().url().nullable().optional(),
})

// Workspace
export const updateWorkspaceSchema = z.object({
  name: z.string().min(2, "Le nom doit faire au moins 2 caractères").max(100),
  timezone: z.string().min(1, "Le fuseau horaire est requis"),
})

// Suppression compte
export const deleteAccountSchema = z.object({
  confirmation: z.string().min(1, "La confirmation est requise"),
})
```

---

## Types TypeScript

Mise à jour de `src/types/index.ts` :

```typescript
// Ajouter timezone à Workspace
export interface Workspace {
  id: string
  name: string
  owner_id: string
  timezone: string  // ajout
  created_at: string
}
```

---

## Composants Frontend

### Page : `src/app/(dashboard)/parametres/reglages/page.tsx`

Layout vertical avec les 3 sections empilées, séparées visuellement. Max-width ~700px centré.

### `src/components/settings/profile-form.tsx`

- **Avatar** : prévisualisation circulaire (Radix Avatar), bouton "Changer la photo", input file caché
- **Nom complet** : champ texte, pré-rempli avec `profile.full_name`
- **Email** : champ texte disabled/grisé, affiché en lecture seule
- **Bouton** : "Enregistrer" (vert `#00C853`)
- **Flow upload** : sélection fichier → preview locale → submit form → POST /api/user/avatar → récupère URL → PATCH /api/user/profile avec la nouvelle URL
- **Feedback** : message de succès inline après sauvegarde

### `src/components/settings/workspace-form.tsx`

- **Nom du workspace** : champ texte, pré-rempli
- **Fuseau horaire** : select/dropdown avec les principales timezones IANA (Europe/Paris, America/New_York, etc. — liste de ~30 les plus courantes)
- **Bouton** : "Enregistrer"
- **Feedback** : message de succès inline

### `src/components/settings/delete-account.tsx`

- **Bouton** : "Supprimer mon compte" en rouge, en bas de page dans une section "Zone dangereuse" bordée de rouge
- **Modale** (au clic) :
  - Titre : "Supprimer votre compte"
  - Texte d'avertissement : "Cette action est irréversible. Toutes vos données seront définitivement supprimées."
  - Champ : "Tapez **{nom_workspace}** pour confirmer"
  - Bouton "Supprimer définitivement" — activé uniquement quand le texte correspond
  - Bouton "Annuler"
- **Flow** : confirmation valide → DELETE /api/user/account → signOut Supabase → redirect `/login`

---

## Patterns à suivre

- **Styles** : inline style objects (pas Tailwind classes), palette existante (`#00C853`, `#141416`, `#09090b`, etc.)
- **Forms** : `useState` + Zod `safeParse()`, erreurs inline sous les champs
- **API** : `getWorkspaceId()` pour auth, réponses `{ data }` ou `{ error }`
- **Composants existants à réutiliser** : pattern de ConfirmModal, inputStyle/labelStyle du projet

---

## Fichiers à créer/modifier

| Action | Fichier |
|--------|---------|
| Créer | `supabase/migrations/002_settings.sql` |
| Créer | `src/lib/validations/settings.ts` |
| Créer | `src/app/api/user/profile/route.ts` |
| Créer | `src/app/api/user/avatar/route.ts` |
| Créer | `src/app/api/workspaces/route.ts` |
| Créer | `src/app/api/user/account/route.ts` |
| Créer | `src/components/settings/profile-form.tsx` |
| Créer | `src/components/settings/workspace-form.tsx` |
| Créer | `src/components/settings/delete-account.tsx` |
| Modifier | `src/app/(dashboard)/parametres/reglages/page.tsx` |
| Modifier | `src/types/index.ts` (ajouter `timezone` à Workspace) |

---

## Vérification

1. **Migration** : appliquer la migration, vérifier que `timezone` existe sur `workspaces` et que le bucket `avatars` est créé
2. **Profil** : modifier le nom → vérifier en DB, upload avatar → vérifier le fichier dans Storage et l'URL en DB
3. **Workspace** : modifier nom + timezone → vérifier en DB
4. **Suppression** : créer un compte test, le supprimer → vérifier que toutes les tables sont nettoyées et que l'auth user est supprimé
5. **UX** : vérifier les messages d'erreur Zod, les états de chargement, la double confirmation
