# Spec — Module Equipe Complet (V2)

> **Date :** 2026-04-09
> **Auteur :** Pierre
> **Statut :** Spec complete, en attente de validation
> **Criticite :** HAUTE — touche auth, RLS, securite

---

## Vision

Transformer ClosRM d'un outil solo en une plateforme equipe. Le coach (admin) invite des setters et closers, leur assigne des leads, suit leur performance, les forme, et gere tout depuis un dashboard manager.

---

## 1. ROLES & PERMISSIONS

### Admin (dirigeant/coach)
- Acces complet a tout
- Gere l'equipe (invite, suspend, supprime)
- Configure les parametres, integrations, automations
- Voit toutes les stats + finances
- Assigne les leads aux membres
- Configure les objectifs et commissions

### Setter
- Dashboard personnalise (ses leads, ses appels du jour, ses stats)
- Leads assignes uniquement (pas tous les leads)
- Passer/logger des appels
- Envoyer des DM Instagram (via ClosRM ou manuellement)
- Changer statut lead : nouveau → setting_planifie → closing_planifie
- Creer des follow-ups
- Voir les conversations IG de ses leads
- Booker un RDV pour un closer
- Voir ses stats perso + objectifs
- Acceder a l'espace formation/SOP
- Chat equipe

### Closer
- Dashboard personnalise (ses closings du jour, son pipeline, ses stats)
- Leads en closing assignes uniquement
- Passer/logger des appels de closing
- Closer un deal (avec montant, echeances)
- Voir le brief du setter (fiche de passage)
- Voir les conversations IG de ses leads
- Voir ses stats perso + commissions
- Acceder a l'espace formation/SOP
- Chat equipe

---

## 2. DASHBOARD PAR ROLE

### Dashboard Setter
```
[Bonjour Pierre — Setter]

[Stats du jour]
Messages envoyes: 12 | Appels passes: 8 | RDV bookes: 2

[Mes leads a traiter]
- Liste des leads assignes, tries par priorite
- Badge statut + derniere activite
- Boutons rapides : Appeler, DM, Booker

[Mon agenda du jour]
- Appels planifies (heure, lead, type)
- Follow-ups a faire

[Mes objectifs]
- Barre de progression : 8/15 appels (53%)
- Barre : 2/5 RDV bookes (40%)
```

### Dashboard Closer
```
[Bonjour Thomas — Closer]

[Stats du jour]
Closings prevus: 3 | Closes ce mois: 8 | CA genere: 12 500€

[Mes closings du jour]
- Liste des RDV closing avec heure, lead, brief setter
- Badge : confirme / no-show risk

[Mon pipeline]
- Leads en attente de closing
- Leads a reprogrammer

[Mes commissions]
- Ce mois : 1 250€ (sur 12 500€ CA)
- Barre objectif : 8/10 closings (80%)
```

### Dashboard Admin (existant + section equipe)
```
[Section Equipe — en haut du dashboard]
[Activite equipe aujourd'hui]
Pierre (setter): 12 msg, 8 appels, 2 RDV ✅
Marie (setter): 5 msg, 3 appels, 0 RDV ⚠️
Thomas (closer): 2 closings, 3500€ ✅

[Alertes]
⚠️ Marie n'a booke aucun RDV aujourd'hui
✅ Thomas a atteint son objectif mensuel
```

---

## 3. ASSIGNATION DES LEADS

### Round-robin avec allocation
- Chaque setter a un % d'allocation (ex: Pierre 50%, Marie 30%, Nouveau 20%)
- Le round-robin respecte ces ratios
- Configurable dans Parametres > Equipe > Repartition

### Ramp-up nouveau setter
- L'admin configure : "Starter: 10%, apres 1 semaine si taux booking > 15%: passer a 25%"
- Ou gestion manuelle : l'admin ajuste le % quand il veut

### Assignation par source
- Option : leads Facebook → Setter A, leads Instagram → Setter B
- Configurable par l'admin

### Assignation manuelle
- L'admin peut toujours assigner manuellement un lead a un membre specifique
- Bouton "Assigner" sur chaque lead

### Passage setter → closer
- Quand le setter booke un closing → le lead est automatiquement assigne au closer de garde (round-robin closers)
- Ou l'admin choisit le closer manuellement
- Le closer recoit une notification

---

## 4. ONBOARDING / SOP / FORMATION

### Espace Formation (`/equipe/formation`)
L'admin cree des "modules" de formation :

```
Module 1 : Introduction
  📄 PDF "Presentation de l'equipe"
  🎥 Video "Comment utiliser le CRM"
  ✅ Quiz : "Quel statut apres un setting reussi ?"

Module 2 : Script Setting
  📄 PDF "Script d'appel setting"
  🔗 Lien "Video formation setting"
  ✅ Checklist : "J'ai lu le script" / "J'ai fait 3 appels test"

Module 3 : Process Closing
  📄 PDF "Guide closing"
  🎥 Video "Gerer les objections"
```

### Par role
- L'admin assigne des modules par role (modules setter ≠ modules closer)
- Le membre voit sa checklist de formation
- L'admin voit la progression : "Pierre a complete 2/3 modules"

### Stockage
- Fichiers uploades sur Supabase Storage
- Liens externes (YouTube, Google Drive)
- Contenu texte markdown

---

## 5. OBJECTIFS & KPIs

### Definition des objectifs (admin)
L'admin configure par role ou par membre :
- Appels/jour : 15
- RDV bookes/semaine : 5
- Taux de joignabilite : > 40%
- Taux de closing : > 30%
- CA/mois : 20 000€

