import { notFound } from 'next/navigation'
import { getBoardBySlug, getTasksForBoard } from '@/lib/pm/queries'
import KanbanClient from './KanbanClient'

export const dynamic = 'force-dynamic'
export const metadata = { robots: 'noindex, nofollow' }

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const board = await getBoardBySlug(slug)
  if (!board) notFound()

  const tasks = await getTasksForBoard(board.id)

  return <KanbanClient slug={slug} board={board} initialTasks={tasks} />
}
