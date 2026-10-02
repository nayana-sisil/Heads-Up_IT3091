/* Same routes as the FastAPI service, answered in the browser. */
import { Engine, loadEngine, predict, scaleRow, shap } from './engine'

const SHIP_DAYS: Record<string, number> = { 'First Class': 1, 'Same Day': 0, 'Second Class': 2, 'Standard Class': 4 }
const MODES = Object.keys(SHIP_DAYS), SEGMENTS = ['Consumer', 'Corporate', 'Home Office'], TYPES = ['CASH', 'DEBIT', 'PAYMENT', 'TRANSFER']
const LABEL: Record<string, string> = { 'Sales': 'Order value', 'Order Item Quantity': 'Items ordered', 'Benefit per order': 'Profit on order', 'n_line_items': 'Number of lines', 'n_distinct_categories': 'Product categories', 'Benefit_per_order_capped': 'Profit on order', 'priority_value_component': 'Order value', 'order_hour': 'Hour of order', 'order_dayofweek': 'Day of week', 'order_month': 'Month', 'order_is_weekend': 'Weekend order', 'order_is_holiday_season': 'Holiday season', 'sales_per_scheduled_day': 'Value per scheduled day', 'is_express_shipping': 'Express shipping', 'country_delay_rate': 'Country late rate', 'region_delay_rate': 'Region late rate', 'Shipping Mode_First Class': 'First Class shipping', 'Shipping Mode_Same Day': 'Same Day shipping', 'Shipping Mode_Second Class': 'Second Class shipping', 'Shipping Mode_Standard Class': 'Standard Class shipping', 'Customer Segment_Consumer': 'Consumer customer', 'Customer Segment_Corporate': 'Corporate customer', 'Customer Segment_Home Office': 'Home Office customer', 'Type_CASH': 'Paid by cash', 'Type_DEBIT': 'Paid by debit', 'Type_PAYMENT': 'Paid by payment', 'Type_TRANSFER': 'Paid by transfer', 'category_frequency': 'Product category popularity' }

let E: Engine
export async function initLocal(base: string) { E = await loadEngine(base) }

function subset(from?: string | null, to?: string | null) {
  let d = E.orders
  if (from) { const f = new Date(from + 'T00:00:00').getTime(); d = d.filter(o => o.dt.getTime() >= f) }
  if (to) { const t = new Date(to + 'T00:00:00').getTime() + 864e5; d = d.filter(o => o.dt.getTime() < t) }
  return d
}
const tierOf = (p: number, sales: number) => {
  const pr = p * sales, c = E.config.tier_cutoffs
  const t = pr >= c.critical_min ? 'Critical' : pr >= c.high_min ? 'High' : 'Standard'
  return p < E.config.risk_threshold && t !== 'Critical' ? 'Standard' : t
}
const r4 = (n: number) => Math.round(n * 1e4) / 1e4
const score = (o: any, a: number) => a > 0 ? Math.pow(o.p, a) * o.sales : o.sales
function rng(seed: number) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 } }
function groupBy<T>(arr: T[], key: (x: T) => string | number) { const m = new Map<string | number, T[]>(); for (const x of arr) { const k = key(x); (m.get(k) ?? m.set(k, []).get(k)!).push(x) } return m }
const sum = (a: number[]) => a.reduce((s, v) => s + v, 0)

