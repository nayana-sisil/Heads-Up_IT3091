export const money = (n: number) => '$' + Math.round(n).toLocaleString('en-US')
export const moneyK = (n: number) => n >= 1e6 ? `$${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1)}K` : `$${Math.round(n)}`
export const pct = (n: number, d = 0) => `${(n * 100).toFixed(d)}%`
export const num = (n: number) => Math.round(n).toLocaleString('en-US')
export const shortDate = (s: string) => new Date(s.replace(' ', 'T')).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
export const timeOf = (s: string) => s.slice(11, 16)
