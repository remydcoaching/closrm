'use client'

import type { TestimonialsBlockConfig, TestimonialItem } from '@/types'

interface Props {
  config: TestimonialsBlockConfig
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function Stars({ rating }: { rating: number }) {
  return (
    <div style={{ display: 'flex', gap: 2, marginBottom: 8 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} style={{ color: i <= rating ? '#f5a623' : '#ddd', fontSize: 16 }}>★</span>
      ))}
    </div>
  )
}

function TestimonialCard({ item }: { item: TestimonialItem }) {
  return (
    <div style={{
      background: '#fff',
      borderRadius: 12,
      padding: 24,
      boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
      flex: '1 1 0',
      minWidth: 240,
    }}>
      <Stars rating={item.rating} />
      <p style={{ fontSize: 15, lineHeight: 1.6, color: '#333', margin: '0 0 16px', fontStyle: 'italic' }}>
        &ldquo;{item.content}&rdquo;
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {item.avatarUrl ? (
          <img
            src={item.avatarUrl}
            alt={item.name}
            style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }}
          />
        ) : (
          <div style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: 'var(--color-primary, #E53E3E)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            fontSize: 14,
          }}>
            {getInitials(item.name)}
          </div>
        )}
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#111' }}>{item.name}</div>
          {item.role && (
            <div style={{ fontSize: 12, color: '#777', fontStyle: 'italic' }}>{item.role}</div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function TestimonialsBlock({ config }: Props) {
  if (!config.items || config.items.length === 0) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center', color: '#999' }}>
        Aucun témoignage configuré
      </div>
    )
  }

  return (
    <div style={{ padding: '40px 20px', maxWidth: 1000, margin: '0 auto' }}>
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 20,
      }}>
        {config.items.map((item, i) => (
          <TestimonialCard key={i} item={item} />
        ))}
      </div>
    </div>
  )
}
