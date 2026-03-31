'use client'

import Link from 'next/link'
import { Users, Phone, BarChart2, Zap, Bell, Megaphone, Calendar, MessageCircle, ArrowRight, Check, Play, Star, TrendingUp, Target } from 'lucide-react'
import LandingNavbar from './landing-navbar'
import ParticlesCanvas from './particles-canvas'
import FadeIn from './fade-in'

const W: React.CSSProperties = { maxWidth: 1100, margin: '0 auto', padding: '0 32px' }
const card: React.CSSProperties = { background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)', borderRadius: 16, padding: 28, overflow: 'hidden' }
const greenBtn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 8, padding: '14px 32px', background: 'var(--color-primary)', color: '#fff', fontWeight: 600, fontSize: 15, borderRadius: 12, textDecoration: 'none', boxShadow: '0 4px 30px rgba(0,200,83,0.25)' }
const ghostBtn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 8, padding: '14px 32px', border: '1px solid var(--border-primary)', color: 'var(--text-secondary)', fontSize: 15, borderRadius: 12, textDecoration: 'none' }

export default function LandingPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontFamily: "'Inter', sans-serif" }}>
      <LandingNavbar />

      {/* ── HERO ── */}
      <section style={{ position: 'relative', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 32px 60px' }}>
        <ParticlesCanvas />
        <div style={{ position: 'absolute', top: '20%', left: '20%', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,200,83,0.06), transparent 70%)', filter: 'blur(80px)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', zIndex: 10, textAlign: 'center', maxWidth: 800 }}>
          <FadeIn>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 18px', borderRadius: 99, border: '1px solid rgba(0,200,83,0.2)', background: 'rgba(0,200,83,0.05)', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 32 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-primary)' }} /> Plateforme tout-en-un pour coachs
            </div>
          </FadeIn>
          <FadeIn delay={0.1}>
            <h1 style={{ fontSize: 'clamp(36px, 6vw, 72px)', fontWeight: 800, lineHeight: 1.05, marginBottom: 24 }}>
              Transformez vos <span style={{ color: 'var(--color-primary)' }}>leads</span><br />en clients
            </h1>
          </FadeIn>
          <FadeIn delay={0.2}>
            <p style={{ fontSize: 17, color: 'var(--text-tertiary)', maxWidth: 560, margin: '0 auto 40px', lineHeight: 1.6 }}>
              Le CRM conçu pour les coachs qui gèrent leurs leads via Meta Ads. Centralisez vos appels, automatisez vos follow-ups et closez plus de deals.
            </p>
          </FadeIn>
          <FadeIn delay={0.3}>
            <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 48 }}>
              <Link href="/register" style={greenBtn}>Commencer gratuitement <ArrowRight size={16} /></Link>
              <a href="#features" style={ghostBtn}><Play size={14} /> Découvrir</a>
            </div>
          </FadeIn>
          <FadeIn delay={0.4}>
            <div style={{ display: 'inline-flex', gap: 32, padding: '18px 36px', borderRadius: 16, border: '1px solid var(--border-primary)', background: 'var(--bg-subtle)' }}>
              {[{ v: '14 jours', l: 'Essai gratuit' }, { v: '2 min', l: 'Pour démarrer' }, { v: '0€', l: 'Sans carte bancaire' }].map((s, i) => (
                <div key={i} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>{s.v}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{s.l}</div>
                </div>
              ))}
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" style={{ padding: '100px 0' }}>
        <div style={W}>
          <FadeIn>
            <div style={{ textAlign: 'center', marginBottom: 60 }}>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 12 }}>FONCTIONNALITÉS</div>
              <h2 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 700, marginBottom: 16 }}>Tout ce dont vous avez besoin</h2>
              <p style={{ fontSize: 16, color: 'var(--text-tertiary)', maxWidth: 500, margin: '0 auto' }}>Un outil complet pour gérer tout votre cycle de vente.</p>
            </div>
          </FadeIn>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
            {[
              { icon: Users, title: 'Pipeline de Leads', desc: 'Suivez chaque lead du premier contact au closing avec un kanban interactif.', color: 'var(--color-primary)' },
              { icon: Phone, title: 'Closing', desc: 'Gérez vos appels de closing. Vue calendrier, onglets par statut, suivi des résultats.', color: '#a855f7' },
              { icon: Bell, title: 'Follow-ups', desc: 'Relances automatiques par WhatsApp, email ou manuelles. Aucun lead oublié.', color: '#3b82f6' },
              { icon: BarChart2, title: 'Statistiques', desc: 'KPIs, taux de closing, coût par lead, funnel de conversion en temps réel.', color: '#22c55e' },
              { icon: Zap, title: 'Automations', desc: 'Rappels RDV, relances auto, notifications. Configurez une fois, ça tourne tout seul.', color: '#f59e0b' },
              { icon: Megaphone, title: 'Meta Ads', desc: 'Import automatique des leads Facebook & Instagram directement dans le pipeline.', color: '#ec4899' },
              { icon: Calendar, title: 'Google Agenda', desc: 'Synchronisation bidirectionnelle de vos RDV. Planifiez en un clic.', color: '#06b6d4' },
              { icon: MessageCircle, title: 'WhatsApp Business', desc: 'Messages automatiques et rappels RDV personnalisés à vos leads.', color: '#22c55e' },
            ].map((f, i) => {
              const I = f.icon
              return (
                <FadeIn key={f.title} delay={i * 0.05}>
                  <div style={card}>
                    <div style={{ width: 40, height: 40, borderRadius: 12, background: f.color + '12', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                      <I size={18} color={f.color} />
                    </div>
                    <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>{f.title}</h3>
                    <p style={{ fontSize: 13, color: 'var(--text-tertiary)', lineHeight: 1.6 }}>{f.desc}</p>
                  </div>
                </FadeIn>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── COMMENT ÇA MARCHE ── */}
      <section style={{ padding: '100px 0', background: 'var(--bg-secondary)' }}>
        <div style={W}>
          <FadeIn>
            <div style={{ textAlign: 'center', marginBottom: 60 }}>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 12 }}>COMMENT ÇA MARCHE</div>
              <h2 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 700, marginBottom: 16 }}>Prêt en 3 étapes</h2>
              <p style={{ fontSize: 16, color: 'var(--text-tertiary)' }}>De l&apos;inscription à votre premier deal closé.</p>
            </div>
          </FadeIn>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
            {[
              { n: '01', icon: Target, title: 'Créez votre compte', desc: 'Inscription en 2 minutes. Connectez Meta Ads pour importer vos leads.' },
              { n: '02', icon: Users, title: 'Organisez vos leads', desc: 'Vos leads arrivent dans le pipeline. Planifiez vos appels en un clic.' },
              { n: '03', icon: TrendingUp, title: 'Closez & analysez', desc: 'Suivez vos résultats en temps réel. Optimisez votre taux de closing.' },
            ].map((s, i) => {
              const I = s.icon
              return (
                <FadeIn key={s.n} delay={i * 0.1}>
                  <div style={{ ...card, textAlign: 'center', position: 'relative', paddingTop: 40 }}>
                    <div style={{ position: 'absolute', top: -16, left: '50%', transform: 'translateX(-50%)', width: 36, height: 36, borderRadius: '50%', background: 'rgba(0,200,83,0.1)', border: '1px solid rgba(0,200,83,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'var(--color-primary)' }}>{s.n}</div>
                    <I size={24} color="var(--text-tertiary)" style={{ marginBottom: 16 }} />
                    <h3 style={{ fontSize: 17, fontWeight: 600, marginBottom: 10 }}>{s.title}</h3>
                    <p style={{ fontSize: 13, color: 'var(--text-tertiary)', lineHeight: 1.6 }}>{s.desc}</p>
                  </div>
                </FadeIn>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── TARIFS ── */}
      <section id="pricing" style={{ padding: '100px 0' }}>
        <div style={W}>
          <FadeIn>
            <div style={{ textAlign: 'center', marginBottom: 60 }}>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 12 }}>TARIFS</div>
              <h2 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 700, marginBottom: 16 }}>Tarifs simples et transparents</h2>
              <p style={{ fontSize: 16, color: 'var(--text-tertiary)' }}>Commencez gratuitement, évoluez à votre rythme.</p>
            </div>
          </FadeIn>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {[
              { name: 'Starter', desc: 'Pour tester ClosRM', price: '0€', features: ['50 leads max', 'Pipeline basique', 'Suivi des appels', '1 utilisateur'], featured: false, cta: 'Commencer' },
              { name: 'Pro', desc: 'Pour les coachs actifs', price: '49€', features: ['Leads illimités', 'Pipeline complet', 'Automations & rappels', 'Meta Ads intégré', 'Google Agenda sync', 'WhatsApp Business', 'Statistiques avancées'], featured: true, cta: "Commencer l'essai gratuit" },
              { name: 'Business', desc: 'Pour les équipes', price: '99€', features: ['Tout du plan Pro', 'Multi-utilisateurs', 'Rôles setter / closer', 'Tunnels de vente', 'Séquences emails', 'Intégration Stripe', 'Support prioritaire'], featured: false, cta: 'Nous contacter' },
            ].map((p) => (
              <FadeIn key={p.name}>
                <div style={{ ...card, border: p.featured ? '2px solid rgba(0,200,83,0.3)' : card.border, boxShadow: p.featured ? '0 0 50px rgba(0,200,83,0.06)' : 'none', position: 'relative', display: 'flex', flexDirection: 'column', height: '100%' }}>
                  {p.featured && <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', padding: '4px 16px', background: 'var(--color-primary)', borderRadius: 99, fontSize: 11, fontWeight: 700, color: '#fff' }}>Recommandé</div>}
                  <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>{p.name}</h3>
                  <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 24 }}>{p.desc}</p>
                  <div style={{ marginBottom: 24 }}>
                    <span style={{ fontSize: 42, fontWeight: 800 }}>{p.price}</span>
                    <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>/mois</span>
                  </div>
                  <ul style={{ listStyle: 'none', padding: 0, marginBottom: 24, flex: 1 }}>
                    {p.features.map((f) => (
                      <li key={f} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
                        <Check size={14} color={p.featured ? '#00C853' : 'var(--text-muted)'} />{f}
                      </li>
                    ))}
                  </ul>
                  <Link href="/register" style={{
                    display: 'block', textAlign: 'center', padding: '12px 0', borderRadius: 10, fontSize: 13, fontWeight: 600, textDecoration: 'none',
                    ...(p.featured ? { background: 'var(--color-primary)', color: '#fff', boxShadow: '0 4px 20px rgba(0,200,83,0.2)' } : { border: '1px solid var(--border-primary)', color: 'var(--text-secondary)' }),
                  }}>{p.cta}</Link>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── SOCIAL PROOF ── */}
      <section style={{ padding: '100px 0', background: 'var(--bg-secondary)' }}>
        <div style={W}>
          <FadeIn>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 24, textAlign: 'center', marginBottom: 60 }}>
              {[{ v: '500+', l: 'Coachs actifs' }, { v: '50k+', l: 'Leads gérés' }, { v: '98%', l: 'Satisfaction' }, { v: '3x', l: 'Plus de deals closés' }].map((s) => (
                <div key={s.l}>
                  <div style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 800, color: 'var(--text-primary)' }}>{s.v}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 4 }}>{s.l}</div>
                </div>
              ))}
            </div>
          </FadeIn>
          <FadeIn delay={0.2}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
              {[
                { name: 'Sophie M.', role: 'Coach Business', text: "ClosRM a transformé ma façon de gérer mes leads. J'ai doublé mon taux de closing en 2 mois." },
                { name: 'Thomas L.', role: 'Coach Sportif', text: "L'intégration Meta Ads est un game changer. Mes leads arrivent directement dans le pipeline." },
                { name: 'Marie K.', role: 'Coach Bien-être', text: 'Les automations WhatsApp me font gagner 2h par jour. Plus aucun lead ne passe entre les mailles.' },
              ].map((t) => (
                <div key={t.name} style={card}>
                  <div style={{ display: 'flex', gap: 2, marginBottom: 16 }}>{Array.from({ length: 5 }).map((_, i) => <Star key={i} size={14} color="#facc15" fill="#facc15" />)}</div>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 18 }}>&ldquo;{t.text}&rdquo;</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(0,200,83,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: 'var(--color-primary)' }}>{t.name[0]}</div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{t.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{t.role}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ── CTA ── */}
      <section id="contact" style={{ padding: '100px 0' }}>
        <div style={{ ...W, textAlign: 'center' }}>
          <FadeIn>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 700, marginBottom: 16 }}>Prêt à closer plus de deals ?</h2>
            <p style={{ fontSize: 16, color: 'var(--text-tertiary)', maxWidth: 500, margin: '0 auto 40px' }}>Rejoignez les coachs qui utilisent ClosRM pour transformer leurs leads en clients.</p>
            <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link href="/register" style={greenBtn}>Commencer gratuitement <ArrowRight size={16} /></Link>
              <a href="mailto:contact@closrm.com" style={ghostBtn}>Nous contacter</a>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ borderTop: '1px solid var(--border-primary)', padding: '40px 0' }}>
        <div style={{ ...W, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20 }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Clos<span style={{ color: 'var(--color-primary)' }}>RM</span></div>
          <div style={{ display: 'flex', gap: 24, fontSize: 13, color: 'var(--text-tertiary)' }}>
            <a href="#features" style={{ color: 'var(--text-tertiary)', textDecoration: 'none' }}>Fonctionnalités</a>
            <a href="#pricing" style={{ color: 'var(--text-tertiary)', textDecoration: 'none' }}>Tarifs</a>
            <a href="mailto:contact@closrm.com" style={{ color: 'var(--text-tertiary)', textDecoration: 'none' }}>Contact</a>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>© {new Date().getFullYear()} ClosRM. Tous droits réservés.</div>
        </div>
      </footer>
    </div>
  )
}
