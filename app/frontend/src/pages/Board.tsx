import { useEffect, useState } from 'react'
import { useGet } from '../api'
import { Meta, OrderRow, Summary } from '../types'
import { useApp, qs } from '../state'
import { Card, OrderCard, Skeleton, TierChip } from '../components/ui'
import { Icon } from '../components/Icons'
import { moneyK, num } from '../format'

function Lane({ tier, filters, summary }: { tier: string; filters: Record<string, string | number | undefined>; summary?: Summary }) {
  const { setOpen } = useApp(); const [limit, setLimit] = useState(10)
  useEffect(() => setLimit(10), [JSON.stringify(filters)])
  const { data, loading } = useGet<{ total: number; items: OrderRow[] }>(`/api/orders?${qs({ ...filters, tier, limit })}`, [])
  const t = summary?.tiers[tier]
  return (
    <div className="lane">
      <div className="lh"><TierChip tier={tier} /><div className="s num">{data ? num(data.total) : '…'} orders{t ? <><br />{moneyK(t.at_risk)} at risk</> : null}</div></div>
      {loading && !data ? <Skeleton h={200} /> : data?.items.map(o => <OrderCard key={o.id} o={o} onOpen={() => setOpen(o.id)} />)}
      {data && data.items.length === 0 && <div className="note" style={{ padding: 14 }}>No orders match these filters.</div>}
      {data && data.total > limit && <button className="more" onClick={() => setLimit(l => l + 10)}>Show 10 more (showing {limit} of {num(data.total)})</button>}
    </div>
  )
}

export default function Board() {
  const { from, to, alpha, reveal, setReveal } = useApp()
  const { data: meta } = useGet<Meta>('/api/meta')
  const [q, setQ] = useState(''); const [mode, setMode] = useState(''); const [region, setRegion] = useState(''); const [dq, setDq] = useState('')
  useEffect(() => { const t = setTimeout(() => setDq(q), 250); return () => clearTimeout(t) }, [q])
  const filters = { alpha, date_from: from, date_to: to, mode, region, q: dq }
  const { data: s } = useGet<Summary>(`/api/summary?${qs({ date_from: from, date_to: to })}`, [from, to])
  return (
    <div className="grid">
      <Card>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: '1 1 220px' }}>
            <span style={{ position: 'absolute', left: 11, top: 9, color: 'var(--ink3)' }}><Icon name="search" size={18} /></span>
            <input className="input" style={{ width: '100%', paddingLeft: 36 }} placeholder="Search order number, city, country or product" value={q} onChange={e => setQ(e.target.value)} aria-label="Search" />
          </div>
          <select className="select" value={mode} onChange={e => setMode(e.target.value)} aria-label="Shipping option"><option value="">All shipping options</option>{meta?.modes.map(m => <option key={m}>{m}</option>)}</select>
          <select className="select" value={region} onChange={e => setRegion(e.target.value)} aria-label="Region"><option value="">All regions</option>{meta?.regions.map(m => <option key={m}>{m}</option>)}</select>
          <label className="chip brand" style={{ cursor: 'pointer', padding: '8px 12px' }}><input type="checkbox" checked={reveal} onChange={e => setReveal(e.target.checked)} /> <Icon name="eye" size={16} /> Reveal what really happened</label>
        </div>
        <p className="note" style={{ margin: '10px 0 0' }}>Tiers use the balanced score. The Money first and Risk first buttons above change the order of the cards inside each lane.</p>
      </Card>
      <div className="lanes">{['Critical', 'High', 'Standard'].map(t => <Lane key={t} tier={t} filters={filters} summary={s ?? undefined} />)}</div>
    </div>
  )
}
