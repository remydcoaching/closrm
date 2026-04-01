# Planning Templates — Spec Design

> Date : 2026-03-31
> Auteur : Pierre

---

## Contexte

Les coachs ont un planning type hebdomadaire récurrent (ex: lundi 7h-8h cardio, 8h-10h contenu, etc.). Ils veulent pouvoir sauvegarder ce planning comme template et l'appliquer sur n'importe quelle semaine de l'agenda.

---

## Modèle de données

### Table `planning_templates`

```sql
create table planning_templates (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  description text,
  blocks jsonb not null default '[]',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

### Format `blocks` (jsonb)

```json
[
  { "day": "monday", "start": "07:00", "end": "08:00", "title": "Cardio", "color": "#3b82f6" },
  { "day": "monday", "start": "08:00", "end": "10:00", "title": "Création contenu", "color": "#a855f7" },
  { "day": "monday", "start": "14:00", "end": "17:00", "title": "Appels clients", "color": "#22c55e" },
  { "day": "tuesday", "start": "09:00", "end": "12:00", "title": "Coaching présentiel", "color": "#f59e0b" }
]
```

Chaque bloc = un jour de la semaine + heure début/fin + titre + couleur.

---

## Pages

### Page Templates `/agenda/templates`

Liste des templates avec cards. Chaque card : nom, description, nombre de blocs, boutons modifier/supprimer.

Bouton "+ Nouveau template" → ouvre la page d'édition.

### Page Édition `/agenda/templates/[id]`

- Nom + description en haut
- Grille semaine (lun-dim) avec les blocs positionnés visuellement
- Click sur un créneau vide → ajouter un bloc (titre, couleur, heure début/fin)
- Click sur un bloc existant → modifier/supprimer
- Bouton Sauvegarder

### Sur la page Agenda

- Nouveau bouton **"Importer template"** dans le header (à côté de "Gérer l'affichage")
- Click → dropdown des templates disponibles
- Sélection → les blocs du template sont convertis en bookings personnels (`is_personal: true`) sur la semaine affichée
- Les bookings créés sont modifiables/supprimables individuellement

---

## API

| Route | Méthode | Description |
|-------|---------|-------------|
| `/api/planning-templates` | GET | Liste des templates |
| `/api/planning-templates` | POST | Créer un template |
| `/api/planning-templates/[id]` | GET | Détails template |
| `/api/planning-templates/[id]` | PATCH | Modifier template |
| `/api/planning-templates/[id]` | DELETE | Supprimer template |
| `/api/planning-templates/[id]/import` | POST | Importer sur une semaine (body: `{ week_start: "2026-04-07" }`) |

### Import : logique

1. Reçoit `week_start` (lundi de la semaine cible)
2. Pour chaque bloc du template, calcule la date réelle : `week_start + day_offset`
3. Crée un booking personnel pour chaque bloc :
   - `title`: titre du bloc
   - `scheduled_at`: date + heure début
   - `duration_minutes`: calculé depuis début/fin
   - `is_personal`: true
   - `source`: 'manual'

---

## Types TypeScript

```typescript
interface TemplateBlock {
  day: DayOfWeek
  start: string  // "07:00"
  end: string    // "08:00"
  title: string
  color: string
}

interface PlanningTemplate {
  id: string
  workspace_id: string
  name: string
  description: string | null
  blocks: TemplateBlock[]
  created_at: string
  updated_at: string
}
```

---

## Navigation

Sous-page de l'agenda, accessible via un onglet ou un lien dans le header de l'agenda.

---

## Fichiers

### Nouveaux
- `supabase/migrations/005_planning_templates.sql`
- `src/types/index.ts` (ajouter PlanningTemplate, TemplateBlock)
- `src/lib/validations/planning-templates.ts`
- `src/app/api/planning-templates/route.ts`
- `src/app/api/planning-templates/[id]/route.ts`
- `src/app/api/planning-templates/[id]/import/route.ts`
- `src/app/(dashboard)/agenda/templates/page.tsx`
- `src/app/(dashboard)/agenda/templates/[id]/page.tsx`
- `src/components/templates/TemplateCard.tsx`
- `src/components/templates/TemplateWeekEditor.tsx`
- `src/components/templates/BlockModal.tsx`

### Modifiés
- `src/app/(dashboard)/agenda/page.tsx` (bouton "Importer template" + dropdown)
