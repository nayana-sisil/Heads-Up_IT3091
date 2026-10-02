"""Model and data layer for the Heads Up app. Uses the XGBoost booster directly (no SHAP library needed)."""
import gzip, json
from pathlib import Path
import numpy as np, pandas as pd, xgboost as xgb

ART = Path(__file__).parent / 'artifacts'
SHIP_DAYS = {'First Class': 1, 'Same Day': 0, 'Second Class': 2, 'Standard Class': 4}
MODES = list(SHIP_DAYS)
SEGMENTS = ['Consumer', 'Corporate', 'Home Office']
TYPES = ['CASH', 'DEBIT', 'PAYMENT', 'TRANSFER']
LABEL = {'Sales':'Order value','Order Item Quantity':'Items ordered','Benefit per order':'Profit on order','n_line_items':'Number of lines',
 'n_distinct_categories':'Product categories','Benefit_per_order_capped':'Profit on order','priority_value_component':'Order value',
 'order_hour':'Hour of order','order_dayofweek':'Day of week','order_month':'Month','order_is_weekend':'Weekend order',
 'order_is_holiday_season':'Holiday season','sales_per_scheduled_day':'Value per scheduled day','is_express_shipping':'Express shipping',
 'country_delay_rate':'Country late rate','region_delay_rate':'Region late rate','Shipping Mode_First Class':'First Class shipping',
 'Shipping Mode_Same Day':'Same Day shipping','Shipping Mode_Second Class':'Second Class shipping','Shipping Mode_Standard Class':'Standard Class shipping',
 'Customer Segment_Consumer':'Consumer customer','Customer Segment_Corporate':'Corporate customer','Customer Segment_Home Office':'Home Office customer',
 'Type_CASH':'Paid by cash','Type_DEBIT':'Paid by debit','Type_PAYMENT':'Paid by payment','Type_TRANSFER':'Paid by transfer','category_frequency':'Product category popularity'}


