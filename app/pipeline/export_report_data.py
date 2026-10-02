"""Build report.json and decisions.json: everything the "How it was built" pages show.

Run from the repo root:  python app/pipeline/export_report_data.py
Reads: data/raw data, data/processed, models/random_forest_tuned.pkl, app/backend/artifacts/xgb.json,
       the metrics_*.json files, DECISION_LOG.md.  Every number is computed here or copied from those files.
Validation is used to choose settings. Test numbers are shown for evaluation only.
"""
import json, re, warnings
from pathlib import Path
import numpy as np, pandas as pd, joblib, xgboost as xgb
from sklearn.metrics import roc_curve, precision_recall_curve, roc_auc_score, average_precision_score, precision_score, recall_score, f1_score

warnings.filterwarnings('ignore')
ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / 'data' / 'processed'
ART = ROOT / 'app' / 'backend' / 'artifacts'
OUT = ROOT / 'app' / 'frontend' / 'public' / 'data'
r4 = lambda v: round(float(v), 4)

# ---------------- raw data facts ----------------
raw = pd.read_csv(ROOT / 'data' / 'raw data' / 'DataCoSupplyChainDataset.csv', encoding='latin-1')
miss = (raw.isna().mean() * 100).sort_values(ascending=False)
status = pd.crosstab(raw['Delivery Status'], raw['Late_delivery_risk'])
rawfacts = {
    'rows': int(len(raw)), 'columns': int(raw.shape[1]), 'orders': int(raw['Order Id'].nunique()),
    'lines_per_order': r4(len(raw) / raw['Order Id'].nunique()),
    'missing_top': [{'column': k, 'pct': round(float(v), 2)} for k, v in miss.head(6).items() if v > 0],
    'zipcode_missing_orders': r4(raw.drop_duplicates('Order Id')['Order Zipcode'].isna().mean()),
    'status_to_target': [{'status': s, 'on_time': int(row.get(0, 0)), 'late': int(row.get(1, 0))} for s, row in status.iterrows()],
    'canceled_share': r4((raw['Delivery Status'] == 'Shipping canceled').mean()),
    'benefit_min': r4(raw['Benefit per order'].min()),
}
lines_hist = raw.groupby('Order Id').size().value_counts().sort_index()
rawfacts['lines_hist'] = [{'lines': int(k), 'orders': int(v)} for k, v in lines_hist.items()]

