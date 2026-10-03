import { StatTile } from '../components/viz'
import { useState } from 'react'
import { scoreFile, getLookups } from '../api'
import { CheckInput } from '../types'
import { Card, TierChip } from '../components/ui'
import { countryEn, countryEs } from '../static/names'
import { money, moneyK, num, pct } from '../format'

const MODES = ['Standard Class', 'Second Class', 'First Class', 'Same Day'], SEG = ['Consumer', 'Corporate', 'Home Office']
const PAYMAP: Record<string, string> = { debit: 'DEBIT', 'debit card': 'DEBIT', cash: 'CASH', payment: 'PAYMENT', 'card payment': 'PAYMENT', card: 'PAYMENT', transfer: 'TRANSFER', 'bank transfer': 'TRANSFER' }
const TEMPLATE = `order_id,shipping_option,date_time,payment,customer_type,country,product_category,items,order_value
A-1001,Same Day,2026-10-05 15:30,Debit card,Consumer,United States,Women's Apparel,6,640
A-1002,Same Day,2026-10-05 09:10,Debit card,Consumer,United States,Women's Apparel,3,250
A-1003,Standard Class,2026-10-06 11:00,Bank transfer,Corporate,France,Cleats,4,380
A-1004,First Class,2026-10-06 13:45,Card payment,Home Office,Mexico,Electronics,2,120
A-1005,Second Class,2026-10-07 08:20,Cash,Consumer,Brazil,Fishing,9,910
`

function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = [], cur = '', q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++ } else q = false } else cur += c }
    else if (c === '"') q = true
    else if (c === ',') { row.push(cur); cur = '' }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cur); cur = ''; if (row.some(x => x.trim())) rows.push(row); row = [] }
    else cur += c
  }
  row.push(cur); if (row.some(x => x.trim())) rows.push(row)
  return rows
}
const norm = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
const csvCell = (v: unknown) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
const download = (name: string, text: string) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv' })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000) }

interface Out { id: string; line: number; input: CheckInput; p: number; sales: number; priority: number; tier: string; flag: boolean }

