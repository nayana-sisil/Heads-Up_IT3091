import { Icon } from '../components/Icons'
import { StatTile } from '../components/viz'
import { Note } from '../components/tech'
import { useGet } from '../api'
import { Bars, CalibrationChart, Card, Skeleton } from '../components/ui'
import { moneyK, num, pct } from '../format'

export default function Trust() {
  const { data: t } = useGet<any>('/api/trust')
  if (!t) return <Skeleton h={600} />
  const v = t.splits.validation, te = t.splits.test; const cfg = t.config
  const names: [string, string][] = [['Random order', 'Random'], ['Sales only', 'Sales only'], ['Risk only', 'Risk only'], ['Simple rule', 'Simple rule'], ['Heads Up', 'Heads Up'], ['Oracle', 'Perfect']]
  const calLines = [{ name: 'Validation', color: '#4f7dff', pts: v.calibration }, { name: 'Test', color: '#d98324', pts: te.calibration }]
  const op = te.operating_point, opv = v.operating_point
  return (
    <div className="grid">
      <section className="phero" style={{ ['--acc' as any]: 'var(--good)' }}>
        <div className="wm" aria-hidden>✓</div>
        <div className="badge"><Icon name="trust" size={15} />The honest summary</div>
        <h2>The model puts the right orders at the top. A simple shipping rule does almost as well.</h2>
        <p className="sub2">In the top 10% of the queue, Heads Up reaches {pct(te.schemes['Heads Up']['10'].revenue_reached, 1)} of late revenue on the test orders, against {pct(te.schemes['Simple rule']['10'].revenue_reached, 1)} for a two line shipping rule. That is a tie. The model adds a separate chance for every order and a reason for each one, which a rule cannot give.</p>
      </section>
      <div className="grid g4">
        <StatTile label="Recall at the threshold" value={<>{pct(op.recall)}</>} sub={<>of late orders caught (validation {pct(opv.recall)})</>} />
        <StatTile label="Precision" value={<>{pct(op.precision)}</>} sub={<>of flagged orders were late</>} />
        <StatTile label="Orders flagged" value={<>{pct(op.flagged_share)}</>} sub={<>of all orders (validation {pct(opv.flagged_share)})</>} />
        <StatTile label="Ranking quality" value={<>{te.roc_auc.toFixed(3)}</>} sub={<>ROC AUC on test (1.0 is perfect, 0.5 is a coin)</>} />
      </div>
      <div className="grid g2">
        <Card title="Top 10% queue: late revenue reached" lead="Each method reviews the same number of orders. Higher is better.">
          {(['validation', 'test'] as const).map(k => (
            <div key={k} style={{ marginBottom: 10 }}><div className="eyebrow" style={{ marginBottom: 2 }}>{k === 'validation' ? 'Validation set' : 'Test set'}</div>
              <Bars rows={names.map(([key, lab]) => ({ label: lab, value: t.splits[k].schemes[key]['10'].revenue_reached }))} fmt={x => pct(x, 1)} max={0.5} /></div>))}
        </Card>
        <Card title="Can the chances be trusted?" lead="If the model says 80%, about 80 in 100 should be late. Lines near the dashed line are honest.">
          <CalibrationChart lines={calLines} />
          <div className="legend" style={{ marginTop: 4 }}><span><i className="dot" style={{ background: '#4f7dff' }} /> Validation</span><span><i className="dot" style={{ background: '#d98324' }} /> Test</span><span>Dashed line: perfect</span></div>
          <Note>Every group sits within about 5 points of the dashed line, so the chances are honest enough to multiply by order value.</Note>
        </Card>
      </div>
      <div className="grid g2">
        <Card title="The strongest pattern in the data" lead="Same Day orders by the hour they were placed (training data).">
          <svg viewBox="0 0 320 170" width="100%" className="chart" role="img" aria-label="Same Day late rate by hour" style={{ fontSize: 12 }}>
            {[0, .5, 1].map(x => <g key={x}><line className="ax" x1="42" x2="314" y1={135 - x * 110} y2={135 - x * 110} strokeDasharray={x ? '3 4' : ''} /><text x="36" y={139 - x * 110} textAnchor="end" style={{ fontSize: 11 }}>{x * 100}%</text></g>)}
            {t.same_day_by_hour.map((h: any) => { const w = 272 / 24, ht = h.late_rate * 110; return <rect key={h.hour} x={44 + h.hour * w} y={135 - ht} width={w - 3} height={Math.max(ht, 1.5)} rx="2.5" fill={h.late_rate > .5 ? 'var(--crit)' : 'var(--good)'}><title>{`${h.hour}:00 · ${pct(h.late_rate)} late · ${h.orders} orders`}</title></rect> })}
            {[0, 6, 12, 18, 23].map(h => <text key={h} x={44 + h * (272 / 24) + 5} y="156" textAnchor="middle" style={{ fontSize: 11 }}>{h}h</text>)}
          </svg>
          <Note>Before noon: never late. From noon: late about 96% of the time. This looks like a rule built into the dataset, so real operations may show a weaker effect.</Note>
        </Card>
        <Card title="What the model leans on" lead="Average push of each fact on the risk (SHAP, test orders).">
          <Bars rows={t.global_importance.slice(0, 8).map((g: any) => ({ label: g.label, value: g.value }))} fmt={x => x.toFixed(2)} />
        </Card>
      </div>
      <div className="grid g2">
        <Card title="Tiers on unseen orders" lead="Cut points were set on validation and left unchanged for test.">
          <table className="t"><thead><tr><th>Tier</th><th>Orders</th><th>Really late</th><th>Late revenue</th></tr></thead><tbody>
            {(['Critical', 'High', 'Standard'] as const).map(k => <tr key={k}><td><span className={`chip ${k}`}>{k}</span></td><td className="num">{num(t.tiers.test[k].orders)} ({pct(t.tiers.test[k].share_orders)})</td><td className="num">{pct(t.tiers.test[k].late_rate)}</td><td className="num">{pct(t.tiers.test[k].share_late_revenue)}</td></tr>)}
          </tbody></table>
        </Card>
        <Card title="Watch out: order values fell" lead="Average order value in each period.">
          <Bars rows={t.sales_by_split.map((s: any) => ({ label: s.split, value: s.mean }))} fmt={x => '$' + Math.round(x)} />
          <Note>Test orders are much smaller, so fewer of them reach the Critical tier. In real use the tier cut points need refreshing on recent data.</Note>
        </Card>
      </div>
      <Card title="How this app decides" lead="Settings come from the validation set. The test set was used once to check them.">
        <div className="grid g3">
          <div><div className="eyebrow">Priority score</div><div style={{ fontWeight: 700 }}>chance of late × order value</div></div>
          <div><div className="eyebrow">Risk threshold</div><div style={{ fontWeight: 700 }}>{cfg.risk_threshold} (target recall {cfg.target_recall})</div></div>
          <div><div className="eyebrow">Tier cut points</div><div style={{ fontWeight: 700 }}>Critical from {moneyK(cfg.tier_cutoffs.critical_min)}, High from {moneyK(cfg.tier_cutoffs.high_min)}</div></div>
        </div>
      </Card>
    </div>
  )
}
