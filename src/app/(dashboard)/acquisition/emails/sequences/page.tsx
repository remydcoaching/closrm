import { redirect } from 'next/navigation'

export default function SequencesPage() {
  redirect('/acquisition/emails?tab=sequences')
}
