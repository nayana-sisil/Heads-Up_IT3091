import { ReactNode, useEffect, useRef, useState } from 'react'
import { Icon } from './Icons'

/* Count a number up when it first appears on screen. Respects reduced motion. */
export function useCount(to: number, ms = 900) {
  const [v, setV] = useState(to); const ref = useRef<HTMLElement | null>(null)
  useEffect(() => {
    const el = ref.current
    if (!el || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || typeof IntersectionObserver === 'undefined') { setV(to); return }
    setV(0); let raf = 0
    const io = new IntersectionObserver(es => {
      if (!es[0].isIntersecting) return; io.disconnect(); const t0 = performance.now()
      const step = (t: number) => { const k = Math.min(1, (t - t0) / ms); setV(to * (1 - Math.pow(1 - k, 3))); if (k < 1) raf = requestAnimationFrame(step) }
      raf = requestAnimationFrame(step)
    })
    io.observe(el); return () => { io.disconnect(); cancelAnimationFrame(raf) }
  }, [to, ms])
  return [v, ref] as const
}
export function CountNum({ to, fmt = (v: number) => String(Math.round(v)) }: { to: number; fmt?: (v: number) => string }) {
  const [v, ref] = useCount(to)
  return <span ref={ref as any} className="num">{fmt(v)}</span>
}

/* Icon tile with a big number. `value` may be text, or pass `to` + `fmt` to count up. */
export function StatTile({ icon, label, value, to, fmt, sub, color = 'var(--acc, var(--brand))' }: { icon?: string; label: string; value?: ReactNode; to?: number; fmt?: (v: number) => string; sub?: ReactNode; color?: string }) {
  return (
    <div className="stile" style={{ ['--c' as any]: color }}>
      {icon && <span className="ico"><Icon name={icon} size={20} /></span>}
      <div className="sv">{to !== undefined ? <CountNum to={to} fmt={fmt} /> : value}</div>
      <div className="sl">{label}</div>
      {sub && <div className="ss">{sub}</div>}
    </div>
  )
}

