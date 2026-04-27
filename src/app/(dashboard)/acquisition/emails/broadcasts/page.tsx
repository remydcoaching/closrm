import { redirect } from 'next/navigation'

export default function BroadcastsPage() {
  redirect('/acquisition/emails?tab=campagnes')
}
