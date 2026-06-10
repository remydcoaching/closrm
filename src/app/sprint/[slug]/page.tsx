import { notFound } from 'next/navigation'
import { getSprintBySlug, getDayKpisForSprint } from '@/lib/sprint/queries'
import SprintClient from './SprintClient'

export const dynamic = 'force-dynamic'
export const metadata = { robots: 'noindex, nofollow' }

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const sprint = await getSprintBySlug(slug)
  if (!sprint) notFound()

  const dayKpis = await getDayKpisForSprint(sprint.id)

  return <SprintClient sprint={sprint} initialDayKpis={dayKpis} />
}