function summary(q: URLSearchParams) {
  const d = subset(q.get('date_from'), q.get('date_to'))
  const tiers: any = {}
  for (const [t, v] of groupBy(d, o => o.tier)) tiers[t as string] = { orders: v.length, at_risk: sum(v.map(o => o.priority)), avg_sales: sum(v.map(o => o.sales)) / v.length }
  const agg = (key: (o: any) => string | number, name: string) => [...groupBy(d, key)].map(([k, v]) => ({ [name]: k, orders: v.length, risk: sum(v.map(o => o.p)) / v.length, at_risk: sum(v.map(o => o.priority)) }))
  return { orders: d.length, flagged: d.filter(o => o.flag).length, revenue_at_risk: sum(d.map(o => o.priority)), sales_total: sum(d.map(o => o.sales)), avg_risk: sum(d.map(o => o.p)) / d.length, tiers,
    by_mode: agg(o => o.mode, 'mode'), by_region: agg(o => o.region, 'region').sort((a: any, b: any) => b.at_risk - a.at_risk).slice(0, 10),
    by_hour: agg(o => o.hour, 'hour').sort((a: any, b: any) => a.hour - b.hour), date_min: d[0]?.date.slice(0, 10), date_max: d[d.length - 1]?.date.slice(0, 10) }
}

function orders(q: URLSearchParams) {
  let d = subset(q.get('date_from'), q.get('date_to'))
  const tier = q.get('tier'), mode = q.get('mode'), region = q.get('region'), s = q.get('q')?.toLowerCase(), fl = q.get('flagged')
  if (tier) d = d.filter(o => o.tier === tier); if (mode) d = d.filter(o => o.mode === mode); if (region) d = d.filter(o => o.region === region)
  if (fl !== null) d = d.filter(o => o.flag === (fl === 'true'))
  if (s) d = d.filter(o => String(o.id).includes(s) || o.country.toLowerCase().includes(s) || o.city.toLowerCase().includes(s) || o.category.toLowerCase().includes(s))
  const alpha = Number(q.get('alpha') ?? 1), limit = Number(q.get('limit') ?? 50), offset = Number(q.get('offset') ?? 0)
  const ranked = d.map(o => ({ o, sc: score(o, alpha) })).sort((a, b) => b.sc - a.sc)
  const keep = ['id', 'date', 'mode', 'region', 'country', 'city', 'segment', 'type', 'category', 'sales', 'p', 'priority', 'tier', 'flag', 'late', 'why']
  return { total: ranked.length, items: ranked.slice(offset, offset + limit).map(({ o, sc }) => { const r: any = {}; keep.forEach(k => r[k] = o[k]); r.score = r4(sc); return r }) }
}

function order(id: number) {
  const o = E.orders.find(x => x.id === id); if (!o) throw new Error('404')
  const { dt, hour, ...rest } = o; void dt; void hour
  return { ...rest, drivers: E.drivers.get(id), base_value: E.baseValue, rank: E.orders.filter(x => x.priority > o.priority).length + 1, total: E.orders.length }
}

function whatif(id: number, b: any) {
  const o = E.orders.find(x => x.id === id); const base = E.raw.get(id); if (!o || !base) throw new Error('404')
  if (b.mode && !MODES.includes(b.mode)) throw new Error('422'); if (b.hour != null && (b.hour < 0 || b.hour > 23)) throw new Error('422')
  const cols = E.rawCols, row = Float64Array.from(base), set = (n: string, v: number) => { row[cols.indexOf(n)] = v }
  const curMode = MODES.find(m => base[cols.indexOf(`Shipping Mode_${m}`)] === 1)!, newMode = b.mode || curMode
  if (b.mode) { MODES.forEach(m => set(`Shipping Mode_${m}`, +(m === b.mode))); set('is_express_shipping', +(b.mode === 'First Class' || b.mode === 'Same Day')) }
  if (b.hour != null) set('order_hour', b.hour)
  if (b.pay_type) TYPES.forEach(t => set(`Type_${t}`, +(t === b.pay_type)))
  if (b.segment) SEGMENTS.forEach(s => set(`Customer Segment_${s}`, +(s === b.segment)))
  const sales = b.sales != null ? Number(b.sales) : o.sales
  set('Sales', sales); set('priority_value_component', sales); set('sales_per_scheduled_day', sales / Math.max(SHIP_DAYS[newMode], 1))
  const x = scaleRow(E, row, cols); const p = predict(E, x); const phi = shap(E, x)
  const idx = [...phi.keys()].slice(0, E.features.length).sort((a, c) => Math.abs(phi[c]) - Math.abs(phi[a])).slice(0, 8)
  return {
    before: { p: o.p, priority: o.p * o.sales, tier: tierOf(o.p, o.sales), sales: o.sales },
    after: { p, priority: p * sales, tier: tierOf(p, sales), sales, drivers: idx.map(j => ({ label: LABEL[E.features[j]] ?? E.features[j], shap: Math.round(phi[j] * 1e3) / 1e3 })) },
  }
}

