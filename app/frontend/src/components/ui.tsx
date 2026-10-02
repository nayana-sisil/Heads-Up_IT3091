import { ReactNode, useRef, useState } from 'react'
import { Tier, OrderRow } from '../types'
import { money, pct, shortDate, timeOf } from '../format'
import { useApp } from '../state'

export const tierColor = (t: string) => t === 'Critical' ? 'var(--crit)' : t === 'High' ? 'var(--high)' : 'var(--std)'
export const riskColor = (p: number) => p >= 0.75 ? 'var(--crit)' : p >= 0.5 ? 'var(--high)' : p >= 0.3 ? 'var(--brand)' : 'var(--good)'
export const TierChip = ({ tier }: { tier: Tier | string }) => <span className={`chip ${tier}`}><i className="dot" style={{ background: tierColor(tier) }} />{tier}</span>

export function Gauge({ value, size = 150, label = 'chance late' }: { value: number; size?: number; label?: string }) {
  const r = 52, cx = 70, cy = 66; const x1 = cx - r, x2 = cx + r
  const d = `M ${x1} ${cy} A ${r} ${r} 0 0 1 ${x2} ${cy}`
  return (
    <svg width={size} height={size * 0.62} viewBox="0 0 140 86" role="img" aria-label={`${pct(value)} ${label}`}>
      <path d={d} fill="none" stroke="var(--bg2)" strokeWidth="12" strokeLinecap="round" />
      <path d={d} fill="none" stroke={riskColor(value)} strokeWidth="12" strokeLinecap="round" pathLength={100} strokeDasharray={`${Math.max(value * 100, 1)} 100`} style={{ transition: 'stroke-dasharray .6s cubic-bezier(.2,.8,.2,1), stroke .3s' }} />
      <text x={cx} y={cy - 6} textAnchor="middle" fontSize="26" fontWeight="800" fill="var(--ink)" style={{ letterSpacing: '-0.03em' }}>{Math.round(value * 100)}%</text>
      <text x={cx} y={cy + 12} textAnchor="middle" fontSize="9.5" fill="var(--ink3)" style={{ textTransform: 'uppercase', letterSpacing: '.08em' }}>{label}</text>
    </svg>
  )
}

export function Card({ title, lead, children, className = '', right }: { title?: string; lead?: string; children: ReactNode; className?: string; right?: ReactNode }) {
  return (
    <section className={`card ${className}`}>
      {(title || right) && <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}><div style={{ flex: 1 }}>{title && <h3>{title}</h3>}{lead && <p className="lead">{lead}</p>}</div>{right}</div>}
      {children}
    </section>
  )
}

export function Skeleton({ h = 120 }: { h?: number }) { return <div className="skel" style={{ height: h }} /> }

export function Bars({ rows, fmt = (v: number) => String(v), max, color }: { rows: { label: string; value: number; sub?: string }[]; fmt?: (v: number) => string; max?: number; color?: string }) {
  const m = max ?? Math.max(...rows.map(r => r.value), 1e-9)
  return <div>{rows.map(r => (
    <div className="barrow" key={r.label}>
      <div className="lbl" title={r.label}>{r.label}</div>
      <div className="track"><div className="fill" style={{ width: `${Math.max(2, (r.value / m) * 100)}%`, background: color }} /></div>
      <div className="val num">{fmt(r.value)}</div>
    </div>))}</div>
}

export function OrderCard({ o, onOpen }: { o: OrderRow; onOpen: () => void }) {
  const { reveal } = useApp()
  return (
    <button className={`ocard ${o.tier}`} onClick={onOpen}>
      <div className="r1"><span className="id num">#{o.id}</span><span className="chip">{o.mode}</span></div>
      <div className="why">{o.why}</div>
      <div className="r3">
        <div className="rbar" title={`${pct(o.p)} chance of late`}><i style={{ width: `${o.p * 100}%`, background: riskColor(o.p) }} /></div>
        <span className="num" style={{ fontWeight: 700 }}>{pct(o.p)}</span>
        <span className="num muted">{money(o.sales)}</span>
      </div>
      <div className="r3" style={{ marginTop: 7, justifyContent: 'space-between' }}>
        <span className="dim">{o.city}, {o.country} · {shortDate(o.date)} {timeOf(o.date)}</span>
        {reveal && <span className={`chip ${o.late ? 'Critical' : 'good'}`}>{o.late ? 'Was late' : 'On time'}</span>}
      </div>
    </button>
  )
}

