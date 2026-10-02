/* Turn a few plain fields about a NEW order into the 28 model inputs.
   Same rules as notebook 03; every lookup table comes from the training data only. */
export const SHIP_DAYS: Record<string, number> = { 'First Class': 1, 'Same Day': 0, 'Second Class': 2, 'Standard Class': 4 }
export const MODES = Object.keys(SHIP_DAYS), SEGMENTS = ['Consumer', 'Corporate', 'Home Office'], TYPES = ['CASH', 'DEBIT', 'PAYMENT', 'TRANSFER']

export interface Lookups {
  global_late_rate: number; country_late_rate: Record<string, number>; region_late_rate: Record<string, number>; country_orders: Record<string, number>
  country_region: Record<string, string>; category_frequency: Record<string, number>; category_frequency_fallback: number
  benefit_cap: [number, number]; median_margin: number; lines_default: Record<string, { distinct: number; median_sales: number; median_qty: number }>
  sales_range: [number, number]; typical: { Sales: number; 'Order Item Quantity': number }
}
export interface OrderInput {
  mode: string; when: string            // 'YYYY-MM-DDTHH:MM'
  pay_type: string; segment: string; country: string; category: string
  qty: number; sales: number
  profit?: number | null; lines?: number | null; distinct?: number | null; region?: string | null
}
export interface Built { row: Float64Array; assumed: string[]; notes: string[]; region: string }

export function buildFeatures(L: Lookups, cols: string[], o: OrderInput): Built {
  const assumed: string[] = [], notes: string[] = []
  const when = new Date(o.when); if (isNaN(when.getTime())) throw new Error('Bad date')
  const set = (row: Float64Array, n: string, v: number) => { const i = cols.indexOf(n); if (i < 0) throw new Error('missing col ' + n); row[i] = v }
  const row = new Float64Array(cols.length)
  const sales = Number(o.sales), qty = Number(o.qty)
  let lines = o.lines, distinct = o.distinct, profit = o.profit
  if (lines == null) { lines = Math.min(5, Math.max(1, Math.round(sales / 200))); assumed.push(`${lines} order line${lines > 1 ? 's' : ''} (guessed from the order value)`) }
  if (distinct == null) { distinct = L.lines_default[String(lines)]?.distinct ?? 1; assumed.push(`${distinct} product categor${distinct > 1 ? 'ies' : 'y'} in the order`) }
  if (profit == null) { profit = sales * L.median_margin; assumed.push('typical profit (about 20% of the order value)') }
  const region = o.region || L.country_region[o.country] || ''
  let crate = L.country_late_rate[o.country]
  if (crate === undefined) { crate = L.global_late_rate; notes.push(`The model never saw "${o.country}", so it used the average late rate.`) }
  let rrate = L.region_late_rate[region]; if (rrate === undefined) rrate = L.global_late_rate
  let cfreq = L.category_frequency[o.category]
  if (cfreq === undefined) { cfreq = L.category_frequency_fallback; notes.push(`The model never saw the product category "${o.category}", so it treated it as rare.`) }
  const dow = (when.getDay() + 6) % 7, month = when.getMonth() + 1
  const [lo, hi] = L.benefit_cap
  set(row, 'Sales', sales); set(row, 'Order Item Quantity', qty); set(row, 'Benefit per order', profit)
  set(row, 'n_line_items', lines); set(row, 'n_distinct_categories', distinct)
  set(row, 'Benefit_per_order_capped', Math.min(hi, Math.max(lo, profit))); set(row, 'priority_value_component', sales)
  set(row, 'order_hour', when.getHours()); set(row, 'order_dayofweek', dow); set(row, 'order_month', month)
  set(row, 'order_is_weekend', +(dow >= 5)); set(row, 'order_is_holiday_season', +(month === 11 || month === 12))
  set(row, 'sales_per_scheduled_day', sales / Math.max(SHIP_DAYS[o.mode], 1)); set(row, 'is_express_shipping', +(o.mode === 'First Class' || o.mode === 'Same Day'))
  set(row, 'country_delay_rate', crate); set(row, 'region_delay_rate', rrate); set(row, 'category_frequency', cfreq)
  MODES.forEach(m => set(row, `Shipping Mode_${m}`, +(m === o.mode)))
  SEGMENTS.forEach(s => set(row, `Customer Segment_${s}`, +(s === o.segment)))
  TYPES.forEach(t => set(row, `Type_${t}`, +(t === o.pay_type)))
  return { row, assumed, notes, region }
}
