import { useMemo, useState } from 'react'
import { useData, useReport } from '../../data'
import { Card, Skeleton } from '../../components/ui'
import { Callout, PageHead, Tbl, pc } from '../../components/tech'
import { useApp } from '../../state'

export function Decisions() {
  const d = useData<any>('decisions.json'); const [stage, setStage] = useState('All'); const [q, setQ] = useState('')
  const all = useMemo(() => d ? d.stages.flatMap((s: any) => s.entries.map((e: any) => ({ ...e, stage: s.stage }))) : [], [d])
  if (!d) return <Skeleton h={500} />
  const shown = all.filter((e: any) => (stage === 'All' || e.stage === stage) && (!q || (e.title + e.decision + e.reason + e.alternatives).toLowerCase().includes(q.toLowerCase())))
  return (
    <div className="grid">
      <PageHead stage="Reference" nb="DECISION_LOG.md" line={`${all.length} decisions across ${d.stages.length} stage groups, each with the reason and the alternatives we rejected. Search it before the viva.`} viva="Why did you do X?" />
      <Card>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <input className="input" style={{ flex: '1 1 240px' }} placeholder="Search the log, for example threshold, leakage, SHAP" value={q} onChange={e => setQ(e.target.value)} aria-label="Search the decision log" />
          <select className="select" value={stage} onChange={e => setStage(e.target.value)} aria-label="Stage"><option>All</option>{d.stages.map((s: any) => <option key={s.stage}>{s.stage}</option>)}</select>
        </div>
        <p className="note" style={{ margin: '10px 0 0' }}>{shown.length} shown</p>
      </Card>
      <Card>
        {shown.map((e: any, i: number) => (
          <details key={i} className="subfold">
            <summary><span className="dim num">{e.date}</span> {e.title} <span className="chip" style={{ marginLeft: 6 }}>{e.stage.split(':')[0]}</span></summary>
            <p><b>Decision.</b> {e.decision}</p><p><b>Reason.</b> {e.reason}</p>{e.alternatives && <p><b>Alternatives considered.</b> {e.alternatives}</p>}{e.made_by && <p className="dim">Made by {e.made_by}</p>}
          </details>))}
        {shown.length === 0 && <p className="note">Nothing matches.</p>}
      </Card>
    </div>
  )
}

