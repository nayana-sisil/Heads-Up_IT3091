import { useReport } from '../../data'
import { Bars, Card, Skeleton } from '../../components/ui'
import { Note, Callout, Columns, PageHead, Related, Stat, Steps, Tbl, pc } from '../../components/tech'
import { moneyK, num } from '../../format'
import { Flow, Dots100, Heat } from '../../components/viz'

export function Problem() {
  const r = useReport(); if (!r) return <Skeleton h={500} />
  const e = r.eda, st = r.raw.status_to_target
  const lateN = Math.round(e.late_rate * 100)
  return (
    <div className="grid">
      <PageHead stage="Stages 1 and 2" nb="README, DECISION_LOG, notebook 01" big="Warn about a late order the moment it is placed, then rank by money at stake."
        line="One model gives the chance of late. A second step turns it into a short list to act on."
        chips={[{ icon: 'box', k: num(r.raw.orders), l: 'orders' }, { icon: 'clock', k: pc(e.late_rate, 0), l: 'arrive late' }, { icon: 'layers', k: '28', l: 'inputs per order' }]} />
      <Card title="Two lenses, one model" lead="Both lenses use the same predictions. Inputs are limited to facts known when the order is placed.">
        <Flow nodes={[
          { icon: 'box', title: 'New order', text: 'Only facts known at order time go in.', color: 'var(--acc)' },
          { icon: 'brain', title: 'Primary lens', text: 'Late delivery risk. Will this order be late (1) or not (0)?', color: 'var(--brand)' },
          { icon: 'rank', title: 'Secondary lens', text: 'Shipment prioritization. Chance of late × order value.', color: 'var(--high)' },
          { icon: 'flag', title: 'Ranked queue', text: 'The team acts on the top of the list.', color: 'var(--crit)' },
        ]} />
      </Card>
      <div className="two" style={{ alignItems: 'stretch' }}>
        <Card title="What counts as late" lead={`The target is Late_delivery_risk. Delivery Status maps to it like this, over all ${num(r.raw.rows)} order lines.`}>
          {st.map((x: any) => { const t = x.on_time + x.late; const mx = Math.max(...st.map((q: any) => q.on_time + q.late)); return (
            <div key={x.status} className="barrow" style={{ gridTemplateColumns: '130px 1fr 70px' }}>
              <div className="lbl">{x.status}</div>
              <div className="stack" style={{ margin: 0, height: 12, width: `${(t / mx) * 100}%` }}><div style={{ width: `${(x.on_time / t) * 100}%`, background: 'var(--good)', display: x.on_time ? undefined : 'none' }} title={`${num(x.on_time)} on time (target 0)`} /><div style={{ width: `${(x.late / t) * 100}%`, background: 'var(--crit)', display: x.late ? undefined : 'none' }} title={`${num(x.late)} late (target 1)`} /></div>
              <div className="val num">{num(t)}</div>
            </div>) })}
          <div className="legend" style={{ marginTop: 10 }}><span><i className="sw" style={{ background: 'var(--good)' }} />Target 0, not late</span><span><i className="sw" style={{ background: 'var(--crit)' }} />Target 1, late</span></div>
          <Note>Every status maps to exactly one target value. "Shipping canceled" ({pc(r.raw.canceled_share)} of lines) is coded 0 in the data, and we kept it as given after checking.</Note>
        </Card>
        <Card title="Out of 100 orders" lead="The split is close to balanced, so accuracy alone would not mislead us.">
          <Dots100 max={250} cats={[{ n: lateN, color: 'var(--crit)', label: 'arrive late' }, { n: 100 - lateN, color: 'var(--good)', label: 'arrive on time' }]} />
        </Card>
      </div>
      <div className="two">
        <Card title="Why Recall" lead="Catching late orders matters more than raw accuracy. The reason changed after we looked at the data, and we logged both versions.">
          <div className="costrow"><span className="cl">Missed late order</span><span className="cb">{[1, 2, 3].map(i => <i key={i} style={{ background: 'var(--crit)' }}>1</i>)}</span><b>costs {r.threshold_notes.cost_fn}</b></div>
          <div className="costrow"><span className="cl">False alarm</span><span className="cb"><i style={{ background: 'var(--high)' }}>1</i></span><b>costs {r.threshold_notes.cost_fp}</b></div>
          <p className="note" style={{ margin: '12px 0 0' }}>A false alarm only costs a quick check. A missed order brings penalties and an unhappy customer.</p>
        </Card>
        <Card title="How the reason changed">
          <Steps items={[
            { title: 'First reason (12 Sep)', text: 'We assumed the classes were imbalanced, so accuracy would mislead.' },
            { title: 'What EDA showed (15 Sep)', text: `The split is ${pc(e.late_rate, 2)} late and ${pc(1 - e.late_rate, 2)} on time, close to balanced. So imbalance is not the reason.` },
            { title: 'The real reason', text: 'Cost. Precision, F1, ROC-AUC and PR-AUC are supporting metrics.' },
          ]} />
        </Card>
      </div>
      <Related stage="Stage 2" />
    </div>
  )
}

