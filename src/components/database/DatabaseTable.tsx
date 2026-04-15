import { ContactRow, ContactGroupBy, LeadStatus, LeadSource } from '@/types'
import StatusBadge from '@/components/leads/StatusBadge'
import SourceBadge from '@/components/leads/SourceBadge'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

interface Props {
  contacts: ContactRow[]
  loading: boolean
  groupBy: ContactGroupBy | ''
  onViewContact: (id: string) => void
}

const th: React.CSSProperties = {
  padding: '10px 14px', textAlign: 'left',
  fontSize: 10, fontWeight: 600, color: 'var(--text-label)',
  textTransform: 'uppercase', letterSpacing: '0.08em', whiteSpace: 'nowrap',
}

const td: React.CSSProperties = {
  padding: '10px 14px', fontSize: 12,
}

function getGroupValue(contact: ContactRow, groupBy: ContactGroupBy): string {
  if (groupBy === 'status') return contact.status
  if (groupBy === 'source') return contact.source
  return ''
}

const GROUP_LABELS: Record<LeadStatus | LeadSource | string, string> = {
  nouveau: 'Nouveau',
  scripte: 'Scripté',
  setting_planifie: 'Setting planifié',
  no_show_setting: 'No-show Setting',
  closing_planifie: 'Closing planifié',
  no_show_closing: 'No-show Closing',
  clos: 'Closé',
  dead: 'Dead',
  facebook_ads: 'Facebook Ads',
  instagram_ads: 'Instagram Ads',
  follow_ads: 'Follow Ads',
  formulaire: 'Formulaire',
  manuel: 'Manuel',
}

export default function DatabaseTable({ contacts, loading, groupBy, onViewContact }: Props) {
  const card: React.CSSProperties = {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border-primary)',
    borderRadius: 12, overflow: 'hidden',
  }

  // Construire les lignes avec séparateurs de groupe
  const rows: Array<{ type: 'group'; label: string; count: number } | { type: 'row'; contact: ContactRow }> = []

  if (groupBy && contacts.length > 0) {
    let lastGroup = ''
    contacts.forEach(contact => {
      const group = getGroupValue(contact, groupBy as ContactGroupBy)
      if (group !== lastGroup) {
        const groupCount = contacts.filter(c => getGroupValue(c, groupBy as ContactGroupBy) === group).length
        rows.push({ type: 'group', label: GROUP_LABELS[group] ?? group, count: groupCount })
        lastGroup = group
      }
      rows.push({ type: 'row', contact })
    })
  } else {
    contacts.forEach(contact => rows.push({ type: 'row', contact }))
  }

  return (
    <div style={card}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-primary)' }}>
              <th style={th}>Date</th>
              <th style={th}>Nom</th>
              <th style={th}>Téléphone</th>
              <th style={{ ...th, maxWidth: 160 }}>Email</th>
              <th style={th}>Source</th>
              <th style={th}>Statut</th>
              <th style={th}>Tags</th>
              <th style={th}>Appels</th>
              <th style={th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} style={{ ...td, textAlign: 'center', color: 'var(--text-muted)', padding: '48px 14px' }}>
                  Chargement...
                </td>
              </tr>
            ) : contacts.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ ...td, textAlign: 'center', color: 'var(--text-muted)', padding: '48px 14px' }}>
                  Aucun contact trouvé
                </td>
              </tr>
            ) : rows.map((row, i) => {
              if (row.type === 'group') {
                return (
                  <tr key={`group-${i}`}>
                    <td colSpan={9} style={{
                      padding: '8px 14px',
                      background: 'var(--bg-subtle)',
                      borderTop: i > 0 ? '1px solid var(--border-primary)' : undefined,
                      borderBottom: '1px solid var(--border-primary)',
                      fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
                      letterSpacing: '0.06em', textTransform: 'uppercase',
                    }}>
                      {row.label} <span style={{ fontWeight: 400, color: 'var(--text-label)' }}>({row.count})</span>
                    </td>
                  </tr>
                )
              }

              const { contact } = row
              const isDead = contact.status === 'dead'

              return (
                <tr
                  key={contact.id}
                  style={{ borderBottom: '1px solid var(--bg-subtle)', opacity: isDead ? 0.55 : 1 }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-subtle)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  {/* Date */}
                  <td style={{ ...td, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {format(new Date(contact.created_at), 'dd MMM yyyy', { locale: fr })}
                  </td>

                  {/* Nom */}
                  <td style={{ ...td, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                    {contact.first_name} {contact.last_name}
                  </td>

                  {/* Téléphone */}
                  <td style={{ ...td, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
                    {contact.phone || <span style={{ color: 'var(--text-label)' }}>—</span>}
                  </td>

                  {/* Email */}
                  <td style={{ ...td, color: '#777', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {contact.email || <span style={{ color: 'var(--text-label)' }}>—</span>}
                  </td>

                  {/* Source */}
                  <td style={td}>
                    <SourceBadge source={contact.source} />
                  </td>

                  {/* Statut */}
                  <td style={td}>
                    <StatusBadge status={contact.status} />
                  </td>

                  {/* Tags */}
                  <td style={td}>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {contact.tags.slice(0, 2).map(tag => (
                        <span key={tag} style={{
                          padding: '2px 7px', borderRadius: 99, fontSize: 10, fontWeight: 600,
                          background: 'var(--border-primary)', color: 'var(--text-muted)',
                        }}>
                          {tag}
                        </span>
                      ))}
                      {contact.tags.length > 2 && (
                        <span style={{ fontSize: 10, color: 'var(--text-label)' }}>+{contact.tags.length - 2}</span>
                      )}
                      {contact.tags.length === 0 && <span style={{ color: 'var(--text-label)', fontSize: 11 }}>—</span>}
                    </div>
                  </td>

                  {/* Nb appels + dernier appel */}
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>
                    <div style={{ color: contact.nb_calls > 0 ? 'var(--text-primary)' : 'var(--text-label)', fontWeight: 600 }}>
                      {contact.nb_calls} appel{contact.nb_calls !== 1 ? 's' : ''}
                    </div>
                    {contact.last_call_at && (
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>
                        dernier: {format(new Date(contact.last_call_at), 'dd MMM', { locale: fr })}
                      </div>
                    )}
                  </td>

                  {/* Actions */}
                  <td style={td}>
                    <button
                      onClick={() => onViewContact(contact.id)}
                      style={{
                        padding: '5px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                        background: 'rgba(0,200,83,0.10)', border: '1px solid rgba(0,200,83,0.2)',
                        color: 'var(--color-primary)', cursor: 'pointer', whiteSpace: 'nowrap',
                      }}
                    >
                      Voir
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
