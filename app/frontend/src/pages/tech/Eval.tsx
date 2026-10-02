import { useReport } from '../../data'
import { Bars, CalibrationChart, Card, ChartLegend, LineChart, Skeleton } from '../../components/ui'
import { Callout, PageHead, Related, SignedColumns, Tbl, fig, pc, resample } from '../../components/tech'
import { num } from '../../format'
import { useApp } from '../../state'
import { ConfMatrix, Ring, Waterfall, IconCards } from '../../components/viz'

export function Explain() {
  const r = useReport(); const { go } = useApp(); if (!r) return <Skeleton h={500} />
  const ex = r.explain
  const dep = ex.hour_dependence_xgb_val
  return (
    <div className="grid">
      <PageHead stage="Stage 8" nb="notebook 05, section 6 (SHAP)" big="Shipping option leads. Order hour matters only inside Same Day orders." line="The model leans on shipping option. The hour of the order matters only inside Same Day orders, where it flips from never late before noon to almost always late after." chips={[{ icon: 'clock', k: '0%', l: 'Same Day late before noon' }, { icon: 'alert', k: '96%', l: 'Same Day late from noon' }, { icon: 'brain', k: 'SHAP', l: 'how we explain it' }]} />
      <div className="two">
        <Card title="What the Random Forest uses" lead={`Average size of each input's push on the prediction (SHAP), on ${num(ex.rf_sample_rows)} sampled validation orders.`}>
          <Bars rows={ex.rf_global.slice(0, 8).map((x: any) => ({ label: x.feature, value: x.value }))} fmt={v => v.toFixed(3)} />
        </Card>
        <Card title="What XGBoost uses" lead="Same measure on all 7,890 validation orders.">
          <Bars rows={ex.xgb_global.slice(0, 8).map((x: any) => ({ label: x.feature, value: x.value }))} fmt={v => v.toFixed(2)} />
        </Card>
      </div>
      <Card title="The noon cliff" lead="How much the hour of the order pushes the risk, by hour (XGBoost, validation orders). Red is Same Day orders. Blue is every other shipping option.">
        <SignedColumns items={dep.map((d: any) => ({ label: String(d.hour), a: d.same_day, b: d.others }))} series={['Same Day', 'Other options']} height={250} showEvery={2} />
        <div className="legend" style={{ marginTop: 6 }}><span><i className="sw" style={{ background: 'var(--crit)' }} />Same Day orders</span><span><i className="sw" style={{ background: 'var(--brand)' }} />Other shipping options</span></div>
        <p className="note" style={{ marginTop: 8 }}>Positive means more risk. For Same Day orders the push is strongly negative until 11:59 and strongly positive from 12:00. For other options the hour barely matters. This is why Random Forest's built in importance, which shows order_hour as big, was resolved as a Same Day interaction and not as noise.</p>
      </Card>
      <div className="two">
        <Card title="SHAP summary: Random Forest" lead="Each dot is an order. Right means higher risk.">{fig('shap_summary_rf.png', 'SHAP summary for the Random Forest')}</Card>
        <Card title="SHAP summary: XGBoost">{fig('shap_summary_xgb.png', 'SHAP summary for XGBoost')}</Card>
      </div>
      <div className="two">
        <Card title="Dependence plot from the notebook" lead="order_hour against its SHAP value, coloured by shipping option.">{fig('shap_dependence_order_hour.png', 'SHAP dependence of order hour')}</Card>
        <Card title="One order explained" lead="The same idea powers the reasons in the app.">
          <Waterfall base={0.55} baseLabel="Typical order" steps={[{ label: 'Shipping: Second Class', delta: 0.21 }, { label: 'Placed in the afternoon', delta: 0.05 }, { label: 'Country late rate', delta: -0.03 }, { label: 'Payment: Debit', delta: -0.01 }]} endLabel="This order" />
          <p className="note" style={{ margin: '0 0 8px' }}>An illustration of the idea with round numbers. Real orders are in Check an order.</p>
          <p style={{ marginTop: 0 }}>For any single order, SHAP splits the final chance into pushes from each input: shipping option, hour, payment type and so on. Red pushes up, green pulls down. In the app this is the "Show the numbers" panel on Check an order.</p>
          <button className="btn primary" onClick={() => go('check')}>Open Check an order</button>
          <p className="note" style={{ marginTop: 12 }}>Caution: the noon pattern looks like a rule built into this dataset. It is strong enough to dominate the model, but a real carrier may not behave like this.</p>
        </Card>
      </div>
      <Callout title="Method note">SHAP on the Random Forest takes about 15 minutes per 1,000 orders, so it was run once on a 1,000 order sample and saved. XGBoost explains an order in about a second, which is one reason it powers the live app.</Callout>
      <Related stage="Stage 7" />
    </div>
  )
}

