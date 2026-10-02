import { useApp, DIAL } from './state'
import { Icon, Logo } from './components/Icons'
import { Drawer } from './components/Drawer'
import Home from './pages/Home'
import Check from './pages/Check'
import ScoreFile from './pages/ScoreFile'
import Handle from './pages/Handle'
import Capacity from './pages/Capacity'
import Replay from './pages/Replay'
import Trust from './pages/Trust'

const USE = [
  { id: 'home', label: 'Home', icon: 'today' }, { id: 'check', label: 'Check an order', icon: 'check' },
  { id: 'file', label: 'Score a file', icon: 'upload' }, { id: 'handle', label: 'Orders to handle', icon: 'list' },
]
const HOOD = [
  { id: 'capacity', label: 'Capacity planner', icon: 'capacity' }, { id: 'replay', label: 'Replay', icon: 'replay' }, { id: 'trust', label: 'Model report', icon: 'trust' },
]
const NAV = [...USE, ...HOOD]
const SHORT: Record<string, string> = { home: 'Home', check: 'Check', file: 'File', handle: 'Orders', capacity: 'Capacity', replay: 'Replay', trust: 'Report' }
const TITLES: Record<string, [string, string]> = {
  home: ['Home', 'What needs your attention today'],
  check: ['Check an order', 'Will this order arrive late? Find out before it ships'],
  file: ['Score a file', 'Rank a whole list of new orders in one go'],
  handle: ['Orders to handle', 'The orders worth your time, biggest and riskiest first'],
  capacity: ['Capacity planner', 'How much late revenue can your team reach?'],
  replay: ['Replay', 'Watch the queue week by week'],
  trust: ['Model report', 'How good the model is, and where it is weak'],
}

export default function App() {
  const { page, go, alpha, setAlpha, theme, toggleTheme } = useApp()
  const [title, sub] = TITLES[page] || TITLES.home
  const dial = alpha <= 0 ? 0 : alpha >= 2 ? 2 : 1
  const showCtl = page === 'capacity'
  return (
    <div className="shell">
      <nav className="side" aria-label="Main">
        <div className="brand"><span className="logo"><Logo /></span>Heads Up</div>
        <div className="navsec">Use it</div>
        {USE.map(n => <button key={n.id} className={`nav ${page === n.id ? 'on' : ''}`} onClick={() => go(n.id)}><Icon name={n.icon} />{n.label}</button>)}
        <div className="navsec">Under the hood</div>
        {HOOD.map(n => <button key={n.id} className={`nav ${page === n.id ? 'on' : ''}`} onClick={() => go(n.id)}><Icon name={n.icon} />{n.label}</button>)}
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
          </>}
          <button className="iconbtn" onClick={toggleTheme} aria-label="Toggle theme"><Icon name={theme === 'dark' ? 'sun' : 'moon'} /></button>
        </header>
        {page === 'home' && <Home />}{page === 'check' && <Check />}{page === 'file' && <ScoreFile />}{page === 'handle' && <Handle />}
        {page === 'capacity' && <Capacity />}{page === 'replay' && <Replay />}{page === 'trust' && <Trust />}
      </main>
      <div className="tabbar">{NAV.map(n => <button key={n.id} className={page === n.id ? 'on' : ''} onClick={() => go(n.id)}><Icon name={n.icon} size={22} />{SHORT[n.id]}</button>)}</div>
      <Drawer />
    </div>
  )
}
