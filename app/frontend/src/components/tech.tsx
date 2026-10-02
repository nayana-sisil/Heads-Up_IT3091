import { ReactNode } from 'react'
import { useData } from '../data'
import { Card } from './ui'
import { useApp } from '../state'
import { PAGES, pageOf } from '../nav'
import { Icon } from './Icons'
import { StatTile, Timeline } from './viz'

export interface HeroChip { icon?: string; k: ReactNode; l: string }
/* Page banner: stage badge, one big takeaway, a short explanation and up to three stat chips. */
export function PageHead({ stage, nb, line, big, chips }: { stage: string; nb: string; line: string; big?: string; chips?: HeroChip[] }) {
  const { page } = useApp(); const cur = pageOf(page); const num = cur?.label.match(/^(\d+)\./)?.[1]
  return (
    <section className="phero">
      {num && <div className="wm" aria-hidden>{num}</div>}
      <div className="badge">{cur && <Icon name={cur.icon} size={15} />}{stage}</div>
      <h2>{big ?? line}</h2>
      {big && <p className="sub2">{line}</p>}
      <div className="srcline">Source: {nb}</div>
      {chips && chips.length > 0 && <div className="hchips">{chips.map((c, i) => <div key={i} className="hchip">{c.icon && <Icon name={c.icon} size={18} />}<div><div className="hk num">{c.k}</div><div className="hl">{c.l}</div></div></div>)}</div>}
    </section>
  )
}

/* Stage stepper (1 to 10) and previous/next links for the "How it was built" pages. */
export function Stepper() {
  const { page, go } = useApp(); const stages = PAGES.filter(p => /^\d+\./.test(p.label)); const i = stages.findIndex(p => p.id === page)
  if (i < 0) return null
  return (
    <div className="stepper" role="navigation" aria-label="Project stages">
      {stages.map((p, k) => <button key={p.id} className={`st ${k === i ? 'on' : k < i ? 'done' : ''}`} style={{ ['--c' as any]: p.acc }} onClick={() => go(p.id)} title={p.label} aria-current={k === i ? 'step' : undefined}>
        <span className="sn">{k < i ? <Icon name="check" size={14} /> : k + 1}</span><span className="sname">{p.title.split(' ')[0]}</span></button>)}
    </div>
  )
}
export function PrevNext() {
  const { page, go } = useApp(); const stages = PAGES.filter(p => /^\d+\./.test(p.label)); const i = stages.findIndex(p => p.id === page)
  if (i < 0) return null
  const prev = stages[i - 1], next = stages[i + 1] ?? pageOf('decisions')
  return (
    <div className="prevnext">
      {prev ? <button onClick={() => go(prev.id)} style={{ ['--c' as any]: prev.acc }}><Icon name="back" size={18} /><span><small>Previous</small>{prev.label}</span></button> : <span />}
      {next && <button onClick={() => go(next.id)} style={{ ['--c' as any]: next.acc, textAlign: 'right' }}><span><small>Next</small>{next.label}</span><Icon name="arrow" size={18} /></button>}
    </div>
  )
}

export function Stat({ label, value, sub, icon, color }: { label: string; value: ReactNode; sub?: ReactNode; icon?: string; color?: string }) {
  return <StatTile icon={icon} label={label} value={value} sub={sub} color={color} />
}

export function Callout({ title, children, tone }: { title?: string; children: ReactNode; tone?: 'crit' | 'good' }) {
  return <div className={`callout ${tone === 'crit' ? 'crit' : ''}`} style={tone === 'good' ? { background: 'var(--good-soft)', borderColor: 'color-mix(in srgb,var(--good) 30%,transparent)' } : undefined}>{title && <b>{title}</b>}{children}</div>
}

/* Vertical bar chart with y axis. */
export interface Col { label: string; value: number; color?: string; tip?: string }
export function Columns({ items, max, fmt = (v: number) => `${Math.round(v * 100)}%`, height = 220, color = 'var(--brand)', showEvery = 1, yTitle, rotate }: { items: Col[]; max?: number; fmt?: (v: number) => string; height?: number; color?: string; showEvery?: number; yTitle?: string; rotate?: boolean }) {
  const W = 640, H = height, L = 50, R = 8, T = 10, B = rotate ? 58 : 34
  const m = max ?? Math.max(...items.map(i => i.value), 1e-9); const bw = (W - L - R) / items.length
  const Y = (v: number) => T + (1 - v / m) * (H - T - B)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" className="chart" role="img" aria-label={yTitle ?? 'Bar chart'} style={{ fontSize: 11 }}>
      {[0, .5, 1].map(v => <g key={v}><line className="ax" x1={L} x2={W - R} y1={Y(v * m)} y2={Y(v * m)} strokeDasharray={v ? '3 4' : ''} /><text x={L - 7} y={Y(v * m) + 4} textAnchor="end">{fmt(v * m)}</text></g>)}
      {items.map((it, i) => {
        const x = L + i * bw, h = (it.value / m) * (H - T - B)
        return <g key={i}>
          <rect x={x + bw * 0.14} y={T + (H - T - B) - h} width={bw * 0.72} height={Math.max(h, 1.5)} rx={Math.min(4, bw * 0.2)} fill={it.color ?? color}><title>{it.tip ?? `${it.label}: ${fmt(it.value)}`}</title></rect>
          {i % showEvery === 0 && (rotate
            ? <text transform={`translate(${x + bw / 2 + 3} ${H - B + 10}) rotate(40)`} textAnchor="start">{it.label}</text>
            : <text x={x + bw / 2} y={H - B + 16} textAnchor="middle">{it.label}</text>)}
        </g>
      })}
      {yTitle && <text transform={`translate(11 ${(T + H - B) / 2}) rotate(-90)`} textAnchor="middle">{yTitle}</text>}
    </svg>
  )
}

