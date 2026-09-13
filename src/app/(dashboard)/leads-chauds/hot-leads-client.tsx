'use client'

import { useState } from 'react'
import Link from 'next/link'

interface HotLead {
  lead_id: string
  first_name: string
  last_name: string
  instagram_handle: string | null
  score: number
  likes_count: number
  comments_count: number
  dm_count: number
  last_interaction_at: string
}

interface Props {
  initialLeads: HotLead[]
}

export default function HotLeadsClient({ initialLeads }: Props) {
  const [leads] = useState<HotLead[]>(initialLeads)

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>
        Leads chauds à contacter
      </h1>

      {leads.length === 0 ? (
        <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: 40 }}>
          Aucun lead avec une interaction Instagram récente.
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-primary)' }}>
              <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-secondary)' }}>Lead</th>
              <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-secondary)' }}>Score</th>
              <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-secondary)' }}>Détail</th>
              <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-secondary)' }}>
                Dernière interaction
              </th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <tr key={lead.lead_id} style={{ borderBottom: '1px solid var(--border-primary)' }}>
                <td style={{ padding: '8px 12px' }}>
                  <Link href={`/leads/${lead.lead_id}`} style={{ color: 'var(--text-primary)' }}>
                    {lead.first_name} {lead.last_name}
                    {lead.instagram_handle ? ` (@${lead.instagram_handle})` : ''}
                  </Link>
                </td>
                <td style={{ padding: '8px 12px', color: 'var(--color-primary)', fontWeight: 600 }}>
                  🔥 {lead.score}
                </td>
                <td style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>
                  {lead.likes_count} likes · {lead.comments_count} commentaires · {lead.dm_count} DMs
                </td>
                <td style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>
                  {new Date(lead.last_interaction_at).toLocaleDateString('fr-FR')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
