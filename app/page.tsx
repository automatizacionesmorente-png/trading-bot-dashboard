'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import { supabase, Signal, Metrics, BotStatus } from '@/lib/supabase'
import EquityChart     from '@/components/EquityChart'
import IcWinChart      from '@/components/IcWinChart'

// ─── helpers ────────────────────────────────────────────────────────────────

function fmt$(n: number) {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}
function fmtPct(n: number, decimals = 2) {
  return (n >= 0 ? '+' : '') + (n * 100).toFixed(decimals) + '%'
}
function timeSince(ts: string) {
  const sec = Math.floor((Date.now() - new Date(ts).getTime()) / 1000)
  if (sec < 90)   return 'en vivo'
  if (sec < 3600) return `hace ${Math.floor(sec / 60)}m`
  if (sec < 86400) return `hace ${Math.floor(sec / 3600)}h`
  return `hace ${Math.floor(sec / 86400)}d`
}
function daysSince(ts: string) {
  return Math.floor((Date.now() - new Date(ts).getTime()) / 86400000)
}

// ─── static backtest validation gates (from V11 R4 10-year run) ─────────────
const GATES = [
  { name: 'Sharpe > 1.0',       value: '1.74',    ok: true,  detail: 'Sharpe ratio neto de costes' },
  { name: 'MaxDD > −20%',        value: '−16.6%',  ok: true,  detail: 'Máxima caída desde máximos' },
  { name: 'Sharpe a 3× costes', value: '0.81',    ok: true,  detail: 'Robusto con comisiones altas' },
  { name: 'Monte Carlo P5 > 0', value: '+133%',   ok: true,  detail: 'Peor 5% de escenarios sigue positivo' },
  { name: 'P(caída >20%) < 10%',value: '0.1%',    ok: true,  detail: 'Probabilidad de drawdown severo' },
  { name: 'T-stat > 1.96',      value: '5.48',    ok: true,  detail: 'Estadísticamente significativo' },
  { name: 'Alpha vs SPY > 3%',  value: '+0.33%',  ok: false, detail: 'Batimos SPY, pero el margen es estrecho' },
]

// ─── derived: open positions from recent LONG signals ───────────────────────
function derivePositions(signals: Signal[]): Signal[] {
  const bySymbol: Record<string, Signal> = {}
  // Walk signals oldest→newest, keep last LONG per symbol
  const sorted = [...signals].sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime())
  for (const s of sorted) {
    if (s.action === 'LONG') bySymbol[s.symbol] = s
    else if (s.action === 'FLAT' && bySymbol[s.symbol]) {
      // A FLAT after a LONG closes the position
      const days = daysSince(bySymbol[s.symbol].ts)
      if (days >= 10) delete bySymbol[s.symbol]
    }
  }
  // Filter: opened within last 12 days (hold = 10 days)
  return Object.values(bySymbol).filter(s => daysSince(s.ts) <= 12)
}

