'use client'

import { Signal } from '@/lib/supabase'

type Props = { signals: Signal[] }

const regimeLabel: Record<number, string> = {
  0: '🔴 Bajista',
  1: '🟡 Lateral',
  2: '🟢 Alcista',
}

function fmtTs(ts: string) {
  const d = new Date(ts)
  return `${d.toLocaleDateString('es-ES', { day:'2-digit', month:'2-digit' })} ${d.toLocaleTimeString('es-ES', { hour:'2-digit', minute:'2-digit' })}`
}

export default function SignalsTable({ signals }: Props) {
  if (!signals.length) return (
    <div style={{ padding: '30px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
      Sin señales aún. El bot empieza en el primer ciclo.
    </div>
  )

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            {['Hora', 'Símbolo', 'Acción', 'Precio', 'Prob.', 'Régimen', 'IC', 'Razón'].map(h => (
              <th key={h} style={{
                padding: '8px 12px', textAlign: 'left',
                color: 'var(--text-muted)', fontWeight: 600,
                fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em',
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {signals.map(s => {
            const isLong = s.action === 'LONG'
            const actionColor = isLong ? '#00e676' : s.action === 'NO_SIGNAL' ? '#90a4ae' : '#e8eaf6'
            return (
              <tr key={s.id} style={{
                borderBottom: '1px solid var(--border)',
                background: isLong ? 'rgba(0,230,118,0.04)' : 'transparent',
                transition: 'background 0.15s',
              }}>
                <td style={{ padding: '9px 12px', color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: 12 }}>
                  {fmtTs(s.ts)}
                </td>
                <td style={{ padding: '9px 12px', fontWeight: 700, letterSpacing: '0.04em' }}>
                  {s.symbol}
                </td>
                <td style={{ padding: '9px 12px' }}>
                  <span style={{
                    background: isLong ? 'rgba(0,230,118,0.15)' : 'transparent',
                    color: actionColor,
                    borderRadius: 4, padding: '2px 8px', fontWeight: 700, fontSize: 12,
                  }}>
                    {isLong ? '▲ LONG' : s.action === 'FLAT' ? '— FLAT' : '○ NO_SIGNAL'}
                  </span>
                </td>
                <td style={{ padding: '9px 12px', fontFamily: 'monospace' }}>
                  {s.price != null ? `$${s.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                </td>
                <td style={{ padding: '9px 12px', fontFamily: 'monospace', color: isLong ? '#00e676' : 'var(--text-muted)' }}>
                  {s.signal_prob != null ? `${(s.signal_prob * 100).toFixed(1)}%` : '—'}
                </td>
                <td style={{ padding: '9px 12px', fontSize: 12 }}>
                  {s.regime != null && s.regime !== -1 ? regimeLabel[s.regime] ?? `Rég. ${s.regime}` : '—'}
                </td>
                <td style={{ padding: '9px 12px', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                  {s.ic_recent != null ? s.ic_recent.toFixed(4) : '—'}
                </td>
                <td style={{ padding: '9px 12px', color: 'var(--text-muted)', fontSize: 11, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {s.reject_reason ?? (isLong ? '✓ validado' : '')}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
