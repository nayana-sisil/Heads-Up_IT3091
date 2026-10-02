import { useGet } from '../api'
import { Summary } from '../types'
import { useApp } from '../state'
import { Card, Skeleton } from '../components/ui'
import { Icon } from '../components/Icons'
import { moneyK, num, pct, shortDate } from '../format'

export default function Home() {
  const { go } = useApp()
  const { data: s } = useGet<Summary>('/api/summary')
  const { data: tr } = useGet<any>('/api/trust')
  if (!s) return <div className="grid"><Skeleton h={220} /><Skeleton h={200} /></div>
  const act = (s.tiers.Critical?.orders ?? 0) + (s.tiers.High?.orders ?? 0)
  const money = (s.tiers.Critical?.at_risk ?? 0) + (s.tiers.High?.at_risk ?? 0)
  return (
    <div className="grid">
      <Card className="hero">
        <div className="eyebrow">Demo data, {shortDate(s.date_min)} to {shortDate(s.date_max)}</div>
        <div className="big" style={{ fontSize: 'clamp(28px,4.4vw,44px)' }}>{act === 0 ? 'No orders need action.' : `${num(act)} of ${num(s.orders)} orders need action.`}</div>
        <p className="muted" style={{ margin: '8px 0 0', maxWidth: 560 }}>These are the orders most likely to arrive late and worth the most money. Start with them. Everything else can wait. Try your own order below.</p>
        <div className="big3">
          <div className="tile"><div className="k num">{num(act)}</div><div className="muted">orders to handle (critical and high)</div></div>
          <div className="tile"><div className="k num">{moneyK(money)}</div><div className="muted">money at risk in those orders</div></div>
          <div className="tile"><div className="k num">{pct(s.flagged / s.orders)}</div><div className="muted">of all orders are likely to be late</div></div>
        </div>
        <div className="pill-row" style={{ marginTop: 20 }}>
          <button className="btn primary" onClick={() => go('check')}>Check an order</button>
          <button className="btn" onClick={() => go('file')}>Score a file of orders</button>
          <button className="btn" onClick={() => go('handle')}>See the orders to handle</button>
        </div>
      </Card>
      <div className="grid g2">
        <Card title="What the tool does" lead="Three steps, no setup.">
          <p style={{ margin: '0 0 8px' }}><b>1. Predict.</b> Tell it about an order. It says how likely the order is to arrive late.</p>
          <p style={{ margin: '0 0 8px' }}><b>2. Rank.</b> It multiplies that chance by the order value, so big risky orders come first.</p>
          <p style={{ margin: 0 }}><b>3. Act.</b> Each order gets a plain next step, like calling the carrier.</p>
        </Card>
        <Card title="The one pattern to remember" lead="Late rate of Same Day orders by the hour they were placed.">
          {tr ? <svg viewBox="0 0 320 150" width="100%" className="chart" role="img" aria-label="Same Day late rate by hour" style={{ fontSize: 12 }}>
            {[0, .5, 1].map(v => <g key={v}><line className="ax" x1="40" x2="314" y1={115 - v * 95} y2={115 - v * 95} strokeDasharray={v ? '3 4' : ''} /><text x="34" y={119 - v * 95} textAnchor="end">{v * 100}%</text></g>)}
            {tr.same_day_by_hour.map((h: any) => { const w = 274 / 24, ht = h.late_rate * 95; return <rect key={h.hour} x={42 + h.hour * w} y={115 - ht} width={w - 3} height={Math.max(ht, 2)} rx="2.5" fill={h.late_rate > .5 ? 'var(--crit)' : 'var(--good)'}><title>{`${String(h.hour).padStart(2, '0')}:00, ${pct(h.late_rate)} late, ${h.orders} orders`}</title></rect> })}
            {[0, 6, 12, 18, 23].map(h => <text key={h} x={42 + h * (274 / 24) + 5} y="136" textAnchor="middle">{h}h</text>)}
          </svg> : <Skeleton h={150} />}
          <p className="note" style={{ margin: '6px 0 0' }}>Before noon: never late. From noon: late about 96% of the time.</p>
        </Card>
      </div>
    </div>
  )
}
