'use client'

type Props = {
  label:  string
  value:  string
  sub?:   string
  color?: 'green' | 'red' | 'gold' | 'default'
  icon?:  string
}

const colorMap: Record<string, string> = {
  green:   'var(--green)',
  red:     'var(--red)',
  gold:    'var(--gold)',
  default: 'var(--ink)',
}

export default function KpiCard({ label, value, sub, color = 'default', icon }: Props) {
  return (
    <div style={{
      background:   '#fff',
      border:       '1px solid var(--border)',
      borderRadius: 'var(--radius)',
      padding:      '26px 22px',
      position:     'relative',
      overflow:     'hidden',
    }}>
      {/* Gold top line on hover handled via CSS in globals */}
      {icon && (
        <div style={{ position: 'absolute', top: 18, right: 18, fontSize: '1.3rem', opacity: 0.22 }}>
          {icon}
        </div>
      )}
      <div style={{
        fontSize: '0.65rem', letterSpacing: '0.1em', textTransform: 'uppercase',
        color: 'var(--muted)', fontWeight: 400, marginBottom: 10,
      }}>
        {label}
      </div>
      <div style={{
        fontFamily: 'var(--serif)', fontSize: '2.3rem', fontWeight: 300,
        color: colorMap[color], lineHeight: 1, marginBottom: 5,
      }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: '0.72rem', color: 'var(--muted)', fontWeight: 300 }}>
          {sub}
        </div>
      )}
    </div>
  )
}
