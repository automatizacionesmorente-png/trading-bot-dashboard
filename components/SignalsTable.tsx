'use client'

import { Signal } from '@/lib/supabase'

type Props = { signals: Signal[] }

const regimeLabel: Record<number, string> = {
  0: '↓ Bajista',
  1: '→ Lateral',
  2: '↑ Alcista',
}

function fmtTs(ts: string) {
  const d = new Date(ts)
  return `${d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })} ${d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`
}

export default function SignalsTable({ signals }: Props) {
  if (!signals.length) return (
    <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
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
                padding: '8px 10px', textAlign: 'left',
                fontSize: '0.63rem', letterSpacing: '0.1em',
                textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 400,
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {signals.map(s => {
            const isLong = s.action === 'LONG'
            return (
              <tr key={s.id} style={{
                borderBottom: '1px solid var(--border)',
                background: isLong ? 'rgba(45,122,79,0.04)' : 'transparent',
              }}>
                <td style={{ padding: '9px 10px', color: 'var(--muted)', fontSize: 11 }}>
                  {fmtTs(s.ts)}
                </td>
                <td style={{ padding: '9px 10px', fontWeight: 500, fontFamily: 'var(--serif)', fontSize: 15 }}>
                  {s.symbol}
                </td>
                <td style={{ padding: '9px 10px' }}>
                  {isLong ? (
                    <span style={{
                      background: 'rgba(45,122,79,0.1)', color: 'var(--green)',
                      borderRadius: 3, padding: '2px 8px', fontSize: '0.65rem',
                      fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em',
                    }}>↑ Long</span>
                  ) : s.action === 'FLAT' ? (
                    <span style={{ color: 'var(--muted)', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>— Flat</span>
                  ) : (
                    <span style={{ color: 'var(--border)', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>○ —</span>
                  )}
                </td>
                <td style={{ padding: '9px 10px', fontFamily: 'var(--serif)', fontSize: 14 }}>
                  {s.price != null ? `$${s.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                </td>
                <td style={{ padding: '9px 10px', color: isLong ? 'var(--green)' : 'var(--muted)', fontFamily: 'var(--serif)', fontSize: 14 }}>
                  {s.signal_prob != null ? `${(s.signal_prob * 100).toFixed(1)}%` : '—'}
                </td>
                <td style={{ padding: '9px 10px', fontSize: 12, color: 'var(--ink2)' }}>
                  {s.regime != null && s.regime !== -1 ? regimeLabel[s.regime] ?? `Rég. ${s.regime}` : '—'}
                </td>
                <td style={{ padding: '9px 10px', color: 'var(--muted)', fontSize: 12 }}>
                  {s.ic_recent != null ? s.ic_recent.toFixed(4) : '—'}
                </td>
                <td style={{ padding: '9px 10px', color: 'var(--muted)', fontSize: 11, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
