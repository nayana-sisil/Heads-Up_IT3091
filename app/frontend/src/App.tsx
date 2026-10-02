import { useApp, PERIODS, DIAL } from './state'
import { Icon, Logo } from './components/Icons'
import { Drawer } from './components/Drawer'
import Today from './pages/Today'
import Board from './pages/Board'
import Capacity from './pages/Capacity'
import WhatIf from './pages/WhatIf'
import Replay from './pages/Replay'
import Trust from './pages/Trust'

const NAV = [
  { id: 'today', label: 'Today', icon: 'today' }, { id: 'board', label: 'Action board', icon: 'board' }, { id: 'capacity', label: 'Capacity', icon: 'capacity' },
  { id: 'whatif', label: 'What if', icon: 'whatif' }, { id: 'replay', label: 'Replay', icon: 'replay' }, { id: 'trust', label: 'Trust', icon: 'trust' },
]
const TITLES: Record<string, [string, string]> = {
  today: ['Today', 'Where the late-delivery risk sits right now'],
  board: ['Action board', 'Orders sorted by what to handle first'],
  capacity: ['Capacity planner', 'How much late revenue can your team reach?'],
  whatif: ['What if', 'Change an order and watch the risk move'],
  replay: ['Replay', 'Watch the queue week by week'],
  trust: ['Trust', 'How good the model is, and where it is weak'],
}

export default function App() {
  const { page, go, period, setPeriod, alpha, setAlpha, theme, toggleTheme } = useApp()
  const [title, sub] = TITLES[page] || TITLES.today
  const dial = alpha <= 0 ? 0 : alpha >= 2 ? 2 : 1
  const showCtl = page !== 'trust' && page !== 'replay'
  return (
    <div className="shell">
      <nav className="side" aria-label="Main">
        <div className="brand"><span className="logo"><Logo /></span>Heads Up</div>
        {NAV.map(n => <button key={n.id} className={`nav ${page === n.id ? 'on' : ''}`} onClick={() => go(n.id)}><Icon name={n.icon} />{n.label}</button>)}
        <div className="sp" />
        <div className="sidefoot">Engine: tuned XGBoost.<br />Demo data: the 11,836 test orders (Aug 2017 to Jan 2018) from the DataCo Smart Supply Chain dataset.<br /><br />IT3091 Machine Learning, Group 5</div>
      </nav>
      <main className="main">
        <header className="top">
          <div className="grow"><h1>{title}</h1><div className="sub">{sub}</div></div>
          {showCtl && <>
            <div className="seg" role="group" aria-label="Risk weight" title="How much risk counts compared with order value">
              {DIAL.map((d, i) => <button key={d.id} className={dial === i ? 'on' : ''} onClick={() => setAlpha(d.alpha)} title={d.hint}>{d.label}</button>)}
            </div>
            {page !== 'capacity' && <select className="select" value={period} onChange={e => setPeriod(e.target.value)} aria-label="Period">{PERIODS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}</select>}
          </>}
          <button className="iconbtn" onClick={toggleTheme} aria-label="Toggle theme"><Icon name={theme === 'dark' ? 'sun' : 'moon'} /></button>
        </header>
        {page === 'today' && <Today />}{page === 'board' && <Board />}{page === 'capacity' && <Capacity />}
        {page === 'whatif' && <WhatIf />}{page === 'replay' && <Replay />}{page === 'trust' && <Trust />}
      </main>
      <div className="tabbar">{NAV.map(n => <button key={n.id} className={page === n.id ? 'on' : ''} onClick={() => go(n.id)}><Icon name={n.icon} size={22} />{n.label.replace('Action board', 'Board')}</button>)}</div>
      <Drawer />
    </div>
  )
}
