'use client'

import { useCallback, useRef, useState } from 'react'
import { Upload, X } from 'lucide-react'

const MAX_IMAGES = 10

interface Props {
  onImagesReady: (dataUrls: string[]) => void
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export default function UploadStep({ onImagesReady }: Props) {
  const [previews, setPreviews] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFiles = useCallback(async (files: FileList) => {
    const imageFiles = Array.from(files).filter((f) => f.type.startsWith('image/'))
    if (imageFiles.length === 0) return
    if (previews.length + imageFiles.length > MAX_IMAGES) {
      alert(`Maximum ${MAX_IMAGES} images par import.`)
      return
    }
    const dataUrls = await Promise.all(imageFiles.map(fileToDataUrl))
    setPreviews((prev) => [...prev, ...dataUrls])
  }, [previews.length])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files)
  }, [handleFiles])

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) handleFiles(e.target.files)
    e.target.value = ''
  }, [handleFiles])

  const removeAt = (idx: number) => {
    setPreviews((prev) => prev.filter((_, i) => i !== idx))
  }

  return (
    <div>
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: '2px dashed var(--border-primary)', borderRadius: 12, padding: '40px 30px',
          textAlign: 'center', cursor: 'pointer', background: 'var(--bg-elevated)',
        }}
      >
        <Upload size={32} color="var(--text-muted)" style={{ marginBottom: 10 }} />
        <p style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 600, margin: '0 0 4px' }}>
          Glissez vos captures d'écran ici ou cliquez pour sélectionner
        </p>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>
          {previews.length}/{MAX_IMAGES} images
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleInputChange}
          style={{ display: 'none' }}
        />
      </div>

      {previews.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginTop: 16 }}>
          {previews.map((src, idx) => (
            <div key={idx} style={{ position: 'relative' }}>
              <img
                src={src}
                alt={`Capture ${idx + 1}`}
                style={{ width: '100%', aspectRatio: '9/16', objectFit: 'cover', borderRadius: 8 }}
              />
              <button
                onClick={() => removeAt(idx)}
                style={{
                  position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 11,
                  background: 'rgba(0,0,0,0.7)', border: 'none', color: '#fff', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {previews.length > 0 && (
        <button
          onClick={() => onImagesReady(previews)}
          style={{
            marginTop: 16, padding: '10px 20px', borderRadius: 8, fontSize: 14, fontWeight: 600,
            background: 'var(--color-primary)', color: '#000', border: 'none', cursor: 'pointer',
          }}
        >
          Analyser {previews.length} capture{previews.length > 1 ? 's' : ''}
        </button>
      )}
    </div>
  )
}
