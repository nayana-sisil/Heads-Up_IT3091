import { useMemo, useState } from 'react'
import { useData } from '../../data'
import { Card, Skeleton } from '../../components/ui'
import { Callout, PageHead, Related, Tbl } from '../../components/tech'
import { buildFeatures, MODES, OrderInput } from '../../static/features'
import { countryEn } from '../../static/names'

const GROUPS: { group: string; items: [string, string, string][] }[] = [
  { group: 'Order value and basket', items: [
    ['Sales', 'Order total in dollars, summed over lines', 'scaled'], ['Order Item Quantity', 'Items in the order, summed over lines', 'scaled'],
    ['n_line_items', 'Number of lines in the order', 'scaled'], ['n_distinct_categories', 'Number of different product categories', 'scaled'],
    ['Benefit per order', 'Profit on the order, raw', 'as is'], ['Benefit_per_order_capped', 'Profit capped at the 1st and 99th percentile', 'scaled'],
    ['priority_value_component', 'Order value used by the ranking (equals Sales)', 'scaled'], ['sales_per_scheduled_day', 'Sales divided by promised days (Same Day counts as 1)', 'scaled']] },
  { group: 'Time of the order', items: [
    ['order_hour', 'Hour placed, 0 to 23', 'as is'], ['order_dayofweek', 'Monday 0 to Sunday 6', 'as is'], ['order_month', 'Month, 1 to 12', 'as is'],
    ['order_is_weekend', '1 if Saturday or Sunday', 'as is'], ['order_is_holiday_season', '1 if November or December', 'as is']] },
  { group: 'Shipping', items: [
    ['Shipping Mode_First Class', 'One hot: 1 if this shipping option', 'as is'], ['Shipping Mode_Same Day', 'One hot', 'as is'], ['Shipping Mode_Second Class', 'One hot', 'as is'], ['Shipping Mode_Standard Class', 'One hot', 'as is'],
    ['is_express_shipping', '1 if First Class or Same Day', 'as is']] },
  { group: 'Where and what', items: [
    ['country_delay_rate', 'Late rate of the country, from the training set only', 'scaled'], ['region_delay_rate', 'Late rate of the region, from the training set only', 'scaled'],
    ['category_frequency', 'How common the product category is in training', 'scaled']] },
  { group: 'Customer and payment', items: [
    ['Customer Segment_Consumer', 'One hot', 'as is'], ['Customer Segment_Corporate', 'One hot', 'as is'], ['Customer Segment_Home Office', 'One hot', 'as is'],
    ['Type_CASH', 'One hot: payment type', 'as is'], ['Type_DEBIT', 'One hot', 'as is'], ['Type_PAYMENT', 'One hot', 'as is'], ['Type_TRANSFER', 'One hot', 'as is']] },
]
const PRESETS: Record<string, OrderInput> = {
  'Risky: Same Day after noon': { mode: 'Same Day', when: '2017-10-12T15:00', pay_type: 'DEBIT', segment: 'Consumer', country: 'Estados Unidos', category: "Women's Apparel", qty: 6, sales: 650 },
  'Safe: Same Day before noon': { mode: 'Same Day', when: '2017-10-12T09:00', pay_type: 'DEBIT', segment: 'Consumer', country: 'Estados Unidos', category: "Women's Apparel", qty: 3, sales: 250 },
  'Standard Class to France': { mode: 'Standard Class', when: '2017-12-02T10:30', pay_type: 'TRANSFER', segment: 'Corporate', country: 'Francia', category: 'Cleats', qty: 4, sales: 380 },
}

