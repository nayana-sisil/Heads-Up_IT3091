// Rebuilds model features in the browser code from RAW order fields for all test orders and compares with the saved predictions.
// Run:  npm run check:features   (needs data/processed/test.csv from the repo)
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url'; import { build } from 'esbuild'
const here = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(here, '..')
const out = path.join(root, 'node_modules/.cache/localApi.mjs')
await build({ entryPoints: [path.join(root, 'src/static/localApi.ts')], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'silent', define: { 'import.meta.env.VITE_STATIC': '"1"' } })
const D = path.join(root, 'public/data/')
globalThis.fetch = async u => new Response(fs.readFileSync(D + String(u).replace(/^.*data\//, '')), { status: 200 })
const api = await import(out); await api.initLocal('')
function csv(t) { const rows = []; let r = [], c = '', q = false; for (let i = 0; i < t.length; i++) { const ch = t[i]; if (q) { if (ch === '"') { if (t[i + 1] === '"') { c += '"'; i++ } else q = false } else c += ch } else if (ch === '"') q = true; else if (ch === ',') { r.push(c); c = '' } else if (ch === '\n') { r.push(c.replace(/\r$/, '')); c = ''; rows.push(r); r = [] } else c += ch } if (c || r.length) { r.push(c); rows.push(r) } return rows }
const rows = csv(fs.readFileSync(path.resolve(root, '../../data/processed/test.csv'), 'utf8')); const h = rows[0], ix = n => h.indexOf(n)
const saved = new Map((await api.localGet('/api/orders?limit=100000')).items.map(o => [o.id, o]))
let worst = 0, tierBad = 0, n = 0
for (const r of rows.slice(1).filter(r => r.length > 5)) {
  const o = saved.get(+r[ix('Order Id')])
  const res = api.checkOrder({ mode: r[ix('Shipping Mode')], when: r[ix('order date (DateOrders)')].replace(' ', 'T').slice(0, 16), pay_type: r[ix('Type')], segment: r[ix('Customer Segment')], country: r[ix('Order Country')], category: r[ix('Category Name')], qty: +r[ix('Order Item Quantity')], sales: +r[ix('Sales')], profit: +r[ix('Benefit per order')], lines: +r[ix('n_line_items')], distinct: +r[ix('n_distinct_categories')], region: r[ix('Order Region')] }, 1, false)
  worst = Math.max(worst, Math.abs(res.p - o.p)); if (res.tier !== o.tier) tierBad++; n++
}
console.log(`orders ${n}, max |dp| ${worst.toExponential(2)}, tier mismatches ${tierBad}`)
if (n !== 11836 || worst > 1e-3 || tierBad > 0) { console.error('FAILED'); process.exit(1) }
console.log('OK')
