import { Note } from '../components/tech'
import { useEffect, useState } from 'react'
import { useGet } from '../api'
import { Meta, OrderRow } from '../types'
import { useApp, qs, PERIODS } from '../state'
import { Card, OrderCard, Skeleton } from '../components/ui'
import { Icon } from '../components/Icons'
import { moneyK, num } from '../format'

const WHAT: Record<string, string> = { Critical: 'Act today', High: 'Act this week', Standard: 'Normal handling' }

export default function Handle() {
  const { setOpen, reveal, setReveal } = useApp()
  const { data: meta } = useGet<Meta>('/api/meta')
  const [tier, setTier] = useState('Critical'); const [limit, setLimit] = useState(15)
  const [period, setPeriod] = useState('all'); const [q, setQ] = useState(''); const [dq, setDq] = useState('')
  useEffect(() => { const t = setTimeout(() => setDq(q), 250); return () => clearTimeout(t) }, [q])
  useEffect(() => setLimit(15), [tier, period, dq])
  const p = PERIODS.find(x => x.id === period)!
  const filters = { date_from: p.from, date_to: p.to }
  const { data: s } = useGet<any>(`/api/summary?${qs(filters)}`, [period])
  const { data, loading } = useGet<{ total: number; items: OrderRow[] }>(`/api/orders?${qs({ ...filters, tier, q: dq, limit, alpha: 1 })}`, [])
  void meta
  return (
    <div className="grid">
      <Card>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="tabs" role="tablist">{['Critical', 'High', 'Standard'].map(t => <button key={t} role="tab" aria-selected={tier === t} className={tier === t ? 'on' : ''} onClick={() => setTier(t)}>{t}{s?.tiers[t] ? ` (${num(s.tiers[t].orders)})` : ''}</button>)}</div>
          <select className="select" value={period} onChange={e => setPeriod(e.target.value)} aria-label="Period" style={{ marginLeft: 'auto' }}>{PERIODS.map(x => <option key={x.id} value={x.id}>{x.label}</option>)}</select>
        </div>
        <Note><b style={{ color: 'var(--ink)' }}>{tier}: {WHAT[tier]}.</b> {s?.tiers[tier] ? `${moneyK(s.tiers[tier].at_risk)} at risk.` : ''} Sorted with the biggest, riskiest orders first. Tap an order to see why.</Note>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginTop: 12 }}>
          <div style={{ position: 'relative', flex: '1 1 220px' }}>
            <span style={{ position: 'absolute', left: 11, top: 9, color: 'var(--ink3)' }}><Icon name="search" size={18} /></span>
            <input className="input" style={{ width: '100%', paddingLeft: 36 }} placeholder="Search order number, city, country or product" value={q} onChange={e => setQ(e.target.value)} aria-label="Search" />
          </div>
          <label className="chip brand" style={{ cursor: 'pointer', padding: '8px 12px' }}><input type="checkbox" checked={reveal} onChange={e => setReveal(e.target.checked)} /> <Icon name="eye" size={16} /> Show what really happened</label>
        </div>
      </Card>
      {loading && !data ? <Skeleton h={300} /> : <div className="listgrid">{data?.items.map(o => <OrderCard key={o.id} o={o} onOpen={() => setOpen(o.id)} />)}</div>}
      {data && data.items.length === 0 && <div className="note">No orders match.</div>}
      {data && data.total > limit && <button className="more" onClick={() => setLimit(l => l + 15)}>Show 15 more (showing {limit} of {num(data.total)})</button>}
    </div>
  )
}
