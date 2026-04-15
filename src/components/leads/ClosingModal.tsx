'use client'

import { useState, useEffect } from 'react'
import { X, Trophy } from 'lucide-react'

interface Props {
  leadName: string
  onClose: () => void
  onConfirm: (data: { deal_amount: number; deal_installments: number; cash_collected: number }) => void
}

const INSTALLMENT_OPTIONS = [
  { value: 1, label: 'Unique' },
  { value: 2, label: '2x' },
  { value: 3, label: '3x' },
  { value: 4, label: '4x' },
  { value: 6, label: '6x' },
  { value: 12, label: '12x' },
]

const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 200,
  background: 'rgba(0,0,0,0.55)', display: 'flex',
  alignItems: 'center', justifyContent: 'center',
}

const modal: React.CSSProperties = {
  background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)',
  borderRadius: 16, width: '100%', maxWidth: 440, padding: 28,
  boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
}

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '10px 12px',
  background: 'var(--bg-input)', border: '1px solid var(--border-primary)',
  borderRadius: 10, color: 'var(--text-primary)', fontSize: 14, outline: 'none',
}

const labelStyle: React.CSSProperties = {
  fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, display: 'block',
}

export default function ClosingModal({ leadName, onClose, onConfirm }: Props) {
  const [dealAmount, setDealAmount] = useState<string>('')
  const [installments, setInstallments] = useState(1)
  const [cashCollected, setCashCollected] = useState<string>('')

  // Auto-calculate cash collected when amount or installments change
  useEffect(() => {
    const amount = parseFloat(dealAmount)
    if (!isNaN(amount) && amount > 0) {
      setCashCollected(String(Math.round((amount / installments) * 100) / 100))
    }
  }, [dealAmount, installments])

  function handleSubmit() {
    const amount = parseFloat(dealAmount)
    const cash = parseFloat(cashCollected)
    if (isNaN(amount) || amount <= 0) return
    onConfirm({
      deal_amount: amount,
      deal_installments: installments,
      cash_collected: isNaN(cash) ? 0 : cash,
    })
  }

  const isValid = !isNaN(parseFloat(dealAmount)) && parseFloat(dealAmount) > 0

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: 'rgba(56,161,105,0.12)', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Trophy size={22} color="#38A169" />
            </div>
            <div>
              <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>
                Felicitations ! Closing valide
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 2 }}>
                {leadName}
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        {/* Deal amount */}
        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>Montant total du deal</label>
          <div style={{ position: 'relative' }}>
            <input
              type="number"
              value={dealAmount}
              onChange={(e) => setDealAmount(e.target.value)}
              placeholder="3000"
              min={0}
              style={{ ...inputStyle, paddingRight: 36 }}
              autoFocus
            />
            <span style={{
              position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
              fontSize: 14, fontWeight: 600, color: 'var(--text-muted)',
            }}>
              &euro;
            </span>
          </div>
        </div>

        {/* Installments */}
        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>Mode de paiement</label>
          <div style={{ display: 'flex', gap: 6 }}>
            {INSTALLMENT_OPTIONS.map((opt) => {
              const active = installments === opt.value
              return (
                <button
                  key={opt.value}
                  onClick={() => setInstallments(opt.value)}
                  style={{
                    flex: 1, padding: '9px 4px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                    cursor: 'pointer', transition: 'all 0.15s',
                    border: active ? '2px solid #38A169' : '1px solid var(--border-primary)',
                    background: active ? 'rgba(56,161,105,0.10)' : 'transparent',
                    color: active ? '#38A169' : 'var(--text-muted)',
                  }}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Cash collected */}
        <div style={{ marginBottom: 28 }}>
          <label style={labelStyle}>Montant encaisse aujourd&apos;hui</label>
          <div style={{ position: 'relative' }}>
            <input
              type="number"
              value={cashCollected}
              onChange={(e) => setCashCollected(e.target.value)}
              placeholder="0"
              min={0}
              style={{ ...inputStyle, paddingRight: 36 }}
            />
            <span style={{
              position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
              fontSize: 14, fontWeight: 600, color: 'var(--text-muted)',
            }}>
              &euro;
            </span>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '11px 0', borderRadius: 10, fontSize: 13, fontWeight: 600,
            border: '1px solid var(--border-primary)', background: 'transparent',
            color: 'var(--text-tertiary)', cursor: 'pointer',
          }}>
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isValid}
            style={{
              flex: 2, padding: '11px 0', borderRadius: 10, fontSize: 13, fontWeight: 700,
              border: 'none', cursor: isValid ? 'pointer' : 'not-allowed',
              background: isValid ? '#38A169' : 'rgba(56,161,105,0.2)',
              color: isValid ? '#fff' : 'rgba(255,255,255,0.4)',
              transition: 'all 0.15s',
            }}
          >
            Valider le closing
          </button>
        </div>
      </div>
    </div>
  )
}