export function Viva() {
  const r = useReport(); const { go } = useApp(); if (!r) return <Skeleton h={500} />
  const rf = r.models['Random Forest'], xg = r.models.XGBoost, base = r.board[0], te = (m: any) => m.test.at_threshold
  const best = Math.max(...r.board.map((b: any) => b.roc_auc))
  const P = r.prioritization_top10
  const QA: { q: string; a: string; page: string; label: string }[] = [
    { q: 'What problem does Heads Up solve?', a: `Operations learns an order is late only after it is late. Heads Up predicts, at order time, whether an order will be late (primary lens) and ranks risky orders by chance × order value (secondary lens), so the team can act on the few that matter.`, page: 'business', label: 'Business case' },
    { q: 'Why is Recall your main metric when the classes are nearly balanced?', a: `The split is ${pc(r.eda.late_rate, 1)} late, so imbalance is not the reason. The reason is cost: a missed late order costs more than a false alarm (we used 3 to 1). We corrected our first reasoning in the log after EDA.`, page: 'problem', label: 'Problem and target' },
    { q: 'How did you avoid data leakage?', a: 'Every field was classified before modelling. Delivery Status, real shipping days and the shipping date are known only after delivery, so they were excluded. Encodings and the scaler are fitted on the training set only, and the test set was opened once, after every choice was fixed.', page: 'data', label: 'Data and EDA' },
    { q: 'Why a chronological split and not a random one?', a: `In real use the model predicts the future from the past. Train is the first 70% of orders (to ${r.splits[0].end}), validation the next 12%, test the last 18% (from ${r.splits[2].start}). Validation exists so tuning never touches the test set.`, page: 'prep', label: 'Cleaning and split' },
    { q: 'What does the model add over a simple rule?', a: `The shipping option rule alone has Recall ${base.recall.toFixed(2)} and ROC-AUC ${base.roc_auc.toFixed(3)}. The best models reach about ${best.toFixed(3)} AUC and, at our threshold, Recall above 0.80. Most signal is the shipping option; the model adds a separate chance per order and reasons.`, page: 'models', label: 'Models' },
    { q: 'Which model is the final one?', a: `Two roles. The tuned Random Forest is the report model (threshold ${rf.threshold}, test Recall ${te(rf).recall.toFixed(3)}, Precision ${te(rf).precision.toFixed(3)}). The tuned XGBoost runs the live app (threshold ${xg.threshold}, test Recall ${te(xg).recall.toFixed(3)}, Precision ${te(xg).precision.toFixed(3)}) because it is tiny, explains an order in about a second, and ties at the operating point.`, page: 'final', label: 'Final evaluation' },
    { q: 'Why did you not pick the cost minimizing threshold?', a: `It sits at ${r.threshold_notes.cost_threshold} and flags about 97% of orders, because 55% of orders are late. That is a degenerate result. We used the highest threshold where validation Recall is at least 0.80 instead.`, page: 'tuning', label: 'Tuning and threshold' },
    { q: 'Why did tuning not improve the models much?', a: 'The signal is limited, mostly shipping option. After tuning, all three models give about 0.64 Precision at Recall 0.80 on validation. The first XGBoost attempt optimized Recall and was discarded; the second optimized PR-AUC.', page: 'tuning', label: 'Tuning and threshold' },
    { q: 'Why does order_hour matter so much?', a: 'It matters only inside Same Day orders: before noon they are never late, from noon they are almost always late. For other options the hour barely matters. It looks like a rule built into this dataset, so a real carrier may differ.', page: 'explain', label: 'Explainability' },
    { q: 'How is the priority score defined and why use Sales, not profit?', a: 'priority = chance of late × Sales. Sales is used so loss making orders are not counted as negative value, and profit had heavy outliers.', page: 'priority', label: 'Prioritization' },
    { q: 'Is the model better than a simple rule for prioritization?', a: `For the top 10% it is a tie: on test, Heads Up reaches ${pc(P.XGBoost.test['Heads Up'].revenue, 1)} of late revenue with XGBoost and ${pc(P['Random Forest'].test['Heads Up'].revenue, 1)} with the forest, the rule ${pc(P.XGBoost.test['Simple rule'].revenue, 1)}. Both beat risk only (${pc(P.XGBoost.test['Risk only'].revenue, 0)}) and are far above random (${pc(P.XGBoost.test['Random order'].revenue, 0)}).`, page: 'priority', label: 'Prioritization' },
    { q: 'What are the main limits?', a: 'Learned from 2015 to 2018 and can drift. The noon pattern may be a dataset artefact. Order values fell in the test period so tier cut points need refreshing. Unknown countries and products fall back to training averages. It scores one order at a time and does not forecast volume.', page: 'trust', label: 'Trust and limits' },
    { q: 'How do you know the app matches the notebooks?', a: 'The browser model reproduces the Python XGBoost to within 0.00004 and the SHAP values exactly. Rebuilding features from raw fields for all 11,836 test orders gives the same predictions (largest difference 0.00005) and the same tier for every order. The report numbers come from the same data and models with an assertion against the saved test result.', page: 'system', label: 'The app itself' },
    { q: 'What would you do next?', a: 'Refresh the tier cut points on recent data, add time series cross validation, test whether the noon rule holds for real carriers, recalibrate the probabilities regularly, and score the baseline and the other models on the test set for completeness.', page: 'trust', label: 'Trust and limits' },
  ]
  return (
    <div className="grid">
      <PageHead stage="Reference" nb="whole project" line="Short answers to the questions a marker is likely to ask. Each one links to the page that shows the proof." />
      <Card>{QA.map((x, i) => (
        <details key={i} className="qa">
          <summary>{x.q}</summary>
          <p>{x.a}</p>
          <button className="btn" style={{ marginTop: 8 }} onClick={() => go(x.page)}>Show the proof: {x.label}</button>
        </details>))}
      </Card>
      <Callout title="Tip">Numbers in these answers are read from the same files as the charts, so they stay consistent. Open the proof page while you answer.</Callout>
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
        <Card title="The team">
          <Tbl head={['Member', 'ID', 'Role']} rows={[['Wijesinghe D H R', 'IT24102372', 'Business problem framing, EDA, final recommendation'], ['Sanjana K D A', 'IT24102364', 'Preprocessing and feature engineering'], ['Wijekoon W M N S B', 'IT24101446', 'Baseline strategy and model development'], ['Pahalawaththage P W I H', 'IT24101303', 'Evaluation, hyperparameter optimization, SHAP']]} />
        </Card>
      </div>
      <Card title="About this site">
        <p style={{ marginTop: 0 }}>The "Use it" side is the decision support tool. The "How it was built" side explains every stage of the project with numbers read from the project's own data and models.</p>
        <p className="note" style={{ marginBottom: 0 }}>AI assistance: the web app was built with help from Claude (Anthropic). Edit this line to match your course's AI use declaration.</p>
      </Card>
    </div>
  )
}