export function Tbl({ head, rows, num = [] }: { head: string[]; rows: ReactNode[][]; num?: number[] }) {
  return (
    <div style={{ overflowX: 'auto' }}><table className="t"><thead><tr>{head.map((h, i) => <th key={i} style={num.includes(i) ? { textAlign: 'right' } : undefined}>{h}</th>)}</tr></thead>
      <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className={num.includes(j) ? 'num' : ''} style={num.includes(j) ? { textAlign: 'right' } : undefined}>{c}</td>)}</tr>)}</tbody></table></div>
  )
}

export function Steps({ items }: { items: { title: string; text: ReactNode }[] }) {
  return <ol className="steps">{items.map((s, i) => <li key={i}><span className="n">{i + 1}</span><div><b>{s.title}</b><div className="muted">{s.text}</div></div></li>)}</ol>
}

/* Decision log entries that belong to a stage, straight from DECISION_LOG.md. Visible, not folded. */
export function Related({ stage }: { stage: string }) {
  const d = useData<any>('decisions.json'); const { go } = useApp()
  if (!d) return null
  const entries = d.stages.filter((s: any) => s.stage.startsWith(stage)).flatMap((s: any) => s.entries)
  if (!entries.length) return null
  return (
    <>
      <div className="sectitle">Decisions made in this stage ({entries.length})</div>
      <Card>
        <Timeline items={entries.map((e: any) => ({ icon: 'log', title: e.title, tag: e.date, text: <><span>{e.decision}</span><br /><span className="dim">Why: {e.reason}</span></> }))} />
        <button className="btn" onClick={() => go('decisions')}>Open the full decision log</button>
      </Card>
    </>
  )
}

export const fig = (file: string, alt: string, caption?: string) => (
  <figure style={{ margin: 0 }}><img src={`${import.meta.env.BASE_URL}img/${file}`} alt={alt} style={{ width: '100%', borderRadius: 10, background: '#fff' }} loading="lazy" />{caption && <figcaption className="note" style={{ marginTop: 6 }}>{caption}</figcaption>}</figure>
)
export const pc = (v: number, d = 1) => `${(v * 100).toFixed(d)}%`

/* Bars that go up or down from zero (for SHAP values). */
export function SignedColumns({ items, max, height = 220, showEvery = 1, series }: { items: { label: string; a: number | null; b?: number | null }[]; max?: number; height?: number; showEvery?: number; series?: [string, string] }) {
  const W = 640, H = height, L = 46, R = 8, T = 10, B = 30
  const m = max ?? Math.max(...items.flatMap(i => [Math.abs(i.a ?? 0), Math.abs(i.b ?? 0)]), 1e-9)
  const mid = T + (H - T - B) / 2, half = (H - T - B) / 2, bw = (W - L - R) / items.length
  const bar = (v: number, x: number, w: number, c: string) => <rect x={x} y={v >= 0 ? mid - (v / m) * half : mid} width={w} height={Math.max(Math.abs(v / m) * half, 1)} rx="2" fill={c}><title>{v.toFixed(2)}</title></rect>
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" className="chart" style={{ fontSize: 11 }} role="img" aria-label="Signed bars">
      {[1, 0, -1].map(v => <g key={v}><line className="ax" x1={L} x2={W - R} y1={mid - v * half} y2={mid - v * half} strokeDasharray={v ? '3 4' : ''} /><text x={L - 7} y={mid - v * half + 4} textAnchor="end">{(v * m).toFixed(1)}</text></g>)}
      {items.map((it, i) => <g key={i}>
        {it.a !== null && bar(it.a, L + i * bw + bw * 0.1, series ? bw * 0.4 : bw * 0.8, 'var(--crit)')}
        {series && it.b != null && bar(it.b, L + i * bw + bw * 0.5, bw * 0.4, 'var(--brand)')}
        {i % showEvery === 0 && <text x={L + i * bw + bw / 2} y={H - 10} textAnchor="middle">{it.label}</text>}
      </g>)}
    </svg>
  )
}
/* Resample an (x, y) curve onto an even grid so the shared LineChart can draw it. */
export function resample(pts: number[][], n = 100): number[] {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]); const out: number[] = []; let j = 0
  for (let i = 0; i <= n; i++) {
    const x = i / n; while (j < p.length - 2 && p[j + 1][0] < x) j++
    const [x0, y0] = p[j], [x1, y1] = p[Math.min(j + 1, p.length - 1)]
    out.push(x1 === x0 ? y1 : Math.max(0, Math.min(1, y0 + ((x - x0) / (x1 - x0)) * (y1 - y0))))
  }
  return out
}
