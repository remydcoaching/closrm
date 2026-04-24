'use client'

/**
 * Éditeur WYSIWYG pour emails. Basé sur TipTap. Utilisé dans le mode
 * "Email libre" des broadcasts (A-023) et dans le builder v2 pour les
 * blocs de type `text`.
 *
 * Output :
 *   - `onChange(html)` : HTML TipTap (proche inline-safe, à passer à
 *     compiler-v2 ou à stocker tel quel pour les broadcasts libres)
 *
 * Toolbar : gras / italique / souligné / H2 / H3 / listes / lien /
 * dropdown variables ({{prenom}} etc).
 */

import { useState } from 'react'
import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import {
  Bold,
  Italic,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Link as LinkIcon,
  Strikethrough,
} from 'lucide-react'

interface Props {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  minHeight?: number
}

const VARIABLES = [
  { key: '{{prenom}}', label: 'Prénom' },
  { key: '{{nom}}', label: 'Nom' },
  { key: '{{email}}', label: 'Email' },
  { key: '{{telephone}}', label: 'Téléphone' },
  { key: '{{nom_coach}}', label: 'Nom du coach' },
]

export default function RichEmailEditor({ value, onChange, placeholder, minHeight = 200 }: Props) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: {
          openOnClick: false,
          HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
        },
      }),
    ],
    content: value || '',
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        style: `min-height:${minHeight}px;padding:16px;outline:none;font-size:14px;line-height:1.6;color:#e4e4e7;`,
      },
    },
  })

  if (!editor) {
    return <div style={{ padding: 16, color: '#555', fontSize: 13 }}>Chargement de l&apos;éditeur...</div>
  }

  return (
    <div
      style={{
        border: '1px solid #333',
        borderRadius: 8,
        background: '#0a0a0a',
        overflow: 'hidden',
      }}
    >
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
      {placeholder && editor.isEmpty && (
        <div
          style={{
            position: 'relative',
            marginTop: -minHeight,
            padding: 16,
            color: '#555',
            fontSize: 14,
            pointerEvents: 'none',
          }}
        >
          {placeholder}
        </div>
      )}
    </div>
  )
}

function Toolbar({ editor }: { editor: Editor }) {
  const [showVariables, setShowVariables] = useState(false)

  function toggleLink() {
    const previousUrl = editor.getAttributes('link').href
    const url = window.prompt('URL du lien', previousUrl || 'https://')
    if (url === null) return
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }

  function insertVariable(key: string) {
    editor.chain().focus().insertContent(key).run()
    setShowVariables(false)
  }

  return (
    <div
      style={{
        display: 'flex',
        gap: 2,
        padding: '8px 10px',
        borderBottom: '1px solid #262626',
        background: '#141414',
        flexWrap: 'wrap',
        alignItems: 'center',
        position: 'relative',
      }}
    >
      <TbBtn active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
        <Bold size={14} />
      </TbBtn>
      <TbBtn active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <Italic size={14} />
      </TbBtn>
      <TbBtn active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}>
        <Strikethrough size={14} />
      </TbBtn>
      <Divider />
      <TbBtn
        active={editor.isActive('heading', { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        <Heading2 size={14} />
      </TbBtn>
      <TbBtn
        active={editor.isActive('heading', { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      >
        <Heading3 size={14} />
      </TbBtn>
      <Divider />
      <TbBtn
        active={editor.isActive('bulletList')}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List size={14} />
      </TbBtn>
      <TbBtn
        active={editor.isActive('orderedList')}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered size={14} />
      </TbBtn>
      <Divider />
      <TbBtn active={editor.isActive('link')} onClick={toggleLink}>
        <LinkIcon size={14} />
      </TbBtn>
      <Divider />
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => setShowVariables((s) => !s)}
          style={{
            padding: '6px 10px',
            borderRadius: 6,
            border: 'none',
            background: showVariables ? '#2a2a2a' : 'transparent',
            color: '#aaa',
            fontSize: 12,
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          {'{{...}}'} Variable
        </button>
        {showVariables && (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              marginTop: 4,
              background: '#1a1a1a',
              border: '1px solid #2a2a2a',
              borderRadius: 8,
              padding: 6,
              zIndex: 100,
              minWidth: 180,
              boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
            }}
          >
            {VARIABLES.map((v) => (
              <button
                key={v.key}
                onClick={() => insertVariable(v.key)}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '7px 10px',
                  textAlign: 'left',
                  background: 'transparent',
                  border: 'none',
                  color: '#ddd',
                  fontSize: 12,
                  cursor: 'pointer',
                  borderRadius: 4,
                }}
              >
                <code style={{ color: '#93c5fd', fontSize: 11 }}>{v.key}</code> — {v.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function TbBtn({
  active,
  onClick,
  children,
}: {
  active?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: 28,
        height: 28,
        borderRadius: 6,
        border: 'none',
        background: active ? '#E53E3E' : 'transparent',
        color: active ? '#fff' : '#888',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      type="button"
    >
      {children}
    </button>
  )
}

function Divider() {
  return <div style={{ width: 1, height: 18, background: '#2a2a2a', margin: '0 4px' }} />
}
