import { useEffect } from 'react'
import { useGet } from '../api'
import { OrderDetail } from '../types'
import { useApp } from '../state'
import { Card, DriverBars, Gauge, Skeleton, TierChip } from './ui'
import { Icon } from './Icons'
import { money, num, pct, shortDate, timeOf } from '../format'

export function suggest(o: { tier: string; mode: string; date: string }) {
  const pm = o.mode === 'Same Day' && Number(o.date.slice(11, 13)) >= 12
  if (o.tier === 'Standard') return { crit: false, title: 'Normal handling', text: 'No action needed now. Keep an eye on this order if its value is high or the customer is a key account.' }
  if (pm) return { crit: true, title: 'Call the carrier now', text: 'Same Day orders placed after noon are late about 96% of the time in our history. Confirm a pickup today or warn the customer before the promise is missed.' }
  if (o.mode === 'First Class') return { crit: true, title: 'Escalate and warn the customer', text: 'First Class orders are late about 96% of the time. Ask the carrier for a firm pickup time and tell the customer the real expected date.' }
  if (o.mode === 'Second Class') return { crit: o.tier === 'Critical', title: 'Follow up with the carrier this week', text: 'Second Class orders run late about 77% of the time. Check the pickup is booked and flag the order for a status update.' }
  return { crit: false, title: 'Check this order today', text: 'The model sees a high chance of delay even though the shipping option is usually safe. Review the reasons below before you act.' }
}

export function Drawer() {
  const { open, setOpen, go, reveal } = useApp()
  const { data: o, loading } = useGet<OrderDetail>(open ? `/api/orders/${open}` : null)
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(null); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k) }, [setOpen])
  if (!open) return null
  const a = o ? suggest(o) : null
  return (
    <>
      <div className="scrim" onClick={() => setOpen(null)} />
      <aside className="drawer" role="dialog" aria-label="Order details">
        {loading || !o ? <Skeleton h={500} /> : <>
          <div className="dr-h">
            <div style={{ flex: 1 }}>
              <div className="eyebrow">Order</div>
              <h2 className="num">#{o.id}</h2>
              <div className="muted">{o.city}, {o.country} · {shortDate(o.date)} {timeOf(o.date)}</div>
            </div>
            <TierChip tier={o.tier} />
            <button className="iconbtn" onClick={() => setOpen(null)} aria-label="Close"><Icon name="close" /></button>
          </div>
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <Gauge value={o.p} />
              <div style={{ flex: 1, minWidth: 160 }}>
                <div className="eyebrow">Priority score</div>
                <div className="kpi num">{money(o.priority)}</div>
                <div className="muted" style={{ fontSize: 13 }}>{pct(o.p)} chance × {money(o.sales)} order value</div>
                <div className="note" style={{ marginTop: 4 }}>Rank {num(o.rank)} of {num(o.total)} orders</div>
              </div>
            </div>
          </Card>
          <div className="callout" style={{ margin: '14px 0' }}><b>{o.why}</b>The model learned this pattern from the training orders.</div>
          <Card title="Why is this order risky?" lead="Each bar shows how much a fact pushed the risk up (red) or down (green).">
            <DriverBars drivers={o.drivers} />
          </Card>
          {a && <div className={`callout ${a.crit ? 'crit' : ''}`} style={{ margin: '14px 0' }}><b>Suggested action: {a.title}</b>{a.text}</div>}
          <Card title="Order facts">
            <div className="kv">
              <div><span>Shipping</span>{o.mode}</div><div><span>Order value</span>{money(o.sales)}</div>
              <div><span>Region</span>{o.region}</div><div><span>Customer</span>{o.segment}</div>
              <div><span>Payment</span>{o.type}</div><div><span>Category</span>{o.category}</div>
              <div><span>Items</span>{o.qty} in {o.lines} lines</div><div><span>Flagged by threshold</span>{o.flag ? 'Yes' : 'No'}</div>
            </div>
            {reveal && <div className={`callout ${o.late ? 'crit' : ''}`} style={{ marginTop: 12 }}><b>What really happened</b>{o.late ? 'This order was delivered late.' : 'This order arrived on time.'}</div>}
          </Card>
          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            <button className="btn primary" onClick={() => go('check', o.id)}>Check and change this order</button>
            <button className="btn" onClick={() => setOpen(null)}>Close</button>
          </div>
        </>}
      </aside>
    </>
  )
}