// ─── component ──────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [status,  setStatus]  = useState<BotStatus | null>(null)
  const [metrics, setMetrics] = useState<Metrics[]>([])
  const [signals, setSignals] = useState<Signal[]>([])
  const [lastPing,setLastPing] = useState<string>(new Date().toISOString())
  const [loading, setLoading] = useState(true)

  const loadAll = useCallback(async () => {
    const [{ data: st }, { data: mt }, { data: sg }] = await Promise.all([
      supabase.from('bot_status').select('*').eq('bot_id', 'main').single(),
      supabase.from('shadow_metrics').select('*').order('ts', { ascending: true }).limit(200),
      supabase.from('shadow_signals').select('*').order('ts', { ascending: false }).limit(300),
    ])
    if (st) setStatus(st as BotStatus)
    if (mt) setMetrics(mt as Metrics[])
    if (sg) setSignals(sg as Signal[])
    setLastPing(new Date().toISOString())
    setLoading(false)
  }, [])

  useEffect(() => { loadAll() }, [loadAll])
  useEffect(() => {
    const ch = supabase.channel('rt')
      .on('postgres_changes', { event: '*',      schema: 'public', table: 'bot_status'     }, p => { if (p.new) { setStatus(p.new as BotStatus); setLastPing(new Date().toISOString()) } })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'shadow_metrics' }, p => { setMetrics(prev => [...prev.slice(-199), p.new as Metrics]); setLastPing(new Date().toISOString()) })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'shadow_signals' }, p => { setSignals(prev => [p.new as Signal, ...prev.slice(0, 299)]); setLastPing(new Date().toISOString()) })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  // ── derived values ─────────────────────────────────────────────────────────
  const latest   = metrics.length > 0 ? metrics[metrics.length - 1] : null
  const equity   = latest?.shadow_equity   ?? 100_000
  const pnl      = latest?.shadow_pnl_pct  ?? 0
  const cycles   = latest?.n_cycles        ?? 0
  const winRate  = latest?.win_rate_recent ?? null
  const ic       = latest?.ic_mean_recent  ?? null
  const kill     = status?.kill_switch     ?? false
  const running  = status?.running         ?? false
  const modo     = (status?.modo ?? 'shadow').toUpperCase()

  const positions = derivePositions(signals)
  const recentLongs = signals.filter(s => s.action === 'LONG').slice(0, 20)

  // ── health score ───────────────────────────────────────────────────────────
  const icOk   = ic != null && ic > 0.05
  const botOk  = running && !kill
  const cycOk  = cycles > 0
  const health = kill ? 'critical' : !running ? 'stopped' : !icOk ? 'warning' : 'ok'

  const healthConfig = {
    ok:       { bg: 'var(--green-bg)',  border: 'rgba(45,122,79,0.2)',  dot: 'var(--green)', text: 'var(--green)',  label: '✓ Todo bien',          sub: 'El bot opera correctamente y el modelo predice bien' },
    warning:  { bg: 'rgba(184,146,42,.07)', border: 'rgba(184,146,42,.25)', dot: 'var(--gold2)', text: 'var(--gold)', label: '⚠ Atención',           sub: 'IC bajo — el modelo necesita más ciclos para calibrarse' },
    stopped:  { bg: 'rgba(168,50,50,.07)', border: 'rgba(168,50,50,.2)',  dot: 'var(--red)',   text: 'var(--red)',   label: '○ Bot detenido',        sub: 'El sistema no está ejecutando ciclos' },
    critical: { bg: 'rgba(168,50,50,.1)',  border: 'rgba(168,50,50,.3)',  dot: 'var(--red)',   text: 'var(--red)',   label: '⛔ Kill switch activo',  sub: 'El bot ha pausado operaciones por protección de capital' },
  }[health]

  // ── IC quality label ───────────────────────────────────────────────────────
  const icLabel = ic == null ? '—'
    : ic > 0.20 ? 'Excelente'
    : ic > 0.10 ? 'Bueno'
    : ic > 0.05 ? 'Suficiente'
    : 'Bajo'
  const icColor = ic == null ? 'var(--muted)'
    : ic > 0.10 ? 'var(--green)'
    : ic > 0.05 ? 'var(--gold)'
    : 'var(--red)'

  // ── cycle progress ─────────────────────────────────────────────────────────
  const cyclesNeeded  = 30
  const cyclesPct     = Math.min(cycles / cyclesNeeded * 100, 100)
  const shadowApproved = cycles >= 30 && icOk && (winRate == null || winRate > 0.60) && !kill

  // ── section & card helpers ─────────────────────────────────────────────────
  const SL = ({ text }: { text: string }) => (
    <div style={{ fontSize: '0.65rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 400, marginBottom: 18, display: 'flex', alignItems: 'center', gap: 10 }}>
      {text}
      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
    </div>
  )

  const Card = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
    <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 26, ...style }}>
      {children}
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>

      {/* ─── HEADER ─────────────────────────────────────────────────────────── */}
      <header style={{ position: 'sticky', top: 0, zIndex: 100, background: 'rgba(250,248,243,0.97)', backdropFilter: 'blur(20px)', borderBottom: '1px solid var(--border)', padding: '0 48px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
          <div style={{ width: 38, height: 38, background: '#fff', border: '1px solid rgba(184,146,42,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ fontFamily: 'var(--serif)', fontSize: '1.5rem', fontStyle: 'italic', color: 'var(--gold)', lineHeight: 1 }}>A</span>
          </div>
          <span style={{ fontFamily: 'var(--serif)', fontSize: '1.35rem', fontWeight: 400, color: 'var(--ink)', letterSpacing: '-0.01em' }}>
            Auto<em style={{ fontStyle: 'italic', color: 'var(--gold)' }}>MikeMor</em>
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          {/* Equity in header */}
          <div className="header-metric">
            <span className="header-metric-label">Portfolio Virtual</span>
            <span className="header-metric-value" style={{ color: pnl >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmt$(equity)}</span>
          </div>
          {/* IC in header */}
          <div className="header-metric">
            <span className="header-metric-label">IC del modelo</span>
            <span className="header-metric-value" style={{ color: icColor }}>{ic != null ? ic.toFixed(3) : '—'}</span>
          </div>
          {/* Modo */}
          <span style={{ fontSize: '10px', fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--gold)', background: 'var(--gold-bg)', border: '1px solid rgba(184,146,42,0.2)', borderRadius: 3, padding: '5px 14px' }}>{modo}</span>
          {/* Status dot */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: '10px', color: 'var(--muted)', letterSpacing: '0.08em' }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: loading ? 'var(--gold2)' : running ? 'var(--green)' : '#ccc', boxShadow: (!loading && running) ? '0 0 0 3px rgba(45,122,79,0.15)' : 'none', animation: (!loading && running) ? 'pulse 2.2s ease-in-out infinite' : 'none' }} />
            <span style={{ textTransform: 'uppercase' }}>{loading ? 'Cargando' : running ? timeSince(lastPing) : 'Detenido'}</span>
          </div>
          <button className="refresh-btn" onClick={loadAll} title="Actualizar">↻</button>
        </div>
      </header>

      <main style={{ maxWidth: 1280, margin: '0 auto', padding: '36px 48px 80px' }}>

        {/* ─── 1. ESTADO GLOBAL — lo primero que ves ──────────────────────── */}
        <div style={{ marginBottom: 36, background: healthConfig.bg, border: `1px solid ${healthConfig.border}`, borderRadius: 'var(--radius)', padding: '22px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: healthConfig.dot, boxShadow: `0 0 0 4px ${healthConfig.bg}`, flexShrink: 0, animation: health === 'ok' ? 'pulse 2.5s ease-in-out infinite' : 'none' }} />
            <div>
              <div style={{ fontFamily: 'var(--serif)', fontSize: '1.25rem', color: healthConfig.text, fontWeight: 400 }}>{healthConfig.label}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: 2 }}>{healthConfig.sub}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 32, textAlign: 'right' }}>
            <div>
              <div style={{ fontSize: '0.63rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 3 }}>Ciclos completados</div>
              <div style={{ fontFamily: 'var(--serif)', fontSize: '1.4rem', color: 'var(--ink)', fontWeight: 300 }}>{cycles} <span style={{ fontSize: '0.9rem', color: 'var(--muted)' }}>/ 30</span></div>
            </div>
            <div>
              <div style={{ fontSize: '0.63rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 3 }}>P&L virtual</div>
              <div style={{ fontFamily: 'var(--serif)', fontSize: '1.4rem', color: pnl >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 300 }}>{fmtPct(pnl)}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.63rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 3 }}>Posiciones abiertas</div>
              <div style={{ fontFamily: 'var(--serif)', fontSize: '1.4rem', color: 'var(--ink)', fontWeight: 300 }}>{positions.length} <span style={{ fontSize: '0.9rem', color: 'var(--muted)' }}>/ 10</span></div>
            </div>
          </div>
        </div>

        {/* ─── 2. MÉTRICAS PRINCIPALES ─────────────────────────────────────── */}
        <SL text="¿Cómo van las cosas?" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 36 }}>

          {/* Portfolio */}
          <Card>
            <div style={{ fontSize: '0.63rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }}>Portfolio virtual</div>
            <div style={{ fontFamily: 'var(--serif)', fontSize: '2.2rem', fontWeight: 300, color: 'var(--ink)', lineHeight: 1, marginBottom: 4 }}>{fmt$(equity)}</div>
            <div style={{ fontSize: '0.85rem', fontWeight: 500, color: pnl >= 0 ? 'var(--green)' : 'var(--red)', marginBottom: 8 }}>{pnl >= 0 ? '▲' : '▼'} {fmtPct(pnl)}</div>
            <div style={{ fontSize: '0.69rem', color: 'var(--muted)', lineHeight: 1.5 }}>Capital hipotético con señales reales del bot</div>
          </Card>

          {/* IC */}
          <Card>
            <div style={{ fontSize: '0.63rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }}>Calidad del modelo (IC)</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
              <div style={{ fontFamily: 'var(--serif)', fontSize: '2.2rem', fontWeight: 300, color: icColor, lineHeight: 1 }}>{ic != null ? ic.toFixed(3) : '—'}</div>
              <div style={{ fontSize: '0.85rem', fontWeight: 500, color: icColor }}>{icLabel}</div>
            </div>
            <div style={{ height: 4, background: 'var(--bg2)', borderRadius: 2, marginBottom: 8, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.min((ic ?? 0) / 0.3 * 100, 100)}%`, background: icColor, borderRadius: 2, transition: 'width 0.6s ease' }} />
            </div>
            <div style={{ fontSize: '0.69rem', color: 'var(--muted)', lineHeight: 1.5 }}>
              {ic != null && ic > 0.10 ? '✓ Por encima del umbral hedge fund (0.05)' : 'Mínimo necesario: 0.05 · Excelente: +0.15'}
            </div>
          </Card>

          {/* Ciclos / progreso */}
          <Card>
            <div style={{ fontSize: '0.63rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }}>Progreso → Paper Trading</div>
            <div style={{ fontFamily: 'var(--serif)', fontSize: '2.2rem', fontWeight: 300, color: 'var(--ink)', lineHeight: 1, marginBottom: 4 }}>{cycles}<span style={{ fontSize: '1rem', color: 'var(--muted)' }}>/30</span></div>
            <div style={{ height: 4, background: 'var(--bg2)', borderRadius: 2, marginBottom: 8, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${cyclesPct}%`, background: shadowApproved ? 'var(--green)' : 'var(--gold)', borderRadius: 2, transition: 'width 0.6s ease' }} />
            </div>
            <div style={{ fontSize: '0.69rem', color: shadowApproved ? 'var(--green)' : 'var(--muted)', lineHeight: 1.5 }}>
              {shadowApproved ? '🎉 Listo para paper trading con IBKR' : `Faltan ${Math.max(0, 30 - cycles)} ciclos · cada ciclo = 4 horas`}
            </div>
          </Card>

          {/* Win Rate */}
          <Card>
            <div style={{ fontSize: '0.63rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }}>Tasa de acierto</div>
            <div style={{ fontFamily: 'var(--serif)', fontSize: '2.2rem', fontWeight: 300, color: winRate == null ? 'var(--muted)' : winRate > 0.6 ? 'var(--green)' : winRate > 0.45 ? 'var(--gold)' : 'var(--red)', lineHeight: 1, marginBottom: 4 }}>
              {winRate != null ? `${(winRate * 100).toFixed(0)}%` : '—'}
            </div>
            <div style={{ fontSize: '0.69rem', color: 'var(--muted)', lineHeight: 1.5 }}>
              {winRate == null
                ? 'Se actualiza cuando cierran las primeras posiciones (~10 días)'
                : winRate > 0.6 ? '✓ Por encima del objetivo (60%)' : `Objetivo: 60% · Actual: ${(winRate*100).toFixed(0)}%`}
            </div>
          </Card>
        </div>

        {/* ─── 3. POSICIONES ABIERTAS AHORA ────────────────────────────────── */}
        {positions.length > 0 && (
          <>
            <SL text={`Posiciones abiertas ahora mismo (${positions.length})`} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginBottom: 36 }}>
              {positions.map(p => {
                const days  = daysSince(p.ts)
                const prob  = p.signal_prob ?? 0
                const pctDone = Math.min(days / 10 * 100, 100)
                return (
                  <Card key={p.symbol + p.ts} style={{ padding: '18px 20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                      <div>
                        <div style={{ fontFamily: 'var(--serif)', fontSize: '1.4rem', fontWeight: 400, color: 'var(--ink)', lineHeight: 1 }}>{p.symbol}</div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--green)', fontWeight: 500, marginTop: 2, letterSpacing: '0.06em' }}>● LONG</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.68rem', color: 'var(--muted)' }}>Entrada</div>
                        <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.88rem', color: 'var(--ink)' }}>${p.price?.toFixed(2) ?? '—'}</div>
                      </div>
                    </div>
                    {/* Progress bar: days held */}
                    <div style={{ marginBottom: 6 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.62rem', color: 'var(--muted)', marginBottom: 3 }}>
                        <span>Día {days} de 10</span>
                        <span>{days >= 10 ? '✓ cierre pendiente' : `${10 - days}d restantes`}</span>
                      </div>
                      <div style={{ height: 3, background: 'var(--bg2)', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pctDone}%`, background: days >= 8 ? 'var(--gold)' : 'var(--green)', borderRadius: 2 }} />
                      </div>
                    </div>
                    {/* Confidence */}
                    <div style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>
                      Confianza del modelo: <span style={{ color: prob > 0.65 ? 'var(--green)' : 'var(--gold)', fontWeight: 500 }}>{(prob * 100).toFixed(0)}%</span>
                      {p.ic_recent != null && <span style={{ marginLeft: 6 }}>· IC {p.ic_recent.toFixed(2)}</span>}
                    </div>
                  </Card>
                )
              })}
            </div>
          </>
        )}

        {positions.length === 0 && (
          <div style={{ marginBottom: 36, padding: '24px', background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--radius)', textAlign: 'center' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Sin posiciones abiertas ahora mismo — el bot abre posiciones en cada ciclo (cada 4 horas)</div>
          </div>
        )}

        {/* ─── 4. CURVA DE EQUITY ──────────────────────────────────────────── */}
        <SL text="Evolución del capital" />
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 18, marginBottom: 36 }}>
          <Card>
            <div style={{ fontFamily: 'var(--serif)', fontSize: '1.1rem', color: 'var(--ink)', marginBottom: 3 }}>Curva de equity</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginBottom: 20 }}>$100,000 inicial · precios reales · sin órdenes en broker</div>
            <EquityChart data={metrics} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
              <span style={{ fontSize: '0.72rem', color: pnl >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 500 }}>
                {pnl >= 0 ? '▲' : '▼'} {fmtPct(pnl)} desde inicio
              </span>
            </div>
          </Card>
          <Card>
            <div style={{ fontFamily: 'var(--serif)', fontSize: '1.1rem', color: 'var(--ink)', marginBottom: 3 }}>IC & Win Rate</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginBottom: 20 }}>Calidad de predicción por ciclo</div>
            <IcWinChart data={metrics} />
            <div style={{ fontSize: '0.68rem', color: 'var(--muted)', marginTop: 10, lineHeight: 1.6 }}>
              Línea dorada = umbral mínimo (IC 0.05). Estamos en <strong style={{ color: icColor }}>{ic?.toFixed(3) ?? '—'}</strong>
            </div>
          </Card>
        </div>

        {/* ─── 5. VALIDACIÓN DEL BACKTEST ──────────────────────────────────── */}
        <SL text="¿Está validada la estrategia? — Backtest 10 años (2015–2025)" />
        <Card style={{ marginBottom: 36 }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <div>
              <div style={{ fontFamily: 'var(--serif)', fontSize: '1.2rem', color: 'var(--ink)', marginBottom: 3 }}>
                6 de 7 criterios aprobados — estrategia validada
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>
                Walk-forward sobre 10 años de datos reales · 24 símbolos · 2,500+ trades
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: 'var(--serif)', fontSize: '2.5rem', fontWeight: 300, color: 'var(--green)', lineHeight: 1 }}>6<span style={{ fontSize: '1.5rem', color: 'var(--muted)' }}>/7</span></div>
              <div style={{ fontSize: '0.65rem', color: 'var(--muted)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Gates pasados</div>
            </div>
          </div>

          {/* Key numbers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12, marginBottom: 24, padding: '16px', background: 'var(--bg)', borderRadius: 6 }}>
            {[
              { label: 'Rentabilidad anual', value: '+12.9%', sub: 'vs SPY +12.6%' },
              { label: 'Sharpe ratio', value: '1.74', sub: 'SPY tiene 0.75' },
              { label: 'Máxima caída', value: '−16.6%', sub: 'SPY tuvo −33.7%' },
              { label: 'Alpha vs Momentum', value: '+5.9%/yr', sub: 'El ML sí aporta' },
              { label: 'T-estadístico', value: '5.48', sub: '>1.96 = significativo' },
            ].map(m => (
              <div key={m.label} style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--serif)', fontSize: '1.5rem', fontWeight: 300, color: 'var(--ink)', lineHeight: 1, marginBottom: 2 }}>{m.value}</div>
                <div style={{ fontSize: '0.62rem', color: 'var(--muted)', marginBottom: 2 }}>{m.label}</div>
                <div style={{ fontSize: '0.60rem', color: 'var(--ink2)', fontStyle: 'italic' }}>{m.sub}</div>
              </div>
            ))}
          </div>

          {/* Gates grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
            {GATES.map(g => (
              <div key={g.name} style={{ padding: '12px 14px', background: g.ok ? 'var(--green-bg)' : 'var(--red-bg)', border: `1px solid ${g.ok ? 'rgba(45,122,79,0.15)' : 'rgba(168,50,50,0.15)'}`, borderRadius: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <span style={{ fontSize: '0.75rem' }}>{g.ok ? '✓' : '✗'}</span>
                  <span style={{ fontSize: '0.68rem', fontWeight: 500, color: g.ok ? 'var(--green)' : 'var(--red)' }}>{g.name}</span>
                </div>
                <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.82rem', color: 'var(--ink)', marginBottom: 2 }}>{g.value}</div>
                <div style={{ fontSize: '0.62rem', color: 'var(--muted)', lineHeight: 1.4 }}>{g.detail}</div>
              </div>
            ))}
          </div>
        </Card>

        {/* ─── 6. SEÑALES RECIENTES ────────────────────────────────────────── */}
        <SL text="Últimas señales del modelo" />
        <Card style={{ marginBottom: 36 }}>
          <div style={{ fontFamily: 'var(--serif)', fontSize: '1.1rem', color: 'var(--ink)', marginBottom: 3 }}>Lo que ha decidido el bot recientemente</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginBottom: 20 }}>
            LONG = el modelo predice que el precio subirá · FLAT = no hay señal suficientemente clara
          </div>
          {recentLongs.length === 0 ? (
            <div style={{ fontSize: '0.75rem', color: 'var(--muted)', textAlign: 'center', padding: '20px 0' }}>Sin señales LONG recientes</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {recentLongs.slice(0, 12).map((s, i) => (
                <div key={s.id ?? i} style={{ display: 'grid', gridTemplateColumns: '80px 100px 1fr 90px 90px', alignItems: 'center', gap: 12, padding: '10px 14px', background: i % 2 === 0 ? 'var(--bg)' : '#fff', borderRadius: 5 }}>
                  <div style={{ fontFamily: 'var(--serif)', fontSize: '1.05rem', color: 'var(--ink)', fontWeight: 400 }}>{s.symbol}</div>
                  <div style={{ fontSize: '0.68rem', fontWeight: 500, color: 'var(--green)', letterSpacing: '0.06em' }}>● LONG</div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--muted)' }}>
                    Entrada: <span style={{ color: 'var(--ink)', fontFamily: 'DM Mono, monospace' }}>${s.price?.toFixed(2) ?? '—'}</span>
                    {s.ic_recent != null && <span style={{ marginLeft: 10 }}>IC: <span style={{ color: s.ic_recent > 0.1 ? 'var(--green)' : 'var(--gold)' }}>{s.ic_recent.toFixed(3)}</span></span>}
                  </div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--muted)', textAlign: 'right' }}>
                    Prob: <span style={{ color: (s.signal_prob ?? 0) > 0.65 ? 'var(--green)' : 'var(--gold)', fontWeight: 500 }}>{((s.signal_prob ?? 0) * 100).toFixed(0)}%</span>
                  </div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--muted)', textAlign: 'right' }}>{timeSince(s.ts)}</div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* ─── 7. PANEL DE ESTADO — qué hacer ─────────────────────────────── */}
        <SL text="¿Qué significa todo esto?" />
        <div style={{ background: 'var(--ink)', borderRadius: 'var(--radius)', padding: '32px', marginBottom: 36 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 28 }}>
            {[
              {
                phase: '01',
                title: 'Shadow Mode',
                active: modo === 'SHADOW',
                done:   shadowApproved,
                lines: [
                  `${cycles}/30 ciclos completados`,
                  `IC: ${ic?.toFixed(3) ?? '—'} ${icOk ? '✓' : '(necesita >0.05)'}`,
                  `Win rate: ${winRate != null ? (winRate*100).toFixed(0)+'%' : 'esperando cierres'}`,
                  'Modo actual — sin dinero real',
                ]
              },
              {
                phase: '02',
                title: 'Paper Trading IBKR',
                active: modo === 'PAPER',
                done: false,
                lines: [
                  'Órdenes reales en cuenta demo',
                  'Visible en app de IBKR',
                  'Cuenta DUQ389144 ($1M virtual)',
                  shadowApproved ? '→ Listo para activar' : `→ Disponible en ~${Math.max(0, 30 - cycles)} ciclos más`,
                ]
              },
              {
                phase: '03',
                title: 'Live Trading',
                active: modo === 'LIVE',
                done: false,
                lines: [
                  'Dinero real (empezar pequeño)',
                  'Mínimo 8 semanas de paper',
                  'Incrementar gradualmente',
                  '→ Fase futura',
                ]
              },
            ].map(step => (
              <div key={step.phase} style={{ opacity: step.active ? 1 : 0.5 }}>
                <div style={{ fontSize: '0.6rem', color: 'rgba(250,248,243,0.35)', letterSpacing: '0.2em', marginBottom: 6 }}>FASE {step.phase}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: step.active ? 'var(--gold2)' : step.done ? 'var(--green)' : 'rgba(250,248,243,0.2)', boxShadow: step.active ? '0 0 0 3px rgba(212,170,74,0.2)' : 'none', animation: step.active ? 'pulse 2s ease-in-out infinite' : 'none' }} />
                  <div style={{ fontFamily: 'var(--serif)', fontSize: '1.15rem', color: '#faf8f3', fontWeight: 300 }}>{step.title}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {step.lines.map((l, i) => (
                    <div key={i} style={{ fontSize: '0.72rem', color: step.active ? 'rgba(250,248,243,0.65)' : 'rgba(250,248,243,0.3)', lineHeight: 1.4 }}>
                      {l.startsWith('→') ? <span style={{ color: step.active ? 'var(--gold2)' : 'rgba(212,170,74,0.4)' }}>{l}</span> : l}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ─── 8. SISTEMA ──────────────────────────────────────────────────── */}
        <SL text="Estado del sistema" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12, marginBottom: 48 }}>
          {[
            { label: 'Bot',         value: running ? '● Activo' : '○ Detenido',        ok: running },
            { label: 'Modo',        value: modo,                                          ok: true    },
            { label: 'Universo',    value: '24 símbolos (V11 R4)',                       ok: true    },
            { label: 'Backtest',    value: '6/7 gates · Sharpe 1.74',                    ok: true    },
            { label: 'Kill switch', value: kill ? '⛔ ACTIVO' : '✓ Inactivo',           ok: !kill   },
          ].map(item => (
            <div key={item.label} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '14px 16px' }}>
              <div style={{ fontSize: '0.62rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 5 }}>{item.label}</div>
              <div style={{ fontSize: '0.82rem', color: item.ok ? 'var(--green)' : 'var(--red)', fontWeight: 400 }}>{item.value}</div>
            </div>
          ))}
        </div>

        <div style={{ textAlign: 'center', fontSize: '0.65rem', color: 'var(--muted)', letterSpacing: '0.06em' }}>
          Actualización en tiempo real · Supabase Realtime · AutoMikeMor v2.0
        </div>
      </main>
    </div>
  )
}
