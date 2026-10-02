import { useEffect, useState } from 'react'
export async function get<T>(url: string): Promise<T> {
  const r = await fetch(url); if (!r.ok) throw new Error(`${r.status}`); return r.json()
}
export async function post<T>(url: string, body: unknown): Promise<T> {
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