# ---------------- order level data ----------------
sp = {n: pd.read_csv(DATA / f'{n}.csv') for n in ('train', 'val', 'test')}
for n, d in sp.items(): d['dt'] = pd.to_datetime(d['order date (DateOrders)'])
al = pd.concat([sp['train'], sp['val'], sp['test']], ignore_index=True)
y_al = al['Late_delivery_risk']
rate = lambda col, minn=0: [{'name': str(k), 'late_rate': r4(g['Late_delivery_risk'].mean()), 'orders': int(len(g))} for k, g in al.groupby(col) if len(g) >= minn]
lc = raw.groupby('Order Country')['Late_delivery_risk'].agg(['mean', 'size']); lc = lc[lc['size'] >= 100]  # same definition as notebook 01: order lines, countries with 100+ lines
by_country = sorted([{'name': k, 'late_rate': r4(v['mean']), 'orders': int(v['size'])} for k, v in lc.iterrows()], key=lambda r: -r['late_rate'])
lr = raw.groupby('Order Region')['Late_delivery_risk'].mean()
al['month'] = al['dt'].dt.to_period('M').astype(str)
al['hour'] = al['dt'].dt.hour
al['dow'] = al['dt'].dt.dayofweek
eda = {
    'orders': int(len(al)), 'late_rate': r4(y_al.mean()), 'late': int(y_al.sum()), 'on_time': int((1 - y_al).sum()),
    'by_mode': sorted(rate('Shipping Mode'), key=lambda r: -r['late_rate']),
    'by_region': sorted(rate('Order Region'), key=lambda r: -r['late_rate']),
    'by_country_top': by_country[:8], 'by_country_bottom': by_country[-8:], 'country_spread': r4(by_country[0]['late_rate'] - by_country[-1]['late_rate']),
    'region_spread': r4(lr.max() - lr.min()),
    'by_category': sorted(rate('Category Name'), key=lambda r: -r['late_rate']),
    'by_segment': rate('Customer Segment'), 'by_type': rate('Type'),
    'by_month': [{'name': k, **{a: b for a, b in v.items() if a != 'name'}} for k, v in ((r['name'], r) for r in sorted(rate('month'), key=lambda r: r['name']))],
    'by_hour': sorted(rate('hour'), key=lambda r: int(r['name'])), 'by_dow': sorted(rate('dow'), key=lambda r: int(r['name'])),
    'sales_hist': [], 'benefit_hist': [],
}
h, e = np.histogram(al['Sales'], bins=20); eda['sales_hist'] = [{'lo': r4(e[i]), 'hi': r4(e[i + 1]), 'n': int(h[i])} for i in range(len(h))]
q1, q99 = al['Benefit per order'].quantile([0.01, 0.99]).tolist()
h, e = np.histogram(al['Benefit per order'].clip(-1500, 800), bins=24); eda['benefit_hist'] = [{'lo': r4(e[i]), 'hi': r4(e[i + 1]), 'n': int(h[i])} for i in range(len(h))]
eda['benefit_p1'], eda['benefit_p99'] = r4(q1), r4(q99)
bq1, bq3 = raw['Benefit per order'].quantile([.25, .75]); bi = bq3 - bq1
eda['benefit_outlier_share'] = r4(((raw['Benefit per order'] < bq1 - 1.5 * bi) | (raw['Benefit per order'] > bq3 + 1.5 * bi)).mean())
eda['multi_category_share'] = r4((al['n_distinct_categories'] > 1).mean())
eda['leakage'] = [('Delivery Status', 'excluded', 'Only known after delivery'), ('Late_delivery_risk', 'target', 'What we predict'),
    ('Days for shipping (real)', 'excluded', 'Actual days taken, known only after delivery'), ('shipping date (DateOrders)', 'excluded', 'Known only after the order ships'),
    ('Shipping Mode', 'safe', 'Chosen at order time'), ('Order Region / Country / City / State', 'safe', 'Delivery address, known at order time'),
    ('Category Name', 'safe', 'In the basket at order time'), ('Order Item Quantity', 'safe', 'In the basket at order time'),
    ('Sales, Benefit per order', 'safe', 'Known at order time (a data quality issue, not leakage)'),
    ('Customer Segment, Type (payment)', 'safe', 'Known at order time'), ('Days for shipment (scheduled)', 'dropped', 'Perfect copy of Shipping Mode, so it adds nothing')]
eda['leakage'] = [{'field': a, 'status': b, 'why': c} for a, b, c in eda['leakage']]

# split
splits = []
for n, label in (('train', 'Train'), ('val', 'Validation'), ('test', 'Test')):
    d = sp[n]; splits.append({'name': label, 'orders': int(len(d)), 'share': r4(len(d) / len(al)), 'start': str(d['dt'].min().date()), 'end': str(d['dt'].max().date()), 'late_rate': r4(d['Late_delivery_risk'].mean()), 'avg_sales': r4(d['Sales'].mean())})

# ---------------- models ----------------
def mm(name):
    return json.load(open(DATA / f'metrics_{name}.json'))
board = [mm(n) for n in ('baseline', 'logreg', 'svm', 'adaboost', 'gb', 'lightgbm', 'catboost', 'rf', 'nn', 'stacking', 'voting', 'xgb') if (DATA / f'metrics_{n}.json').exists()]
for b in board: b.update({k: r4(b[k]) for k in ('recall', 'precision', 'f1', 'roc_auc', 'pr_auc')})

def load(name):
    mr = pd.read_csv(DATA / f'model_ready_{name}.csv'); b = mr.select_dtypes(include='bool').columns; mr[b] = mr[b].astype(int)
    return mr.drop(columns='Late_delivery_risk'), mr['Late_delivery_risk'].values
