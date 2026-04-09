# Spec — Refonte UX Module Emails

> **Date :** 2026-04-08
> **Auteur :** Pierre
> **Statut :** Auto-valide (Pierre a donne carte blanche)

---

## Objectif

Refonte UX complete du module Emails pour qu'il soit intuitif, beau, et fonctionnel. Le coach doit pouvoir :
1. Configurer son domaine en 3 clics
2. Creer et envoyer un broadcast en 2 minutes
3. Creer une sequence automatique facilement
4. Voir ses stats d'envoi

---

## Problemes identifies (audit)

1. Dashboard KPIs vides (pas branche)
2. Pas de page edition broadcast existant
3. BroadcastFilterBuilder URL cassee (double path)
4. Pas de preview email avant envoi
5. Pas de scheduled sends
6. Template editor sans auto-save
7. Variables {{prenom}} sans aide/autocomplete
8. Sequences = hack sur workflows (confus)
9. Domain setup pas integre dans le flow
10. Stats figees (webhook Resend pas branche)

---

## Architecture UX — nouvelle navigation

Quand le coach clique sur "Emails" dans la sidebar, il arrive sur une page avec **4 onglets** :

### Onglet 1 : Campagnes (defaut)
Liste des broadcasts avec :
- Bouton "+ Nouvelle campagne"
- Table : nom, sujet, destinataires, statut (badge), date envoi, actions
- Clic sur une campagne → page edition/detail

### Onglet 2 : Sequences
Liste des sequences avec :
- Bouton "+ Nouvelle sequence"
- Cards : nom, nombre d'etapes, statut, inscrits actifs
- Clic → editeur sequence

### Onglet 3 : Templates
Grille de templates avec :
- Bouton "+ Nouveau template"
- Cards avec apercu miniature, nom, date modif
- Clic → editeur template

### Onglet 4 : Parametres
- Configuration domaine (DomainSetup)
- Adresse d'envoi par defaut
- Stats globales (envoyes, ouverts, cliques, bounces)

---

## Changements cles

### 1. Dashboard → remplace par liste campagnes
Plus de page dashboard vide. L'onglet par defaut = campagnes.

### 2. Fix BroadcastFilterBuilder
Corriger l'URL de preview-count (double path bug).

### 3. Preview email dans broadcast
Ajouter un apercu de l'email compile a droite du formulaire broadcast.

### 4. Variables helper
Bouton "Variables" dans l'editeur qui montre la liste des variables disponibles avec un clic pour inserer.

### 5. Domain setup integre
Si pas de domaine configure, banner d'avertissement en haut de la page campagnes : "Configurez votre domaine pour envoyer des emails"

### 6. Stats dashboard dans onglet Parametres
Brancher les vraies stats depuis /api/emails/stats

### 7. Auto-save templates
Debounce 2s apres chaque modification de bloc.

---

## Fichiers a modifier

- `src/app/(dashboard)/acquisition/emails/page.tsx` — refaire completement (onglets)
- `src/app/(dashboard)/acquisition/emails/broadcasts/broadcasts-client.tsx` — refaire la liste
- `src/app/(dashboard)/acquisition/emails/broadcasts/new/page.tsx` — ajouter preview
- `src/app/(dashboard)/acquisition/emails/sequences/sequences-client.tsx` — refaire la liste
- `src/app/(dashboard)/acquisition/emails/templates/templates-client.tsx` — refaire la grille
- `src/components/emails/BroadcastFilterBuilder.tsx` — fix URL
- `src/components/emails/DomainSetup.tsx` — polish
- `src/components/emails/EmailBlockBuilder.tsx` — auto-save + variables helper
