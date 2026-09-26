// Acquisition > Messages — mirrors src/app/(dashboard)/acquisition/messages:
// unified inbox with an Instagram channel (DMs) and an Email channel
// (replies to sent emails), same endpoints and refresh cadence as the web.
import { useState } from 'react'
import { Tabs } from '../../design-system/Tabs'
import { InstagramInbox } from './messages/InstagramInbox'
import { EmailInbox } from './messages/EmailInbox'
import './marketing.css'
import '../leads/lead-create-modal.css'

type Channel = 'instagram' | 'email'

export function MessagesPage() {
  const [channel, setChannel] = useState<Channel>('instagram')
  return (
    <div className="mk-inbox-page">
      <div className="mk-header">
        <div>
          <h1>Messages</h1>
          <p>Vos conversations Instagram et email au même endroit</p>
        </div>
        <Tabs
          items={[
            { key: 'instagram' as Channel, label: 'Instagram' },
            { key: 'email' as Channel, label: 'Email' },
          ]}
          active={channel}
          onChange={setChannel}
        />
      </div>
      {channel === 'instagram' ? <InstagramInbox /> : <EmailInbox />}
    </div>
  )
}