X_va, y_va = load('val'); X_te, y_te = load('test')
rf = joblib.load(ROOT / 'models' / 'random_forest_tuned.pkl')
xg = xgb.XGBClassifier(); xg.load_model(str(ART / 'xgb.json'))
P = {'Random Forest': {'val': rf.predict_proba(X_va)[:, 1], 'test': rf.predict_proba(X_te)[:, 1]},
     'XGBoost': {'val': xg.predict_proba(X_va)[:, 1], 'test': xg.predict_proba(X_te)[:, 1]}}
Y = {'val': y_va, 'test': y_te}
thr_file = json.load(open(DATA / 'chosen_threshold.json')); cfg = json.load(open(ART / 'config.json'))
THR = {'Random Forest': thr_file['threshold'], 'XGBoost': cfg['risk_threshold']}

def pick(p, y, target=0.80):
    best = 0.0
    for t in np.round(np.arange(0.01, 0.99, 0.01), 2):
        if recall_score(y, (p >= t).astype(int)) >= target: best = float(t)
    return best
for m in P: assert abs(pick(P[m]['val'], y_va) - THR[m]) < 1e-9, (m, pick(P[m]['val'], y_va), THR[m])

def op(p, y, t):
    f = (p >= t).astype(int)
    return {'threshold': t, 'recall': r4(recall_score(y, f)), 'precision': r4(precision_score(y, f)), 'f1': r4(f1_score(y, f)), 'flagged': r4(f.mean()),
            'tp': int(((f == 1) & (y == 1)).sum()), 'fp': int(((f == 1) & (y == 0)).sum()), 'fn': int(((f == 0) & (y == 1)).sum()), 'tn': int(((f == 0) & (y == 0)).sum())}
def sweep(p, y):
    out = []
    for t in np.round(np.arange(0.05, 0.96, 0.01), 2):
        f = (p >= t).astype(int)
        out.append({'t': float(t), 'recall': r4(recall_score(y, f)), 'precision': r4(precision_score(y, f, zero_division=0)), 'flagged': r4(f.mean()),
                    'cost': int(3 * ((f == 0) & (y == 1)).sum() + 1 * ((f == 1) & (y == 0)).sum())})
    return out
def curves(p, y, pts=80):
    fpr, tpr, _ = roc_curve(y, p); pr, rc, _ = precision_recall_curve(y, p)
    ix = np.linspace(0, len(fpr) - 1, pts).astype(int); jx = np.linspace(0, len(pr) - 1, pts).astype(int)
    return {'roc': [[r4(fpr[i]), r4(tpr[i])] for i in ix], 'pr': [[r4(rc[i]), r4(pr[i])] for i in jx]}
def calib(p, y):
    q = pd.qcut(p, 10, duplicates='drop'); g = pd.DataFrame({'p': p, 'y': y}).groupby(q, observed=True).agg(pred=('p', 'mean'), actual=('y', 'mean'))
    return [{'pred': r4(a), 'actual': r4(b)} for a, b in g.itertuples(index=False)]
def matched(p, y, targets=(0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9)):
    """Best precision reachable while catching at least the target share of late orders (same idea as notebook 05)."""
    pr, rc, _ = precision_recall_curve(y, p)
    return [{'recall_target': tg, 'precision': r4(pr[rc >= tg].max())} for tg in targets]

models = {}
for m in P:
    models[m] = {'threshold': THR[m], 'val': {'roc_auc': r4(roc_auc_score(y_va, P[m]['val'])), 'pr_auc': r4(average_precision_score(y_va, P[m]['val'])), 'at_threshold': op(P[m]['val'], y_va, THR[m]), 'at_half': op(P[m]['val'], y_va, 0.5), 'matched': matched(P[m]['val'], y_va)},
                 'test': {'roc_auc': r4(roc_auc_score(y_te, P[m]['test'])), 'pr_auc': r4(average_precision_score(y_te, P[m]['test'])), 'at_threshold': op(P[m]['test'], y_te, THR[m])},
                 'sweep_val': sweep(P[m]['val'], y_va), 'sweep_test': sweep(P[m]['test'], y_te),
                 'curves_val': curves(P[m]['val'], y_va), 'curves_test': curves(P[m]['test'], y_te), 'calib_val': calib(P[m]['val'], y_va), 'calib_test': calib(P[m]['test'], y_te)}
