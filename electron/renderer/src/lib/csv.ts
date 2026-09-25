// CSV export for tables — builds the file client-side and hands it to the
// browser download flow (works in Electron's renderer).
export function toCsv(rows: (string | number | null | undefined)[][]): string {
  return rows
    .map((r) =>
      r
        .map((v) => {
          const s = v == null ? '' : String(v)
          return /[";\n,]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
        })
        .join(';'),
    )
    .join('\n')
}

export function downloadCsv(filename: string, rows: (string | number | null | undefined)[][]) {
  // BOM so Excel opens accents correctly.
  const blob = new Blob(['﻿' + toCsv(rows)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
