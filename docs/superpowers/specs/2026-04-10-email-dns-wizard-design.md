# Spec — Redesign flow configuration domaine email (DNS Wizard)

> Date : 2026-04-10
> Statut : Validé

## Problème

La configuration du domaine email est trop brute : les 3 records DNS sont affichés d'un coup sans guidance. Le coach ne sait pas qu'il doit d'abord supprimer ses anciens records, ne comprend pas ce que fait chaque record, et doit cliquer manuellement "Vérifier" sans feedback en temps réel. Résultat : setup raté, frustration, abandon.

## Solution

Remplacer le composant `DomainSetup.tsx` par un wizard 4 étapes guidé, avec nettoyage DNS, records un par un, polling live, et tips par registrar.

## Wizard — 4 étapes

### Étape 1 — Ajouter le domaine

- Input nom de domaine avec placeholder "moncoaching.fr"
- Tips : "Utilisez votre domaine principal (ex: moncoaching.fr) ou un sous-domaine (ex: mail.moncoaching.fr)"
- Bouton "Continuer" → `POST /api/emails/domains` (appel Resend API)
- Si le domaine existe déjà dans le workspace → message d'erreur inline
- Après succès → passe à l'étape 2 avec les records DNS récupérés

### Étape 2 — Nettoyage DNS

Avant d'ajouter les nouveaux records, le coach doit nettoyer les anciens :

**Checklist :**
- [ ] Supprimez les anciens records MX sur ce domaine/sous-domaine (si existants)
- [ ] Supprimez les anciens records TXT contenant `v=spf1` sur ce domaine (si existants)
- [ ] Supprimez les anciens records CNAME de type DKIM (si existants)

Chaque item est une checkbox. Le coach coche quand c'est fait (ou quand il n'y en avait pas).

**Guide par registrar :**

Accordion avec les registrars populaires. Chaque entrée contient :
- Nom + logo/icône
- "Connectez-vous à [lien direct panel DNS]"
- Instructions courtes : "Allez dans Zone DNS > sélectionnez le domaine > supprimez les records MX/TXT/CNAME existants"

Registrars couverts :
- OVH → https://www.ovh.com/manager/
- Namecheap → https://ap.www.namecheap.com/
- GoDaddy → https://dcc.godaddy.com/
- Ionos → https://my.ionos.fr/
- Hostinger → https://hpanel.hostinger.com/

Bouton "C'est fait, continuer" (activé quand au moins une checkbox est cochée).

### Étape 3 — Ajouter les records DNS

Affiche les records **un par un** (pas tous d'un coup).

Pour chaque record :
- Badge type (TXT, MX, CNAME) avec couleur
- Champ "Nom" avec bouton copier
- Champ "Valeur" avec bouton copier
- Si MX : afficher aussi la priorité
- Explication courte par type :
  - TXT (domainkey) : "Ce record vérifie que vous êtes propriétaire du domaine"
  - MX : "Ce record permet de gérer les réponses à vos emails"
  - TXT (SPF) : "Ce record autorise nos serveurs à envoyer des emails en votre nom"

Bouton "J'ai ajouté ce record →" → passe au record suivant.

Barre de progression : "Record 1/3", "Record 2/3", "Record 3/3".

Après le dernier record → bouton "Vérifier mes DNS →" → passe à l'étape 4.

### Étape 4 — Vérification

**Polling live :**
- `setInterval` toutes les 30 secondes
- Appelle `POST /api/emails/domains/{id}/verify`
- Affiche chaque record avec statut en temps réel :
  - Spinner jaune : "En cours de vérification..."
  - Check vert : "Vérifié"
  - Croix rouge : "Échoué" + tip inline

**Barre de progression globale :** "2/3 records vérifiés"

**Message :** "La propagation DNS peut prendre de quelques minutes à 48h. Cette page se met à jour automatiquement."

**Troubleshooting inline par record échoué :**
- "Vérifiez que la valeur est exactement identique (pas d'espace en trop)"
- "Assurez-vous d'avoir sélectionné le bon type d'enregistrement (TXT, pas CNAME)"
- "Si vous venez d'ajouter le record, attendez quelques minutes"

**Quand tout est vérifié :**
- Animation de succès (check vert animé)
- Message : "Votre domaine est vérifié et prêt à envoyer des emails !"
- Champs éditables : Nom affiché (from name) + Adresse d'envoi (from email)
- Bouton "Terminer" → retour à la vue normale

## Polling background (cron)

Nouveau bloc dans `workflow-scheduler/route.ts` :

1. Chercher les `email_domains` où `status = 'pending'`
2. Pour chaque domaine : appeler Resend API verify + get
3. Mettre à jour le statut et les records en base
4. Compteur `email_domains_verified` dans la réponse

## Composant

Réécriture de `src/components/emails/DomainSetup.tsx` → renommé `DomainWizard.tsx`.

State machine simple :
```typescript
type WizardStep = 'domain' | 'cleanup' | 'records' | 'verify'
const [step, setStep] = useState<WizardStep>('domain')
```

Chaque étape est rendue inline dans le composant via un switch/case. Pas de fichiers séparés.

**Props :**
```typescript
interface DomainWizardProps {
  existingDomain: EmailDomain | null  // null = pas de domaine, montrer étape 1
  onDomainChange: () => void          // callback pour refresh après modif
}
```

Si `existingDomain` est fourni et `status === 'verified'` → afficher directement la vue "domaine vérifié" (from name/email, bouton déconnecter).

Si `existingDomain` est fourni et `status === 'pending'` → reprendre au step `verify` (polling).

## Barre de progression du wizard

En haut du wizard, barre visuelle avec les 4 étapes :
```
[1 Domaine] ─── [2 Nettoyage] ─── [3 Records] ─── [4 Vérification]
     ✓              ●                  ○                  ○
```

Étapes complétées = check vert, étape courante = point plein accent, futures = point vide.

## Fichiers impactés

| Fichier | Changement |
|---------|-----------|
| `src/components/emails/DomainSetup.tsx` | Supprimé — remplacé par DomainWizard.tsx |
| `src/components/emails/DomainWizard.tsx` | Nouveau — wizard 4 étapes complet |
| `src/app/(dashboard)/acquisition/emails/page.tsx` | Import DomainWizard au lieu de DomainSetup |
| `src/app/api/cron/workflow-scheduler/route.ts` | Nouveau bloc polling DNS background |

## Hors scope

- Vidéo tutoriel intégrée
- Screenshots par registrar (trop de maintenance)
- Webhook Resend pour domain verification (pas supporté)
- DMARC configuration (V2)
- Détection automatique du registrar