models['Random Forest']['params'] = json.load(open(DATA / 'optuna_rf_best_params.json')); models['XGBoost']['params'] = json.load(open(DATA / 'optuna_xgb_best_params.json'))
models['Random Forest']['size_mb'] = round((ROOT / 'models' / 'random_forest_tuned.pkl').stat().st_size / 1e6, 1); models['XGBoost']['size_mb'] = round((ART / 'xgb.json').stat().st_size / 1e6, 2)
nn = json.load(open(DATA / 'optuna_nn_best_params.json'))
tuned_val = [  # copied from notebook 05 section 5 (validation, default 0.5 threshold)
    {'model': 'Random Forest', 'recall': 0.6289, 'precision': 0.7751, 'f1': 0.6944, 'roc_auc': 0.7621, 'pr_auc': 0.8266},
    {'model': 'XGBoost', 'recall': 0.5875, 'precision': 0.8462, 'f1': 0.6935, 'roc_auc': 0.7684, 'pr_auc': 0.8322},
    {'model': 'Neural Network', 'recall': 0.5868, 'precision': 0.8460, 'f1': 0.6930, 'roc_auc': 0.7657, 'pr_auc': 0.8291}]
for t in tuned_val[:2]:  # cross-check the copied numbers against a fresh computation
    m = models[t['model']]['val']; assert abs(m['at_half']['recall'] - t['recall']) < 5e-4 and abs(m['roc_auc'] - t['roc_auc']) < 5e-4, t['model']
nn_matched = [{'recall_target': a, 'precision': b} for a, b in zip((0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9), (0.8136, 0.7576, 0.7188, 0.6745, 0.6445, 0.6162, 0.5911))]

# final test file check
ft = json.load(open(DATA / 'final_test_results.json'))
assert abs(ft['test_recall'] - models['Random Forest']['test']['at_threshold']['recall']) < 5e-4

# ---------------- explainability ----------------
feat_names = list(X_va.columns)
LABEL = {'Sales': 'Order value', 'Order Item Quantity': 'Items ordered', 'Benefit per order': 'Profit on order', 'n_line_items': 'Number of lines', 'n_distinct_categories': 'Product categories',
 'Benefit_per_order_capped': 'Profit (capped)', 'priority_value_component': 'Order value (priority)', 'order_hour': 'Hour of order', 'order_dayofweek': 'Day of week', 'order_month': 'Month',
 'order_is_weekend': 'Weekend order', 'order_is_holiday_season': 'Holiday season', 'sales_per_scheduled_day': 'Value per scheduled day', 'is_express_shipping': 'Express shipping',
 'country_delay_rate': 'Country late rate', 'region_delay_rate': 'Region late rate', 'Shipping Mode_First Class': 'First Class', 'Shipping Mode_Same Day': 'Same Day', 'Shipping Mode_Second Class': 'Second Class',
 'Shipping Mode_Standard Class': 'Standard Class', 'Customer Segment_Consumer': 'Consumer', 'Customer Segment_Corporate': 'Corporate', 'Customer Segment_Home Office': 'Home Office',
 'Type_CASH': 'Paid cash', 'Type_DEBIT': 'Paid debit', 'Type_PAYMENT': 'Paid payment', 'Type_TRANSFER': 'Paid transfer', 'category_frequency': 'Product popularity'}