export function DataEda() {
  const r = useReport(); if (!r) return <Skeleton h={500} />
  const e = r.eda, raw = r.raw
  const monthItems = e.by_month.map((m: any) => ({ label: m.name.slice(2), value: m.late_rate, color: m.name.startsWith('2018') ? 'var(--high)' : 'var(--brand)', tip: `${m.name}: ${pc(m.late_rate)} late, ${num(m.orders)} orders` }))
  const hourItems = e.by_hour.map((h: any) => ({ label: h.name, value: h.late_rate, tip: `${h.name}:00, ${pc(h.late_rate)} late` }))
  return (
    <div className="grid">
      <PageHead stage="Stage 2" nb="notebook 01_eda" big="Shipping option is the strongest signal. Calendar effects are flat." line="Several fields were kept out because they are only known after delivery." chips={[{ icon: 'data', k: '53', l: 'columns' }, { icon: 'box', k: '65,752', l: 'orders' }, { icon: 'truck', k: '57 pts', l: 'best to worst shipping gap' }]} />
      <div className="grid g4">
        <Stat label="Order lines" value={num(raw.rows)} sub={`${raw.columns} columns`} />
        <Stat label="Unique orders" value={num(raw.orders)} sub={`${raw.lines_per_order.toFixed(2)} lines per order`} />
        <Stat label="Late share" value={pc(e.late_rate, 2)} sub="close to balanced" />
        <Stat label="Multi category orders" value={pc(e.multi_category_share, 1)} sub="orders that mix categories" />
      </div>
      <div className="two">
        <Card title="Late rate by shipping option" lead="The strongest signal found. The gap between the best and worst is 57 points.">
          <Bars rows={e.by_mode.map((m: any) => ({ label: m.name, value: m.late_rate, sub: String(m.orders) }))} fmt={v => pc(v)} max={1} />
          <Note>First Class is the slowest in practice: it is late {pc(e.by_mode[0].late_rate, 0)} of the time. Standard Class is late only {pc(e.by_mode[3].late_rate, 0)} of the time.</Note>
        </Card>
        <Card title="Late rate by month" lead="Stable from 2015 to 2017. The orange bar is January 2018, the only 2018 month, which is too thin to hold out as a calendar year test.">
          <Columns items={monthItems} max={1} height={230} showEvery={3} rotate />
        </Card>
      </div>
      <Card title="Hour of day × shipping option" lead="Each square is the late rate for orders placed in that hour. The Same Day row jumps from never late to almost always late at noon.">
        <Heat rows={e.heat.modes} cols={e.heat.hours.map((h: number) => String(h))} vals={e.heat.vals} colLabelEvery={2} />
        <div className="legend"><span><i className="sw" style={{ background: 'var(--crit)', opacity: .12 }} />0% late</span><span><i className="sw" style={{ background: 'var(--crit)' }} />100% late</span><span className="dim">Hover a square for the exact value.</span></div>
      </Card>
      <div className="two">
        <Card title="Late rate by hour of the day" lead="All shipping options together. The hour matters mainly through Same Day orders (see Explainability).">
          <Columns items={hourItems} max={0.8} height={200} showEvery={3} />
        </Card>
        <Card title="Country and region" lead={`Country rates spread ${Math.round(e.country_spread * 100)} points. Region rates spread only ${Math.round(e.region_spread * 100)} points.`}>
          <div className="eyebrow" style={{ marginBottom: 4 }}>Highest country late rates (100+ lines)</div>
          <Bars rows={e.by_country_top.slice(0, 4).map((m: any) => ({ label: m.name, value: m.late_rate }))} fmt={v => pc(v)} max={1} />
          <div className="eyebrow" style={{ margin: '10px 0 4px' }}>Lowest</div>
          <Bars rows={e.by_country_bottom.slice(-4).map((m: any) => ({ label: m.name, value: m.late_rate }))} fmt={v => pc(v)} max={1} />
          <p className="note" style={{ margin: '8px 0 0' }}>So we encode country, not just region, as a feature.</p>
        </Card>
      </div>
      <div className="two">
        <Card title="Product category" lead="A moderate spread. Less important than shipping option.">
          <Bars rows={[...e.by_category].slice(0, 5).map((m: any) => ({ label: m.name, value: m.late_rate }))} fmt={v => pc(v)} max={1} />
          <div className="eyebrow" style={{ margin: '10px 0 4px' }}>Lowest</div>
          <Bars rows={[...e.by_category].slice(-3).map((m: any) => ({ label: m.name, value: m.late_rate }))} fmt={v => pc(v)} max={1} />
        </Card>
        <Card title="Missing values" lead="Only one field was a real problem.">
          <Tbl head={['Column', 'Missing']} num={[1]} rows={[['Order Zipcode (order level)', pc(raw.zipcode_missing_orders, 2)], ...raw.missing_top.filter((m: any) => m.column !== 'Order Zipcode').slice(0, 2).map((m: any) => [m.column, `${m.pct.toFixed(1)}%`])]} />
          <p className="note" style={{ marginTop: 8 }}>Zipcode is missing for almost every order and for every order in most countries, so it was dropped.</p>
        </Card>
      </div>
      <Card title="Leakage check" lead="Leakage means using information that would not exist at order time. Each field was classified before any modelling.">
        <Tbl head={['Field', 'Status', 'Why']} rows={e.leakage.map((l: any) => [l.field, <span className={`pill ${l.status}`}>{l.status}</span>, l.why])} />
        <Note>Sales and Benefit per order were cleared as safe. They are known at order time. Benefit has outliers (a data quality issue, not leakage), handled on the next page.</Note>
      </Card>
      <Callout title="What this told us">Shipping option dominates. A simple rule built on it would be a tough baseline, and it was: see the Models page. Calendar effects are flat, so a time based split is safe but we do not need a calendar year cut off.</Callout>
      <Related stage="Stage 2" />
    </div>
  )
}

