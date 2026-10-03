import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalPage, h2 } from '@/components/legal/LegalPage'
import { LEGAL } from '@/lib/legal'

export const metadata: Metadata = { title: 'Politique de confidentialité — ClosRM' }

// Public page (Meta App Review « Privacy Policy URL »). Describes what the
// app actually does — keep it in sync when a data source or provider changes.
export default function PrivacyPolicyPage() {
  return (
    <LegalPage title="Politique de confidentialité">
      <p style={{ color: '#6e6e73', fontSize: 13 }}>Dernière mise à jour : {LEGAL.updatedAt}</p>

      <p>
        ClosRM est un logiciel de gestion de la relation client (CRM) destiné aux coachs indépendants : suivi des prospects, agenda, messages,
        statistiques et analyse de leur compte Instagram. Cette politique explique quelles données ClosRM traite, pourquoi, avec qui, combien de
        temps, et comment exercer vos droits.
      </p>

      <h2 style={h2}>Qui est responsable</h2>
      <p>
        Le service est édité par {LEGAL.company}
        {LEGAL.address ? `, ${LEGAL.address}` : ''}.{' '}
        {LEGAL.email ? (
          <>
            Contact : <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>.
          </>
        ) : null}{' '}
        Pour les données de vos prospects et clients, vous (le coach) êtes responsable du traitement et ClosRM agit comme sous-traitant, sur vos
        instructions.
      </p>

      <h2 style={h2}>Données traitées</h2>
      <ul>
        <li>
          <b>Votre compte</b> : nom, adresse e-mail, mot de passe (stocké sous forme chiffrée par notre fournisseur d&apos;authentification), photo,
          nom de votre espace de travail, membres de votre équipe.
        </li>
        <li>
          <b>Vos prospects et clients</b> : les informations que vous saisissez, importez ou recevez (nom, téléphone, e-mail, pseudo Instagram, notes,
          rendez-vous, appels, ventes, statut dans votre pipeline).
        </li>
        <li>
          <b>Données Meta (Facebook / Instagram), avec votre autorisation</b> : votre Page Facebook et votre compte Instagram professionnel, vos
          publications et leurs statistiques, les commentaires reçus et vos réponses, les messages privés de votre messagerie Instagram, les leads de
          vos formulaires publicitaires et les statistiques de vos publicités.
        </li>
        <li>
          <b>Interactions publiques avec votre propre compte</b> : comptes qui aiment, commentent ou regardent vos contenus, lus à partir de votre
          compte connecté ou de fournisseurs d&apos;analyse de données Instagram publiques, pour vous montrer qui s&apos;intéresse à votre activité.
        </li>
        <li>
          <b>Services que vous connectez</b> : agenda Google (rendez-vous), e-mails envoyés et reçus via la messagerie de ClosRM, notifications
          (Telegram, WhatsApp).
        </li>
        <li>
          <b>Données techniques</b> : journaux d&apos;accès et d&apos;erreurs nécessaires au fonctionnement et à la sécurité du service.
        </li>
      </ul>

      <h2 style={h2}>Pourquoi (finalités et bases légales)</h2>
      <ul>
        <li>Fournir le service que vous utilisez : CRM, agenda, messagerie, statistiques, automatisations — exécution du contrat.</li>
        <li>Sécuriser le service et prévenir les abus — intérêt légitime.</li>
        <li>Vous envoyer les e-mails liés à votre compte — exécution du contrat.</li>
        <li>Connecter vos comptes Meta, Google ou autres — votre consentement, que vous pouvez retirer à tout moment en les déconnectant.</li>
      </ul>
      <p>
        ClosRM ne vend aucune donnée, n&apos;affiche pas de publicité et n&apos;utilise pas vos données (ni celles de vos prospects) pour faire de la
        publicité ciblée.
      </p>

      <h2 style={h2}>Données issues de Meta</h2>
      <p>
        Les données obtenues via les API de Meta servent uniquement à afficher et gérer, dans votre espace, votre compte, vos contenus, vos messages,
        vos commentaires et vos publicités. Elles ne sont ni vendues, ni partagées avec des tiers à d&apos;autres fins, ni utilisées pour entraîner
        des modèles. Les jetons d&apos;accès sont chiffrés et ne sont jamais transmis à votre navigateur. Si vous déconnectez Meta, les jetons sont
        supprimés ; pour supprimer toutes les données, voir{' '}
        <Link href="/suppression-des-donnees">Suppression des données</Link>.
      </p>

      <h2 style={h2}>Avec qui (sous-traitants)</h2>
      <ul>
        <li>Supabase — base de données et authentification, hébergées dans l&apos;Union européenne (Francfort).</li>
        <li>Vercel — hébergement de l&apos;application (région Francfort).</li>
        <li>Meta Platforms — API Facebook et Instagram, à votre demande.</li>
        <li>Google — agenda, si vous le connectez.</li>
        <li>Amazon Web Services (SES, Irlande) et Resend — envoi et réception des e-mails.</li>
        <li>HikerAPI et Apify — lecture des interactions publiques avec votre compte Instagram.</li>
        <li>Anthropic — assistant IA, uniquement si vous l&apos;activez avec votre propre clé.</li>
        <li>Stripe — paiements, si vous souscrivez un abonnement payant.</li>
      </ul>
      <p>Certains de ces prestataires peuvent traiter des données hors de l&apos;UE ; ces transferts sont encadrés par les clauses contractuelles types de la Commission européenne.</p>

      <h2 style={h2}>Combien de temps</h2>
      <p>
        Vos données sont conservées tant que votre compte existe. Après la suppression de votre compte, elles sont effacées sous 30 jours, sauf
        obligation légale de conservation (par exemple des factures). Les journaux techniques sont conservés au plus 12 mois.
      </p>

      <h2 style={h2}>Sécurité</h2>
      <p>
        Connexions chiffrées (HTTPS), cloisonnement strict des données par espace de travail, jetons d&apos;accès chiffrés, accès limité aux
        personnes qui en ont besoin.
      </p>

      <h2 style={h2}>Vos droits</h2>
      <p>
        Vous disposez d&apos;un droit d&apos;accès, de rectification, d&apos;effacement, de limitation, d&apos;opposition et de portabilité de vos
        données. {LEGAL.email ? <>Écrivez-nous à <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>. </> : null}Nous répondons sous 30 jours. Vous
        pouvez aussi saisir la CNIL (cnil.fr).
      </p>

      <h2 style={h2}>Summary in English</h2>
      <p style={{ fontSize: 14 }}>
        ClosRM is a CRM for independent coaches. With the user&apos;s permission it uses Meta APIs to show and manage the user&apos;s own Facebook
        Page and Instagram professional account: posts and insights, comments and replies, Instagram direct messages, lead ads and ads statistics.
        Meta data is used only to provide these features inside the user&apos;s workspace; it is never sold, shared for other purposes or used for
        advertising. Access tokens are encrypted and never sent to the browser. Data is hosted in the EU (Supabase and Vercel, Frankfurt). Users can
        delete their data at any time — see the <Link href="/suppression-des-donnees">data deletion instructions</Link>.
      </p>
    </LegalPage>
  )
}
