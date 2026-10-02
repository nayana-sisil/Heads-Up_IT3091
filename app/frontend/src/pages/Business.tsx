import { useGet } from '../api'
import { Card, Skeleton, TierChip } from '../components/ui'
import { Callout, Steps, Tbl, pc } from '../components/tech'
import { useApp } from '../state'
import { money } from '../format'
import { Icon } from '../components/Icons'
import { Flow, Timeline, Dots100, IconCards, StatTile } from '../components/viz'

export default function Business() {
  const { go } = useApp()
  const { data: t } = useGet<any>('/api/trust')
  if (!t) return <Skeleton h={500} />
  const te = t.splits.test, va = t.splits.validation, tiers = t.tiers.test
  const h10 = te.schemes['Heads Up']['10'], r10 = te.schemes['Random order']['10']
  const late10 = Math.round(h10.precision * 10)
  return (
    <div className="grid">
      <section className="phero" style={{ ['--acc' as any]: 'var(--brand)' }}>
        <div className="wm" aria-hidden>$</div>
        <div className="badge"><Icon name="briefcase" size={15} />The business problem</div>
        <h2>Operations learns an order is late only after it is late. Heads Up gives a warning while there is still time.</h2>
        <p className="sub2">A logistics company ships hundreds of orders a day. A missed delivery brings penalties, angry customers and extra work. The team cannot chase every order, so the real question is which few to look at first.</p>
        <div className="pill-row" style={{ marginTop: 18, position: 'relative' }}>
          <button className="btn primary" onClick={() => go('check')}>Try it on an order</button>
          <button className="btn" onClick={() => go('problem')}>See how it was built</button>
        </div>
      </section>

      <Flow nodes={[
        { icon: 'brain', title: '1. Predict', text: 'Chance that each new order arrives late, using only facts known at order time.', color: 'var(--brand)' },
        { icon: 'rank', title: '2. Rank', text: 'Chance of late × order value. A likely late $2,000 order beats a likely late $50 one.', color: 'var(--high)' },
        { icon: 'flag', title: '3. Act', text: 'Critical, High or Standard, each with a plain next step.', color: 'var(--crit)' },
      ]} />

      <div className="sectitle">A day with Heads Up</div>
      <Card>
        <Timeline items={[
          { icon: 'check', title: 'Order desk, all day', tag: 'Check an order', text: <>Before confirming an order, the desk checks it on <a href="#/check" onClick={() => go('check')}>Check an order</a>. If the answer is "Probably late", they change the shipping option or the promise date.</> },
          { icon: 'list', title: 'Morning queue, 9:00', tag: 'Orders to handle', color: 'var(--crit)', text: <>The lead opens <a href="#/handle" onClick={() => go('handle')}>Orders to handle</a>. Critical orders get a call to the carrier today. High orders get a follow up this week.</> },
          { icon: 'upload', title: 'Weekly planning', tag: 'Score a file', color: 'var(--high)', text: <>The team uploads next week's orders in <a href="#/file" onClick={() => go('file')}>Score a file</a> to see where the pressure will be, and decides how many people it needs.</> },
          { icon: 'calendar', title: 'Monthly review', color: 'var(--good)', text: 'Compare predictions with what really happened and refresh the tier cut points if order values have shifted.' },
        ]} />
      </Card>

      <div className="sectitle">What each tier means</div>
      <div className="grid g3">
        {([['Critical', 'alert', 'var(--crit)', 'Today', 'Call the carrier, confirm pickup, warn the customer'], ['High', 'clock', 'var(--high)', 'This week', 'Follow up with the carrier, flag for a status update'], ['Standard', 'box', 'var(--std)', 'No action', 'Normal handling']] as const).map(([t, ic, c, when, what]) => (
          <div key={t} className="stile" style={{ ['--c' as any]: c }}>
            <span className="ico"><Icon name={ic} size={20} /></span>
            <div className="sv">{pc(tiers[t].late_rate, 0)}<span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink2)' }}> late</span></div>
            <div className="sl"><TierChip tier={t} /> <b>{when}</b></div>
            <div className="ss">{what}</div>
          </div>))}
      </div>
      <p className="note" style={{ margin: '-4px 4px 0' }}>Late share of each tier on the 11,836 test orders. Tiers come from the priority score, with cut points set on validation orders.</p>

      <div className="sectitle">What it is worth</div>
      <div className="grid g2">
        <Card title="Review 10 orders from the top" lead={`Out of every 10 orders at the top of the queue, about ${late10} really were late.`}>
          <Dots100 size={26} cols={10} cats={[{ n: 10 * late10, color: 'var(--crit)', label: 'late' }, { n: 100 - 10 * late10, color: 'var(--std)', label: 'on time' }]} />
          <p className="note" style={{ margin: '10px 0 0' }}>Each dot is one of the top 100 orders. Measured on test orders the model never saw.</p>
        </Card>
        <div className="grid" style={{ alignContent: 'start' }}>
          <StatTile icon="money" label="of late revenue reached by reviewing only the top 10% of orders" to={h10.revenue_reached * 100} fmt={v => `${Math.round(v)}%`} color="var(--good)" />
          <StatTile icon="users" label="reached by reviewing 10% of orders at random" to={r10.revenue_reached * 100} fmt={v => `${Math.round(v)}%`} color="var(--std)" />
          <p className="muted" style={{ margin: 0 }}>About three times more of the late money than picking at random. See <a href="#/priority" onClick={() => go('priority')}>Prioritization</a> for the full comparison.</p>
        </div>
      </div>

      <div className="sectitle">Our recommendation</div>
      <IconCards cols={4} items={[
        { icon: 'rank', title: 'A ranking aid, not a promise', text: 'It decides what to look at first. It should not set promise dates for customers.', color: 'var(--brand)' },
        { icon: 'filter', title: 'Review the top 10% to 30%', text: `Reviewing 30% reaches about ${pc(te.schemes['Heads Up']['30'].revenue_reached, 0)} of late revenue on the test orders.`, color: 'var(--good)' },
        { icon: 'code', title: 'Keep the simple rule as a safety net', text: `A two line shipping rule does almost as well in the top 10% (${pc(te.schemes['Simple rule']['10'].revenue_reached, 0)} against ${pc(h10.revenue_reached, 0)}). The model adds a separate, explained risk.`, color: 'var(--high)' },
        { icon: 'calendar', title: 'Refresh the tiers monthly', text: 'Order values changed over time, so the cut points need updating on recent data.', color: 'var(--crit)' },
      ]} />

      <div className="sectitle">When not to trust it</div>
      <IconCards cols={3} items={[
        { icon: 'calendar', title: 'Old data', text: 'It learned from orders placed in 2015 to 2018. If carriers or shipping rules change, it can drift.', color: 'var(--high)' },
        { icon: 'clock', title: 'The noon pattern', text: 'Same Day is never late before noon and almost always late after. That looks like a rule built into this dataset. A real carrier may not behave this way.', color: 'var(--crit)' },
        { icon: 'money', title: 'Order values moved', text: `Average order value dropped from about ${money(va.avg_sales)} in validation to ${money(te.avg_sales)} in test, so fewer orders reach the Critical tier on newer data.`, color: 'var(--high)' },
        { icon: 'help', title: 'Unseen countries and products', text: 'They fall back to training averages, and the app says so.', color: 'var(--std)' },
        { icon: 'box', title: 'One order at a time', text: 'It predicts one order when it is placed. It does not forecast how many orders will arrive next week.', color: 'var(--std)' },
      ]} />
      <Callout title="Want the technical proof?">Every number on this page comes from the project notebooks. Open <a href="#/final" onClick={() => go('final')}>Final evaluation</a> and <a href="#/priority" onClick={() => go('priority')}>Prioritization</a> under "How it was built".</Callout>
    </div>
  )
}
