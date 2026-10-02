import { useEffect, useState } from 'react'
import { useGet } from '../api'
import { OrderRow } from '../types'
import { useApp, qs } from '../state'
import { Card, OrderCard, Skeleton } from '../components/ui'
import { Icon } from '../components/Icons'
import { money, moneyK, num } from '../format'

interface Week { week: string; orders: number; critical: number; high: number; revenue_at_risk: number; late_revenue: number; flagged: number }
export default function Replay() {
  const { alpha, setOpen } = useApp()
  const { data: weeks } = useGet<Week[]>('/api/replay')
  const [i, setI] = useState(0); const [play, setPlay] = useState(false)
  useEffect(() => { if (!play || !weeks) return; const t = setInterval(() => setI(x => x + 1 >= weeks.length ? (setPlay(false), x) : x + 1), 1100); return () => clearInterval(t) }, [play, weeks])
  const w = weeks?.[i]
  const to = w ? new Date(new Date(w.week).getTime() + 6 * 864e5).toISOString().slice(0, 10) : undefined
  const { data: top } = useGet<{ items: OrderRow[] }>(w ? `/api/orders?${qs({ date_from: w.week, date_to: to, alpha, limit: 4 })}` : null, [w?.week, alpha])
  if (!weeks || !w) return <Skeleton h={420} />
  const max = Math.max(...weeks.map(x => x.revenue_at_risk))
  return (
    <div className="grid">
      <Card title="Revenue at risk, week by week" lead="Click a bar or press play. The bars show what the queue held at the start of each week.">
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 8 }}>
          <button className="btn primary" onClick={() => { if (i >= weeks.length - 1) setI(0); setPlay(p => !p) }} aria-label={play ? 'Pause' : 'Play'} style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Icon name={play ? 'pause' : 'play'} size={16} />{play ? 'Pause' : 'Play'}</button>
          <input className="slider" type="range" min={0} max={weeks.length - 1} value={i} onChange={e => { setPlay(false); setI(+e.target.value) }} aria-label="Week" />
        </div>
        <svg viewBox={`0 0 ${weeks.length * 28 + 20} 170`} width="100%" className="chart" role="img" aria-label="Weekly revenue at risk">
          {weeks.map((x, k) => { const h = (x.revenue_at_risk / max) * 120; return (
            <g key={x.week} onClick={() => { setPlay(false); setI(k) }} style={{ cursor: 'pointer' }}>
              <rect x={10 + k * 28} y={140 - h} width="20" height={h} rx="4" fill={k === i ? 'var(--brand)' : 'var(--std)'} opacity={k === i ? 1 : .45}><title>{`Week of ${x.week}: ${moneyK(x.revenue_at_risk)} at risk`}</title></rect>
              {k % 4 === 0 && <text x={20 + k * 28} y="158" textAnchor="middle">{new Date(x.week).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</text>}
            </g>) })}
        </svg>
      </Card>
      <div className="grid g12" style={{ alignItems: 'start' }}>
        <Card title={`Week of ${new Date(w.week).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`}>
          <div className="grid g2">
            <div><div className="eyebrow">Orders</div><div className="kpi num">{num(w.orders)}</div></div>
            <div><div className="eyebrow">Flagged</div><div className="kpi num">{num(w.flagged)}</div></div>
            <div><div className="eyebrow">Critical + High</div><div className="kpi num">{num(w.critical)} + {num(w.high)}</div></div>
            <div><div className="eyebrow">Revenue at risk</div><div className="kpi num" style={{ color: 'var(--brand)' }}>{moneyK(w.revenue_at_risk)}</div></div>
          </div>
          <p className="note" style={{ marginTop: 14 }}>The first and last weeks hold only part of a week of orders. Late revenue that really happened that week: <b className="num">{money(w.late_revenue)}</b>. The expected value above tracks it closely, which is what a good priority score should do.</p>
        </Card>
        <Card title="Top of the queue that week">{top ? top.items.map(o => <OrderCard key={o.id} o={o} onOpen={() => setOpen(o.id)} />) : <Skeleton />}</Card>
      </div>
    </div>
  )
}
