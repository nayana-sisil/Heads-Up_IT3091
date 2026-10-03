import { useMemo, useState } from 'react'
import { useData, useReport } from '../../data'
import { Card, Skeleton } from '../../components/ui'
import { Note, Callout, PageHead, Tbl, pc } from '../../components/tech'
import { useApp } from '../../state'
import { Tag, IconCards } from '../../components/viz'

export function Decisions() {
  const d = useData<any>('decisions.json'); const [stage, setStage] = useState('All'); const [q, setQ] = useState('')
  const all = useMemo(() => d ? d.stages.flatMap((s: any) => s.entries.map((e: any) => ({ ...e, stage: s.stage }))) : [], [d])
  if (!d) return <Skeleton h={500} />
  const shown = all.filter((e: any) => (stage === 'All' || e.stage === stage) && (!q || (e.title + e.decision + e.reason + e.alternatives).toLowerCase().includes(q.toLowerCase())))
  return (
    <div className="grid">
      <PageHead stage="Reference" nb="DECISION_LOG.md" line={`${all.length} decisions across ${d.stages.length} stage groups, each with the reason and the alternatives we rejected.`} />
      <Card>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <input className="input" style={{ flex: '1 1 240px' }} placeholder="Search the log, for example threshold, leakage, SHAP" value={q} onChange={e => setQ(e.target.value)} aria-label="Search the decision log" />
          <select className="select" value={stage} onChange={e => setStage(e.target.value)} aria-label="Stage"><option>All</option>{d.stages.map((s: any) => <option key={s.stage}>{s.stage}</option>)}</select>
        </div>
        <p className="note" style={{ margin: '10px 0 0' }}>{shown.length} shown</p>
      </Card>
      <div className="dlog">
        {shown.map((e: any, i: number) => { const k = parseInt(e.stage.match(/\d+/)?.[0] ?? '0'); const col = ['#5b8cff', '#5b8cff', '#20b2a0', '#9a73e6', '#f0902f', '#e5619a', '#e3b020', '#3fb97a', '#ef6b5b', '#8294c4', '#8294c4'][Math.min(k, 10)]
          return <article key={i} className="dentry" style={{ ['--c' as any]: col }}>
            <div className="dh"><Tag color={col}>{e.stage.split(':')[0]}</Tag><span className="dim num">{e.date}</span>{e.made_by && <span className="dim">· {e.made_by}</span>}</div>
            <h4>{e.title}</h4>
            <p className="dline">{e.decision.length > 220 ? e.decision.slice(0, e.decision.lastIndexOf(' ', 220)) + '…' : e.decision}</p>
            <Note label="Full decision, reason and alternatives"><p><b>Decision.</b> {e.decision}</p><p><b>Reason.</b> {e.reason}</p>{e.alternatives && <p><b>Alternatives.</b> {e.alternatives}</p>}</Note>
          </article>
        })}
        {shown.length === 0 && <p className="note">Nothing matches.</p>}
      </div>
    </div>
  )
}

export function About() {
  return (
    <div className="grid">
      <PageHead stage="Reference" nb="README" line="Heads Up gives DataCo's operations team a warning before a delivery goes wrong, not a report after it already has." />
      <div className="two">
        <Card title="The project">
          <Tbl head={['Field', 'Value']} rows={[['Track', 'Guided Data Track'], ['Domain', 'Logistics and Supply Chain'], ['Dataset', 'DataCo Smart Supply Chain'], ['Institution', 'Sri Lanka Institute of Information Technology'], ['Course', 'Machine Learning (IT3091)'], ['Year and semester', '2026, Year 3, Semester 1'], ['Group ID', '2026 DS 05'], ['Batch', 'Y3.S1.WE.DS.0102']]} />
        </Card>
        <Card title="The team" lead="IT3091 Machine Learning, Group 5">
          <IconCards cols={2} items={[
            { icon: 'briefcase', title: 'Wijesinghe D H R', text: <>IT24102372. Business problem framing, EDA, final recommendation</>, color: '#5b8cff' },
            { icon: 'clean', title: 'Sanjana K D A', text: <>IT24102364. Preprocessing and feature engineering</>, color: '#9a73e6' },
            { icon: 'models', title: 'Wijekoon W M N S B', text: <>IT24101446. Baseline strategy and model development</>, color: '#e5619a' },
            { icon: 'brain', title: 'Pahalawaththage P W I H', text: <>IT24101303. Evaluation, hyperparameter optimization, SHAP</>, color: '#e3b020' },
          ]} />
        </Card>
      </div>
      <Card title="About this site">
        <p style={{ marginTop: 0 }}>The "Use it" side is the decision support tool. The "How it was built" side explains every stage of the project with numbers read from the project's own data and models.</p>
        <Note>AI assistance: the web app was built with help from Claude (Anthropic). Edit this line to match your course's AI use declaration.</Note>
      </Card>
    </div>
  )
}
