import { useEffect, useMemo, useRef, useState } from 'react'
import { checkNew, getLookups, get } from '../api'
import { useApp } from '../state'
import { CheckInput, CheckResult, LookupInfo, OrderDetail } from '../types'
import { Waterfall } from '../components/viz'
import { Card, DriverBars, Gauge, TierChip } from '../components/ui'
import { verdict } from '../components/verdict'
import { countryEn, countryEs } from '../static/names'
import { money, pct } from '../format'

const MODES = ['Standard Class', 'Second Class', 'First Class', 'Same Day']
const nowLocal = () => { const d = new Date(); d.setSeconds(0, 0); const z = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}` }
const withHour = (when: string, h: number) => when.slice(0, 11) + String(h).padStart(2, '0') + ':00'
const DEFAULT: CheckInput = { mode: 'Standard Class', when: nowLocal(), pay_type: 'DEBIT', segment: 'Consumer', country: 'Estados Unidos', category: "Women's Apparel", qty: 3, sales: 250 }
const PAY: Record<string, string> = { DEBIT: 'Debit card', CASH: 'Cash', PAYMENT: 'Card payment', TRANSFER: 'Bank transfer' }

export default function Check() {
  const [f, setF] = useState<CheckInput>(DEFAULT)
  const [countryText, setCountryText] = useState(countryEn(DEFAULT.country))
  const [info, setInfo] = useState<LookupInfo | null>(null)
  const [res, setRes] = useState<CheckResult | null>(null)
  const [err, setErr] = useState('')
  const [before, setBefore] = useState<{ p: number; label: string } | null>(null)
  const set = (patch: Partial<CheckInput>) => setF(x => ({ ...x, ...patch }))
  const { focusId } = useApp()
  useEffect(() => { getLookups().then(setInfo) }, [])
  useEffect(() => {
    if (!focusId) return
    get<OrderDetail>(`/api/orders/${focusId}`).then(o => { setBefore(null); setF({ mode: o.mode, when: o.date.replace(' ', 'T').slice(0, 16), pay_type: o.type, segment: o.segment, country: o.country, category: o.category, qty: o.qty, sales: Math.round(o.sales * 100) / 100 }); setCountryText(countryEn(o.country)) }).catch(() => {})
  }, [focusId])
  const known = useMemo(() => Object.fromEntries((info?.countries ?? []).map(c => [c, 1])), [info])
  const timer = useRef<number>()
  const answer = useRef<HTMLDivElement>(null)
  const jump = () => { if (window.innerWidth < 1100) setTimeout(() => answer.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 250) }
  useEffect(() => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      if (!(f.sales > 0) || !(f.qty > 0)) { setErr('Enter an order value and a number of items above zero.'); return }
      checkNew(f).then(r => { setRes(r); setErr('') }).catch(() => setErr('Could not read the date or the shipping option.'))
    }, 120)
    return () => window.clearTimeout(timer.current)
  }, [f])
  const hour = Number(f.when.slice(11, 13))
  const v = res ? verdict(res.p, res.threshold, res.tier, f.mode, f.when) : null
  const change = (label: string, patch: Partial<CheckInput>) => { if (!before && res) setBefore({ p: res.p, label }); else if (before) setBefore({ ...before, label }); set(patch) }
  const risky = () => { jump(); setBefore(null); setF({ ...DEFAULT, mode: 'Same Day', when: withHour(nowLocal(), 15), sales: 900, qty: 8 }); setCountryText(countryEn(DEFAULT.country)) }
  const safe = () => { jump(); setBefore(null); setF({ ...DEFAULT, mode: 'Same Day', when: withHour(nowLocal(), 9), sales: 250, qty: 3 }); setCountryText(countryEn(DEFAULT.country)) }
  const reset = () => { setBefore(null); setF(DEFAULT); setCountryText(countryEn(DEFAULT.country)) }
  const delta = res && before ? res.p - before.p : 0
  const countryOk = !info || countryEs(countryText, known) in known

  return (
    <div className="grid g21">
      <div className="grid" style={{ alignContent: 'start' }}>
        <Card title="Tell us about the order" lead="Eight quick answers. The result updates as you type.">
          <div className="pill-row" style={{ marginBottom: 14 }}>
            <button className="btn" onClick={risky}>Try a risky order</button>
            <button className="btn" onClick={safe}>Try a safe order</button>
            <button className="btn" onClick={reset}>Start over</button>
          </div>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Shipping option</div>
          <div className="seg segfull">{MODES.map(m => <button key={m} className={f.mode === m ? 'on' : ''} onClick={() => set({ mode: m })}>{m}</button>)}</div>
          <div className="formgrid">
            <label>Date and time placed<input className="input" type="datetime-local" value={f.when} onChange={e => e.target.value && set({ when: e.target.value })} /></label>
            <label>Order value (USD)<input className="input" type="number" min={1} value={f.sales} onChange={e => set({ sales: +e.target.value })} /></label>
            <label>Number of items<input className="input" type="number" min={1} value={f.qty} onChange={e => set({ qty: +e.target.value })} /></label>
            <label>Payment<select className="select" value={f.pay_type} onChange={e => set({ pay_type: e.target.value })}>{Object.entries(PAY).map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select></label>
            <label>Customer type<select className="select" value={f.segment} onChange={e => set({ segment: e.target.value })}>{['Consumer', 'Corporate', 'Home Office'].map(s => <option key={s}>{s}</option>)}</select></label>
            <label>Product category<select className="select" value={f.category} onChange={e => set({ category: e.target.value })}>{(info?.categories ?? [f.category]).map(c => <option key={c}>{c}</option>)}</select></label>
            <label style={{ gridColumn: '1 / -1' }}>Country
              <input className="input" list="countries" value={countryText} onChange={e => { setCountryText(e.target.value); const es = countryEs(e.target.value, known); set({ country: es }) }} placeholder="Start typing a country" />
              <datalist id="countries">{(info?.countries ?? []).map(c => <option key={c} value={countryEn(c)} />)}</datalist>
            </label>
          </div>
          {!countryOk && <p className="note" style={{ marginTop: 8 }}>The model has not seen this country. It will use the average late rate.</p>}
          {err && <p className="note" style={{ color: 'var(--crit)', marginTop: 8 }}>{err}</p>}
        </Card>
        <Card title="What this tool can and cannot do">
          <p className="note" style={{ margin: 0 }}>It predicts one order at the moment it is placed. It does not forecast how many orders will come next week. The model learned from orders placed between 2015 and 2018, so it can drift if shipping rules change. Countries or products it never saw fall back to training averages.</p>
        </Card>
      </div>
      <div className="grid" style={{ alignContent: 'start' }}>
        {res && v && <>
          <div ref={answer} style={{ scrollMarginTop: 12 }} />
          <Card className="hero">
            <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
              <Gauge value={res.p} size={170} />
              <div style={{ flex: '1 1 220px' }}>
                <div className="eyebrow">Our answer</div>
                <div className="kpi" style={{ color: v.kind === 'crit' ? 'var(--crit)' : v.kind === 'high' ? 'var(--high)' : 'var(--good)' }}>{v.head}</div>
                <p style={{ margin: '8px 0 10px' }}><b>{v.action}</b> {v.kind !== 'good' && v.detail}</p>
                <TierChip tier={res.tier} />
              </div>
            </div>
          </Card>
          {before && <div className={`callout ${delta > 0.02 ? 'crit' : ''}`}><b>{Math.abs(delta) < 0.005 ? 'No change in risk' : delta > 0 ? `Risk goes up by ${(delta * 100).toFixed(0)} points` : `Risk drops by ${(-delta * 100).toFixed(0)} points`}</b>After "{before.label}": from {pct(before.p)} to {pct(res.p)} chance of being late.</div>}
          <Card title="Try a change" lead="See how the answer moves. Nothing is saved.">
            <div className="pill-row">
              {f.mode !== 'Standard Class' && <button className="btn" onClick={() => change('Standard Class', { mode: 'Standard Class' })}>Ship Standard Class</button>}
              {f.mode !== 'Second Class' && <button className="btn" onClick={() => change('Second Class', { mode: 'Second Class' })}>Ship Second Class</button>}
              {f.mode === 'Same Day' && hour >= 12 && <button className="btn" onClick={() => change('placed at 09:00', { when: withHour(f.when, 9) })}>Place it at 09:00</button>}
              {f.mode === 'Same Day' && hour < 12 && <button className="btn" onClick={() => change('placed at 15:00', { when: withHour(f.when, 15) })}>Place it at 15:00</button>}
              {f.mode !== 'Same Day' && <button className="btn" onClick={() => change('Same Day at 15:00', { mode: 'Same Day', when: withHour(f.when, 15) })}>Ship Same Day at 15:00</button>}
              <button className="btn" onClick={() => setBefore(null)}>Clear comparison</button>
            </div>
          </Card>
          {res.notes.length > 0 && <div className="callout"><b>Heads up</b>{res.notes.join(' ')}</div>}
          <Card title="What pushed the risk" lead="Starting from a typical order, each reason moves the chance up (red) or down (green), in percentage points.">
            {(() => { const sg = (z: number) => 1 / (1 + Math.exp(-z)); const top = [...res.drivers].sort((a, b) => Math.abs(b.shap) - Math.abs(a.shap)).slice(0, 5); const rest = res.drivers.filter(d => !top.includes(d)).reduce((a, d) => a + d.shap, 0)
              let z = res.base_value; const steps = [...top, ...(Math.abs(rest) > 1e-6 ? [{ label: 'All other reasons', shap: rest }] : [])].map(d => { const a = sg(z); z += d.shap; return { label: d.label, delta: sg(z) - a } })
              return <Waterfall base={sg(res.base_value)} steps={steps} endLabel="This order" /> })()}
          </Card>
          <details className="fold">
            <summary>Show the numbers</summary>
            <div style={{ padding: '4px 2px 2px' }}>
              <p className="note" style={{ margin: '6px 0 10px' }}>Red pushes the risk up. Green pulls it down.</p>
              <DriverBars drivers={res.drivers} />
              <table className="t" style={{ marginTop: 12 }}><tbody>
                <tr><td>Chance of being late</td><td className="num">{pct(res.p, 1)}</td></tr>
                <tr><td>Flag line (we flag orders above this)</td><td className="num">{pct(res.threshold)}</td></tr>
                <tr><td>Priority score (chance late × order value)</td><td className="num">{money(res.priority)}</td></tr>
                <tr><td>Region used</td><td>{res.region || 'unknown'}</td></tr>
              </tbody></table>
              {res.assumed.length > 0 && <p className="note" style={{ marginTop: 10 }}>Not asked, so we assumed: {res.assumed.join('; ')}.</p>}
            </div>
          </details>
        </>}
      </div>
    </div>
  )
}
