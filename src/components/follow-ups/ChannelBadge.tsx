import { FollowUpChannel } from '@/types'
import { MessageCircle, Mail, User, AtSign } from 'lucide-react'

const CHANNEL_CONFIG: Record<FollowUpChannel, { label: string; color: string; bg: string; icon: typeof MessageCircle }> = {
  whatsapp: { label: 'WhatsApp', color: '#22c55e', bg: 'rgba(34,197,94,0.12)', icon: MessageCircle },
  email: { label: 'Email', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)', icon: Mail },
  instagram_dm: { label: 'Instagram DM', color: '#e879f9', bg: 'rgba(232,121,249,0.12)', icon: AtSign },
  manuel: { label: 'Manuel', color: 'var(--text-tertiary)', bg: 'rgba(136,136,136,0.12)', icon: User },
}

export default function ChannelBadge({ channel }: { channel: FollowUpChannel }) {
  const c = CHANNEL_CONFIG[channel]
  const Icon = c.icon
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 600, color: c.color, background: c.bg }}>
      <Icon size={12} />{c.label}
    </span>
  )
}
