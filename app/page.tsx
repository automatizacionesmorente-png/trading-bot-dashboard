'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import { supabase, Signal, Metrics, BotStatus } from '@/lib/supabase'
import KpiCard         from '@/components/KpiCard'
import EquityChart     from '@/components/EquityChart'
import IcWinChart      from '@/components/IcWinChart'
import SignalsTable    from '@/components/SignalsTable'
import SymbolBreakdown from '@/components/SymbolBreakdown'

// ── Helpers ────────────────────────────────────────────────────────────
function fmt$(n: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(n)
}

function timeSince(ts: string) {
  const sec = Math.floor((Date.now() - new Date(ts).getTime()) / 1000)
  if (sec < 60)   return `hace ${sec}s`
  if (sec < 3600) return `hace ${Math.floor(sec / 60)}m`
  return `hace ${Math.floor(sec / 3600)}h`
}

// ── Dashboard ──────────────────────────────────────────────────────────
export default function Dashboard() {
  const [status,   setStatus]   = useState<BotStatus | null>(null)
  const [metrics,  setMetrics]  = useState<Metrics[]>([])
  const [signals,  setSignals]  = useState<Signal[]>([])
  const [lastPing, setLastPing] = useState<string>(new Date().toISOString())
  const [loading,  setLoading]  = useState(true)
  const [tab,      setTab]      = useState<'all' | 'long'>('all')

  // ── Carga inicial ──────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    const [{ data: st }, { data: mt }, { data: sg }] = await Promise.all([
      supabase.from('bot_status').select('*').eq('bot_id', 'main').single(),
      supabase.from('shadow_metrics').select('*').order('ts', { ascending: true }).limit(200),
      supabase.from('shadow_signals').select('*').order('ts', { ascending: false }).limit(100),
    ])
    if (st) setStatus(st as BotStatus)
    if (mt) setMetrics(mt as Metrics[])
    if (sg) setSignals(sg as Signal[])
    setLastPing(new Date().toISOString())
    setLoading(false)
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  // ── Realtime subscriptions ─────────────────────────────────────────
  useEffect(() => {
    const ch = supabase
      .channel('dashboard-realtime')
      .on('postgres_changes', { event: '*',      schema: 'public', table: 'bot_status' },
        p => { if (p.new) { setStatus(p.new as BotStatus); setLastPing(new Date().toISOString()) } })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'shadow_metrics' },
        p => { setMetrics(prev => [...prev.slice(-199), p.new as Metrics]); setLastPing(new Date().toISOString()) })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'shadow_signals' },
        p => { setSignals(prev => [p.new as Signal, ...prev.slice(0, 99)]); setLastPing(new Date().toISOString()) })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  // ── KPIs derivados ─────────────────────────────────────────────────
  const latest  = metrics.length > 0 ? metrics[metrics.length - 1] : null
  const equity  = latest?.shadow_equity  ?? 100_000
  const pnl     = latest?.shadow_pnl_pct ?? 0
  const cycles  = latest?.n_cycles       ?? 0
  const longs   = latest?.n_signals_long ?? 0
  const winRate = latest?.win_rate_recent ?? null
  const ic      = latest?.ic_mean_recent  ?? null
  const kill    = status?.kill_switch ?? false
  const running = status?.running     ?? false
  const activos = status?.activos?.split(',') ?? []
  const modo    = (status?.modo ?? 'shadow').toUpperCase()

  const pnlColor = pnl >= 0 ? '#00e676' : '#f44336'
  const modoColor: Record<string, string> = { SHADOW: '#2196f3', PAPER: '#ffc107', LIVE: '#00e676' }
  const modeC = modoColor[modo] ?? '#2196f3'

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>

      {/* ── Header ──────────────────────────────────────────────────── */}
      <header style={{
        background: 'var(--bg-card)', borderBottom: '1px solid var(--border)',
        padding: '0 28px', height: 60,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 22 }}>🤖</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Trading Bot ML</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {activos.length > 0 ? activos.join(' · ') : 'Conectando...'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{
            background: `${modeC}20`, color: modeC,
            border: `1px solid ${modeC}`,
            borderRadius: 6, padding: '3px 10px', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
          }}>{modo}</span>

          {kill && (
            <span style={{
              background: '#f4433620', color: '#f44336', border: '1px solid #f44336',
              borderRadius: 6, padding: '3px 10px', fontSize: 11, fontWeight: 700,
            }}>⛔ KILL SWITCH</span>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: loading ? '#ffc107' : running ? '#00e676' : '#f44336',
              boxShadow: running ? '0 0 6px #00e676' : 'none',
            }} />
            {loading ? 'Cargando...' : running ? `Live · ${timeSince(lastPing)}` : 'Bot detenido'}
          </div>
        </div>
      </header>

      {/* ── Main ────────────────────────────────────────────────────── */}
      <main style={{ padding: '24px 28px', maxWidth: 1400, margin: '0 auto' }}>

        {/* KPI grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(175px, 1fr))', gap: 12, marginBottom: 20 }}>
          <KpiCard icon="💰" label="Equity Shadow" value={fmt$(equity)}
            sub={`P&L: ${pnl >= 0 ? '+' : ''}${(pnl * 100).toFixed(2)}%`}
            color={pnl >= 0 ? 'green' : 'red'} />
          <KpiCard icon="🎯" label="Win Rate"
            value={winRate != null ? `${(winRate * 100).toFixed(1)}%` : '—'}
            sub="Últimas 30 señales LONG"
            color={winRate != null && winRate > 0.6 ? 'green' : 'default'} />
          <KpiCard icon="🔬" label="IC Medio"
            value={ic != null ? ic.toFixed(4) : '—'}
            sub={ic != null && ic > 0.05 ? '✅ Sobre umbral' : 'Umbral: > 0.05'}
            color={ic != null && ic > 0.05 ? 'green' : 'default'} />
          <KpiCard icon="🔄" label="Ciclos" value={String(cycles)}
            sub={`${longs} señales LONG`} color="blue" />
          <KpiCard icon="📊" label="Activos" value={String(activos.length || 8)}
            sub={activos.slice(0, 4).join(', ') + (activos.length > 4 ? '…' : '')} color="blue" />
          <KpiCard icon={kill ? '⛔' : '✅'} label="Sistema"
            value={kill ? 'KILL SWITCH' : 'Operativo'}
            sub={kill ? (status?.kill_reason ?? '') : `Modo ${modo}`}
            color={kill ? 'red' : 'green'} />
        </div>

        {/* Charts */}
        <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 14, marginBottom: 20 }}>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '18px 20px' }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>📈 Curva de Equity</div>
            <EquityChart data={metrics} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
              <span style={{ fontSize: 11, color: pnlColor, fontWeight: 700 }}>
                {pnl >= 0 ? '▲' : '▼'} {pnl >= 0 ? '+' : ''}{(pnl * 100).toFixed(2)}% desde inicio
              </span>
            </div>
          </div>

          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '18px 20px' }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>🔬 IC & Win Rate</div>
            <IcWinChart data={metrics} />
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
              Línea azul = umbral IC mínimo (5×10²). Shadow aprobado: IC &gt; 0.05 y Win &gt; 60%.
            </div>
          </div>
        </div>

        {/* Symbol breakdown */}
        {signals.length > 0 && (
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '18px 20px', marginBottom: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>🌐 Estado por Símbolo</div>
            <SymbolBreakdown signals={signals} />
          </div>
        )}

        {/* Signals table */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>📋 Señales Recientes</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['all', 'long'] as const).map(t => (
                <button key={t} onClick={() => setTab(t)} style={{
                  background:   tab === t ? '#2196f320' : 'transparent',
                  color:        tab === t ? '#2196f3'   : 'var(--text-muted)',
                  border:       `1px solid ${tab === t ? '#2196f3' : 'var(--border)'}`,
                  borderRadius: 6, padding: '4px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                }}>
                  {t === 'all' ? 'Todas' : '▲ Solo LONG'}
                </button>
              ))}
            </div>
          </div>
          <SignalsTable signals={tab === 'all' ? signals : signals.filter(s => s.action === 'LONG')} />
        </div>

        <div style={{ textAlign: 'center', marginTop: 28, paddingBottom: 20, fontSize: 11, color: 'var(--text-muted)' }}>
          Actualización en tiempo real · Supabase Realtime · Trading Bot ML v1.0
        </div>
      </main>
    </div>
  )
}
