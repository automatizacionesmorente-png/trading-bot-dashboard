'use client'

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts'
import { Metrics } from '@/lib/supabase'

type Props = { data: Metrics[] }

function fmtTs(ts: string) {
  const d = new Date(ts)
  return `${d.getDate()}/${d.getMonth() + 1}`
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload as Metrics
  const pnl = d.shadow_pnl_pct
  return (
    <div style={{
      background: '#fff', border: '1px solid rgba(26,20,10,0.1)',
      borderRadius: 6, padding: '10px 14px', fontSize: 12,
      fontFamily: 'var(--sans)', boxShadow: '0 4px 16px rgba(26,20,10,0.08)',
    }}>
      <div style={{ color: 'var(--muted)', marginBottom: 4, fontSize: 11 }}>{label}</div>
      <div style={{ fontFamily: 'var(--serif)', fontWeight: 400, fontSize: 18, color: 'var(--ink)' }}>
        ${d.shadow_equity.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
      </div>
      <div style={{ color: pnl >= 0 ? 'var(--green)' : 'var(--red)', fontSize: 12, marginTop: 2 }}>
        {pnl >= 0 ? '+' : ''}{(pnl * 100).toFixed(2)}%
      </div>
    </div>
  )
}

export default function EquityChart({ data }: Props) {
  if (!data.length) return (
    <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 13 }}>
      Sin datos de equity aún...
    </div>
  )

  const chartData = data.map(d => ({ ...d, label: fmtTs(d.ts) }))
  const isPositive = data[data.length - 1].shadow_equity >= data[0].shadow_equity
  const color = isPositive ? '#2d7a4f' : '#a83232'
  const min = Math.min(...data.map(d => d.shadow_equity)) * 0.999
  const max = Math.max(...data.map(d => d.shadow_equity)) * 1.001

  return (
    <ResponsiveContainer width="100%" height={210}>
      <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
        <defs>
          <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={color} stopOpacity={0.12} />
            <stop offset="95%" stopColor={color} stopOpacity={0.01} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
        <YAxis
          domain={[min, max]}
          tick={{ fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={v => `$${(v / 1000).toFixed(0)}k`}
          width={44}
        />
        <Tooltip content={<CustomTooltip />} />
        <Area
          type="monotone"
          dataKey="shadow_equity"
          stroke={color}
          strokeWidth={2}
          fill="url(#eqGrad)"
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
