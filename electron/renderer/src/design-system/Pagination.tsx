// Page size (10 / 20 / 50 / 100) + previous/next for client-side lists —
// the same control under every long table.
import { useEffect, useMemo, useState } from 'react'
import { Chips } from './Tabs'
import './pagination.css'

export const PAGE_SIZES = [10, 20, 50, 100] as const
export type PageSize = (typeof PAGE_SIZES)[number]

export function usePaged<T>(rows: T[], initialSize: PageSize = 20) {
  const [size, setSize] = useState<PageSize>(initialSize)
  const [page, setPage] = useState(1)
  const pages = Math.max(1, Math.ceil(rows.length / size))
  // Back to page 1 whenever the list or the page size changes.
  useEffect(() => setPage(1), [rows, size])
  const pageRows = useMemo(() => rows.slice((page - 1) * size, page * size), [rows, page, size])
  return { pageRows, page: Math.min(page, pages), pages, size, setPage, setSize, total: rows.length }
}

export function PaginationBar({
  total,
  page,
  pages,
  size,
  onPage,
  onSize,
}: {
  total: number
  page: number
  pages: number
  size: PageSize
  onPage: (p: number) => void
  onSize: (s: PageSize) => void
}) {
  if (total <= PAGE_SIZES[0]) return null
  const from = (page - 1) * size + 1
  const to = Math.min(page * size, total)
  return (
    <div className="ds-pagination">
      <div className="ds-pagination-size">
        <span>Afficher</span>
        <Chips items={PAGE_SIZES.map((s) => ({ key: String(s), label: String(s) }))} active={String(size)} onChange={(k) => onSize(Number(k) as PageSize)} />
      </div>
      <div className="ds-pagination-nav">
        <span className="ds-pagination-range">
          {from}–{to} sur {new Intl.NumberFormat('fr-FR').format(total)}
        </span>
        <button type="button" className="ds-pill-button" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          ←
        </button>
        <button type="button" className="ds-pill-button" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          →
        </button>
      </div>
    </div>
  )
}