function capacity(q: URLSearchParams) {
  const alpha = Number(q.get('alpha') ?? 1), budget = Number(q.get('budget') ?? 0.1)
  if (!(budget > 0 && budget <= 1)) throw new Error('422')
  const d = subset(q.get('date_from'), q.get('date_to')); if (!d.length) throw new Error('404')
  const S = d.map(o => o.sales), y = d.map(o => o.late), p = d.map(o => o.p), lv = S.map((s, i) => s * y[i]), total = sum(lv) || 1
  const order = (sc: number[]) => sc.map((v, i) => i).sort((a, b) => sc[b] - sc[a] || a - b)
  const curve = (sc: number[], pts = 100) => { const idx = order(sc); const cum: number[] = []; let c = 0; for (const i of idx) { c += lv[i]; cum.push(c / total) }
    return [0, ...Array.from({ length: pts }, (_, k) => r4(cum[Math.floor(((k + 1) / pts) * (d.length - 1))]))] }
  const sc = d.map((o, i) => alpha > 0 ? Math.pow(p[i], alpha) * S[i] : S[i])
  const n = Math.max(1, Math.round(d.length * budget)), top = order(sc).slice(0, n)
  const reached = sum(top.map(i => lv[i])) / total, prec = sum(top.map(i => y[i])) / n
  const oracle = d.map((_, i) => y[i] * S[i] + 1e-9 * S[i]), oTop = order(oracle).slice(0, n)
  const rnd = rng(42)
  return { orders: d.length, review_n: n, budget, alpha, revenue_reached: reached, precision: prec, late_revenue_total: total, late_revenue_reached: sum(top.map(i => lv[i])),
    oracle_reached: sum(oTop.map(i => lv[i])) / total, wasted_reviews: Math.round(n * (1 - prec)),
    curves: { 'Heads Up': curve(sc), 'Sales only': curve(S), 'Risk only': curve(p.map((v, i) => v + 1e-12 * S[i])), 'Oracle': curve(oracle), 'Random order': curve(d.map(() => rnd())) } }
}

export async function localGet(url: string): Promise<any> {
  const u = new URL(url, 'http://x'), q = u.searchParams, path = u.pathname
  if (path === '/api/meta') return { config: E.config, modes: MODES, segments: SEGMENTS, types: TYPES, regions: [...new Set(E.orders.map(o => o.region))].sort(), date_min: E.orders[0].date.slice(0, 10), date_max: E.orders[E.orders.length - 1].date.slice(0, 10) }
  if (path === '/api/summary') return summary(q)
  if (path === '/api/orders') return orders(q)
  if (path === '/api/capacity') return capacity(q)
  if (path === '/api/trust') return E.trust
  if (path === '/api/replay') return E.trust.replay
  if (path === '/api/health') return { ok: true, orders: E.orders.length, engine: E.config.engine }
  const m = path.match(/^\/api\/orders\/(\d+)$/); if (m) return order(+m[1])
  throw new Error('404')
}
export async function localPost(url: string, body: any): Promise<any> {
  const m = new URL(url, 'http://x').pathname.match(/^\/api\/orders\/(\d+)\/whatif$/); if (m) return whatif(+m[1], body)
  throw new Error('404')
}
export { whatif as _whatif, capacity as _capacity, orders as _orders, summary as _summary }
