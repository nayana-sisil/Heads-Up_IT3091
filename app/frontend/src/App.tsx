import { useApp, DIAL } from './state'
import { PAGES, pageOf } from './nav'
import { Icon, Logo } from './components/Icons'
import { Drawer } from './components/Drawer'
import Home from './pages/Home'
import Check from './pages/Check'
import ScoreFile from './pages/ScoreFile'
import Handle from './pages/Handle'
import Capacity from './pages/Capacity'
import Replay from './pages/Replay'
import Trust from './pages/Trust'
import Business from './pages/Business'
import { Problem, DataEda, Prep } from './pages/tech/Early'
import { Features } from './pages/tech/Features'
import { Models, Tuning } from './pages/tech/Models'
import { Explain, Final } from './pages/tech/Eval'
import { Priority, System } from './pages/tech/Late'
import { Decisions, Viva, About } from './pages/tech/Reference'

const VIEW: Record<string, () => JSX.Element> = {
  home: Home, check: Check, file: ScoreFile, handle: Handle, capacity: Capacity, replay: Replay, business: Business, trust: Trust,
  problem: Problem, data: DataEda, prep: Prep, features: Features, models: Models, tuning: Tuning, explain: Explain, final: Final, priority: Priority, system: System,
  decisions: Decisions, viva: Viva, about: About,
}
const TAB: Record<string, string[]> = { use: ['home', 'check', 'file', 'handle'], built: ['problem', 'models', 'final', 'viva'] }

export default function App() {
  const { page, go, alpha, setAlpha, theme, toggleTheme } = useApp()
  const cur = pageOf(page) ?? PAGES[0]; const mode = cur.mode
  const View = VIEW[cur.id] ?? Home
  const dial = alpha <= 0 ? 0 : alpha >= 2 ? 2 : 1
  const showCtl = page === 'capacity'
  const list = PAGES.filter(p => p.mode === mode)
  const groups = [...new Set(list.map(p => p.group ?? ''))]
  return (
    <div className="shell">
      <nav className="side" aria-label="Main">
        <div className="brand"><span className="logo"><Logo /></span>Heads Up</div>
        <div className="mode" role="group" aria-label="Mode">
          <button className={mode === 'use' ? 'on' : ''} onClick={() => go('home')}>Use it</button>
          <button className={mode === 'built' ? 'on' : ''} onClick={() => go('problem')}>How it was built</button>
        </div>
        {groups.map(g => <div key={g}>
          {g && <div className="navgrp">{g}</div>}
          {list.filter(p => (p.group ?? '') === g).map(n => <button key={n.id} className={`nav ${page === n.id ? 'on' : ''}`} onClick={() => go(n.id)}><Icon name={n.icon} />{n.label}</button>)}
        </div>)}
        <div className="sp" />
        <div className="sidefoot">Live model: tuned XGBoost. Report model: tuned Random Forest.<br />Demo data: the 11,836 test orders (Aug 2017 to Jan 2018) from the DataCo Smart Supply Chain dataset.<br /><br />IT3091 Machine Learning, Group 5</div>
      </nav>
      <main className="main">
        <header className="top">
          <div className="grow"><h1>{cur.title}</h1><div className="sub">{cur.sub}</div></div>
          {showCtl && <div className="seg" role="group" aria-label="Risk weight" title="How much risk counts compared with order value">
            {DIAL.map((d, i) => <button key={d.id} className={dial === i ? 'on' : ''} onClick={() => setAlpha(d.alpha)} title={d.hint}>{d.label}</button>)}
          </div>}
          <button className="iconbtn" onClick={toggleTheme} aria-label="Toggle theme"><Icon name={theme === 'dark' ? 'sun' : 'moon'} /></button>
          <select className="select pagepick" value={cur.id} onChange={e => go(e.target.value)} aria-label="Go to page">
            {PAGES.map(p => <option key={p.id} value={p.id}>{p.mode === 'use' ? 'App: ' : 'Project: '}{p.label}</option>)}
          </select>
        </header>
        <View />
      </main>
      <div className="tabbar">
        {TAB[mode].map(id => { const p = pageOf(id)!; return <button key={id} className={page === id ? 'on' : ''} onClick={() => go(id)}><Icon name={p.icon} size={22} />{p.mode === 'built' ? p.label.replace(/^\d+\. /, '').split(' ')[0] : p.short}</button> })}
        <button onClick={() => go(mode === 'use' ? 'problem' : 'home')}><Icon name={mode === 'use' ? 'layers' : 'today'} size={22} />{mode === 'use' ? 'Project' : 'App'}</button>
      </div>
      <Drawer />
    </div>
  )
}
