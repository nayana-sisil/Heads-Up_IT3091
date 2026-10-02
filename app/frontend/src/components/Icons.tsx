const P = (d: string) => ({ d })
const paths: Record<string, string[]> = {
  today: ['M3 12 12 4l9 8', 'M5 10v10h14V10'],
  board: ['M4 5h5v14H4z', 'M10 5h5v9h-5z', 'M16 5h4v6h-4z'],
  capacity: ['M4 19V5', 'M4 19h16', 'M7 15l4-4 3 2 5-6'],
  whatif: ['M5 6h8', 'M17 6h2', 'M5 12h2', 'M11 12h8', 'M5 18h10', 'M19 18h0', 'M15 4v4', 'M9 10v4', 'M17 16v4'],
  replay: ['M12 4a8 8 0 1 0 8 8', 'M12 8v4l3 2', 'M20 4v4h-4'],
  trust: ['M12 3 5 6v6c0 4 3 7 7 9 4-2 7-5 7-9V6z', 'M9 12l2 2 4-4'],
  check: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M8.5 12.5l2.5 2.5 4.5-5'],
  upload: ['M12 16V4', 'M7 9l5-5 5 5', 'M5 20h14'],
  list: ['M8 6h12', 'M8 12h12', 'M8 18h12', 'M4 6h.01', 'M4 12h.01', 'M4 18h.01'],
  tool: ['M14.5 6.5a4 4 0 0 0-5 5L4 17l3 3 5.5-5.5a4 4 0 0 0 5-5l-2.5 2.5-2-.5-.5-2z'],
  moon: ['M20 14.5A8 8 0 1 1 9.5 4 6.5 6.5 0 0 0 20 14.5z'],
  sun: ['M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z', 'M12 2v2', 'M12 20v2', 'M4.9 4.9l1.4 1.4', 'M17.7 17.7l1.4 1.4', 'M2 12h2', 'M20 12h2', 'M4.9 19.1l1.4-1.4', 'M17.7 6.3l1.4-1.4'],
  close: ['M6 6l12 12', 'M18 6 6 18'],
  play: ['M8 5v14l11-7z'], pause: ['M8 5v14', 'M16 5v14'],
  search: ['M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z', 'M20 20l-4-4'],
  eye: ['M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z', 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z'],
}
export function Icon({ name, size = 20 }: { name: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{(paths[name] || []).map((d, i) => <path key={i} {...P(d)} />)}</svg>
}
export function Logo() {
  return <svg width="20" height="20" viewBox="0 0 32 32" fill="none"><path d="M6 22a10 10 0 0 1 20 0" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" /><circle cx="16" cy="22" r="3" fill="#fff" /></svg>
}