/* Line chart with hover crosshair. values are 0..1, x runs 0..1 across the array. */
export interface Series { name: string; color: string; values: number[]; dash?: string; width?: number }
export function LineChart({ series, height = 300, marker, xTitle, yTitle, xMax = 1, xFmt = (x: number) => `${+(x * 100).toFixed(1)}%`, ticks = [0, .25, .5, .75, 1], tipTitle }: { series: Series[]; height?: number; marker?: number; xTitle: string; yTitle: string; xMax?: number; xFmt?: (x: number) => string; ticks?: number[]; tipTitle?: (x: string) => string }) {
  const W = 760, H = height, L = 46, R = 14, T = 12, B = 38
  const ref = useRef<SVGSVGElement>(null); const [hov, setHov] = useState<number | null>(null)
  const n = series[0].values.length - 1
  const X = (i: number) => L + (i / n) * (W - L - R); const Y = (v: number) => T + (1 - v) * (H - T - B)
  const onMove = (e: React.MouseEvent) => {
    const b = ref.current!.getBoundingClientRect(); const x = ((e.clientX - b.left) / b.width) * W
    setHov(Math.max(0, Math.min(n, Math.round(((x - L) / (W - L - R)) * n))))
  }
  const mk = marker !== undefined ? Math.round(marker * n) : null
  return (
    <div style={{ position: 'relative' }}>
      <svg ref={ref} className="chart" viewBox={`0 0 ${W} ${H}`} width="100%" onMouseMove={onMove} onMouseLeave={() => setHov(null)} role="img" aria-label={`${yTitle} against ${xTitle}`}>
        {[0, .25, .5, .75, 1].map(v => <g key={v}><line className="ax" x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} strokeDasharray={v === 0 ? '' : '3 4'} /><text x={L - 8} y={Y(v) + 4} textAnchor="end">{Math.round(v * 100)}%</text></g>)}
        {ticks.map(v => <text key={v} x={X(v * n)} y={H - 18} textAnchor="middle">{xFmt(v * xMax)}</text>)}
        <text x={(L + W - R) / 2} y={H - 3} textAnchor="middle">{xTitle}</text>
        <text transform={`translate(11 ${(T + H - B) / 2}) rotate(-90)`} textAnchor="middle">{yTitle}</text>
        {mk !== null && <line x1={X(mk)} x2={X(mk)} y1={T} y2={H - B} stroke="var(--brand)" strokeWidth="1.5" strokeDasharray="4 4" />}
        {series.map(s => <path key={s.name} d={s.values.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(v).toFixed(1)}`).join(' ')} fill="none" stroke={s.color} strokeWidth={s.width ?? 2} strokeDasharray={s.dash} strokeLinejoin="round" strokeLinecap="round" />)}
        {mk !== null && series.map(s => <circle key={s.name} cx={X(mk)} cy={Y(s.values[mk])} r={s.width && s.width > 2.5 ? 5.5 : 3.5} fill={s.color} stroke="var(--card)" strokeWidth="2" />)}
        {hov !== null && <line x1={X(hov)} x2={X(hov)} y1={T} y2={H - B} stroke="var(--ink3)" strokeWidth="1" />}
      </svg>
      {hov !== null && (
        <div className="tip" style={{ left: `${(X(hov) / W) * 100}%`, top: 8, transform: X(hov) > W * 0.6 ? 'translateX(calc(-100% - 12px))' : 'translateX(12px)' }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>{tipTitle ? tipTitle(xFmt((hov / n) * xMax)) : `${xFmt((hov / n) * xMax)} of orders reviewed`}</div>
          {series.map(s => <div key={s.name} style={{ display: 'flex', gap: 8, alignItems: 'center' }}><i className="dot" style={{ background: s.color }} /><span style={{ flex: 1 }}>{s.name}</span><b className="num">{pct(s.values[hov], 1)}</b></div>)}
        </div>)}
    </div>
  )
}
export const ChartLegend = ({ series }: { series: Series[] }) => (
  <div className="legend" style={{ marginTop: 6 }}>{series.map(s => <span key={s.name} style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
    <svg width="22" height="8"><line x1="1" x2="21" y1="4" y2="4" stroke={s.color} strokeWidth={s.width ?? 2} strokeDasharray={s.dash} strokeLinecap="round" /></svg>{s.name}</span>)}</div>
)

export function DriverBars({ drivers, max }: { drivers: { label: string; shap: number; value?: string }[]; max?: number }) {
  const m = max ?? Math.max(...drivers.map(d => Math.abs(d.shap)), 0.01)
  return <div>{drivers.map((d, i) => {
    const w = Math.min(50, (Math.abs(d.shap) / m) * 50)
    return (
      <div className="drv" key={i}>
        <div className="lbl" title={d.label}>{d.label}{d.value ? <span className="dim"> · {d.value}</span> : null}</div>
        <div className="dtrack"><div className="dbar" style={d.shap >= 0 ? { left: '50%', width: `${w}%`, background: 'var(--crit)' } : { right: '50%', width: `${w}%`, background: 'var(--good)' }} /></div>
        <div className="num" style={{ textAlign: 'right', color: d.shap >= 0 ? 'var(--crit)' : 'var(--good)', fontWeight: 600 }}>{d.shap > 0 ? '+' : ''}{d.shap.toFixed(2)}</div>
      </div>)
  })}
    <div className="note" style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}><span>◀ lowers the risk</span><span>raises the risk ▶</span></div></div>
}

/* Calibration: predicted chance (x) against what really happened (y), per risk group. */
export function CalibrationChart({ lines }: { lines: { name: string; color: string; pts: { pred: number; actual: number }[] }[] }) {
  const W = 420, H = 320, L = 48, R = 14, T = 12, B = 44
  const X = (v: number) => L + v * (W - L - R), Y = (v: number) => T + (1 - v) * (H - T - B)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" className="chart" role="img" aria-label="Predicted chance against share really late" style={{ fontSize: 12 }}>
      {[0, .25, .5, .75, 1].map(v => <g key={v}><line className="ax" x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} strokeDasharray={v ? '3 4' : ''} /><text x={L - 8} y={Y(v) + 4} textAnchor="end" style={{ fontSize: 12 }}>{v * 100}%</text><text x={X(v)} y={H - 24} textAnchor="middle" style={{ fontSize: 12 }}>{v * 100}%</text></g>)}
      <text x={(L + W - R) / 2} y={H - 4} textAnchor="middle" style={{ fontSize: 12 }}>Chance of late predicted by the model</text>
      <text transform={`translate(13 ${(T + H - B) / 2}) rotate(-90)`} textAnchor="middle" style={{ fontSize: 12 }}>Share really late</text>
      <line x1={X(0)} y1={Y(0)} x2={X(1)} y2={Y(1)} stroke="var(--ink3)" strokeDasharray="5 5" />
      {lines.map(l => <g key={l.name}>
        <path d={l.pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.pred).toFixed(1)} ${Y(p.actual).toFixed(1)}`).join(' ')} fill="none" stroke={l.color} strokeWidth="2.6" strokeLinejoin="round" />
        {l.pts.map((p, i) => <circle key={i} cx={X(p.pred)} cy={Y(p.actual)} r="4" fill={l.color} stroke="var(--card)" strokeWidth="1.5"><title>{`${l.name}: predicted ${Math.round(p.pred * 100)}%, really late ${Math.round(p.actual * 100)}%`}</title></circle>)}
      </g>)}
    </svg>
  )
}
