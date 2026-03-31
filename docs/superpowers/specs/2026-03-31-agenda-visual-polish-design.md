# Refonte visuelle Agenda — Style GHL — Spec Design

> Date : 2026-03-31
> Auteur : Pierre
> Référence visuelle : GoHighLevel (app.lelandigital.com) — Calendriers

---

## Contexte

L'agenda ClosRM est fonctionnel (vues jour/semaine/mois, modale RDV, sidebar) mais le visuel est basique comparé à GHL. Cette spec couvre la refonte visuelle + l'ajout des lieux multiples pour matcher le niveau de qualité de GHL.

---

## 1. Layout global — Panel filtres à droite

**Avant :** Sidebar gauche (220px) avec mini-calendrier + légende calendriers
**Après :** Sidebar gauche (220px) avec mini-calendrier UNIQUEMENT + panel filtres à droite (collapsible)

### Panel droit "Gérer l'affichage"

- Bouton "Gérer l'affichage" dans le header, à côté de "+ Nouveau"
- Panel de 300px qui glisse depuis la droite (animé)
- Bouton × pour fermer

**Contenu du panel :**

```
Gérer l'affichage                              ×
─────────────────────────────────────────────────
Afficher par type
  ● Tous
  ○ Rendez-vous
  ○ Créneaux bloqués

Filtres                              × Effacer tout
  🔍 Rechercher des calendriers...

▸ Calendriers
  ☑ Coaching Schiltigheim     (couleur)
  ☑ Coaching Lampertheim      (couleur)
  ☑ Appel découverte          (couleur)
  ☐ Personnel                 (gris)
```

### Sidebar gauche simplifiée

Ne contient plus que le `MiniCalendar`. Les filtres calendriers migrent dans le panel droit.

---

## 2. Blocs RDV — Hauteur proportionnelle

### Positionnement

Les blocs sont positionnés en **absolute** dans des cellules horaires en **relative**. La position et la hauteur sont calculées :

```
top = (startMinutes / 60) * cellHeight
height = (durationMinutes / 60) * cellHeight
```

Où `cellHeight` = hauteur d'une cellule d'1 heure (ex: 60px).

### Contenu du bloc

```
┌─ 3px bordure gauche (couleur calendrier) ────────┐
│ Lucas Christ - Ap...           (gras, 12px, blanc) │
│ 02:00 PM - 02:30 PM           (10px, gris #aaa)   │
│ 😎 Decompress                  (9px, gris #888)    │
└───────────────────────────────────────────────────┘
```

- **Background :** couleur calendrier avec alpha 0.15 (`${color}26`)
- **Bordure gauche :** 3px solid couleur calendrier
- **Texte principal :** nom du lead (ou titre si événement perso), gras, 12px
- **Texte secondaire :** plage horaire `HH:mm - HH:mm`, 10px, couleur gris
- **Texte tertiaire :** nom du calendrier, 9px, couleur gris foncé
- **Overflow :** `text-overflow: ellipsis` sur le nom si trop long
- **Border-radius :** 4px
- **Padding :** 4px 6px

### Gestion des chevauchements

Quand 2+ blocs se chevauchent temporellement dans la même colonne jour :
- Diviser la largeur de la cellule proportionnellement
- Bloc 1 prend 50% gauche, bloc 2 prend 50% droite
- Si 3 blocs : 33% chacun

---

## 3. Grille horaire — WeekView refactorée

### Structure

Chaque colonne jour est en `position: relative`. Les blocs sont en `position: absolute` à l'intérieur.

```
<div style="position: relative; height: ${HOURS.length * CELL_HEIGHT}px">
  {/* Lignes horaires (border-bottom toutes les CELL_HEIGHT px) */}
  {/* Blocs RDV positionnés en absolute */}
</div>
```

### Constantes

- `CELL_HEIGHT = 60px` (1 heure = 60px de haut)
- `HOURS = 7h à 21h` (15 heures, total 900px)
- Ligne "maintenant" : trait rouge horizontal à la position actuelle

### DayView

Même refonte que WeekView, mais une seule colonne. Plus de place pour chaque bloc.

---

## 4. Modale "Prendre rendez-vous" — Onglets GHL

**Avant :** Toggle "Calendrier" / "Événement perso"
**Après :** Deux onglets en haut de la modale

### Onglet "Rendez-vous" (par défaut)

```
┌─ Rendez-vous ─────── Horaire bloqué ──────────┐
│                                                 │
│ Calendrier          │ Contact *                 │
│ [Appel de Mentoring]│ 🔍 Rechercher...          │
│                     │                           │
│ Titre du RDV        │ Notes internes            │
│ [RDV avec Bob]      │ [+ ajouter une note]      │
│                     │                           │
│ Lieu de la réunion                              │
│ [Fitness Park Schiltigheim ▼]                   │
│                                                 │
│ Date et heure                                   │
│ Heure de début      Heure de fin                │
│ [3 avr. 2026 11:30] [3 avr. 2026 12:00]        │
│                                                 │
│ État : [Confirmé ▼]                             │
│                                                 │
│          [Annuler]  [Prendre rendez-vous]       │
└─────────────────────────────────────────────────┘
```

