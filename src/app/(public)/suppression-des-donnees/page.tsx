import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalPage, h2 } from '@/components/legal/LegalPage'
import { LEGAL } from '@/lib/legal'

export const metadata: Metadata = { title: 'Suppression des données — ClosRM' }

// Public page (Meta App Review « Data Deletion Instructions URL »).
export default function DataDeletionPage() {
  return (
    <LegalPage title="Suppression de vos données">
      <p>Vous pouvez supprimer à tout moment les données que ClosRM détient sur vous, y compris celles obtenues via Facebook et Instagram.</p>

      <h2 style={h2}>1. Supprimer votre compte ClosRM (toutes les données)</h2>
      <ol>
        <li>Connectez-vous à ClosRM.</li>
        <li>
          Ouvrez <b>Paramètres › Réglages</b>, bouton <b>Supprimer mon compte</b>.
        </li>
        <li>Confirmez. Votre espace de travail et toutes ses données (prospects, messages, données Meta, statistiques) sont supprimés.</li>
      </ol>

      <h2 style={h2}>2. Retirer l&apos;accès de ClosRM à Facebook et Instagram</h2>
      <ol>
        <li>
          Dans ClosRM : <b>Paramètres › Intégrations › Meta › Déconnecter</b> — les jetons d&apos;accès sont supprimés immédiatement.
        </li>
        <li>
          Dans Facebook : <b>Paramètres et confidentialité › Paramètres › Intégrations professionnelles</b>, sélectionnez <b>ClosRM</b> puis{' '}
          <b>Supprimer</b>.
        </li>
      </ol>

      <h2 style={h2}>3. Par e-mail</h2>
      <p>
        {LEGAL.email ? (
          <>
            Écrivez à <a href={`mailto:${LEGAL.email}?subject=Suppression%20de%20mes%20donn%C3%A9es`}>{LEGAL.email}</a>{' '}
          </>
        ) : (
          'Contactez-nous '
        )}
        en indiquant l&apos;adresse e-mail de votre compte, ou votre nom d&apos;utilisateur Instagram si vous n&apos;avez pas de compte ClosRM. Nous
        supprimons vos données sous 30 jours et vous confirmons la suppression.
      </p>

      <h2 style={h2}>In English</h2>
      <p style={{ fontSize: 14 }}>
        To delete your data: in ClosRM go to <b>Settings › Account › Delete account</b> (all data is removed), or disconnect Meta in{' '}
        <b>Settings › Integrations</b> (access tokens are deleted immediately) and remove ClosRM from Facebook <b>Settings › Business integrations</b>.
        {LEGAL.email ? (
          <>
            {' '}
            You can also email <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>; data is deleted within 30 days.
          </>
        ) : null}{' '}
        See also our <Link href="/confidentialite">privacy policy</Link>.
      </p>
    </LegalPage>
  )
}
