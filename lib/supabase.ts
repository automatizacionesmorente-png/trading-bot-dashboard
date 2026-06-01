import { createClient } from '@supabase/supabase-js'

const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL  ?? 'https://placeholder.supabase.co'
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder'

export const supabase = createClient(supabaseUrl, supabaseAnon)

// ── Tipos ─────────────────────────────────────────────────────────────

export type Signal = {
  id:            number
  ts:            string
  symbol:        string
  timeframe:     string
  price:         number | null
  signal_prob:   number | null
  regime:        number | null
  action:        'LONG' | 'FLAT' | 'NO_SIGNAL'
  size:          number
  risk_pct:      number
  reject_reason: string | null
  ic_recent:     number | null
  model_trained: boolean
  modo:          string
  created_at:    string
}

export type Metrics = {
  id:               number
  ts:               string
  n_cycles:         number
  n_signals_total:  number
  n_signals_long:   number
  n_signals_flat:   number
  shadow_equity:    number
  shadow_pnl_pct:   number
  win_rate_recent:  number | null
  ic_mean_recent:   number | null
  kill_switch:      boolean
  modo:             string
}

export type BotStatus = {
  bot_id:      string
  running:     boolean
  modo:        string
  kill_switch: boolean
  kill_reason: string | null
  activos:     string | null
  updated_at:  string
}