Champs :
- **Calendrier** (dropdown) — liste des booking_calendars actifs
- **Contact** (recherche) — recherche lead avec autocomplete
- **Titre** (optionnel) — auto-généré depuis "calendrier — contact" si vide
- **Lieu** (dropdown) — lieux associés au calendrier sélectionné. Visible uniquement si le calendrier a des lieux.
- **Date/heure début + fin** — datetime pickers, la fin se calcule auto depuis la durée du calendrier
- **Notes internes** (textarea)
- **État** (dropdown) — Confirmé / Annulé

### Onglet "Horaire bloqué"

```
┌─ Rendez-vous ─────── Horaire bloqué ──────────┐
│                                                 │
│ Titre *                                         │
│ [Pause déjeuner]                                │
│                                                 │
│ Date et heure                                   │
│ Heure de début      Heure de fin                │
│ [3 avr. 2026 12:00] [3 avr. 2026 13:00]        │
│                                                 │
│ Notes                                           │
│ [...]                                           │
│                                                 │
│          [Annuler]  [Bloquer le créneau]        │
└─────────────────────────────────────────────────┘
```

Pas de calendrier, pas de contact, pas de lieu. Crée un booking avec `is_personal: true`.

---

## 5. Lieux multiples — Nouvelle feature

### Table `booking_locations`

```sql
create table booking_locations (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  address text,
  is_active boolean not null default true,
  created_at timestamptz default now()
);
```

RLS : même pattern workspace.

### Modification `booking_calendars`

Remplacer `location text` par `location_ids uuid[]` (array de FK vers booking_locations).

Migration : `ALTER TABLE booking_calendars ADD COLUMN location_ids uuid[] NOT NULL DEFAULT '{}'; ALTER TABLE booking_calendars DROP COLUMN location;`

### Modification `bookings`

Ajouter `location_id uuid REFERENCES booking_locations(id) ON DELETE SET NULL` pour stocker le lieu choisi pour chaque RDV.

### Type TypeScript

```typescript
interface BookingLocation {
  id: string
  workspace_id: string
  name: string
  address: string | null
  is_active: boolean
  created_at: string
}
```

Modifier `BookingCalendar` : remplacer `location: string | null` par `location_ids: string[]`.
Modifier `Booking` : ajouter `location_id: string | null`.
Modifier `BookingWithCalendar` : ajouter `location: Pick<BookingLocation, 'id' | 'name' | 'address'> | null`.

### API

- `GET/POST /api/booking-locations` — CRUD lieux
- `GET/PATCH/DELETE /api/booking-locations/[id]` — single lieu
- Modifier `GET /api/bookings` pour joindre le lieu
- Modifier `POST /api/bookings` pour accepter `location_id`

### UI Settings

Dans l'éditeur de calendrier (`/parametres/calendriers/[id]`), remplacer le champ texte "Lieu" par un multi-select des lieux du workspace.

Nouvelle page ou section dans les paramètres pour gérer les lieux (CRUD simple).

---

## 6. Fichiers impactés

### Fichiers à modifier

| Fichier | Changement |
|---------|-----------|
| `src/components/agenda/BookingBlock.tsx` | Refonte : hauteur proportionnelle, plage horaire, nom calendrier |
| `src/components/agenda/WeekView.tsx` | Position absolute des blocs, gestion chevauchements |
| `src/components/agenda/DayView.tsx` | Même refonte que WeekView |
| `src/components/agenda/AgendaSidebar.tsx` | Simplifier : ne garder que MiniCalendar |
| `src/components/agenda/NewBookingModal.tsx` | Onglets RDV/Horaire bloqué + dropdown lieu |
| `src/app/(dashboard)/agenda/page.tsx` | Panel filtres droite, bouton "Gérer l'affichage", état filterType |
| `src/types/index.ts` | BookingLocation, modifier BookingCalendar + Booking + BookingWithCalendar |
| `src/app/api/bookings/route.ts` | Joindre location dans le select |
| `src/app/(dashboard)/parametres/calendriers/[id]/page.tsx` | Multi-select lieux au lieu de champ texte |

### Fichiers à créer

| Fichier | Responsabilité |
|---------|---------------|
| `src/components/agenda/FilterPanel.tsx` | Panel droit collapsible "Gérer l'affichage" |
| `supabase/migrations/004_booking_locations.sql` | Table lieux + migration calendars |
| `src/app/api/booking-locations/route.ts` | GET + POST lieux |
| `src/app/api/booking-locations/[id]/route.ts` | GET + PATCH + DELETE lieu |
| `src/lib/validations/booking-locations.ts` | Zod schemas lieux |

---

## Vérification

1. Vue semaine : les blocs ont une hauteur proportionnelle à leur durée
2. Blocs chevauchants côte à côte (pas superposés)
3. Panel "Gérer l'affichage" s'ouvre/ferme depuis le bouton header
4. Filtres par type (Tous/RDV/Bloqués) fonctionnent
5. Modale : onglet RDV avec dropdown lieu, onglet Horaire bloqué sans
6. Lieux : CRUD dans paramètres, sélection dans modale, affiché dans le bloc
7. `npm run build` sans erreurs

---

*Spec créée le 2026-03-31 — ClosRM*
