import { useEffect, useState } from 'react'
import { localGet, localPost } from './static/localApi'
export const STATIC = import.meta.env.VITE_STATIC === '1'
export async function get<T>(url: string): Promise<T> {
  if (STATIC) return (await localGet(url)) as T
  const r = await fetch(url); if (!r.ok) throw new Error(`${r.status}`); return r.json()
}
export async function post<T>(url: string, body: unknown): Promise<T> {
  if (STATIC) return (await localPost(url, body)) as T
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  if (!r.ok) throw new Error(`${r.status}`); return r.json()
}
export function useGet<T>(url: string | null, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (!url) return; let live = true; setLoading(true)
    get<T>(url).then(d => { if (live) { setData(d); setError(null) } }).catch(e => live && setError(String(e))).finally(() => live && setLoading(false))
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, ...deps])
  return { data, loading, error }
}

/* ---- predict a brand new order (runs in the browser on the static build; the API serves it otherwise) ---- */
import type { CheckInput, CheckResult, LookupInfo } from './types'
export async function checkNew(input: CheckInput): Promise<CheckResult> {
  if (STATIC) { const m = await import('./static/localApi'); return m.checkOrder(input) as unknown as CheckResult }
  return post<CheckResult>('/api/check', input)
}
export async function scoreFile(rows: CheckInput[]): Promise<{ p: number; sales: number; priority: number; tier: string; flag: boolean }[]> {
  if (STATIC) { const m = await import('./static/localApi'); return m.scoreMany(rows) }
  return post('/api/score', { rows })
}
export async function getLookups(): Promise<LookupInfo> {
  if (STATIC) { const m = await import('./static/localApi'); const L = m.lookups(); return { countries: Object.keys(L.country_orders).sort((a, b) => L.country_orders[b] - L.country_orders[a]), categories: Object.keys(L.category_frequency).sort(), typical: L.typical, sales_range: L.sales_range, region_of: L.country_region, threshold: m.engineConfig().risk_threshold } }
  return get<LookupInfo>('/api/lookups')
}
