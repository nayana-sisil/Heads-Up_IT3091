import { useState } from 'react'
import { useReport } from '../../data'
import { useGet } from '../../api'
import { Bars, Card, Skeleton, TierChip } from '../../components/ui'
import { Callout, PageHead, Related, Stat, Steps, Tbl, pc } from '../../components/tech'
import { money, num } from '../../format'
import { useApp } from '../../state'
import { DotPlot, Flow, Dots100 } from '../../components/viz'

export function Priority() {
  const r = useReport(); const { go } = useApp(); const { data: t } = useGet<any>('/api/trust'); const [m, setM] = useState('XGBoost')
  if (!r || !t) return <Skeleton h={500} />
  const P = r.prioritization_top10[m]; const cut = t.config.tier_cutoffs
  const order: [string, string][] = [['Random order', 'Random'], ['Sales only', 'Sales only'], ['Risk only', 'Risk only'], ['Simple rule', 'Simple rule × Sales'], ['Heads Up', 'Heads Up (risk × Sales)'], ['Oracle', 'Perfect (ceiling)']]
  return (
    <div className="grid">
      <PageHead stage="Stage 9" nb="notebook 06_shipment_prioritization" big="Chance of late × order value puts the right orders at the top." line="Chance of late × order value puts the right orders at the top. It beats ranking by risk alone or by money alone, but a simple shipping rule ties it." chips={[{ icon: 'money', k: '36%', l: 'of late revenue in top 10%' }, { icon: 'users', k: '11%', l: 'with random picking' }, { icon: 'rank', k: '48%', l: 'best possible (oracle)' }]} />
      <div className="two">
        <Card title="The priority score" lead="One line, easy to explain.">
          <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-.02em', margin: '4px 0 12px' }}>priority = chance of late<sup>α</sup> × order value</div>
          <Steps items={[
            { title: 'Chance of late', text: 'From the model, between 0 and 1.' },
            { title: 'Order value (Sales)', text: 'Not profit, so loss making orders are not counted as negative value.' },
            { title: 'α = 1', text: 'Risk and money count equally. The Team capacity page lets you try other weights.' },
          ]} />
          <p className="note" style={{ marginTop: 10 }}>Example: an order with a 90% chance of being late and a value of $1,000 scores 900. A 90% order worth $100 scores 90.</p>
        </Card>
        <Card title="How we judged it" lead="Same review budget for every method. Which one reaches the most late revenue?">
          <p style={{ marginTop: 0 }}>We take the top 10% of orders from each ranking and add up the value of those that were really late. We also report precision: how many of the top orders were late. A perfect ranking is shown as a ceiling.</p>
          <div className="seg" style={{ marginTop: 6 }}>{['XGBoost', 'Random Forest'].map(k => <button key={k} className={m === k ? 'on' : ''} onClick={() => setM(k)}>{k}</button>)}</div>
          <p className="note" style={{ marginTop: 8 }}>Both models are shown. The app uses XGBoost. The Stage 9 notebook used the Random Forest.</p>
        </Card>
      </div>
      <div className="two">
        {(['validation', 'test'] as const).map(k => <Card key={k} title={`Top 10% queue, ${k} set (${m})`} lead="Share of late revenue reached. Higher is better.">
          <DotPlot min={0} max={0.55} fmt={v => pc(v, 0)} refLine={P[k]['Oracle'].revenue} refLabel="best possible" rows={order.filter(([key]) => key !== 'Oracle').map(([key, lab]) => ({ label: lab, value: P[k][key].revenue, color: key === 'Heads Up' ? 'var(--good)' : key === 'Random order' ? 'var(--std)' : undefined }))} />
          <div style={{ marginTop: 10 }}><div className="eyebrow" style={{ marginBottom: 6 }}>Top 100 orders, Heads Up</div><Dots100 size={18} cols={20} cats={[{ n: Math.round(P[k]['Heads Up'].precision * 100), color: 'var(--crit)', label: 'really late' }, { n: 100 - Math.round(P[k]['Heads Up'].precision * 100), color: 'var(--std)', label: 'on time' }]} /></div>
          <p className="note" style={{ marginTop: 8 }}>Precision at the top: Heads Up {pc(P[k]['Heads Up'].precision, 0)}, risk only {pc(P[k]['Risk only'].precision, 0)}, sales only {pc(P[k]['Sales only'].precision, 0)}.</p>
        </Card>)}
      </div>
      <Callout title="How to read this honestly">Risk only gets nearly every pick right, but they are small orders, so it reaches little money. Sales only picks big orders, but almost half are not late. Heads Up combines both. The simple rule (shipping option and the Same Day noon line, times Sales) is a tie. We keep the model because it gives a separate chance and a reason for every order, which a rule cannot.</Callout>
      <Card title="From score to action" lead="Orders below the risk threshold are always Standard, however big they are.">
        <Flow nodes={[
          { icon: 'brain', title: 'Chance of late', text: 'From the model.', color: 'var(--brand)' },
          { icon: 'money', title: '× order value', text: 'Sales, not profit.', color: 'var(--high)' },
          { icon: 'rank', title: 'Priority score', text: `Top 10% (${money(cut.critical_min)}+) is Critical, next 20% (${money(cut.high_min)}+) is High.`, color: 'var(--crit)' },
          { icon: 'flag', title: 'Action tier', text: 'Critical today, High this week, Standard normal.', color: 'var(--good)' },
        ]} />
      </Card>
      <Card title="Action tiers" lead={`Cut points were set on validation orders: Critical is the top 10% by priority score (${money(cut.critical_min)} or more), High is the next 20% (${money(cut.high_min)} or more). Orders below the risk threshold (${t.config.risk_threshold}) cannot be High.`}>
        <Tbl head={['Tier', 'Set', 'Orders', 'Share', 'Late rate', 'Avg order', 'Late revenue held']} num={[2, 3, 4, 5, 6]} rows={(['validation', 'test'] as const).flatMap(k => ['Critical', 'High', 'Standard'].map(tn => { const x = t.tiers[k][tn]; return [<TierChip tier={tn} />, k, num(x.orders), pc(x.share_orders, 1), pc(x.late_rate, 0), money(x.avg_sales), pc(x.share_late_revenue, 0)] }))} />
        <p className="note" style={{ marginTop: 8 }}>On the test set the Critical share drops from 10% to about 5% because the average order value fell from about $612 to $401. The ranking still works, but the cut points should be refreshed on recent data.</p>
        <button className="btn" style={{ marginTop: 10 }} onClick={() => go('capacity')}>Try other review budgets and risk weights</button>
      </Card>
      <Related stage="Stage 9" />
    </div>
  )
}

