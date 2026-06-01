'use client'

type Props = {
  label:    string
  value:    string
  sub?:     string
  color?:   'green' | 'red' | 'blue' | 'gold' | 'default'
  icon?:    string
}

const colorMap: Record<string, string> = {
  green:   '#00e676',
  red:     '#f44336',
  blue:    '#2196f3',
  gold:    '#ffc107',
  default: '#e8eaf6',
}

export default function KpiCard({ label, value, sub, color = 'default', icon }: Props) {
  const c = colorMap[color]
  return (
    <div style={{
      background:   'var(--bg-card)',
      border:       '1px solid var(--border)',
      borderRadius: 12,
      padding:      '18px 22px',
      display:      'flex',
      flexDirection: 'column',
      gap:          6,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {icon && <span style={{ fontSize: 18 }}>{icon}</span>}
        <span style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
          {label}
        </span>
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color: c, lineHeight: 1 }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {sub}
        </div>
      )}
    </div>
  )
}