def mean_abs(sv): return sorted([{'feature': LABEL.get(f, f), 'value': r4(v)} for f, v in zip(feat_names, np.abs(sv).mean(0))], key=lambda r: -r['value'])[:12]
svr = np.load(ROOT / 'models' / 'shap_values_rf_n1000.npy') if (ROOT / 'models' / 'shap_values_rf_n1000.npy').exists() else np.load('/tmp/proj2/models/shap_values_rf_n1000.npy')
svr = svr[:, :, 1] if svr.ndim == 3 else svr
contrib = xg.get_booster().predict(xgb.DMatrix(X_va.values, feature_names=feat_names), pred_contribs=True)[:, :-1]
hrs = X_va['order_hour'].values.astype(int); sd = X_va['Shipping Mode_Same Day'].values == 1; ih = feat_names.index('order_hour')
dep = [{'hour': int(hh), 'same_day': r4(contrib[(hrs == hh) & sd, ih].mean()) if ((hrs == hh) & sd).any() else None, 'others': r4(contrib[(hrs == hh) & ~sd, ih].mean())} for hh in range(24)]
explain = {'rf_global': mean_abs(svr), 'xgb_global': mean_abs(contrib), 'hour_dependence_xgb_val': dep, 'rf_sample_rows': int(svr.shape[0])}

# ---------------- prioritization for both models (validation and test) ----------------
rate_mode = sp['train'].groupby('Shipping Mode')['Late_delivery_risk'].mean()
def rule_key(df): return df['Shipping Mode'].astype(str) + np.where((df['Shipping Mode'] == 'Same Day') & (df['dt'].dt.hour >= 12), ' (after noon)', '')
rate_key = sp['train'].assign(k=rule_key(sp['train'])).groupby('k')['Late_delivery_risk'].mean()
def reach(sc, S, y, k):
    n = int(len(y) * k); idx = np.argsort(-sc, kind='stable')[:n]; return r4((S * y)[idx].sum() / (S * y).sum()), r4(y[idx].mean())
prio = {}
for m in P:
    prio[m] = {}
    for nm, d, key in (('validation', sp['val'], 'val'), ('test', sp['test'], 'test')):
        S = d['Sales'].values; y = Y[key]; p = P[m][key]; rng = np.random.default_rng(42)
        sc = {'Random order': rng.random(len(y)), 'Sales only': S, 'Simple rule': rule_key(d).map(rate_key).values * S, 'Risk only': p + 1e-12 * S, 'Heads Up': p * S, 'Oracle': y * S + 1e-9 * S}
        prio[m][nm] = {k: {'revenue': reach(v, S, y, 0.10)[0], 'precision': reach(v, S, y, 0.10)[1]} for k, v in sc.items()}

report = {'raw': rawfacts, 'eda': eda, 'splits': splits, 'board': board, 'tuned_val': tuned_val, 'nn_matched': nn_matched, 'nn_params': nn, 'features': feat_names,
          'models': models, 'explain': explain, 'prioritization_top10': prio, 'final_test_file': ft,
          'threshold_notes': {'cost_threshold': thr_file['cost_optimal_threshold_for_reference'], 'cost_fn': thr_file['cost_false_negative'], 'cost_fp': thr_file['cost_false_positive']}}
OUT.mkdir(parents=True, exist_ok=True)
json.dump(report, open(OUT / 'report.json', 'w'), separators=(',', ':'))

# ---------------- decision log ----------------
txt = open(ROOT / 'DECISION_LOG.md', encoding='utf-8').read()
stages, cur = [], None
for blk in re.split(r'\n(?=## Stage )', txt)[1:]:
    title = blk.split('\n', 1)[0].replace('## ', '').strip(); entries = []
    for e in re.split(r'\n(?=### \[)', blk)[1:]:
        head = e.split('\n', 1)[0]; m = re.match(r'### \[([^\]]+)\] (.*)', head)
        if not m: continue
        fields = {k.lower(): v.strip() for k, v in re.findall(r'^- \*\*([^*:]+):\*\* (.*)$', e, flags=re.M)}
        entries.append({'date': m.group(1), 'title': m.group(2).strip(), 'made_by': fields.get('made by', ''), 'decision': fields.get('decision', ''), 'reason': fields.get('reason', ''), 'alternatives': fields.get('alternatives considered', '')})
    stages.append({'stage': title, 'entries': entries})
json.dump({'stages': stages}, open(OUT / 'decisions.json', 'w'), separators=(',', ':'))
print('report.json', (OUT / 'report.json').stat().st_size // 1024, 'KB; decisions', sum(len(s['entries']) for s in stages), 'entries in', len(stages), 'stages')
