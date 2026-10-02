import { useEffect, useState } from 'react'
import { useGet } from '../api'
import { Capacity as Cap } from '../types'
import { useApp, qs } from '../state'
import { Card, ChartLegend, LineChart, Series, Skeleton } from '../components/ui'
import { money, num, pct } from '../format'

export default function Capacity() {
  const { alpha } = useApp(); const [budget, setBudget] = useState(10); const [b, setB] = useState(10)
  useEffect(() => { const t = setTimeout(() => setB(budget), 120); return () => clearTimeout(t) }, [budget])
  const { data: c } = useGet<Cap>(`/api/capacity?${qs({ alpha, budget: b / 100 })}`, [alpha, b])
  if (!c) return <Skeleton h={500} />
  const cut = (n: string) => c.curves[n].slice(0, 51); const at = (name: string) => c.curves[name][b]
  const series: Series[] = [
    { name: 'Heads Up', color: '#4f7dff', values: cut('Heads Up'), width: 3.5 },
    { name: 'Sales only', color: '#1fb39c', values: cut('Sales only') },
    { name: 'Risk only', color: '#9a7bff', values: cut('Risk only') },
    { name: 'Random order', color: '#8b93ad', values: cut('Random order') },
    { name: 'Perfect (oracle)', color: '#e8ecf8', values: cut('Oracle'), dash: '6 5', width: 1.8 },
  ]
  series[4].color = getComputedStyle(document.documentElement).getPropertyValue('--ink').trim() || '#222'
  return (
    <div className="grid">
      <Card>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
          <div className="eyebrow">My team can review</div>
          <div className="kpi num">{b}% of orders</div><span className="muted">that is {num(c.review_n)} of {num(c.orders)} orders</span>
        </div>
        <input className="slider" type="range" min={1} max={50} value={budget} onChange={e => setBudget(+e.target.value)} aria-label="Review budget percent" style={{ marginTop: 10 }} />
        <div className="note" style={{ display: 'flex', justifyContent: 'space-between' }}><span>1%</span><span>25%</span><span>50%</span></div>
      </Card>
      <div className="grid g4">
        <Card><div className="eyebrow">Late revenue reached</div><div className="kpi num" style={{ color: 'var(--brand)' }}>{pct(c.revenue_reached, 1)}</div><div className="muted">{money(c.late_revenue_reached)} of {money(c.late_revenue_total)}</div></Card>
        <Card><div className="eyebrow">Orders really late</div><div className="kpi num">{pct(c.precision)}</div><div className="muted">{num(c.wasted_reviews)} reviews would find nothing wrong</div></Card>
        <Card><div className="eyebrow">Best possible</div><div className="kpi num">{pct(c.oracle_reached, 1)}</div><div className="muted">You reach {pct(c.revenue_reached / Math.max(c.oracle_reached, 1e-9))} of it</div></Card>
        <Card><div className="eyebrow">Versus picking by order value</div><div className="kpi num" style={{ color: at('Heads Up') >= at('Sales only') ? 'var(--good)' : 'var(--crit)' }}>{at('Heads Up') >= at('Sales only') ? '+' : ''}{((at('Heads Up') - at('Sales only')) * 100).toFixed(1)} pts</div><div className="muted">more late revenue reached</div></Card>
      </div>
      <Card title="Late revenue reached as your team reviews more orders" lead="Orders are reviewed from highest priority downward. The higher the line, the better the ordering. Hover to compare.">
        <LineChart series={series} marker={b / 50} xMax={0.5} ticks={[0, .2, .4, .6, .8, 1]} xTitle="Share of orders reviewed" yTitle="Late revenue reached" height={330} />
        <ChartLegend series={series} />
      </Card>
    </div>
  )
}
