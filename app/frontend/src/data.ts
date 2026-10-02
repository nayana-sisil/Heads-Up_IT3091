import { useEffect, useState } from 'react'
const cache = new Map<string, Promise<any>>()
export function loadData<T = any>(file: string): Promise<T> {
  if (!cache.has(file)) cache.set(file, fetch(`${import.meta.env.BASE_URL}data/${file}`).then(async r => { if (!r.ok) throw new Error(file); return r.json() }))
  return cache.get(file)!
}
export function useData<T = any>(file: string) {
  const [d, setD] = useState<T | null>(null)
  useEffect(() => { let live = true; loadData<T>(file).then(x => live && setD(x)).catch(() => {}); return () => { live = false } }, [file])
  return d
}
export const useReport = () => useData<any>('report.json')
