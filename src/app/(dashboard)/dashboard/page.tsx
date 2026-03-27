'use client'

import { Users, Phone, TrendingUp, Target, ArrowUpRight, Calendar, Clock, Activity } from 'lucide-react'

const card: React.CSSProperties = {
  background: '#0f0f11',
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: 14,
  padding: 20,
}

export default function DashboardPage() {
  return (
    <div style={{ padding: 32 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#fff' }}>Dashboard</h1>
      <p style={{ fontSize: 13, color: '#666', margin: '4px 0 28px' }}>Vue d&apos;ensemble de votre activité</p>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14, marginBottom: 14 }}>
        {[
          { label: 'Nouveaux leads', value: '0', icon: Users, color: '#3b82f6' },
          { label: 'Appels planifiés', value: '0', icon: Phone, color: '#f59e0b' },
          { label: 'Deals closés', value: '0', icon: Target, color: '#00C853' },
          { label: 'Taux de closing', value: '0%', icon: TrendingUp, color: '#a855f7' },
        ].map((k) => {
          const I = k.icon
          return (
            <div key={k.label} style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: k.color + '15', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <I size={16} color={k.color} />
                </div>
                <span style={{ fontSize: 10, color: '#00C853', display: 'flex', alignItems: 'center', gap: 2 }}>
                  <ArrowUpRight size={10} />+0%
                </span>
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#fff' }}>{k.value}</div>
              <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>{k.label}</div>
            </div>
          )
        })}
      </div>

      {/* Two cols */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 14, marginBottom: 14 }}>
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Calendar size={15} color="#f59e0b" />
              <span style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>Prochains appels</span>
            </div>
            <span style={{ fontSize: 10, color: '#555', textTransform: 'uppercase' as const, letterSpacing: '0.1em' }}>Aujourd&apos;hui</span>
          </div>
          <div style={{ textAlign: 'center', padding: '28px 0' }}>
            <Phone size={22} color="#333" />
            <p style={{ fontSize: 13, color: '#888', marginTop: 10 }}>Aucun appel planifié</p>
            <p style={{ fontSize: 11, color: '#555', marginTop: 4 }}>Planifiez depuis la page Leads</p>
          </div>
        </div>

        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Clock size={15} color="#ef4444" />
              <span style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>Follow-ups en retard</span>
            </div>
            <span style={{ fontSize: 10, color: '#00C853', background: 'rgba(0,200,83,0.08)', padding: '3px 10px', borderRadius: 99, fontWeight: 600 }}>À jour</span>
          </div>
          <div style={{ textAlign: 'center', padding: '28px 0' }}>
            <Target size={22} color="#333" />
            <p style={{ fontSize: 13, color: '#888', marginTop: 10 }}>Aucun follow-up en retard</p>
            <p style={{ fontSize: 11, color: '#555', marginTop: 4 }}>Vos relances sont à jour</p>
          </div>
        </div>
      </div>

      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
          <Activity size={15} color="#888" />
          <span style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>Activité récente</span>
        </div>
        <div style={{ textAlign: 'center', padding: '28px 0' }}>
          <p style={{ fontSize: 13, color: '#888' }}>Aucune activité pour le moment</p>
          <p style={{ fontSize: 11, color: '#555', marginTop: 4 }}>Votre historique apparaîtra ici</p>
        </div>
      </div>
    </div>
  )
}