/* 100 dots. Each category fills dots in order; used to show "out of 100 orders". */
export interface DotCat { n: number; color: string; label: string }
export function Dots100({ cats, cols = 10, size = 22 }: { cats: DotCat[]; cols?: number; size?: number }) {
  const total = cats.reduce((a, c) => a + c.n, 0), dots: DotCat[] = []
  cats.forEach(c => { for (let i = 0; i < c.n; i++) dots.push(c) })
  const w = cols * size
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${Math.ceil(total / cols) * size}`} width="100%" style={{ maxWidth: 360 }} role="img" aria-label={cats.map(c => `${c.n} ${c.label}`).join(', ')}>
        {dots.map((c, i) => <circle key={i} cx={(i % cols) * size + size / 2} cy={Math.floor(i / cols) * size + size / 2} r={size * 0.36} fill={c.color} className="pop" style={{ animationDelay: `${i * 6}ms` }}><title>{c.label}</title></circle>)}
      </svg>
      <div className="legend" style={{ marginTop: 10 }}>{cats.filter(c => c.n > 0).map(c => <span key={c.label}><i className="sw" style={{ background: c.color }} /><b>{c.n}</b> {c.label}</span>)}</div>
    </div>
  )
}

/* A row of icon steps joined by arrows. */
export interface FlowNode { icon: string; title: string; text?: ReactNode; color?: string }
export function Flow({ nodes, vertical = false }: { nodes: FlowNode[]; vertical?: boolean }) {
  return (
    <div className={`vflow ${vertical ? 'v' : ''}`}>
      {nodes.map((n, i) => (
        <div key={i} className="vnode-wrap">
          <div className="vnode" style={{ ['--c' as any]: n.color ?? 'var(--acc, var(--brand))' }}>
            <span className="ico"><Icon name={n.icon} size={22} /></span>
            <b>{n.title}</b>{n.text && <div className="muted">{n.text}</div>}
          </div>
          {i < nodes.length - 1 && <span className="varrow"><Icon name="arrow" size={18} /></span>}
        </div>
      ))}
    </div>
  )
}

/* Vertical timeline with coloured icon dots. */
export interface TLItem { icon?: string; title: string; text?: ReactNode; tag?: string; color?: string }
export function Timeline({ items }: { items: TLItem[] }) {
  return (
    <ol className="tl">{items.map((it, i) => (
      <li key={i} style={{ ['--c' as any]: it.color ?? 'var(--acc, var(--brand))' }}>
        <span className="dotico">{it.icon ? <Icon name={it.icon} size={16} /> : i + 1}</span>
        <div><b>{it.title}</b>{it.tag && <span className="tag">{it.tag}</span>}{it.text && <div className="muted">{it.text}</div>}</div>
      </li>))}</ol>
  )
}

/* Ring gauge for a 0 to 1 value. */
export function Ring({ value, label, color = 'var(--acc, var(--brand))', size = 120, fmt }: { value: number; label: string; color?: string; size?: number; fmt?: (v: number) => string }) {
  const r = 44, c = 2 * Math.PI * r
  return (
    <div className="ringbox" style={{ width: size }}>
      <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label={`${label}: ${Math.round(value * 100)}%`}>
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--bg2)" strokeWidth="9" />
        <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="9" strokeLinecap="round" strokeDasharray={`${c * value} ${c}`} transform="rotate(-90 50 50)" className="ringfill" />
        <text x="50" y="56" textAnchor="middle" fontSize="21" fontWeight="800" fill="var(--ink)">{fmt ? fmt(value) : `${Math.round(value * 100)}%`}</text>
      </svg>
      <div className="rl">{label}</div>
    </div>
  )
}

/* Heatmap: rows x cols of 0..1 values, one hue, light to strong. */
export function Heat({ rows, cols, vals, color = 'var(--crit)', fmt = (v: number) => `${Math.round(v * 100)}%`, colLabelEvery = 1, unit = 'late' }: { rows: string[]; cols: string[]; vals: (number | null)[][]; color?: string; fmt?: (v: number) => string; colLabelEvery?: number; unit?: string }) {
  const L = 92, T = 6, B = 24, cw = Math.max(14, Math.floor((640 - L) / cols.length)), ch = 34
  const W = L + cw * cols.length, H = T + ch * rows.length + B
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" className="chart" role="img" aria-label="Heatmap" style={{ fontSize: 11 }}>
      {rows.map((r, i) => <text key={r} x={L - 8} y={T + i * ch + ch / 2 + 4} textAnchor="end">{r}</text>)}
      {rows.map((_, i) => cols.map((c, j) => { const v = vals[i][j]; return v === null ? null :
        <rect key={`${i}-${j}`} x={L + j * cw + 1} y={T + i * ch + 1} width={cw - 2} height={ch - 2} rx="4" fill={color} fillOpacity={0.08 + 0.92 * v}><title>{`${rows[i]}, ${c}: ${fmt(v)} ${unit}`}</title></rect> }))}
      {cols.map((c, j) => j % colLabelEvery === 0 && <text key={c} x={L + j * cw + cw / 2} y={H - 8} textAnchor="middle">{c}</text>)}
    </svg>
  )
}

/* Confusion matrix as four coloured blocks sized by share. */
export function ConfMatrix({ tp, fp, fn, tn }: { tp: number; fp: number; fn: number; tn: number }) {
  const tot = tp + fp + fn + tn; const f = (n: number) => n.toLocaleString('en-US'); const s = (n: number) => `${((n / tot) * 100).toFixed(1)}% of orders`
  const cell = (n: number, t: string, d: string, c: string) => <div className="cm" style={{ ['--c' as any]: c, background: `color-mix(in srgb, ${c} ${12 + 40 * Math.sqrt(n / tot)}%, var(--card2))` }} title={s(n)}><div className="cn num">{f(n)}</div><b>{t}</b><span>{d}</span></div>
  return (
    <div className="cmgrid">
      <div className="ax1" /><div className="axh">Flagged late</div><div className="axh">Not flagged</div>
      <div className="axv">Really late</div>{cell(tp, 'Caught', 'late and flagged', 'var(--good)')}{cell(fn, 'Missed', 'late, not flagged', 'var(--crit)')}
      <div className="axv">On time</div>{cell(fp, 'False alarm', 'on time but flagged', 'var(--high)')}{cell(tn, 'Correct pass', 'on time, not flagged', 'var(--brand)')}
    </div>
  )
}

/* Dot plot: one dot per item on a shared axis, optional dashed reference line. */
export function DotPlot({ rows, min, max, refLine, refLabel, fmt = (v: number) => v.toFixed(3), color = 'var(--acc, var(--brand))', width = 560 }: { rows: { label: string; value: number; color?: string; note?: string }[]; min: number; max: number; refLine?: number; refLabel?: string; fmt?: (v: number) => string; color?: string; width?: number }) {
  const L = 132, R = 52, rh = 30, T = 8, W = width, H = T + rows.length * rh + 22
  const X = (v: number) => L + ((v - min) / (max - min)) * (W - L - R)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" className="chart" role="img" aria-label="Dot plot" style={{ fontSize: 13.5 }}>
      {[0, .25, .5, .75, 1].map(k => { const v = min + k * (max - min); return <g key={k}><line className="ax" x1={X(v)} x2={X(v)} y1={T} y2={H - 20} strokeDasharray="3 4" /><text x={X(v)} y={H - 6} textAnchor="middle">{fmt(v)}</text></g> })}
      {refLine !== undefined && <g><line x1={X(refLine)} x2={X(refLine)} y1={T} y2={H - 20} stroke="var(--high)" strokeWidth="1.5" strokeDasharray="5 4" /><text x={X(refLine) + 4} y={T + 9} fill="var(--high)" style={{ fill: 'var(--high)' }}>{refLabel}</text></g>}
      {rows.map((r, i) => { const y = T + i * rh + rh / 2; return <g key={r.label}>
        <text x={L - 10} y={y + 4} textAnchor="end" style={{ fill: 'var(--ink2)' }}>{r.label}</text>
        <line x1={X(min)} x2={X(r.value)} y1={y} y2={y} stroke={r.color ?? color} strokeWidth="2" strokeOpacity=".45" strokeLinecap="round" />
        <circle cx={X(r.value)} cy={y} r="6" fill={r.color ?? color} stroke="var(--card)" strokeWidth="2"><title>{`${r.label}: ${fmt(r.value)}${r.note ? '. ' + r.note : ''}`}</title></circle>
        <text x={X(r.value) + 11} y={y + 4} style={{ fill: 'var(--ink)', fontWeight: 600 }}>{fmt(r.value)}</text>
      </g> })}
    </svg>
  )
}

/* Waterfall: base value, then each driver pushes the number up or down. Values in probability points. */
export function Waterfall({ base, steps, baseLabel = 'Typical order', endLabel = 'This order' }: { base: number; steps: { label: string; delta: number }[]; baseLabel?: string; endLabel?: string }) {
  const rows = [{ label: baseLabel, from: 0, to: base, kind: 'base' as const }]
  let cur = base; steps.forEach(s => { rows.push({ label: s.label, from: cur, to: cur + s.delta, kind: s.delta >= 0 ? 'up' as any : 'down' as any }); cur += s.delta })
  rows.push({ label: endLabel, from: 0, to: cur, kind: 'end' as any })
  const L = 150, R = 50, rh = 32, W = 640, H = rows.length * rh + 10, X = (v: number) => L + Math.max(0, Math.min(1, v)) * (W - L - R)
  const col = (k: string) => k === 'up' ? 'var(--crit)' : k === 'down' ? 'var(--good)' : k === 'end' ? 'var(--brand)' : 'var(--std)'
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" className="chart" role="img" aria-label="What pushed the risk up or down" style={{ fontSize: 14 }}>
      {rows.map((r, i) => { const y = 4 + i * rh, a = Math.min(r.from, r.to), b = Math.max(r.from, r.to); return <g key={i}>
        <text x={L - 10} y={y + rh / 2 + 3} textAnchor="end" style={{ fill: 'var(--ink2)' }}>{r.label}</text>
        <rect x={X(a)} y={y + 4} width={Math.max(2, X(b) - X(a))} height={rh - 10} rx="4" fill={col(r.kind)}><title>{`${r.label}: ${(r.kind === 'base' || r.kind === 'end') ? Math.round(r.to * 100) + '%' : (r.to >= r.from ? '+' : '') + Math.round((r.to - r.from) * 100) + ' points'}`}</title></rect>
        <text x={X(b) + 7} y={y + rh / 2 + 3} style={{ fill: 'var(--ink)', fontWeight: 600 }}>{(r.kind === 'base' || r.kind === 'end') ? `${Math.round(r.to * 100)}%` : `${r.to >= r.from ? '+' : ''}${Math.round((r.to - r.from) * 100)}`}</text>
      </g> })}
    </svg>
  )
}

/* Coloured icon cards in a grid; replaces plain bullet lists. */
export interface IconCard { icon: string; title: string; text: ReactNode; color?: string }
export function IconCards({ items, cols = 3 }: { items: IconCard[]; cols?: number }) {
  return <div className="icards" style={{ ['--cols' as any]: cols }}>{items.map((it, i) => (
    <div key={i} className="icard" style={{ ['--c' as any]: it.color ?? 'var(--acc, var(--brand))' }}>
      <span className="ico"><Icon name={it.icon} size={20} /></span><b>{it.title}</b><div className="muted">{it.text}</div>
    </div>))}</div>
}

export const Tag = ({ children, color }: { children: ReactNode; color?: string }) => <span className="tag" style={color ? { ['--c' as any]: color } : undefined}>{children}</span>
