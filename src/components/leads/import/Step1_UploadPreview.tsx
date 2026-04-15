'use client'

import { useCallback, useRef } from 'react'
import { Upload, FileText, ArrowRight } from 'lucide-react'
import { parseCsvFile, autoMapColumns } from '@/lib/leads/csv-parser'
import type { WizardState } from '@/app/(dashboard)/leads/import/import-client'

interface Props {
  state: WizardState
  updateState: (partial: Partial<WizardState>) => void
  onNext: () => void
}

const MAX_SIZE = 5 * 1024 * 1024 // 5 MB
const MAX_ROWS = 5000

export default function Step1_UploadPreview({ state, updateState, onNext }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.endsWith('.csv')) {
      alert('Seuls les fichiers CSV sont acceptés.')
      return
    }
    if (file.size > MAX_SIZE) {
      alert('Le fichier dépasse 5 Mo.')
      return
    }

    const result = await parseCsvFile(file)

    if (result.totalRows > MAX_ROWS) {
      alert(`Le fichier contient ${result.totalRows} lignes. Maximum : ${MAX_ROWS}.`)
      return
    }

    const mappings = autoMapColumns(result.headers)

    updateState({
      fileName: file.name,
      headers: result.headers,
      rows: result.rows,
      totalRows: result.totalRows,
      detectedDelimiter: result.detectedDelimiter,
      columnMappings: mappings,
    })
  }, [updateState])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }, [handleFile])

  const previewRows = state.rows.slice(0, 10)
  const hasFile = state.totalRows > 0

  return (
    <div>
      {!hasFile && (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: '2px dashed var(--border-primary)', borderRadius: 12, padding: '60px 40px',
            textAlign: 'center', cursor: 'pointer', background: 'var(--bg-elevated)',
            transition: 'border-color 0.2s',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--color-primary)' }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-primary)' }}
        >
          <Upload size={40} color="var(--text-muted)" style={{ marginBottom: 12 }} />
          <p style={{ fontSize: 15, color: 'var(--text-primary)', fontWeight: 600, margin: '0 0 6px' }}>
            Glissez votre fichier CSV ici ou cliquez pour sélectionner
          </p>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
            CSV uniquement — 5 Mo max — 5 000 lignes max
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleInputChange}
            style={{ display: 'none' }}
          />
        </div>
      )}

      {hasFile && (
        <>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20,
            padding: '12px 16px', background: 'var(--bg-elevated)', borderRadius: 8, border: '1px solid var(--border-primary)',
          }}>
            <FileText size={18} color="#E53E3E" />
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>{state.fileName}</p>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>
                {state.totalRows} lignes — séparateur : « {state.detectedDelimiter === ',' ? ',' : state.detectedDelimiter === ';' ? ';' : 'tab'} »
              </p>
            </div>
            <button
              onClick={() => {
                updateState({ fileName: '', headers: [], rows: [], totalRows: 0, columnMappings: [] })
              }}
              style={{
                padding: '6px 12px', borderRadius: 6, fontSize: 12,
                background: 'transparent', border: '1px solid var(--border-primary)', color: 'var(--text-secondary)', cursor: 'pointer',
              }}
            >
              Changer de fichier
            </button>
          </div>

          <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid var(--border-primary)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  {state.headers.map((h) => (
                    <th key={h} style={{
                      padding: '10px 14px', textAlign: 'left', fontWeight: 600,
                      color: 'var(--text-primary)', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-primary)',
                      whiteSpace: 'nowrap',
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row, i) => (
                  <tr key={i}>
                    {state.headers.map((h) => (
                      <td key={h} style={{
                        padding: '8px 14px', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-secondary)',
                        whiteSpace: 'nowrap', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        {row[h] || '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {state.totalRows > 10 && (
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
              Aperçu des 10 premières lignes sur {state.totalRows}
            </p>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24 }}>
            <button onClick={onNext} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '10px 20px', borderRadius: 8, fontSize: 14, fontWeight: 600,
              background: 'var(--color-primary)', border: 'none', color: '#000', cursor: 'pointer',
            }}>
              Continuer
              <ArrowRight size={16} />
            </button>
          </div>
        </>
      )}
    </div>
  )
}
