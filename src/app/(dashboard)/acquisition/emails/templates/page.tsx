import { redirect } from 'next/navigation'

export default function TemplatesPage() {
  redirect('/acquisition/emails?tab=templates')
}