const COLORS = { 'Random Forest': '#2a6fdb', XGBoost: '#c8691a' } as const
export function Final() {
  const r = useReport(); if (!r) return <Skeleton h={500} />
  const rf = r.models['Random Forest'], xg = r.models.XGBoost
  const col = (m: any, s: 'val' | 'test') => { const o = m[s].at_threshold; return [o.recall, o.precision, o.f1, o.flagged, m[s].roc_auc, m[s].pr_auc] }
  const names = ['Recall', 'Precision', 'F1', 'Orders flagged', 'ROC-AUC', 'PR-AUC']
  const rows = names.map((n, i) => [n, ...[col(rf, 'val')[i], col(rf, 'test')[i], col(xg, 'val')[i], col(xg, 'test')[i]].map(v => i === 4 || i === 5 ? v.toFixed(3) : pc(v))])
  const roc = [{ name: 'Random Forest', color: COLORS['Random Forest'], values: resample(rf.curves_test.roc) }, { name: 'XGBoost', color: COLORS.XGBoost, values: resample(xg.curves_test.roc) }, { name: 'Coin flip', color: '#8a93b0', values: Array.from({ length: 101 }, (_, i) => i / 100), dash: '4 4', width: 1.5 }]
  const pr = [{ name: 'Random Forest', color: COLORS['Random Forest'], values: resample(rf.curves_test.pr) }, { name: 'XGBoost', color: COLORS.XGBoost, values: resample(xg.curves_test.pr) }]
  const cm = (m: any) => { const o = m.test.at_threshold; return <ConfMatrix tp={o.tp} fp={o.fp} fn={o.fn} tn={o.tn} /> }
  return (
    <div className="grid">
      <PageHead stage="Stage 8" nb="notebook 05, sections 7 and 8" big="On orders it never saw, the models catch 86% to 88% of late orders." line="On orders it had never seen, the Random Forest catches 88% of late orders and XGBoost 86%, with about 61% to 63% of flags correct. The test set was opened once, after every choice was fixed." chips={[{ icon: 'flag', k: '88%', l: 'Random Forest Recall' }, { icon: 'flag', k: '86%', l: 'XGBoost Recall' }, { icon: 'check', k: '61 to 63%', l: 'of flags were right' }]} />
      <Callout title="Why two models">
        The <span style={{ fontWeight: 800 }}>Random Forest</span> is the report model: it was the Recall leader through development and went through the full evaluation. The <span style={{ fontWeight: 800 }}>XGBoost</span> model runs the live app because the file is only {xg.size_mb} MB, it explains an order in about a second (SHAP on the forest takes about 15 minutes per 1,000 orders), and it can run inside a web page. At the chosen operating point the two are tied, so nothing is lost. Both are shown here, labelled.
      </Callout>
      <div className="two">
        {([['Random Forest', rf, 'Report model'], ['XGBoost', xg, 'Live app model']] as const).map(([n, m, tag]) => (
          <Card key={n} title={n} lead={`${tag}, on ${num(m.test.at_threshold.tp + m.test.at_threshold.fn + m.test.at_threshold.fp + m.test.at_threshold.tn)} unseen test orders`}>
            <div className="rings"><Ring value={m.test.at_threshold.recall} label="Recall" color="var(--good)" /><Ring value={m.test.at_threshold.precision} label="Precision" color="var(--high)" /><Ring value={m.test.roc_auc} label="ROC-AUC" color="var(--brand)" fmt={v => v.toFixed(2)} /></div>
          </Card>))}
      </div>
      <Card title="Side by side" lead="Each model at its own chosen threshold. Validation is where the thresholds were chosen. Test is the final, unseen result.">
        <Tbl head={['', `Random Forest val (${rf.threshold})`, `Random Forest test`, `XGBoost val (${xg.threshold})`, 'XGBoost test']} num={[1, 2, 3, 4]} rows={rows} />
        <p className="note" style={{ marginTop: 8 }}>The report model's saved test result is Recall {r.final_test_file.test_recall.toFixed(3)}, Precision {r.final_test_file.test_precision.toFixed(3)}, ROC-AUC {r.final_test_file.test_roc_auc.toFixed(3)} (final_test_results.json), which this page reproduces.</p>
      </Card>
      <div className="two">
        <Card title="Random Forest on test: confusion matrix" lead={`${num(rf.test.at_threshold.tp + rf.test.at_threshold.fn + rf.test.at_threshold.fp + rf.test.at_threshold.tn)} orders`}>{cm(rf)}</Card>
        <Card title="XGBoost on test: confusion matrix" lead="Same orders, its own threshold.">{cm(xg)}</Card>
      </div>
      <div className="grid">
        <Card title="ROC curve (test)" lead="Closer to the top left is better.">
          <LineChart series={roc} height={290} xTitle="False alarm rate" yTitle="Late orders caught" tipTitle={s => `False alarm rate ${s}`} />
          <ChartLegend series={roc} />
        </Card>
        <Card title="Precision and recall (test)" lead="As we catch more late orders, precision falls.">
          <LineChart series={pr} height={290} xTitle="Recall" yTitle="Precision" tipTitle={s => `Recall ${s}`} />
          <ChartLegend series={pr} />
        </Card>
      </div>
      <Card title="Can we trust the percentages?" lead="Orders grouped by predicted chance (test). On the dashed line, a 70% prediction means 70% really late.">
        <div style={{ maxWidth: 520 }}><CalibrationChart lines={[{ name: 'Random Forest', color: COLORS['Random Forest'], pts: rf.calib_test }, { name: 'XGBoost', color: COLORS.XGBoost, pts: xg.calib_test }]} /></div>
        <div className="legend" style={{ marginTop: 6 }}><span><i className="sw" style={{ background: COLORS['Random Forest'] }} />Random Forest</span><span><i className="sw" style={{ background: COLORS.XGBoost }} />XGBoost</span></div>
        <p className="note" style={{ marginTop: 8 }}>XGBoost stays within about 5 points of the line in every group. The Random Forest under predicts its lowest risk group by about 8 to 10 points. That matters for the priority score, which multiplies the chance by money.</p>
      </Card>
      <Card title="Read these results with care" lead="What the numbers do and do not say.">
        <IconCards cols={2} items={[
          { icon: 'filter', title: 'More orders flagged on test', color: 'var(--high)', text: <>Random Forest {pc(rf.val.at_threshold.flagged, 0)} to {pc(rf.test.at_threshold.flagged, 0)}, XGBoost {pc(xg.val.at_threshold.flagged, 0)} to {pc(xg.test.at_threshold.flagged, 0)}. The tool works as a prioritizer, not a filter.</> },
          { icon: 'models', title: 'Recall up, Precision down a little', color: 'var(--brand)', text: 'The later orders look riskier to the model.' },
          { icon: 'target', title: 'A modest model', color: 'var(--std)', text: <>ROC-AUC is {rf.test.roc_auc.toFixed(3)} for the Random Forest and {xg.test.roc_auc.toFixed(3)} for XGBoost on test. Most of the signal is the shipping option.</> },
          { icon: 'trust', title: 'Test opened once', color: 'var(--good)', text: 'After the model and threshold were fixed on validation.' },
        ]} />
      </Card>
      <Related stage="Stage 7" />
    </div>
  )
}
