'use client'

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts'
import { Metrics } from '@/lib/supabase'

type Props = { data: Metrics[] }

function fmt(n: number) {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency', currency: 'USD',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(n)
}

function fmtTs(ts: string) {
  const d = new Date(ts)
  return `${d.getDate()}/${d.getMonth() + 1} ${d.getHours()}:${String(d.getMinutes()).padStart(2,'0')}`
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload as Metrics
  const pnl = d.shadow_pnl_pct
  const pnlColor = pnl >= 0 ? '#00e676' : '#f44336'
  return (
    <div style={{
      background: '#1a2235', border: '1px solid #1e2d45',
      borderRadius: 8, padding: '10px 14px', fontSize: 13,
    }}>
      <div style={{ color: '#90a4ae', marginBottom: 4 }}>{label}</div>
      <div style={{ fontWeight: 700, fontSize: 16 }}>{fmt(d.shadow_equity)}</div>
      <div style={{ color: pnlColor }}>{pnl >= 0 ? '+' : ''}{(pnl * 100).toFixed(2)}%</div>
      <div style={{ color: '#90a4ae', marginTop: 4 }}>Ciclo {d.n_cycles}</div>
    </div>
  )
}

export default function EquityChart({ data }: Props) {
  if (!data.length) return (
    <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
      Sin datos de equity aún...
    </div>
  )

  const chartData = data.map(d => ({
    ...d,
    label: fmtTs(d.ts),
    equity: d.shadow_equity,
  }))

  const min = Math.min(...data.map(d => d.shadow_equity)) * 0.999
  const max = Math.max(...data.map(d => d.shadow_equity)) * 1.001
  const isPositive = data[data.length - 1].shadow_equity >= data[0].shadow_equity

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
        <defs>
          <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={isPositive ? '#00e676' : '#f44336'} stopOpacity={0.25} />
            <stop offset="95%" stopColor={isPositive ? '#00e676' : '#f44336'} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
        <YAxis
          domain={[min, max]}
          tick={{ fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={v => `$${(v/1000).toFixed(0)}k`}
          width={48}
        />
        <Tooltip content={<CustomTooltip />} />
        <Area
          type="monotone"
          dataKey="equity"
          stroke={isPositive ? '#00e676' : '#f44336'}
          strokeWidth={2}
          fill="url(#equityGrad)"
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
