import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react'
export const PERIODS = [
  { id: 'all', label: 'Whole test period', from: undefined, to: undefined },
  { id: 'aug', label: 'August 2017', from: '2017-08-01', to: '2017-08-31' },
  { id: 'sep', label: 'September 2017', from: '2017-09-01', to: '2017-09-30' },
  { id: 'oct', label: 'October 2017', from: '2017-10-01', to: '2017-10-31' },
  { id: 'nov', label: 'November 2017', from: '2017-11-01', to: '2017-11-30' },
  { id: 'dec', label: 'December 2017', from: '2017-12-01', to: '2017-12-31' },
  { id: 'jan', label: 'January 2018', from: '2018-01-01', to: '2018-01-31' },
]
export const DIAL = [
  { id: 0, label: 'Money first', alpha: 0, hint: 'Biggest orders go first' },
  { id: 1, label: 'Balanced', alpha: 1, hint: 'Chance of late × order value' },
  { id: 2, label: 'Risk first', alpha: 3, hint: 'Most likely late go first' },
]
interface Ctx { alpha: number; setAlpha: (a: number) => void; period: string; setPeriod: (p: string) => void; from?: string; to?: string; open: number | null; setOpen: (id: number | null) => void; theme: string; toggleTheme: () => void; reveal: boolean; setReveal: (b: boolean) => void; page: string; go: (p: string, id?: number) => void; focusId: number | null }
const C = createContext<Ctx>(null as unknown as Ctx)
export const useApp = () => useContext(C)
export function AppProvider({ children }: { children: ReactNode }) {
  const [alpha, setAlpha] = useState(1); const [period, setPeriod] = useState('all'); const [open, setOpen] = useState<number | null>(null)
  const [reveal, setReveal] = useState(false)
  const initial = (location.hash.replace('#/', '').split('/')[0]) || 'today'
  const [page, setPage] = useState(initial); const [focusId, setFocusId] = useState<number | null>(null)
  const go = (p: string, id?: number) => { setPage(p); setFocusId(id ?? null); setOpen(null); history.replaceState(null, '', `#/${p}`); window.scrollTo({ top: 0 }) }
  const [theme, setTheme] = useState(() => { try { return localStorage.getItem('hu-theme') || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') } catch { return 'dark' } })
  useEffect(() => { document.documentElement.dataset.theme = theme; try { localStorage.setItem('hu-theme', theme) } catch { /* ignore */ } }, [theme])
  const p = PERIODS.find(x => x.id === period)!
  const v = useMemo(() => ({ alpha, setAlpha, period, setPeriod, from: p.from, to: p.to, open, setOpen, theme, toggleTheme: () => setTheme(t => t === 'dark' ? 'light' : 'dark'), reveal, setReveal, page, go, focusId }), [alpha, period, open, theme, reveal, page, focusId])
  return <C.Provider value={v}>{children}</C.Provider>
}
export const qs = (o: Record<string, string | number | boolean | undefined | null>) => Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&')
