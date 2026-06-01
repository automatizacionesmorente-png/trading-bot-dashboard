'use client'

import { Signal } from '@/lib/supabase'

type Props = { signals: Signal[] }

export default function SymbolBreakdown({ signals }: Props) {
  if (!signals.length) return null

  const bySymbol: Record<string, Signal[]> = {}
  for (const s of signals) {
    if (!bySymbol[s.symbol]) bySymbol[s.symbol] = []
    bySymbol[s.symbol].push(s)
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10 }}>
      {Object.keys(bySymbol).sort().map(sym => {
        const all   = bySymbol[sym]
        const last  = all[0]
        const longs = all.filter(s => s.action === 'LONG').length
        const pct   = Math.round((longs / all.length) * 100)
        const isLong = last.action === 'LONG'

        return (
          <div key={sym} style={{
            background:    'var(--bg2)',
            border:        `1px solid ${isLong ? 'rgba(45,122,79,0.3)' : 'var(--border)'}`,
            borderRadius:  'var(--radius)',
            padding:       '14px 16px',
            display:       'flex',
            flexDirection: 'column',
            gap:           5,
          }}>
            <div style={{ fontFamily: 'var(--serif)', fontWeight: 400, fontSize: 18, color: 'var(--ink)', letterSpacing: '0.02em' }}>
              {sym}
            </div>
            <div style={{
              fontSize: '0.65rem', fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase',
              color: isLong ? 'var(--green)' : 'var(--muted)',
            }}>
              {isLong ? '↑ Long' : last.action === 'FLAT' ? '— Flat' : '—'}
            </div>
            {last.signal_prob != null && (
              <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>
                {(last.signal_prob * 100).toFixed(1)}% prob.
              </div>
            )}
            <div style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>
              Long rate: {pct}%
            </div>
          </div>
        )
      })}
    </div>
  )
}