export function Prep() {
  const r = useReport(); if (!r) return <Skeleton h={500} />
  const e = r.eda, s = r.splits
  const colors = ['#2a6fdb', '#8a63d2', '#c8691a']
  const ben = e.benefit_hist.map((b: any) => ({ label: String(Math.round(b.lo)), value: b.n, color: b.hi <= e.benefit_p1 || b.lo >= e.benefit_p99 ? 'var(--crit)' : 'var(--brand)', tip: `$${Math.round(b.lo)} to $${Math.round(b.hi)}: ${num(b.n)} orders` }))
  return (
    <div className="grid">
      <PageHead stage="Stage 3" nb="notebook 02_preprocessing" big="180,519 lines became 65,752 orders, split by time so the test set is the future." line="One useless field was dropped and extreme profits were capped." chips={[{ icon: 'layers', k: '46,026', l: 'train orders' }, { icon: 'dial', k: '7,890', l: 'validation orders' }, { icon: 'flag', k: '11,836', l: 'test orders' }]} />
      <Card title="From lines to orders to three sets" lead="Each step keeps only what the model can learn from.">
        <Flow nodes={[
          { icon: 'data', title: `${num(r.raw.rows)} lines`, text: 'The raw file. One row per item in a basket.', color: 'var(--std)' },
          { icon: 'box', title: `${num(r.raw.orders)} orders`, text: 'Collapsed to one row per order.', color: 'var(--acc)' },
          { icon: 'calendar', title: 'Split by date', text: 'Oldest 70% train, next 12% validation, newest 18% test.', color: 'var(--brand)' },
        ]} />
      </Card>
      <div className="two">
        <Card title="From order lines to orders" lead="One order can have several lines. The model predicts per order, so lines were collapsed.">
          <Tbl head={['Column', 'Rule']} rows={[['Sales, Order Item Quantity', 'Sum across lines'], ['Shipping Mode, region, country, segment, payment type', 'First value (same on every line)'], ['Late_delivery_risk', 'First value (checked: identical on all lines of an order)'], ['Category Name, Category Id', 'Most common value (mode), because 67.8% of orders mix categories'], ['New: n_line_items, n_distinct_categories', 'Counted, so the mix is not lost']]} />
        </Card>
        <Card title="Lines per order" lead="The average is 2.75 lines. Most orders have 1 to 5.">
          <Columns items={r.raw.lines_hist.slice(0, 8).map((l: any) => ({ label: String(l.lines), value: l.orders }))} fmt={v => num(v)} height={200} yTitle="Orders" />
        </Card>
      </div>
      <div className="two">
        <Card title="Profit outliers and capping" lead={`Profit per order runs from ${moneyK(Math.abs(raw0(r)))} loss upward. Red bars lie outside the 1st to 99th percentile and are capped.`}>
          <Columns items={ben} fmt={v => num(v)} height={210} showEvery={4} yTitle="Orders" />
          <Note>{pc(e.benefit_outlier_share, 2)} of order lines are statistical outliers. Profit is capped at ${Math.round(e.benefit_p1)} and ${Math.round(e.benefit_p99)} for modelling. For ranking orders we use Sales, so a loss making order is not counted as negative value.</Note>
        </Card>
        <Card title="Dropped and kept" lead="Decisions with a recorded reason.">
          <Tbl head={['Item', 'Decision']} rows={[['Order Zipcode', `Dropped (${pc(r.raw.zipcode_missing_orders, 2)} missing)`], ['Country names', 'Checked: already consistent, no cleaning needed'], ['Category Id', 'Not used alone, it is scoped by department'], ['Days for shipment (scheduled)', 'Dropped later, a perfect copy of Shipping Mode']]} />
        </Card>
      </div>
      <Card title="Chronological split" lead="The model is trained on the past and tested on the future, like real use. No order from a later date is ever used to learn about an earlier one.">
        <div className="timeline">{s.map((x: any, i: number) => <div key={x.name} style={{ flex: x.share, background: colors[i] }}>{x.name} {Math.round(x.share * 100)}%</div>)}</div>
        <Tbl head={['Set', 'Orders', 'From', 'To', 'Late share', 'Avg order value']} num={[1, 4, 5]} rows={s.map((x: any) => [x.name, num(x.orders), x.start, x.end, pc(x.late_rate, 1), '$' + Math.round(x.avg_sales)])} />
        <Note>Validation exists so tuning can run quickly without ever touching the test set. The test set is opened once. Note the average order value fell from about $591 in train to $401 in test, which we flag as a drift risk.</Note>
      </Card>
      <Related stage="Stage 3" />
    </div>
  )
}
const raw0 = (r: any) => r.raw.benefit_min