### Suivi
- Barres de progression sur le dashboard de chaque membre
- Code couleur : vert (> 80%), orange (50-80%), rouge (< 50%)

### Leaderboard
- Classement des setters par RDV bookes
- Classement des closers par CA genere
- Visible par toute l'equipe (motivation)

---

## 6. REPORTING MANAGER

### Vue equipe admin (`/equipe/reporting`)
Tableau avec pour chaque membre :

| Membre | Role | Messages | Appels | Repondus | RDV | Closings | CA | Commission |
|---|---|---|---|---|---|---|---|---|
| Pierre | Setter | 45 | 32 | 18 | 8 | — | — | — |
| Marie | Setter | 23 | 15 | 9 | 3 | — | — | — |
| Thomas | Closer | — | 12 | 12 | — | 8 | 24k€ | 2.4k€ |

### Graphiques
- Activite par jour (barres empilees par membre)
- Evolution des KPIs sur 30 jours
- Comparaison entre membres

### Alertes automatiques
- "Marie n'a fait aucun appel depuis 2 jours"
- "Pierre a un taux de joignabilite de 15% (< objectif 40%)"
- "Thomas a 3 no-show cette semaine"

---

## 7. COMMISSIONS

### Configuration (admin)
Par role ou par membre :
- Pourcentage du CA : ex 10%
- Montant fixe par closing : ex 50€
- Paliers : 0-5 closings = 8%, 5-10 = 10%, 10+ = 12%
- Bonus objectif atteint : +200€ si objectif mensuel atteint

### Vue closer
- CA genere ce mois
- Commission calculee en temps reel
- Historique des commissions

### Stockage
Table `commissions_config` + vue calculee

---

## 8. DISPONIBILITE EN TEMPS REEL

### Status
- 🟢 En ligne
- 🔵 En appel
- 🟡 Pause
- 🔴 Hors ligne

### Implementation
- Le membre change son status manuellement (toggle dans le header)
- Status auto "En appel" quand un call est en cours
- L'admin voit les status de toute l'equipe dans le dashboard

---

## 9. HISTORIQUE D'ASSIGNATION

Chaque lead a une timeline d'assignation :
```
5 avril — Lead cree (source: Instagram Ads)
5 avril — Assigne a Pierre (setter) via round-robin
6 avril — Pierre a appele (repondu, interesse)
7 avril — Pierre a booke un RDV closing
7 avril — Assigne a Thomas (closer)
9 avril — Thomas a close (3000€, 3x)
```

Table `lead_assignments` :
```sql
CREATE TABLE lead_assignments (
  id UUID PRIMARY KEY,
  lead_id UUID REFERENCES leads(id),
  assigned_to UUID REFERENCES auth.users(id),
  assigned_by UUID REFERENCES auth.users(id),
  role TEXT,
  reason TEXT, -- 'round_robin', 'manual', 'handoff_closing'
  created_at TIMESTAMPTZ
);
```

---

## 10. CHAT EQUIPE

### Channels
- **#general** — toute l'equipe
- **Messages prives** — entre 2 membres
- **Notes sur un lead** — visibles par l'equipe, pas le prospect

### Implementation V1 (simple)
- Table `team_messages` (channel_type, sender_id, content, lead_id nullable)
- Pas de temps reel en V1 (refresh toutes les 30s)
- V2 : Supabase Realtime pour le temps reel

---

## 11. CALENDRIER EQUIPE

### Vue admin
- Tous les RDV de toute l'equipe sur un seul calendrier
- Code couleur par membre (Pierre = bleu, Marie = vert, Thomas = rouge)
- Filtrer par membre
- Voir les trous dans le planning

### Vue membre
- Son propre calendrier (deja en place)

---

## 12. HANDOFF SETTER → CLOSER

### Fiche de passage
Quand le setter booke un closing, il remplit un brief :
- Objectif du prospect (ex: "perdre 10kg")
- Budget annonce (ex: "autour de 2000-3000€")
- Objections identifiees (ex: "hesite sur le prix")
- Disponibilites
- Notes libres
- Lien vers la conversation IG

### Template configurable
L'admin definit les champs du brief (les questions que le setter doit remplir).

---

## 13. APPELS

### V1 : Manuel
- Le setter/closer appelle depuis son telephone
- Log le resultat dans ClosRM (joint/pas joint, duree, notes)
- Bouton "Appeler" ouvre le numero dans le telephone

### V2 : Integration VoIP
- Google Meet pour les visios (deja en place via T-030)
- Vathomm / Aircall / Ringover pour la telephonie
- Appel direct depuis ClosRM
- Enregistrement automatique
- Transcription IA
- Log automatique dans le CRM

---

## PRIORISATION

### Phase 1 — Fondations (implementer maintenant)
1. Table workspace_members + migration
2. Roles & permissions (admin/setter/closer)
3. API members (invite, update, delete)
4. Page Equipe dans parametres
5. Sidebar conditionnel par role
6. RLS policies
7. Dashboard par role (setter/closer)
8. Assignation manuelle des leads

### Phase 2 — Management
9. Round-robin + allocation %
10. Objectifs & KPIs
11. Reporting manager
12. Leaderboard

### Phase 3 — Communication & Process
13. Handoff setter → closer (brief)
14. Historique assignation
15. Chat equipe
16. Disponibilite en temps reel

### Phase 4 — Formation & Finance
17. Espace formation/SOP
18. Commissions
19. Calendrier equipe

### Phase 5 — Integrations
20. VoIP (Vathomm/Aircall)
21. Enregistrement + transcription appels

---

*Spec generee le 2026-04-09 — ClosRM / Pierre*
