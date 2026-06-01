'use client'

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { Metrics } from '@/lib/supabase'

type Props = { data: Metrics[] }

function fmtTs(ts: string) {
  const d = new Date(ts)
  return `${d.getDate()}/${d.getMonth() + 1}`
}

export default function IcWinChart({ data }: Props) {
  if (!data.length) return (
    <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 13 }}>
      Sin datos aún...
    </div>
  )

  const chartData = data.map(d => ({
    label:    fmtTs(d.ts),
    ic:       d.ic_mean_recent != null ? +(d.ic_mean_recent * 100).toFixed(2) : null,
    win_rate: d.win_rate_recent != null ? +(d.win_rate_recent * 100).toFixed(1) : null,
  }))

  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
        <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={36} />
        <Tooltip
          contentStyle={{
            background: '#fff', border: '1px solid rgba(26,20,10,0.1)',
            borderRadius: 6, fontSize: 12, fontFamily: 'var(--sans)',
          }}
          formatter={(v, name) => [`${v}${String(name) === 'IC (×100)' ? '' : '%'}`, String(name)]}
        />
        <Legend wrapperStyle={{ fontSize: 12, color: 'var(--muted)' }} />
        <ReferenceLine y={5} stroke="var(--gold)" strokeDasharray="4 4" />
        <Line type="monotone" dataKey="ic"       name="IC (×100)"    stroke="var(--gold)"  strokeWidth={2} dot={false} connectNulls />
        <Line type="monotone" dataKey="win_rate" name="Win Rate (%)" stroke="var(--green)" strokeWidth={2} dot={false} connectNulls />
      </LineChart>
    </ResponsiveContainer>
  )
}