export function System() {
  const { go } = useApp()
  return (
    <div className="grid">
      <PageHead stage="Stage 10" nb="app/ in the repo" big="The model runs inside your browser, so nothing can break during a demo." line="Everything in this site runs from the same files as the notebooks. The model runs inside your browser, so there is no server to break during a demo." chips={[{ icon: 'server', k: '0.88 MB', l: 'live model file' }, { icon: 'check', k: '16', l: 'automated API tests' }, { icon: 'code', k: '28', l: 'features rebuilt in JS' }]} />
      <Card title="How the pieces fit" lead="From raw data to what you see on screen.">
        <Flow nodes={[
          { icon: 'data', title: 'Raw data', text: 'DataCo CSV, 180,519 lines', color: 'var(--std)' },
          { icon: 'log', title: 'Notebooks 01 to 06', text: 'EDA, cleaning, features, models, tuning, prioritization', color: 'var(--brand)' },
          { icon: 'code', title: 'Export scripts', text: 'export_app_data, export_lookups, export_report_data', color: 'var(--high)' },
          { icon: 'box', title: 'Model and data files', text: 'XGBoost trees, scaler, lookups, report numbers', color: 'var(--acc)' },
          { icon: 'eye', title: 'This site', text: 'React page with an in-browser XGBoost and SHAP engine', color: 'var(--good)' },
        ]} />
        
        <p className="note" style={{ marginTop: 10 }}>A FastAPI version of the same engine also exists for running on a server or in Docker.</p>
      </Card>
      <div className="grid g3">
        <Stat icon="check" color="var(--good)" label="Browser vs Python model" value="0.00004" sub="largest difference in predicted chance on stored orders. SHAP values identical." />
        <Stat icon="layers" color="var(--brand)" label="Features from raw fields" value="11,836 of 11,836" sub="test orders rebuilt from raw fields give the same tier. Largest difference 0.00005." />
        <Stat icon="server" color="var(--high)" label="Backend tests" value="16 pass" sub="API, what-if, new order scoring, unknown country fallback, bad input" />
      </div>
      <div className="two">
        <Card title="What it is made of">
          <Tbl head={['Part', 'Technology']} rows={[['Model', 'Tuned XGBoost (426 trees), shipped as a small JSON file'], ['Explanations', 'Path dependent TreeSHAP, ported to TypeScript and checked against the XGBoost library'], ['Interface', 'React 18, TypeScript, Vite, hand drawn SVG charts'], ['Server version', 'FastAPI and pandas, with pytest tests'], ['Hosting', 'Free static Hugging Face Space (a Docker Space needs a paid plan)'], ['Build', 'Docker file included for a one container version']]} />
        </Card>
        <Card title="How we verified it" lead="Three checks, all repeatable.">
          <Steps items={[
            { title: 'Same answer as Python', text: 'The browser engine reproduces XGBoost predictions and SHAP values. It needed 32 bit number handling to match exactly.' },
            { title: 'Same features as the notebook', text: 'npm run check:features rebuilds all 11,836 test orders from raw fields and compares the predictions.' },
            { title: 'Same numbers as the notebooks', text: 'The report pages read files computed from your data and models, and an assertion checks the saved test result matches.' },
          ]} />
        </Card>
      </div>
      <Card title="Run it yourself">
        <pre className="code">{`# rebuild the data the app reads (from the repo root)
python app/pipeline/export_app_data.py
python app/pipeline/export_lookups.py
python app/pipeline/export_report_data.py

# web interface
cd app/frontend && npm install && npm run dev

# static build that runs fully in the browser
python app/pipeline/make_static_data.py
npm run build:static && npm run check:features

# API version
cd app/backend && pip install -r requirements.txt && uvicorn main:app --port 7860`}</pre>
      </Card>
      <Callout title="Known limits of the app">It scores one order at placement time and does not forecast volume. The demo orders are a replay of the test set. The data is public in the browser, so use a private Space for anything sensitive. Order values drifted, so tiers need refreshing on recent data.</Callout>
      <div className="pill-row"><button className="btn" onClick={() => go('check')}>Try a live prediction</button><button className="btn" onClick={() => go('decisions')}>Read the decision log</button></div>
    </div>
  )
}