export default function ScoreFile() {
  const [out, setOut] = useState<Out[] | null>(null); const [errs, setErrs] = useState<string[]>([]); const [busy, setBusy] = useState(false); const [name, setName] = useState(''); const [over, setOver] = useState(false)
  const [tier, setTier] = useState('All'); const [limit, setLimit] = useState(25)

  async function handle(file: File) {
    setBusy(true); setErrs([]); setOut(null); setName(file.name)
    try {
      const info = await getLookups(); const known = Object.fromEntries(info.countries.map(c => [c, 1])); const cats = new Map(info.categories.map(c => [c.toLowerCase(), c]))
      const rows = parseCsv(await file.text()); if (rows.length < 2) throw new Error('The file has no rows.')
      const head = rows[0].map(norm); const idx = (...names: string[]) => head.findIndex(h => names.includes(h))
      const col = { id: idx('order_id', 'id', 'order'), mode: idx('shipping_option', 'shipping_mode', 'shipping'), when: idx('date_time', 'datetime', 'order_date', 'date', 'placed_at'), pay: idx('payment', 'payment_type', 'type'), seg: idx('customer_type', 'customer_segment', 'segment'), country: idx('country', 'order_country'), cat: idx('product_category', 'category', 'category_name'), qty: idx('items', 'quantity', 'number_of_items'), sales: idx('order_value', 'sales', 'value') }
      const missing = Object.entries(col).filter(([k, v]) => v < 0 && k !== 'id').map(([k]) => ({ mode: 'shipping_option', when: 'date_time', pay: 'payment', seg: 'customer_type', country: 'country', cat: 'product_category', qty: 'items', sales: 'order_value' } as Record<string, string>)[k])
      if (missing.length) throw new Error(`Missing column${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}. Download the template to see the layout.`)
      const good: { id: string; line: number; input: CheckInput }[] = [], bad: string[] = []
      rows.slice(1).forEach((r, i) => {
        const line = i + 2, get = (k: number) => (r[k] ?? '').trim()
        const mode = MODES.find(m => m.toLowerCase() === get(col.mode).toLowerCase()); const seg = SEG.find(m => m.toLowerCase() === get(col.seg).toLowerCase())
        const pay = PAYMAP[get(col.pay).toLowerCase()] ?? (['CASH', 'DEBIT', 'PAYMENT', 'TRANSFER'].includes(get(col.pay).toUpperCase()) ? get(col.pay).toUpperCase() : '')
        const cat = cats.get(get(col.cat).toLowerCase()) ?? get(col.cat); const when = get(col.when).replace(' ', 'T').slice(0, 16)
        const qty = Number(get(col.qty)), sales = Number(get(col.sales))
        const why = !mode ? `shipping_option "${get(col.mode)}" must be one of ${MODES.join(', ')}` : !seg ? `customer_type "${get(col.seg)}" must be one of ${SEG.join(', ')}` : !pay ? `payment "${get(col.pay)}" is not recognised` : isNaN(new Date(when).getTime()) ? `date_time "${get(col.when)}" is not a date` : !(qty > 0) ? 'items must be above zero' : !(sales > 0) ? 'order_value must be above zero' : !get(col.country) ? 'country is empty' : ''
        if (why) bad.push(`Row ${line}: ${why}`)
        else good.push({ id: col.id >= 0 ? get(col.id) || String(line - 1) : String(line - 1), line, input: { mode: mode!, when, pay_type: pay, segment: seg!, country: countryEs(get(col.country), known), category: cat, qty, sales } })
      })
      const sc = await scoreFile(good.map(g => g.input))
      const res = good.map((g, i) => ({ ...g, ...sc[i] })).sort((a, b) => b.priority - a.priority)
      setOut(res); setErrs(bad); setTier('All'); setLimit(25)
    } catch (e: any) { setErrs([String(e.message || e)]) } finally { setBusy(false) }
  }
  const shown = out ? out.filter(o => tier === 'All' || o.tier === tier) : []
  const count = (t: string) => out?.filter(o => o.tier === t).length ?? 0
  const save = () => out && download('heads-up-results.csv', 'rank,order_id,tier,chance_late,order_value,priority_score,shipping_option,date_time,country,product_category\n' + out.map((o, i) => [i + 1, o.id, o.tier, o.p.toFixed(4), o.sales, o.priority.toFixed(2), o.input.mode, o.input.when.replace('T', ' '), countryEn(o.input.country), o.input.category].map(csvCell).join(',')).join('\n'))

  return (
    <div className="grid">
      <Card title="Score a whole file" lead="Upload a CSV of new orders. We rank them so you know which to handle first. The file never leaves your browser.">
        <label className={`dropzone ${over ? 'over' : ''}`} onDragOver={e => { e.preventDefault(); setOver(true) }} onDragLeave={() => setOver(false)} onDrop={e => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files[0]; if (f) handle(f) }}>
          <input type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handle(f); e.target.value = '' }} />
          {busy ? 'Scoring…' : <><b style={{ color: 'var(--ink)' }}>Drop a CSV here</b> or click to choose one<br /><span className="note">{name || 'Columns: shipping_option, date_time, payment, customer_type, country, product_category, items, order_value'}</span></>}
        </label>
        <div className="pill-row" style={{ marginTop: 12 }}>
          <button className="btn" onClick={() => download('heads-up-template.csv', TEMPLATE)}>Download the template</button>
          {out && <button className="btn primary" onClick={save}>Download results</button>}
        </div>
        {errs.length > 0 && <div className="callout crit" style={{ marginTop: 14 }}><b>{out ? `${errs.length} row${errs.length > 1 ? 's' : ''} skipped` : 'Could not score the file'}</b>{errs.slice(0, 6).map((e, i) => <div key={i}>{e}</div>)}{errs.length > 6 && <div>and {errs.length - 6} more.</div>}</div>}
      </Card>
      {out && <>
        <div className="grid g4">
          <StatTile label="Scored" value={<>{num(out.length)}</>} sub={<>orders</>} />
          <StatTile label="Likely late" value={<>{num(out.filter(o => o.flag).length)}</>} sub={<>{pct(out.filter(o => o.flag).length / Math.max(out.length, 1))} of the file</>} />
          <StatTile label="Act today or this week" value={<>{count('Critical') + count('High')}</>} sub={<>{count('Critical')} critical, {count('High')} high</>} />
          <StatTile label="Money at risk" value={<>{moneyK(out.reduce((a, o) => a + o.priority, 0))}</>} sub={<>chance late × value</>} />
        </div>
        <Card title="Ranked list" lead="Highest priority first." right={<div className="tabs">{['All', 'Critical', 'High', 'Standard'].map(t => <button key={t} className={tier === t ? 'on' : ''} onClick={() => { setTier(t); setLimit(25) }}>{t}</button>)}</div>}>
          <div style={{ overflowX: 'auto' }}><table className="t"><thead><tr><th>#</th><th>Order</th><th>Tier</th><th>Chance late</th><th>Value</th><th>Shipping</th><th>Placed</th><th>Country</th></tr></thead><tbody>
            {shown.slice(0, limit).map((o, i) => <tr key={o.line}><td className="num">{i + 1}</td><td>{o.id}</td><td><TierChip tier={o.tier} /></td><td className="num"><b>{pct(o.p)}</b></td><td className="num">{money(o.sales)}</td><td>{o.input.mode}</td><td className="num">{o.input.when.replace('T', ' ')}</td><td>{countryEn(o.input.country)}</td></tr>)}
          </tbody></table></div>
          {shown.length > limit && <button className="more" style={{ marginTop: 10 }} onClick={() => setLimit(l => l + 25)}>Show 25 more ({limit} of {num(shown.length)})</button>}
        </Card>
      </>}
    </div>
  )
}
