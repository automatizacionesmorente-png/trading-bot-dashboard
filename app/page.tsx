'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import { supabase, Signal, Metrics, BotStatus } from '@/lib/supabase'
import KpiCard         from '@/components/KpiCard'
import EquityChart     from '@/components/EquityChart'
import IcWinChart      from '@/components/IcWinChart'
import SignalsTable    from '@/components/SignalsTable'
import SymbolBreakdown from '@/components/SymbolBreakdown'

function fmt$(n: number) {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function timeSince(ts: string) {
  const sec = Math.floor((Date.now() - new Date(ts).getTime()) / 1000)
  if (sec < 60)   return `hace ${sec}s`
  if (sec < 3600) return `hace ${Math.floor(sec / 60)}m`
  return `hace ${Math.floor(sec / 3600)}h`
}

export default function Dashboard() {
  const [status,   setStatus]   = useState<BotStatus | null>(null)
  const [metrics,  setMetrics]  = useState<Metrics[]>([])
  const [signals,  setSignals]  = useState<Signal[]>([])
  const [lastPing, setLastPing] = useState<string>(new Date().toISOString())
  const [loading,  setLoading]  = useState(true)
  const [tab,      setTab]      = useState<'all' | 'long'>('all')

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

  const sectionLabel = (text: string) => (
    <div style={{
      fontSize: '0.68rem', letterSpacing: '0.15em', textTransform: 'uppercase',
      color: 'var(--muted)', fontWeight: 400, marginBottom: 20,
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      {text}
      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
    </div>
  )

  const card = (children: React.ReactNode, style?: React.CSSProperties) => (
    <div style={{
      background: '#fff', border: '1px solid var(--border)',
      borderRadius: 'var(--radius)', padding: '26px',
      ...style,
    }}>
      {children}
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>

      {/* ── Header ──────────────────────────────────────────────────── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(250,248,243,0.96)', backdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--border)',
        padding: '16px 48px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 38, height: 38, background: '#fff',
            border: '1px solid rgba(184,146,42,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <span style={{ fontFamily: 'var(--serif)', fontSize: '1.6rem', fontStyle: 'italic', color: 'var(--gold)', lineHeight: 1 }}>M</span>
          </div>
          <div>
            <div style={{ fontFamily: 'var(--serif)', fontSize: '1.4rem', fontWeight: 400, color: 'var(--ink)', letterSpacing: '-0.01em' }}>
              Trading<em style={{ fontStyle: 'italic', color: 'var(--gold)' }}>Bot ML</em>
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--muted)', letterSpacing: '0.06em' }}>
              {activos.length > 0 ? activos.join(' · ') : 'Conectando...'}
            </div>
          </div>
        </div>

        {/* Right side */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
          {kill && (
            <span style={{
              background: 'var(--red-bg)', color: 'var(--red)',
              border: '1px solid rgba(168,50,50,0.2)',
              borderRadius: 4, padding: '6px 14px',
              fontSize: '0.7rem', fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase',
            }}>⛔ Kill Switch</span>
          )}

          {/* Modo */}
          <span style={{
            background: 'var(--gold-bg)', color: 'var(--gold)',
            border: '1px solid rgba(184,146,42,0.2)',
            borderRadius: 4, padding: '6px 14px',
            fontSize: '0.7rem', fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase',
          }}>{modo}</span>

          {/* Status dot */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: '0.7rem', color: 'var(--muted)', fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            <div style={{
              width: 7, height: 7, borderRadius: '50%',
              background: loading ? 'var(--gold)' : running ? 'var(--green)' : 'var(--red)',
              boxShadow: running ? '0 0 0 3px rgba(45,122,79,0.15)' : 'none',
              animation: running ? 'pulse 2s infinite' : 'none',
            }} />
            {loading ? 'Cargando' : running ? `Live · ${timeSince(lastPing)}` : 'Detenido'}
          </div>

          <button
            onClick={loadAll}
            style={{
              background: 'none', border: '1px solid var(--border)', color: 'var(--muted)',
              fontFamily: 'var(--sans)', fontSize: '0.7rem', letterSpacing: '0.08em',
              textTransform: 'uppercase', padding: '7px 16px', cursor: 'pointer', borderRadius: 4,
            }}
          >↻ Actualizar</button>
        </div>
      </header>

      {/* ── Main ────────────────────────────────────────────────────── */}
      <main style={{ maxWidth: 1280, margin: '0 auto', padding: '36px 48px 80px' }}>

        {/* KPI */}
        {sectionLabel('Resumen general')}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 18, marginBottom: 36 }}>
          <KpiCard
            icon="💰" label="Equity Shadow" value={fmt$(equity)}
            sub={`P&L: ${pnl >= 0 ? '+' : ''}${(pnl * 100).toFixed(2)}%`}
            color={pnl >= 0 ? 'green' : 'red'}
          />
          <KpiCard
            icon="🎯" label="Win Rate"
            value={winRate != null ? `${(winRate * 100).toFixed(1)}%` : '—'}
            sub="Últimas 30 señales LONG"
            color={winRate != null && winRate > 0.6 ? 'green' : winRate != null ? 'gold' : 'default'}
          />
          <KpiCard
            icon="🔬" label="IC Medio"
            value={ic != null ? ic.toFixed(4) : '—'}
            sub={ic != null && ic > 0.05 ? 'Sobre umbral ✓' : 'Umbral: > 0.05'}
            color={ic != null && ic > 0.05 ? 'green' : 'gold'}
          />
          <KpiCard
            icon="🔄" label="Ciclos completados"
            value={String(cycles)}
            sub={`${longs} señales LONG detectadas`}
            color="gold"
          />
        </div>

        {/* Charts */}
        {sectionLabel('Evolución del sistema')}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 18, marginBottom: 36 }}>
          {card(
            <>
              <div style={{ fontFamily: 'var(--serif)', fontSize: '1.1rem', fontWeight: 400, color: 'var(--ink)', marginBottom: 4 }}>
                Curva de Equity
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--muted)', fontWeight: 300, marginBottom: 22 }}>
                Capital hipotético shadow — sin órdenes reales
              </div>
              <EquityChart data={metrics} />
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
                <span style={{ fontSize: '0.72rem', color: pnl >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 500 }}>
                  {pnl >= 0 ? '▲' : '▼'} {pnl >= 0 ? '+' : ''}{(pnl * 100).toFixed(2)}% desde inicio
                </span>
              </div>
            </>
          )}
          {card(
            <>
              <div style={{ fontFamily: 'var(--serif)', fontSize: '1.1rem', fontWeight: 400, color: 'var(--ink)', marginBottom: 4 }}>
                IC & Win Rate
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--muted)', fontWeight: 300, marginBottom: 22 }}>
                Calidad de predicción del modelo
              </div>
              <IcWinChart data={metrics} />
              <div style={{ fontSize: '0.68rem', color: 'var(--muted)', marginTop: 10, lineHeight: 1.6 }}>
                Línea dorada = umbral IC mínimo. Shadow aprobado cuando IC &gt; 0.05 y Win Rate &gt; 60%.
              </div>
            </>
          )}
        </div>

        {/* Symbol breakdown */}
        {signals.length > 0 && (
          <>
            {sectionLabel('Estado por símbolo')}
            {card(<SymbolBreakdown signals={signals} />, { marginBottom: 36 })}
          </>
        )}

        {/* Signals */}
        {sectionLabel('Señales recientes')}
        {card(
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
              <div>
                <div style={{ fontFamily: 'var(--serif)', fontSize: '1.1rem', fontWeight: 400, color: 'var(--ink)', marginBottom: 4 }}>
                  Actividad del scanner
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--muted)', fontWeight: 300 }}>
                  Señales LONG / FLAT generadas por el modelo ensemble
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['all', 'long'] as const).map(t => (
                  <button key={t} onClick={() => setTab(t)} style={{
                    background:   tab === t ? 'var(--gold-bg2)' : 'none',
                    color:        tab === t ? 'var(--gold)'     : 'var(--muted)',
                    border:       `1px solid ${tab === t ? 'rgba(184,146,42,0.2)' : 'var(--border)'}`,
                    borderRadius: 4, padding: '7px 16px',
                    fontFamily: 'var(--sans)', fontSize: '0.7rem',
                    letterSpacing: '0.08em', textTransform: 'uppercase',
                    cursor: 'pointer',
                  }}>
                    {t === 'all' ? 'Todas' : '↑ Solo LONG'}
                  </button>
                ))}
              </div>
            </div>
            <SignalsTable signals={tab === 'all' ? signals : signals.filter(s => s.action === 'LONG')} />
          </>
        )}

        {/* Decision panel */}
        {sectionLabel('¿Qué hacer ahora?')}
        <div style={{
          background: 'var(--ink)', color: 'var(--bg)',
          borderRadius: 'var(--radius)', padding: '30px',
          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 22,
          marginBottom: 36,
        }}>
          <div>
            <div style={{ fontSize: '0.63rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(250,248,243,0.4)', marginBottom: 7 }}>
              Fase actual
            </div>
            <div style={{ fontFamily: 'var(--serif)', fontSize: '1.45rem', fontWeight: 300, marginBottom: 4 }}>
              {modo === 'SHADOW' ? 'Shadow Mode' : modo === 'PAPER' ? 'Paper Trading' : 'Live Trading'}
            </div>
            <div style={{ fontSize: '0.73rem', color: 'rgba(250,248,243,0.45)', fontWeight: 300, lineHeight: 1.5 }}>
              Sin dinero real. El modelo aprende y acumula estadísticas.
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.63rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(250,248,243,0.4)', marginBottom: 7 }}>
              Progreso
            </div>
            <div style={{ fontFamily: 'var(--serif)', fontSize: '1.45rem', fontWeight: 300, marginBottom: 4 }}>
              {cycles} / 30 ciclos
            </div>
            <div style={{ fontSize: '0.73rem', color: 'rgba(250,248,243,0.45)', fontWeight: 300, lineHeight: 1.5 }}>
              Necesitas 30+ ciclos con IC &gt; 0.05 y win rate &gt; 60% para pasar a paper.
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.63rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(250,248,243,0.4)', marginBottom: 7 }}>
              Criterio aprobación
            </div>
            <div style={{ fontFamily: 'var(--serif)', fontSize: '1.45rem', fontWeight: 300, marginBottom: 4 }}>
              IC &gt; 0.05 · WR &gt; 60%
            </div>
            <div style={{ fontSize: '0.73rem', color: 'rgba(250,248,243,0.45)', fontWeight: 300, lineHeight: 1.5 }}>
              Y kill switch inactivo durante todo el shadow period.
            </div>
          </div>
          <div style={{ gridColumn: 'span 3', borderTop: '1px solid rgba(250,248,243,0.1)', paddingTop: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontFamily: 'var(--serif)', fontSize: '1.1rem', fontWeight: 300 }}>
              {cycles < 30
                ? 'Continúa el shadow mode — acumula ciclos y datos antes de avanzar'
                : ic != null && ic > 0.05 && winRate != null && winRate > 0.6 && !kill
                  ? '✓ Shadow aprobado — puedes pasar a MODO=paper cuando estés listo'
                  : 'Ciclos suficientes, pero IC o win rate aún no alcanzan el umbral'}
            </div>
            <div style={{
              padding: '9px 22px', borderRadius: 4, fontSize: '0.72rem',
              letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 500,
              background: 'rgba(184,146,42,0.2)', color: 'var(--gold2)',
              border: '1px solid rgba(184,146,42,0.3)', whiteSpace: 'nowrap', marginLeft: 20,
            }}>
              ⏳ Recopilar datos
            </div>
          </div>
        </div>

        {/* System status */}
        {sectionLabel('Estado del sistema')}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
          {[
            { label: 'Bot',      value: running ? '● Activo' : '○ Detenido', ok: running },
            { label: 'Modo',     value: `📄 ${modo}`,                         ok: true },
            { label: 'Activos',  value: `${activos.length || 8} símbolos`,    ok: true },
            { label: 'Kill switch', value: kill ? '⛔ ACTIVO' : '✓ Inactivo', ok: !kill },
          ].map(item => (
            <div key={item.label} style={{
              background: '#fff', border: '1px solid var(--border)',
              borderRadius: 'var(--radius)', padding: '16px 18px',
            }}>
              <div style={{ fontSize: '0.63rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 5 }}>
                {item.label}
              </div>
              <div style={{ fontSize: '0.85rem', color: item.ok ? 'var(--green)' : 'var(--red)', fontWeight: 400 }}>
                {item.value}
              </div>
            </div>
          ))}
        </div>

        <div style={{ textAlign: 'center', marginTop: 48, fontSize: '0.68rem', color: 'var(--muted)', letterSpacing: '0.06em' }}>
          Actualización en tiempo real · Supabase Realtime · Trading Bot ML v1.0
        </div>
      </main>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
      `}</style>
    </div>
  )
}
