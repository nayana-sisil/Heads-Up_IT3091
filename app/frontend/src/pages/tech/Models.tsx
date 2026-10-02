import { useState } from 'react'
import { useReport } from '../../data'
import { Bars, Card, LineChart, ChartLegend, Skeleton } from '../../components/ui'
import { Callout, PageHead, Related, Stat, Steps, Tbl, fig, pc } from '../../components/tech'
import { num } from '../../format'

export function Models() {
  const r = useReport(); if (!r) return <Skeleton h={500} />
  const b = [...r.board]; const best = (k: string) => Math.max(...b.map((x: any) => x[k]))
  const cell = (x: any, k: string) => <span style={x[k] === best(k) ? { fontWeight: 800, color: 'var(--brand)' } : undefined}>{x[k].toFixed(3)}</span>
  const base = b.find((x: any) => x.model.startsWith('Rule'))
  return (
    <div className="grid">
      <PageHead stage="Stages 5 and 6" nb="notebook 04_model_development" line="Twelve models were compared against a one line rule. The best ones are close to each other, and the rule is a tougher opponent than expected." viva="Why is a Random Forest better than the baseline if the AUC only moves from 0.73 to 0.76?" />
      <div className="grid g3">
        <Stat label="Baseline rule" value={`Recall ${base.recall.toFixed(2)}`} sub={`Predict "late" for any shipping option that was late more than half the time in training (First and Second Class). ROC-AUC ${base.roc_auc.toFixed(3)}`} />
        <Stat label="Best ROC-AUC" value={best('roc_auc').toFixed(3)} sub="Neural network, closely followed by LightGBM, CatBoost, Stacking and Gradient Boosting" />
        <Stat label="Best Recall at 0.5" value={best('recall').toFixed(3)} sub="Random Forest" />
      </div>
      <Card title="All models on the validation set" lead="Default 0.5 threshold, before any tuning. The best value in each column is blue.">
        <Tbl head={['Model', 'Recall', 'Precision', 'F1', 'ROC-AUC', 'PR-AUC']} num={[1, 2, 3, 4, 5]} rows={b.map((x: any) => [x.model, cell(x, 'recall'), cell(x, 'precision'), cell(x, 'f1'), cell(x, 'roc_auc'), cell(x, 'pr_auc')])} />
        <p className="note" style={{ marginTop: 8 }}>Gradient Boosting, LightGBM, CatBoost, Random Forest, XGBoost, the Neural Network and both ensembles all sit inside a narrow band (ROC-AUC 0.758 to 0.765). That tells us the signal in this data is limited, mostly the shipping option.</p>
      </Card>
      <div className="two">
        <Card title="Recall by model" lead="Share of really late orders caught at the default 0.5 line.">
          <Bars rows={[...b].sort((x: any, y: any) => y.recall - x.recall).map((x: any) => ({ label: x.model.replace(' (sklearn)', '').replace(' (PyTorch)', ''), value: x.recall }))} fmt={v => v.toFixed(3)} max={0.7} />
        </Card>
        <Card title="ROC-AUC by model" lead="How well the model ranks late orders above on time ones. 0.5 is a coin flip.">
          <Bars rows={[...b].sort((x: any, y: any) => y.roc_auc - x.roc_auc).map((x: any) => ({ label: x.model.replace(' (sklearn)', '').replace(' (PyTorch)', ''), value: x.roc_auc }))} fmt={v => v.toFixed(3)} max={0.8} />
        </Card>
      </div>
      <Card title="What we learned along the way" lead="Bugs and surprises are part of the result. They are all in the decision log.">
        <Steps items={[
          { title: 'The first baseline predicted "late" for everyone', text: 'It used Shipping Mode OR Region. Because the late rate is over 50%, nearly every region qualified. The classification report exposed it. Using Shipping Mode alone gave a real baseline: Recall 0.53, Precision 0.84.' },
          { title: 'SVM looked different until it converged', text: 'After raising max_iter and setting dual=False, the linear SVM matched Logistic Regression almost exactly. The first gap was only an unfinished optimization.' },
          { title: 'Built in feature importance was misleading', text: 'Random Forest and LightGBM ranked order_hour high and Shipping Mode low, which contradicted EDA. Both measures favour features with many values. Permutation importance and later SHAP gave the real picture.' },
          { title: 'Newer boosting is not more accurate here', text: 'Only AdaBoost lagged. Classic Gradient Boosting matched XGBoost, LightGBM and CatBoost on every metric, so the newer libraries are faster, not better, on this dataset.' },
          { title: 'Voting and Stacking did not help', text: 'Both ensembles scored lower on Recall than Random Forest alone. The four models they combined all make similar mistakes.' },
          { title: 'Candidates for tuning', text: 'Random Forest (best Recall), the Neural Network (best ROC-AUC and Precision), with XGBoost as a backup. XGBoost later became the model inside this app.' },
        ]} />
      </Card>
      <Related stage="Stage 5" />
    </div>
  )
}

