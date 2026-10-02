/* In-browser model: XGBoost trees, exact TreeSHAP and the same data logic as the Python API. */
export interface Tree { left: Int32Array; right: Int32Array; feat: Int32Array; cond: Float64Array; dl: Uint8Array; cover: Float64Array; depth: number }
export interface Engine {
  config: any; scaler: Record<string, { mean: number; std: number }>; features: string[]; trees: Tree[]; baseMargin: number; bias: number
  lookups: Lookups; orders: any[]; drivers: Map<number, any[]>; baseValue: number; raw: Map<number, Float64Array>; trust: any; rawCols: string[]
}
import type { Lookups } from './features'
const sigmoid = (z: number) => 1 / (1 + Math.exp(-z))

async function gz(url: string) {
  // Files end in .dat. Hosts may or may not gzip them on the way, so look at the first bytes.
  const r = await fetch(url); if (!r.ok) throw new Error(url)
  const buf = new Uint8Array(await r.arrayBuffer())
  if (buf[0] === 0x1f && buf[1] === 0x8b) {
    const ds = new DecompressionStream('gzip')
    return JSON.parse(await new Response(new Blob([buf]).stream().pipeThrough(ds)).text())
  }
  return JSON.parse(new TextDecoder().decode(buf))
}
const json = async (url: string) => (await fetch(url)).json()

export async function loadEngine(base = ''): Promise<Engine> {
  const [config, scalerFile, model, ordersBlob, feats, trust, lookups] = await Promise.all([
    json(`${base}data/config.json`), json(`${base}data/scaler.json`), json(`${base}data/model.json`),
    gz(`${base}data/orders.dat`), gz(`${base}data/features_test.dat`), json(`${base}data/trust.json`), json(`${base}data/lookups.json`)])
  const trees: Tree[] = model.trees.map((t: any) => {
    const n = t.left_children.length; const tr: Tree = { left: Int32Array.from(t.left_children), right: Int32Array.from(t.right_children), feat: Int32Array.from(t.split_indices), cond: Float64Array.from(t.split_conditions, Math.fround), dl: Uint8Array.from(t.default_left), cover: Float64Array.from(t.sum_hessian), depth: 0 }
    const walk = (i: number, d: number) => { tr.depth = Math.max(tr.depth, d); if (tr.left[i] >= 0) { walk(tr.left[i], d + 1); walk(tr.right[i], d + 1) } }
    walk(0, 0); void n; return tr
  })
  const baseMargin = Math.log(model.base_score / (1 - model.base_score))
  // expected value of each tree = cover weighted mean of leaves
  let bias = baseMargin
  for (const t of trees) {
    const ev = (i: number): number => t.left[i] < 0 ? t.cond[i] : (t.cover[t.left[i]] * ev(t.left[i]) + t.cover[t.right[i]] * ev(t.right[i])) / t.cover[i]
    bias += ev(0)
  }
  const raw = new Map<number, Float64Array>(); feats.ids.forEach((id: number, k: number) => raw.set(id, Float64Array.from(feats.rows[k])))
  const orders = ordersBlob.orders.map((o: any) => ({ ...o, dt: new Date(o.date.replace(' ', 'T')), hour: Number(o.date.slice(11, 13)) }))
  const drivers = new Map<number, any[]>(); orders.forEach((o: any) => drivers.set(o.id, o.drivers))
  return { lookups, config, scaler: scalerFile.scaled, features: scalerFile.features, trees, baseMargin, bias, orders, drivers, baseValue: ordersBlob.base_value, raw, trust, rawCols: feats.cols }
}

function leafValue(t: Tree, x: Float64Array) {
  let i = 0
  while (t.left[i] >= 0) { const v = x[t.feat[i]]; i = Number.isNaN(v) ? (t.dl[i] ? t.left[i] : t.right[i]) : (v < t.cond[i] ? t.left[i] : t.right[i]) }
  return t.cond[i]
}
export function predict(e: Engine, x: Float64Array) { let m = e.baseMargin; for (const t of e.trees) m += leafValue(t, x); return sigmoid(m) }

