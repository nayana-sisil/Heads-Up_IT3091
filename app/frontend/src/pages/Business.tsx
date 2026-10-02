import { useGet } from '../api'
import { Card, Skeleton, TierChip } from '../components/ui'
import { Callout, Steps, Tbl, pc } from '../components/tech'
import { useApp } from '../state'
import { money } from '../format'

export default function Business() {
  const { go } = useApp()
  const { data: t } = useGet<any>('/api/trust')
  if (!t) return <Skeleton h={500} />
  const te = t.splits.test, va = t.splits.validation, tiers = t.tiers.test
  const h10 = te.schemes['Heads Up']['10'], r10 = te.schemes['Random order']['10']
  return (
    <div className="grid">
      <Card className="hero">
        <div className="eyebrow">The business problem</div>
        <h2 style={{ margin: '6px 0 0', fontSize: 'clamp(20px,2.6vw,28px)', letterSpacing: '-.02em', maxWidth: 820, lineHeight: 1.25 }}>Today, operations only learns that an order is late after it is already late. Heads Up gives a warning while there is still time to act.</h2>
        <p className="muted" style={{ maxWidth: 780, margin: '12px 0 0' }}>A logistics company ships hundreds of orders a day. A missed delivery brings penalties, angry customers and extra work. The team cannot chase every order, so the real question is: which few orders should we look at first? Heads Up answers that at the moment the order is placed.</p>
        <div className="pill-row" style={{ marginTop: 16 }}>
          <button className="btn primary" onClick={() => go('check')}>Try it on an order</button>
          <button className="btn" onClick={() => go('problem')}>See how it was built</button>
        </div>
      </Card>

      <div className="grid g3">
        <Card title="1. Predict" lead="Primary lens: late delivery risk."><p style={{ margin: 0 }}>For every new order the model gives the chance that it will arrive late. It only uses facts known at order time, such as shipping option, time placed, country, product and order value.</p></Card>
        <Card title="2. Rank" lead="Secondary lens: shipment prioritization."><p style={{ margin: 0 }}>Chance of late multiplied by order value gives a priority score. A likely late order worth $2,000 comes before a likely late order worth $50.</p></Card>
        <Card title="3. Act" lead="A plain next step for every order."><p style={{ margin: 0 }}>Each order lands in a tier: Critical, High or Standard. Each tier has an action, so people know what to do without reading a model.</p></Card>
      </div>

      <div className="grid g2">
        <Card title="A day with Heads Up" lead="How an operations lead would use it.">
          <Steps items={[
            { title: 'Order desk, all day', text: <>Before confirming an order, the desk checks it on <a href="#/check" onClick={() => go('check')}>Check an order</a>. If the answer is "Probably late", they change the shipping option or the promise date.</> },
            { title: 'Morning queue, 9:00', text: <>The lead opens <a href="#/handle" onClick={() => go('handle')}>Orders to handle</a>. Critical orders get a call to the carrier today. High orders get a follow up this week.</> },
            { title: 'Weekly planning', text: <>The team uploads next week's orders in <a href="#/file" onClick={() => go('file')}>Score a file</a> to see where the pressure will be, and decides how many people it needs.</> },
            { title: 'Monthly review', text: 'Compare predictions with what really happened and refresh the tier cut points if order values have shifted.' },
          ]} />
        </Card>
        <Card title="What each tier means" lead="Tiers come from the priority score, set on validation orders.">
          <Tbl head={['Tier', 'Do this', 'When']} rows={[
            [<TierChip tier="Critical" />, 'Call the carrier, confirm pickup, warn the customer', 'Today'],
            [<TierChip tier="High" />, 'Follow up with the carrier, flag for a status update', 'This week'],
            [<TierChip tier="Standard" />, 'Normal handling', 'No action'],
          ]} />
          <p className="note" style={{ marginTop: 10 }}>On the test orders, Critical orders were late {pc(tiers.Critical.late_rate, 0)} of the time, High {pc(tiers.High.late_rate, 0)}, and Standard {pc(tiers.Standard.late_rate, 0)}.</p>
        </Card>
      </div>

      <Card title="What it is worth" lead="Measured by replaying the 11,836 test orders the model never saw.">
        <div className="grid g3" style={{ marginBottom: 12 }}>
          <div className="tile"><div className="k num">{pc(h10.revenue_reached, 0)}</div><div className="muted">of late revenue reached by reviewing only the top 10% of orders</div></div>
          <div className="tile"><div className="k num">{pc(r10.revenue_reached, 0)}</div><div className="muted">reached by reviewing 10% of orders at random</div></div>
          <div className="tile"><div className="k num">{pc(h10.precision, 0)}</div><div className="muted">of the orders at the top really were late</div></div>
        </div>
        <p style={{ margin: 0, maxWidth: 780 }}>In plain terms: if your team can look at 100 orders a day, the 10 at the top are about {Math.round(h10.precision * 10)} late out of 10, and together they hold about three times more of the late money than 10 orders picked at random. See the <a href="#/capacity" onClick={() => go('capacity')}>Team capacity</a> page to try other budgets.</p>
      </Card>

      <div className="grid g2">
        <Card title="Our recommendation">
          <Steps items={[
            { title: 'Use it as a ranking aid, not a promise', text: 'It decides what to look at first. It should not set promise dates for customers.' },
            { title: 'Review the top 10% to 30% of the queue', text: `Reviewing 30% reaches about ${pc(te.schemes['Heads Up']['30'].revenue_reached, 0)} of late revenue on the test orders.` },
            { title: 'Keep the simple shipping rule as a safety net', text: `A two line rule on shipping option and the Same Day noon cut off does almost as well in the top 10% (${pc(te.schemes['Simple rule']['10'].revenue_reached, 0)} against ${pc(h10.revenue_reached, 0)}). The model adds a separate chance and reasons for each order.` },
            { title: 'Refresh the tiers every month', text: 'Order values changed over time, so the cut points need updating on recent data.' },
          ]} />
        </Card>
        <Card title="When not to trust it" lead="The honest limits, in plain words.">
          <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 8 }}>
            <li>It learned from orders placed in 2015 to 2018. If carriers or shipping rules change, it can drift.</li>
            <li>The Same Day noon pattern (never late before noon, almost always late after) looks like a rule built into this dataset. A real carrier may not behave this way.</li>
            <li>Average order value dropped from about {money(va.avg_sales)} in validation to {money(te.avg_sales)} in test, so fewer orders reach the Critical tier on newer data.</li>
            <li>Countries and products the model never saw fall back to training averages, and the app says so.</li>
            <li>It predicts one order at the time it is placed. It does not forecast how many orders will arrive next week.</li>
          </ul>
        </Card>
      </div>
      <Callout title="Want the technical proof?">Every number on this page comes from the project notebooks. Open <a href="#/final" onClick={() => go('final')}>Final evaluation</a> and <a href="#/priority" onClick={() => go('priority')}>Prioritization</a> under "How it was built".</Callout>
    </div>
  )
}
