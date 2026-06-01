'use client'

import { Signal } from '@/lib/supabase'

type Props = { signals: Signal[] }

export default function SymbolBreakdown({ signals }: Props) {
  if (!signals.length) return null

  // Agrupar por símbolo: últimas señales
  const bySymbol: Record<string, Signal[]> = {}
  for (const s of signals) {
    if (!bySymbol[s.symbol]) bySymbol[s.symbol] = []
    bySymbol[s.symbol].push(s)
  }

  const symbols = Object.keys(bySymbol).sort()

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10 }}>
      {symbols.map(sym => {
        const all  = bySymbol[sym]
        const last = all[0]
        const longs = all.filter(s => s.action === 'LONG').length
        const total = all.length
        const pct   = total > 0 ? Math.round((longs / total) * 100) : 0
        const isLong = last.action === 'LONG'

        return (
          <div key={sym} style={{
            background:    'var(--bg-card2)',
            border:        `1px solid ${isLong ? 'rgba(0,230,118,0.3)' : 'var(--border)'}`,
            borderRadius:  10,
            padding:       '12px 14px',
            display:       'flex',
            flexDirection: 'column',
            gap:           6,
          }}>
            <div style={{ fontWeight: 700, fontSize: 16, letterSpacing: '0.04em' }}>{sym}</div>
            <div style={{
              fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
              color: isLong ? '#00e676' : '#90a4ae',
            }}>
              {isLong ? '▲ LONG' : last.action === 'FLAT' ? '— FLAT' : '○ —'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {last.signal_prob != null ? `Prob: ${(last.signal_prob * 100).toFixed(1)}%` : ''}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
              LONG rate: {pct}%
            </div>
          </div>
        )
      })}
    </div>
  )
}