/* Path dependent TreeSHAP (Lundberg et al.), same method XGBoost uses for pred_contribs. */
export function shap(e: Engine, x: Float64Array): Float64Array {
  const nf = x.length; const phi = new Float64Array(nf)
  for (const t of e.trees) {
    const D = t.depth + 2
    const mk = () => ({ f: new Int32Array(D), z: new Float64Array(D), o: new Float64Array(D), w: new Float64Array(D) })
    const extend = (p: ReturnType<typeof mk>, ud: number, zf: number, of: number, fi: number) => {
      p.f[ud] = fi; p.z[ud] = zf; p.o[ud] = of; p.w[ud] = ud === 0 ? 1 : 0
      for (let i = ud - 1; i >= 0; i--) { p.w[i + 1] += of * p.w[i] * (i + 1) / (ud + 1); p.w[i] = zf * p.w[i] * (ud - i) / (ud + 1) }
    }
    const unwind = (p: ReturnType<typeof mk>, ud: number, pi: number) => {
      const of = p.o[pi], zf = p.z[pi]; let next = p.w[ud]
      for (let i = ud - 1; i >= 0; i--) {
        if (of !== 0) { const tmp = p.w[i]; p.w[i] = next * (ud + 1) / ((i + 1) * of); next = tmp - p.w[i] * zf * (ud - i) / (ud + 1) }
        else p.w[i] = (p.w[i] * (ud + 1)) / (zf * (ud - i))
      }
      for (let i = pi; i < ud; i++) { p.f[i] = p.f[i + 1]; p.z[i] = p.z[i + 1]; p.o[i] = p.o[i + 1] }
    }
    const unwoundSum = (p: ReturnType<typeof mk>, ud: number, pi: number) => {
      const of = p.o[pi], zf = p.z[pi]; let next = p.w[ud], total = 0
      for (let i = ud - 1; i >= 0; i--) {
        if (of !== 0) { const tmp = next * (ud + 1) / ((i + 1) * of); total += tmp; next = p.w[i] - tmp * zf * ((ud - i) / (ud + 1)) }
        else if (zf !== 0) total += (p.w[i] / zf) / ((ud - i) / (ud + 1))
      }
      return total
    }
    const rec = (node: number, ud: number, parent: ReturnType<typeof mk>, pz: number, po: number, pf: number) => {
      const p = mk(); p.f.set(parent.f); p.z.set(parent.z); p.o.set(parent.o); p.w.set(parent.w)
      extend(p, ud, pz, po, pf)
      if (t.left[node] < 0) {
        for (let i = 1; i <= ud; i++) { const w = unwoundSum(p, ud, i); phi[p.f[i]] += w * (p.o[i] - p.z[i]) * t.cond[node] }
        return
      }
      const sf = t.feat[node]; const v = x[sf]
      const goLeft = Number.isNaN(v) ? !!t.dl[node] : v < t.cond[node]
      const hot = goLeft ? t.left[node] : t.right[node], cold = goLeft ? t.right[node] : t.left[node]
      const hz = t.cover[hot] / t.cover[node], cz = t.cover[cold] / t.cover[node]
      let iz = 1, io = 1, pi = 0
      for (; pi <= ud; pi++) if (p.f[pi] === sf) break
      let nud = ud
      if (pi !== ud + 1 && pi <= ud) { iz = p.z[pi]; io = p.o[pi]; unwind(p, ud, pi); nud -= 1 }
      rec(hot, nud + 1, p, hz * iz, io, sf)
      rec(cold, nud + 1, p, cz * iz, 0, sf)
    }
    rec(0, 0, mk(), 1, 1, -1)
  }
  return phi
}
export function scaleRow(e: Engine, row: Float64Array, cols: string[]): Float64Array {
  const x = new Float64Array(e.features.length)
  e.features.forEach((f, i) => { const v = row[cols.indexOf(f)]; const s = e.scaler[f]; x[i] = Math.fround(s ? (v - s.mean) / s.std : v) })
  return x
}