class Engine:
    def __init__(self):
        self.config = json.load(open(ART / 'config.json'))
        sc = json.load(open(ART / 'scaler.json')); self.features = sc['features']; self.scaler = sc['scaled']
        self.booster = xgb.Booster(); self.booster.load_model(str(ART / 'xgb.json'))
        with gzip.open(ART / 'orders.json.gz', 'rt') as f: blob = json.load(f)
        self.base_value = blob['base_value']
        self.df = pd.DataFrame(blob['orders']); self.df['dt'] = pd.to_datetime(self.df['date'])
        self.df['hour'] = self.df['dt'].dt.hour
        self.drivers = {o['id']: o['drivers'] for o in blob['orders']}
        self.raw = pd.read_csv(ART / 'features_test.csv.gz').set_index('Order Id')
        self.trust = json.load(open(ART / 'trust.json'))
        self.thr = self.config['risk_threshold']
        self.crit = self.config['tier_cutoffs']['critical_min']; self.high = self.config['tier_cutoffs']['high_min']

    # ----- scoring -----
    def _scale(self, row: pd.Series) -> np.ndarray:
        v = row[self.features].astype(float).copy()
        for c, ms in self.scaler.items(): v[c] = (v[c] - ms['mean']) / ms['std']
        return v.values.reshape(1, -1)

    def score_row(self, row: pd.Series):
        X = self._scale(row); d = xgb.DMatrix(X, feature_names=self.features)
        p = float(self.booster.predict(d)[0])
        contrib = self.booster.predict(d, pred_contribs=True)[0]
        return p, contrib[:-1], float(contrib[-1])

    def tier(self, p, sales):
        pr = p * sales
        t = 'Critical' if pr >= self.crit else ('High' if pr >= self.high else 'Standard')
        return 'Standard' if (p < self.thr and t != 'Critical') else t

    def whatif(self, order_id: int, mode=None, hour=None, pay_type=None, segment=None, sales=None):
        base = self.raw.loc[order_id].copy()
        row = base.copy()
        if mode:
            for m in MODES: row[f'Shipping Mode_{m}'] = int(m == mode)
            row['is_express_shipping'] = int(mode in ('First Class', 'Same Day'))
        cur_mode = next(m for m in MODES if base[f'Shipping Mode_{m}'] == 1); new_mode = mode or cur_mode
        if hour is not None: row['order_hour'] = int(hour)
        if pay_type:
            for t in TYPES: row[f'Type_{t}'] = int(t == pay_type)
        if segment:
            for s in SEGMENTS: row[f'Customer Segment_{s}'] = int(s == segment)
        o = self.df.loc[self.df['id'] == order_id].iloc[0]
        s_new = float(sales) if sales is not None else float(o['sales'])
        row['Sales'] = s_new; row['priority_value_component'] = s_new
        row['sales_per_scheduled_day'] = s_new / max(SHIP_DAYS[new_mode], 1)
        out = {}
        for name, r in (('before', base), ('after', row)):
            if name == 'before':
                p, c, b = float(o['p']), None, self.base_value
            else:
                p, c, b = self.score_row(r)
            sv = float(o['sales']) if name == 'before' else s_new
            out[name] = {'p': p, 'priority': p * sv, 'tier': self.tier(p, sv), 'sales': sv}
            if c is not None:
                idx = np.argsort(-np.abs(c))[:8]
                out[name]['drivers'] = [{'label': LABEL.get(self.features[j], self.features[j]), 'shap': round(float(c[j]), 3)} for j in idx]
        return out

    # ----- ranking / evaluation -----
    def subset(self, date_from=None, date_to=None):
        d = self.df
        if date_from: d = d[d['dt'] >= pd.Timestamp(date_from)]
        if date_to: d = d[d['dt'] < pd.Timestamp(date_to) + pd.Timedelta(days=1)]
        return d

    def capacity(self, alpha=1.0, budget=0.10, date_from=None, date_to=None, curve_points=100):
        d = self.subset(date_from, date_to)
        if len(d) == 0: return None
        S = d['sales'].values; y = d['late'].values; p = d['p'].values
        sc = (p ** alpha) * S if alpha > 0 else S.copy()
        late_val = S * y; total = late_val.sum() or 1.0
        def curve(score):
            idx = np.argsort(-score, kind='stable'); cum = np.cumsum(late_val[idx]) / total
            pos = (np.linspace(0, 1, curve_points + 1)[1:] * (len(y) - 1)).astype(int)
            return [0.0] + [round(float(cum[q]), 4) for q in pos]
        n = max(1, int(round(len(y) * budget))); idx = np.argsort(-sc, kind='stable')[:n]
        rule = d['mode'].map({r['segment']: r['late_rate'] for r in self.trust['rule_table']}).fillna(0.5).values * S
        oracle = y * S + 1e-9 * S
        rng = np.random.default_rng(42)
        reached, prec = float(late_val[idx].sum() / total), float(y[idx].mean())
        o_idx = np.argsort(-oracle, kind='stable')[:n]
        return {'orders': int(len(y)), 'review_n': n, 'budget': budget, 'alpha': alpha,
                'revenue_reached': reached, 'precision': prec, 'late_revenue_total': float(total), 'late_revenue_reached': float(late_val[idx].sum()),
                'oracle_reached': float(late_val[o_idx].sum() / total), 'wasted_reviews': int(round(n * (1 - prec))),
                'curves': {'Heads Up': curve(sc), 'Sales only': curve(S), 'Risk only': curve(p + 1e-12 * S),
                           'Oracle': curve(oracle), 'Random order': curve(rng.random(len(y)))}}

    def summary(self, date_from=None, date_to=None):
        d = self.subset(date_from, date_to)
        tiers = d.groupby('tier').agg(orders=('id', 'size'), at_risk=('priority', 'sum'), avg_sales=('sales', 'mean')).to_dict('index')
        return {'orders': int(len(d)), 'flagged': int(d['flag'].sum()), 'revenue_at_risk': float(d['priority'].sum()),
                'sales_total': float(d['sales'].sum()), 'avg_risk': float(d['p'].mean()),
                'tiers': {k: {a: float(b) for a, b in v.items()} for k, v in tiers.items()},
                'by_mode': d.groupby('mode').agg(orders=('id', 'size'), risk=('p', 'mean'), at_risk=('priority', 'sum')).reset_index().to_dict('records'),
                'by_region': d.groupby('region').agg(orders=('id', 'size'), risk=('p', 'mean'), at_risk=('priority', 'sum')).reset_index().sort_values('at_risk', ascending=False).head(10).to_dict('records'),
                'by_hour': d.groupby('hour').agg(orders=('id', 'size'), risk=('p', 'mean')).reset_index().to_dict('records'),
                'date_min': str(d['dt'].min().date()), 'date_max': str(d['dt'].max().date())}