const CHOSEN: Record<string, string> = { 'Random Forest': 'Report model', XGBoost: 'Live app model' }
export function Tuning() {
  const r = useReport(); const [m, setM] = useState('Random Forest'); const [sp, setSp] = useState<'val' | 'test'>('val'); const [t, setT] = useState<number | null>(null)
  if (!r) return <Skeleton h={500} />
  const M = r.models[m]; const sweep = sp === 'val' ? M.sweep_val : M.sweep_test; const thr = t ?? M.threshold
  const row = sweep.find((x: any) => Math.abs(x.t - thr) < 1e-9) ?? sweep[0]
  const frac = (thr - 0.05) / 0.9
  const series = [
    { name: 'Recall (late orders caught)', color: '#2a6fdb', values: sweep.map((x: any) => x.recall) },
    { name: 'Precision (flags that were right)', color: '#c8691a', values: sweep.map((x: any) => x.precision) },
    { name: 'Share of orders flagged', color: '#8a63d2', values: sweep.map((x: any) => x.flagged), dash: '5 4' },
  ]
  const costMin = sweep.reduce((a: any, x: any) => x.cost < a.cost ? x : a, sweep[0])
  const flagAll = sweep[0]
  const mseries = [{ name: 'Random Forest', color: '#2a6fdb', values: r.models['Random Forest'].val.matched.map((x: any) => x.precision) }, { name: 'XGBoost', color: '#c8691a', values: r.models.XGBoost.val.matched.map((x: any) => x.precision) }, { name: 'Neural Network', color: '#1b9e8a', values: r.nn_matched.map((x: any) => x.precision) }]
  return (
    <div className="grid">
      <PageHead stage="Stages 7 and 8" nb="notebook 05_hyperparameter_tuning_and_evaluation" line="Tuning helped less than expected, all three tuned models tie at the operating point, and the threshold came from a Recall target because a cost based threshold flagged almost every order." viva="Why not just use the threshold that minimizes cost?" />
      <div className="three-cols grid g3">
        {(['Random Forest', 'XGBoost'] as const).map(k => <Card key={k} title={`${k} settings`} lead="Best of the Optuna search, picked on validation.">
          <Tbl head={['Setting', 'Value']} num={[1]} rows={Object.entries(r.models[k].params).map(([a, v]) => [a, typeof v === 'number' ? (Number.isInteger(v) ? String(v) : (v as number).toPrecision(3)) : String(v)])} /></Card>)}
        <Card title="Neural network settings" lead="Two hidden layers, tuned the same way."><Tbl head={['Setting', 'Value']} num={[1]} rows={Object.entries(r.nn_params).map(([a, v]) => [a, typeof v === 'number' ? (Number.isInteger(v) ? String(v) : (v as number).toPrecision(3)) : String(v)])} /></Card>
      </div>
      <div className="two">
        <Card title="Random Forest search" lead="Each dot is one Optuna trial.">{fig('rf_optimization_history.png', 'Random Forest Optuna history')}</Card>
        <Card title="XGBoost search" lead="The first attempt used Recall as the goal and was thrown away. The second used PR-AUC.">{fig('xgb_optuna_history.png', 'XGBoost Optuna history')}</Card>
      </div>
      <Card title="Fair comparison at the same Recall" lead="Precision of each tuned model when all are forced to catch the same share of late orders (validation set).">
        <LineChart series={mseries} height={260} xTitle="Recall target" yTitle="Precision" xFmt={x => (0.6 + 0.3 * x).toFixed(2)} ticks={[0, 1 / 6, 2 / 6, .5, 4 / 6, 5 / 6, 1]} tipTitle={s => `Recall target ${s}`} />
        <ChartLegend series={mseries} />
        <p className="note" style={{ marginTop: 8 }}>At Recall 0.80 the three models are within 0.5 points of each other (about 0.64 Precision). So the choice between them is not critical. The Neural Network did not improve with tuning.</p>
      </Card>
      <Card title="Threshold explorer" lead="Move the line and watch the trade off. Everything is on validation unless you switch, and the test view is for evaluation only.">
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
          <div className="seg">{Object.keys(CHOSEN).map(k => <button key={k} className={m === k ? 'on' : ''} onClick={() => { setM(k); setT(null) }}>{k}</button>)}</div>
          <div className="seg"><button className={sp === 'val' ? 'on' : ''} onClick={() => setSp('val')}>Validation</button><button className={sp === 'test' ? 'on' : ''} onClick={() => setSp('test')}>Test (view only)</button></div>
          <button className="btn" onClick={() => setT(null)}>Chosen line: {M.threshold.toFixed(2)}</button>
        </div>
        <input className="slider" type="range" min={5} max={95} value={Math.round(thr * 100)} onChange={e => setT(+e.target.value / 100)} aria-label="Threshold" />
        <div className="grid g4" style={{ margin: '12px 0' }}>
          <div className="tile"><div className="eyebrow">Flag orders above</div><div className="k num">{thr.toFixed(2)}</div></div>
          <div className="tile"><div className="eyebrow">Recall</div><div className="k num">{pc(row.recall)}</div></div>
          <div className="tile"><div className="eyebrow">Precision</div><div className="k num">{pc(row.precision)}</div></div>
          <div className="tile"><div className="eyebrow">Orders flagged</div><div className="k num">{pc(row.flagged, 0)}</div></div>
        </div>
        <LineChart series={series} height={280} marker={frac} xTitle="Threshold" yTitle="Share" xFmt={x => (0.05 + 0.9 * x).toFixed(2)} tipTitle={s => `Threshold ${s}`} />
        <ChartLegend series={series} />
        <p className="note" style={{ marginTop: 8 }}>The rule used: the highest threshold where validation Recall is at least 0.80. That gives {r.models['Random Forest'].threshold} for the Random Forest and {r.models.XGBoost.threshold} for XGBoost.</p>
      </Card>
      <div className="two">
        <Card title="Why not the cost based threshold" lead="A missed late order costs 3, a false alarm costs 1.">
          <Tbl head={['Choice (validation, Random Forest)', 'Cost']} num={[1]} rows={[
            ['Flag nothing', '12,837'], ['Default 0.5', '5,544'], [`Cost minimum at threshold ${r.threshold_notes.cost_threshold}`, '3,399'], ['Flag everything', '3,611']]} />
          <p className="note" style={{ marginTop: 8 }}>With 55% late orders, the cheapest policy is to flag almost everything (97% of orders). That is no use to an ops team. So the threshold comes from a Recall target of 0.80 instead.</p>
        </Card>
        <Card title="What drove the search" lead="Which settings mattered most to the XGBoost search.">{fig('xgb_optuna_importances.png', 'XGBoost parameter importances')}</Card>
      </div>
      <Callout title="Honest result">Tuning moved ROC-AUC by less than one point. The value of this stage is the threshold, the fair comparison, and knowing that all three models are tied where we operate.</Callout>
      <Related stage="Stage 7" />
    </div>
  )
}
