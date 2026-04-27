'use client'

import { useState } from 'react'
import { MessageCircle, Mail } from 'lucide-react'
import InstagramMessagesView from '@/components/messages/InstagramMessagesView'
import EmailMessagesView from '@/components/messages/EmailMessagesView'

type Channel = 'instagram' | 'email'

export default function MessagesPage() {
  const [channel, setChannel] = useState<Channel>('instagram')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <div
        style={{
          display: 'flex',
          gap: 4,
          padding: '12px 20px 0',
          borderBottom: '1px solid var(--border-primary)',
          flexShrink: 0,
        }}
      >
        <TabButton
          active={channel === 'instagram'}
          onClick={() => setChannel('instagram')}
          icon={<MessageCircle size={15} />}
          label="Instagram"
        />
        <TabButton
          active={channel === 'email'}
          onClick={() => setChannel('email')}
          icon={<Mail size={15} />}
          label="Email"
        />
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {channel === 'instagram' ? <InstagramMessagesView /> : <EmailMessagesView />}
      </div>
    </div>
  )
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '10px 16px',
        background: 'transparent',
        border: 'none',
        borderBottom: active ? '2px solid var(--color-primary)' : '2px solid transparent',
        color: active ? 'var(--text-primary)' : 'var(--text-tertiary)',
        fontSize: 13,
        fontWeight: active ? 600 : 500,
        cursor: 'pointer',
        transition: 'all 0.15s',
        marginBottom: -1,
      }}
    >
      {icon}
      {label}
    </button>
  )
}
