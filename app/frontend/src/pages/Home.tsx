import { useGet } from '../api'
import { Summary } from '../types'
import { useApp } from '../state'
import { useReport } from '../data'
import { Card, Skeleton } from '../components/ui'
import { Icon } from '../components/Icons'
import { Flow, StatTile, Ring } from '../components/viz'
import { moneyK, num, pct, shortDate } from '../format'

export default function Home() {
  const { go } = useApp()
  const { data: s } = useGet<Summary>('/api/summary')
  const { data: tr } = useGet<any>('/api/trust')
  const rep = useReport()
  if (!s) return <div className="grid"><Skeleton h={220} /><Skeleton h={200} /></div>
  const act = (s.tiers.Critical?.orders ?? 0) + (s.tiers.High?.orders ?? 0)
  const money = (s.tiers.Critical?.at_risk ?? 0) + (s.tiers.High?.at_risk ?? 0)
  const flagRate = s.flagged / s.orders
  return (
    <div className="grid">
      <section className="phero" style={{ ['--acc' as any]: 'var(--brand)' }}>
        <div className="wm" aria-hidden>!</div>
        <div className="badge"><Icon name="today" size={15} />Demo data, {shortDate(s.date_min)} to {shortDate(s.date_max)}</div>
        <h2>{act === 0 ? 'No orders need action.' : `${num(act)} of ${num(s.orders)} orders need action.`}</h2>
        <p className="sub2">These are the orders most likely to arrive late and worth the most money. Start with them. Everything else can wait.</p>
        <div className="pill-row" style={{ marginTop: 20, position: 'relative' }}>
          <button className="btn primary" onClick={() => go('check')}>Check an order</button>
          <button className="btn" onClick={() => go('file')}>Score a file of orders</button>
          <button className="btn" onClick={() => go('handle')}>See the orders to handle</button>
        </div>
      </section>
      <div className="tilegrid">
        <StatTile icon="alert" label="orders to handle (critical and high)" to={act} fmt={v => num(Math.round(v))} color="var(--crit)" />
        <StatTile icon="money" label="money at risk in those orders" to={money} fmt={v => moneyK(v)} color="var(--high)" />
        <StatTile icon="truck" label="of all orders are likely late" to={flagRate * 100} fmt={v => `${Math.round(v)}%`} color="var(--brand)" />
        <StatTile icon="check" label="of the flagged orders really were late" to={rep ? rep.models.XGBoost.test.at_threshold.precision : 0.63} fmt={v => `${Math.round(v * 100)}%`} color="var(--good)" />
      </div>
      <Card title="What the tool does" lead="Three steps, no setup.">
        <Flow nodes={[
          { icon: 'brain', title: '1. Predict', text: 'Tell it about an order. It says how likely the order is to arrive late.', color: 'var(--brand)' },
          { icon: 'rank', title: '2. Rank', text: 'It multiplies that chance by the order value, so big risky orders come first.', color: 'var(--high)' },
          { icon: 'flag', title: '3. Act', text: 'Each order gets a plain next step, like calling the carrier.', color: 'var(--crit)' },
        ]} />
      </Card>
      <div className="grid g2">
        <Card title="The one pattern to remember" lead="Late rate of Same Day orders by the hour they were placed.">
          {tr ? <svg viewBox="0 0 320 150" width="100%" className="chart" role="img" aria-label="Same Day late rate by hour" style={{ fontSize: 12 }}>
            {[0, .5, 1].map(v => <g key={v}><line className="ax" x1="40" x2="314" y1={115 - v * 95} y2={115 - v * 95} strokeDasharray={v ? '3 4' : ''} /><text x="34" y={119 - v * 95} textAnchor="end">{v * 100}%</text></g>)}
            {tr.same_day_by_hour.map((h: any) => { const w = 274 / 24, ht = h.late_rate * 95; return <rect key={h.hour} x={42 + h.hour * w} y={115 - ht} width={w - 3} height={Math.max(ht, 2)} rx="2.5" fill={h.late_rate > .5 ? 'var(--crit)' : 'var(--good)'}><title>{`${String(h.hour).padStart(2, '0')}:00, ${Math.round(h.late_rate * 100)}% late`}</title></rect> })}
            {[0, 6, 12, 18, 23].map(h => <text key={h} x={42 + h * (274 / 24) + 5} y="136" textAnchor="middle">{h}h</text>)}
          </svg> : <Skeleton h={150} />}
          <div className="legend"><span><i className="sw" style={{ background: 'var(--good)' }} />Before noon: never late</span><span><i className="sw" style={{ background: 'var(--crit)' }} />From noon: late about 96% of the time</span></div>
        </Card>
        <Card title="Where to start" lead="Pick what you want to do.">
          <div className="icards" style={{ ['--cols' as any]: 1 }}>
            {[['check', 'Check one order', 'Type an order in and see the chance it is late and why.', 'check'], ['upload', 'Score a file', 'Drop a list of new orders and get them ranked.', 'file'], ['list', 'Orders to handle', 'The biggest, riskiest orders first, with a next step.', 'handle']].map(([ic, t, d, to]) =>
              <button key={to} className="icard" style={{ ['--c' as any]: 'var(--brand)', textAlign: 'left', cursor: 'pointer', display: 'flex', gap: 12, alignItems: 'center' }} onClick={() => go(to)}><span className="ico" style={{ marginBottom: 0 }}><Icon name={ic} size={20} /></span><span style={{ flex: 1 }}><b>{t}</b><span className="muted" style={{ fontSize: 13, display: 'block' }}>{d}</span></span><Icon name="arrow" size={18} /></button>)}
          </div>
        </Card>
      </div>
    </div>
  )
}
