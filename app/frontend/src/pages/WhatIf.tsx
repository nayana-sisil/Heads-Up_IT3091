import { useEffect, useState } from 'react'
import { useGet, post } from '../api'
import { Meta, OrderDetail, OrderRow, WhatIfResult } from '../types'
import { useApp } from '../state'
import { Card, DriverBars, Gauge, Skeleton, TierChip } from '../components/ui'
import { money, pct } from '../format'

export default function WhatIf() {
  const { focusId } = useApp()
  const { data: meta } = useGet<Meta>('/api/meta')
  const { data: list } = useGet<{ items: OrderRow[] }>('/api/orders?limit=40&flagged=true')
  const [id, setId] = useState<number | null>(focusId)
  useEffect(() => { if (id === null && list && list.items.length) setId(list.items[0].id) }, [list, id])
  const { data: o } = useGet<OrderDetail>(id ? `/api/orders/${id}` : null, [id])
  const [mode, setMode] = useState(''); const [hour, setHour] = useState<number | null>(null); const [pay, setPay] = useState(''); const [seg, setSeg] = useState('')
  const [res, setRes] = useState<WhatIfResult | null>(null)
  useEffect(() => { setMode(''); setHour(null); setPay(''); setSeg('') }, [id])
  const curMode = mode || o?.mode || ''; const curHour = hour ?? (o ? Number(o.date.slice(11, 13)) : 0)
  useEffect(() => {
    if (!id || !o) return; let live = true
    const t = setTimeout(() => post<WhatIfResult>(`/api/orders/${id}/whatif`, { mode: mode || null, hour, pay_type: pay || null, segment: seg || null }).then(r => live && setRes(r)).catch(() => {}), 120)
    return () => { live = false; clearTimeout(t) }
  }, [id, o, mode, hour, pay, seg])
  const reset = () => { setMode(''); setHour(null); setPay(''); setSeg('') }
  const delta = res ? res.after.p - res.before.p : 0
  return (
    <div className="grid g21">
      <div className="grid" style={{ alignContent: 'start' }}>
        <Card title="1. Pick an order" lead="Flagged orders, highest priority first.">
          <select className="select" style={{ width: '100%' }} value={id ?? ''} onChange={e => setId(+e.target.value)} aria-label="Order">
            {focusId && !list?.items.find(i => i.id === focusId) && <option value={focusId}>#{focusId}</option>}
            {list?.items.map(i => <option key={i.id} value={i.id}>#{i.id} · {i.mode} · {money(i.sales)} · {pct(i.p)} late</option>)}
          </select>
          {o && <p className="note" style={{ margin: '10px 0 0' }}>{o.city}, {o.country} · {o.segment} · paid by {o.type}</p>}
        </Card>
        <Card title="2. Change something" lead="Moves are tested on the real model, not on a rule of thumb.">
          <div className="eyebrow" style={{ marginBottom: 6 }}>Shipping option</div>
          <div className="seg" style={{ flexWrap: 'wrap' }}>{meta?.modes.map(m => <button key={m} className={curMode === m ? 'on' : ''} onClick={() => setMode(m === o?.mode ? '' : m)}>{m}</button>)}</div>
          <div className="eyebrow" style={{ margin: '16px 0 6px' }}>Hour the order was placed: <span className="num" style={{ color: 'var(--ink)' }}>{String(curHour).padStart(2, '0')}:00</span></div>
          <input className="slider" type="range" min={0} max={23} value={curHour} onChange={e => setHour(+e.target.value)} aria-label="Order hour" />
          <div className="grid g2" style={{ marginTop: 14 }}>
            <div><div className="eyebrow" style={{ marginBottom: 6 }}>Payment</div><select className="select" style={{ width: '100%' }} value={pay || o?.type || ''} onChange={e => setPay(e.target.value === o?.type ? '' : e.target.value)}>{meta?.types.map(t => <option key={t}>{t}</option>)}</select></div>
            <div><div className="eyebrow" style={{ marginBottom: 6 }}>Customer</div><select className="select" style={{ width: '100%' }} value={seg || o?.segment || ''} onChange={e => setSeg(e.target.value === o?.segment ? '' : e.target.value)}>{meta?.segments.map(t => <option key={t}>{t}</option>)}</select></div>
          </div>
          <div className="pill-row" style={{ marginTop: 16 }}>
            <button className="btn" onClick={() => { setMode('Same Day'); setHour(15) }}>Same Day at 15:00</button>
            <button className="btn" onClick={() => { setMode('Same Day'); setHour(9) }}>Same Day at 09:00</button>
            <button className="btn" onClick={() => setMode('Standard Class')}>Standard Class</button>
            <button className="btn" onClick={reset}>Reset</button>
          </div>
        </Card>
      </div>
      <div className="grid" style={{ alignContent: 'start' }}>
        {!res || !o ? <Skeleton h={420} /> : <>
          <div className="grid g2">
            <Card><div className="eyebrow">Before</div><Gauge value={res.before.p} size={170} /><div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><TierChip tier={res.before.tier} /><span className="num muted">priority {money(res.before.priority)}</span></div></Card>
            <Card><div className="eyebrow">After your change</div><Gauge value={res.after.p} size={170} /><div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><TierChip tier={res.after.tier} /><span className="num muted">priority {money(res.after.priority)}</span></div></Card>
          </div>
          <div className={`callout ${delta > 0.02 ? 'crit' : ''}`}><b>{Math.abs(delta) < 0.005 ? 'No change in risk' : delta > 0 ? `Risk goes up by ${(delta * 100).toFixed(0)} points` : `Risk drops by ${(-delta * 100).toFixed(0)} points`}</b>
            {Math.abs(delta) < 0.005 ? 'Try a different shipping option or a different hour.' : `From ${pct(res.before.p)} to ${pct(res.after.p)} chance of being late. Priority moves from ${money(res.before.priority)} to ${money(res.after.priority)}.`}</div>
          <Card title="What drives the new score" lead="Red pushes the risk up. Green pulls it down.">{res.after.drivers && <DriverBars drivers={res.after.drivers} />}</Card>
          <p className="note">Tip: pick a Same Day order and slide the hour across noon. The risk jumps from near zero to near certain, which is the strongest pattern the model found.</p>
        </>}
      </div>
    </div>
  )
}
