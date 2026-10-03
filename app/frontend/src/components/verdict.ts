import { suggest } from './Drawer'
export function verdict(p: number, threshold: number, tier: string, mode: string, when: string) {
  const pp = Math.round(p * 100)
  const kind = p >= 0.7 ? 'crit' : p >= threshold ? 'high' : 'good'
  const head = kind === 'crit' ? `Probably late (${pp}%)` : kind === 'high' ? `Could be late (${pp}%)` : 'Probably on time'
  const s = suggest({ tier, mode, date: when.replace('T', ' ') })
  const action = kind === 'good' ? 'No action needed. Handle it as normal.' : s.title + '.'
  return { kind, head, action, detail: s.text, tier }
}