export function Features() {
  const look = useData<any>('lookups.json'), sc = useData<any>('scaler.json')
  const [pk, setPk] = useState(Object.keys(PRESETS)[0]); const [inp, setInp] = useState<OrderInput>(PRESETS[pk])
  const built = useMemo(() => look && sc ? buildFeatures(look, sc.features, inp) : null, [look, sc, inp])
  if (!look || !sc || !built) return <Skeleton h={500} />
  const set = (p: Partial<OrderInput>) => setInp(x => ({ ...x, ...p }))
  const val = (f: string) => built.row[sc.features.indexOf(f)]
  const fmt = (v: number) => Number.isInteger(v) ? String(v) : v.toFixed(3)
  return (
    <div className="grid">
      <PageHead stage="Stage 4" nb="notebook 03_feature_engineering" line="The model sees 28 numbers per order. A few simple rules create them, and every lookup table is learned from the training set only." viva="How do you stop the country late rate from leaking the answer?" />
      <div className="two">
        <Card title="The 28 inputs" lead="Grouped by what they describe.">
          {GROUPS.map(g => <div key={g.group} style={{ marginBottom: 10 }}><div className="eyebrow" style={{ marginBottom: 4 }}>{g.group} ({g.items.length})</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{g.items.map(i => <span key={i[0]} className="chip" title={i[1]}>{i[0]}</span>)}</div></div>)}
          <p className="note" style={{ margin: 0 }}>Hover a name for its meaning. Ten inputs are standardized (mean 0, spread 1, fitted on train). Targets are never an input.</p>
        </Card>
        <Card title="Rules that matter" lead="What was decided and why.">
          <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 8 }}>
            <li><b>Target encoding for geography.</b> Country and region become their training late rate. Unknown places fall back to the overall training rate.</li>
            <li><b>Frequency encoding for product.</b> Twenty four categories become one number: how common each is.</li>
            <li><b>One hot for the rest.</b> Shipping option, segment and payment type.</li>
            <li><b>Time features kept</b> even though they are weak alone, because the hour matters inside Same Day orders.</li>
            <li><b>Scheduled days dropped.</b> It is a perfect copy of Shipping Mode.</li>
            <li><b>Pipeline bug caught.</b> An early draft dropped the scheduled days column before the features that needed it were built, silently losing two features. A final column check caught it.</li>
          </ul>
        </Card>
      </div>
      <Card title="Watch one order become 28 numbers" lead="This is the real feature builder the app uses. Change the order and see every input update.">
        <div className="pill-row" style={{ marginBottom: 12 }}>{Object.keys(PRESETS).map(k => <button key={k} className={`btn ${pk === k ? 'primary' : ''}`} onClick={() => { setPk(k); setInp(PRESETS[k]) }}>{k}</button>)}</div>
        <div className="formgrid" style={{ gridTemplateColumns: 'repeat(4,minmax(0,1fr))' }}>
          <label>Shipping<select className="select" value={inp.mode} onChange={e => set({ mode: e.target.value })}>{MODES.map(m => <option key={m}>{m}</option>)}</select></label>
          <label>Hour placed<select className="select" value={Number(inp.when.slice(11, 13))} onChange={e => set({ when: inp.when.slice(0, 11) + String(e.target.value).padStart(2, '0') + ':00' })}>{Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>)}</select></label>
          <label>Order value<input className="input" type="number" min={1} value={inp.sales} onChange={e => set({ sales: Math.max(1, +e.target.value) })} /></label>
          <label>Country<select className="select" value={inp.country} onChange={e => set({ country: e.target.value })}>{Object.keys(look.country_late_rate).sort().map(c => <option key={c} value={c}>{countryEn(c)}</option>)}</select></label>
        </div>
        <div className="two" style={{ marginTop: 14 }}>
          {[0, 1].map(half => {
            const feats: string[] = sc.features.slice(half * 14, half * 14 + 14)
            return <Tbl key={half} head={['Input', 'Value', 'Scaled']} num={[1, 2]} rows={feats.map(f => { const s = sc.scaled[f]; const v = val(f); return [f, fmt(v), s ? fmt((v - s.mean) / s.std) : ''] })} />
          })}
        </div>
        {built.assumed.length > 0 && <p className="note" style={{ marginTop: 10 }}>Not given, so assumed: {built.assumed.join('; ')}.</p>}
        <p className="note" style={{ marginTop: 6 }}>Country late rate used here: {(val('country_delay_rate') * 100).toFixed(1)}%. Scaled values use the training mean and spread.</p>
      </Card>
      <Callout title="Fitted on train only">The country and region rates, the product frequencies and the scaler are all computed on the training set and then applied unchanged to validation, test and every new order. That is what keeps the evaluation honest.</Callout>
      <Related stage="Stage 4" />
    </div>
  )
}
