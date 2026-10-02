import { useReport } from '../../data'
import { Bars, Card, Skeleton } from '../../components/ui'
import { Callout, Columns, PageHead, Related, Stat, Steps, Tbl, pc } from '../../components/tech'
import { moneyK, num } from '../../format'

export function Problem() {
  const r = useReport(); if (!r) return <Skeleton h={500} />
  const e = r.eda, st = r.raw.status_to_target
  return (
    <div className="grid">
      <PageHead stage="Stages 1 and 2" nb="README, DECISION_LOG, notebook 01" line="We predict, at the moment an order is placed, whether it will arrive late. Then we rank the risky orders by how much money is at stake." viva="Why is Recall your main metric when the classes are almost balanced?" />
      <div className="two">
        <Card title="Two lenses, one model" lead="Both lenses use the same predictions.">
          <div className="flow">
            <div className="node"><b>Primary lens</b>Late delivery risk. Binary classification: will this order be late (1) or not (0)?</div>
            <div className="arrow">then</div>
            <div className="node"><b>Secondary lens</b>Shipment prioritization. Chance of late × order value gives a ranked action queue.</div>
          </div>
          <p className="note" style={{ marginTop: 12 }}>Inputs are limited to facts known when the order is placed. Nothing from after shipping is allowed in.</p>
        </Card>
        <Card title="What counts as late" lead="The target is Late_delivery_risk. This is how the dataset's Delivery Status maps to it, counted over all 180,519 order lines.">
          <Tbl head={['Delivery Status', 'Target 0', 'Target 1']} num={[1, 2]} rows={st.map((s: any) => [s.status, num(s.on_time), num(s.late)])} />
          <p className="note" style={{ marginTop: 10 }}>Every status maps to exactly one target value. "Shipping canceled" ({pc(r.raw.canceled_share)} of lines) is coded 0 in the data, and we kept it as given after checking.</p>
        </Card>
      </div>
      <div className="grid g3">
        <Stat label="Late share" value={pc(e.late_rate)} sub={`${num(e.late)} late and ${num(e.on_time)} on time orders`} />
        <Stat label="Primary metric" value="Recall" sub="share of really late orders that we catch" />
        <Stat label="Cost used for the threshold" value={`${r.threshold_notes.cost_fn} : ${r.threshold_notes.cost_fp}`} sub="a missed late order costs 3 times a false alarm" />
      </div>
      <Card title="Why Recall" lead="The reason changed after we looked at the data, and we logged both versions.">
        <Steps items={[
          { title: 'First reason (12 Sep)', text: 'We assumed the classes were imbalanced, so accuracy would mislead.' },
          { title: 'What EDA showed (15 Sep)', text: `The split is ${pc(e.late_rate, 2)} late and ${pc(1 - e.late_rate, 2)} on time, which is close to balanced. So imbalance is not the reason.` },
          { title: 'The real reason', text: 'Cost. Missing a late order brings penalties and unhappy customers. A false alarm only costs a quick check. So catching late orders matters more than raw accuracy. Precision, F1, ROC-AUC and PR-AUC are supporting metrics.' },
        ]} />
      </Card>
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
      <PageHead stage="Stage 2" nb="notebook 01_eda" line="Shipping option is by far the strongest signal. Calendar effects are flat. Several fields had to be kept out because they are only known after delivery." viva="How did you check for data leakage?" />
      <div className="grid g4">
        <Stat label="Order lines" value={num(raw.rows)} sub={`${raw.columns} columns`} />
        <Stat label="Unique orders" value={num(raw.orders)} sub={`${raw.lines_per_order.toFixed(2)} lines per order`} />
        <Stat label="Late share" value={pc(e.late_rate, 2)} sub="close to balanced" />
        <Stat label="Multi category orders" value={pc(e.multi_category_share, 1)} sub="orders that mix categories" />
      </div>
      <div className="two">
        <Card title="Late rate by shipping option" lead="The strongest signal found. The gap between the best and worst is 57 points.">
          <Bars rows={e.by_mode.map((m: any) => ({ label: m.name, value: m.late_rate, sub: String(m.orders) }))} fmt={v => pc(v)} max={1} />
          <p className="note" style={{ margin: '8px 0 0' }}>First Class is the slowest in practice: it is late {pc(e.by_mode[0].late_rate, 0)} of the time. Standard Class is late only {pc(e.by_mode[3].late_rate, 0)} of the time.</p>
        </Card>
        <Card title="Late rate by month" lead="Stable from 2015 to 2017. The orange bar is January 2018, the only 2018 month, which is too thin to hold out as a calendar year test.">
          <Columns items={monthItems} max={1} height={230} showEvery={3} rotate />
        </Card>
      </div>
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
        <p className="note" style={{ marginTop: 8 }}>Sales and Benefit per order were cleared as safe. They are known at order time. Benefit has outliers (a data quality issue, not leakage), handled on the next page.</p>
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
      <PageHead stage="Stage 3" nb="notebook 02_preprocessing" line="We turned 180,519 order lines into 65,752 orders, dropped one useless field, capped extreme profits, and split the data by time so the test set is the future." viva="Why did you split by time instead of randomly?" />
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
          <p className="note" style={{ margin: '8px 0 0' }}>{pc(e.benefit_outlier_share, 2)} of order lines are statistical outliers. Profit is capped at ${Math.round(e.benefit_p1)} and ${Math.round(e.benefit_p99)} for modelling. For ranking orders we use Sales, so a loss making order is not counted as negative value.</p>
        </Card>
        <Card title="Dropped and kept" lead="Decisions with a recorded reason.">
          <Tbl head={['Item', 'Decision']} rows={[['Order Zipcode', `Dropped (${pc(r.raw.zipcode_missing_orders, 2)} missing)`], ['Country names', 'Checked: already consistent, no cleaning needed'], ['Category Id', 'Not used alone, it is scoped by department'], ['Days for shipment (scheduled)', 'Dropped later, a perfect copy of Shipping Mode']]} />
        </Card>
      </div>
      <Card title="Chronological split" lead="The model is trained on the past and tested on the future, like real use. No order from a later date is ever used to learn about an earlier one.">
        <div className="timeline">{s.map((x: any, i: number) => <div key={x.name} style={{ flex: x.share, background: colors[i] }}>{x.name} {Math.round(x.share * 100)}%</div>)}</div>
        <Tbl head={['Set', 'Orders', 'From', 'To', 'Late share', 'Avg order value']} num={[1, 4, 5]} rows={s.map((x: any) => [x.name, num(x.orders), x.start, x.end, pc(x.late_rate, 1), '$' + Math.round(x.avg_sales)])} />
        <p className="note" style={{ marginTop: 8 }}>Validation exists so tuning can run quickly without ever touching the test set. The test set is opened once. Note the average order value fell from about $591 in train to $401 in test, which we flag as a drift risk.</p>
      </Card>
      <Related stage="Stage 3" />
    </div>
  )
}
const raw0 = (r: any) => r.raw.benefit_min
