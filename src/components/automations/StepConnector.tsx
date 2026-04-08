'use client'

export default function StepConnector() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        height: 36,
      }}
    >
      <div
        style={{
          width: 2,
          flex: 1,
          background: 'linear-gradient(to bottom, var(--border-primary), rgba(91,155,245,0.3))',
          borderRadius: 1,
        }}
      />
      <div
        style={{
          width: 0,
          height: 0,
          borderLeft: '4px solid transparent',
          borderRight: '4px solid transparent',
          borderTop: '5px solid rgba(91,155,245,0.4)',
        }}
      />
    </div>
  )
}
