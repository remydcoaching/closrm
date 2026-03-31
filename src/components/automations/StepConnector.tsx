'use client'

export default function StepConnector() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        height: 32,
      }}
    >
      <div
        style={{
          width: 2,
          flex: 1,
          background: 'var(--border-primary)',
        }}
      />
      <div
        style={{
          width: 0,
          height: 0,
          borderLeft: '5px solid transparent',
          borderRight: '5px solid transparent',
          borderTop: '6px solid var(--border-primary)',
        }}
      />
    </div>
  )
}
