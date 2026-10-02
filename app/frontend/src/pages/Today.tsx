import { useEffect, useState } from 'react'
import { useGet } from '../api'
import { Summary, OrderRow } from '../types'
import { useApp, qs } from '../state'
import { Bars, Card, Skeleton, TierChip, OrderCard, tierColor } from '../components/ui'
import { moneyK, num, pct } from '../format'

function useCount(target: number) {
  const [v, setV] = useState(0)
  useEffect(() => { let raf = 0; const t0 = performance.now(); const from = 0
    const tick = (t: number) => { const k = Math.min(1, (t - t0) / 900); setV(from + (target - from) * (1 - Math.pow(1 - k, 3))); if (k < 1) raf = requestAnimationFrame(tick) }
    raf = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf) }, [target])
  return v
}

export default function Today() {
  const { from, to, alpha, setOpen } = useApp()
  const { data: s } = useGet<Summary>(`/api/summary?${qs({ date_from: from, date_to: to })}`, [from, to])
  const { data: top } = useGet<{ items: OrderRow[] }>(`/api/orders?${qs({ limit: 4, alpha, date_from: from, date_to: to })}`, [alpha, from, to])
  const { data: tr } = useGet<any>('/api/trust')
  const risk = useCount(s?.revenue_at_risk ?? 0)
  if (!s) return <div className="grid"><Skeleton h={220} /><Skeleton h={300} /></div>
  const tiers = ['Critical', 'High', 'Standard'] as const
  const totalAt = tiers.reduce((a, t) => a + (s.tiers[t]?.at_risk ?? 0), 0) || 1
    return (
    <div className="grid">
      <div className="grid g12" style={{ alignItems: 'start' }}>
        <Card className="hero">
          <div className="eyebrow">Revenue at risk</div>
          <div className="big num">{moneyK(risk)}</div>
          <p className="muted" style={{ margin: '6px 0 0', maxWidth: 520 }}>Expected value of orders that may arrive late, across {num(s.orders)} orders. {num(s.flagged)} of them ({pct(s.flagged / s.orders)}) are above the risk threshold.</p>
          <div className="stack" role="img" aria-label="Share of revenue at risk by tier">
            {tiers.map(t => <div key={t} style={{ flex: Math.max((s.tiers[t]?.at_risk ?? 0) / totalAt, 0.02), background: tierColor(t) }} title={t} />)}
          </div>
          <div className="note">Bar width is each tier's share of the money at risk.</div>
          <div className="tiles">{tiers.map(t => <div className="tile" key={t}>
            <TierChip tier={t} />
            <div className="k num" style={{ marginTop: 8 }}>{num(s.tiers[t]?.orders ?? 0)}</div>
            <div className="muted" style={{ fontSize: 12.5 }}>orders · {moneyK(s.tiers[t]?.at_risk ?? 0)} at risk</div>
            <div className="dim" style={{ fontSize: 12.5 }}>average order {moneyK(s.tiers[t]?.avg_sales ?? 0)}</div></div>)}</div>
          <div className="callout" style={{ marginTop: 18 }}><b>How to use this</b>Critical orders need action today, High orders this week. Standard orders need normal handling. Open any order to see why it is risky.</div>
        </Card>
        <Card title="Start here" lead="The four orders worth the most attention right now." >
          {top ? top.items.map(o => <OrderCard key={o.id} o={o} onOpen={() => setOpen(o.id)} />) : <Skeleton />}
        </Card>
      </div>
      <div className="grid g3">
        <Card title="By shipping option" lead="Average chance of being late.">
          <Bars rows={s.by_mode.sort((a, b) => b.risk - a.risk).map(m => ({ label: m.mode, value: m.risk }))} fmt={v => pct(v)} max={1} />
        </Card>
        <Card title="Money at risk by region" lead="The ten regions with the most at stake.">
          <Bars rows={s.by_region.map(r => ({ label: r.region, value: r.at_risk }))} fmt={moneyK} />
        </Card>
        <Card title="The noon cliff" lead="Late rate of Same Day orders by the hour they were placed.">
          {tr ? <svg viewBox="0 0 320 170" width="100%" className="chart" role="img" aria-label="Same Day late rate by hour" style={{ fontSize: 12 }}>
            {[0, .5, 1].map(v => <g key={v}><line className="ax" x1="40" x2="314" y1={135 - v * 110} y2={135 - v * 110} strokeDasharray={v ? '3 4' : ''} /><text x="34" y={139 - v * 110} textAnchor="end" style={{ fontSize: 11 }}>{v * 100}%</text></g>)}
            {tr.same_day_by_hour.map((h: any) => { const w = 274 / 24, ht = h.late_rate * 110; return <rect key={h.hour} x={42 + h.hour * w} y={135 - ht} width={w - 3} height={Math.max(ht, 2)} rx="2.5" fill={h.late_rate > .5 ? 'var(--crit)' : 'var(--good)'}><title>{`${String(h.hour).padStart(2, '0')}:00 · ${pct(h.late_rate)} late · ${h.orders} orders`}</title></rect> })}
            {[0, 6, 12, 18, 23].map(h => <text key={h} x={42 + h * (274 / 24) + 5} y="156" textAnchor="middle" style={{ fontSize: 11 }}>{h}h</text>)}
          </svg> : <Skeleton h={170} />}
          <p className="note" style={{ margin: '6px 0 0' }}>Before noon: never late. From noon: late about 96% of the time.</p>
        </Card>
      </div>
    </div>
  )
}
