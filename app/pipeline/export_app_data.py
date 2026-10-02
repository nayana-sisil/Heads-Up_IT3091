"""Build every file the Heads Up app reads.

Run from the repo root:  python app/pipeline/export_app_data.py
Needs: data/processed/*.csv and models/xgboost_tuned.pkl (or the saved best params).
Engine: tuned XGBoost (small, explains an order in about a second).
"""
import json, gzip, warnings
from pathlib import Path
import numpy as np, pandas as pd, joblib, xgboost as xgb, shap
from sklearn.metrics import roc_auc_score, average_precision_score, precision_score, recall_score

warnings.filterwarnings('ignore')
ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / 'data' / 'processed'
OUT = ROOT / 'app' / 'backend' / 'artifacts'
OUT.mkdir(parents=True, exist_ok=True)
TARGET_RECALL = 0.80
SEED = 42

# ---------- load ----------
def load(name):
    raw = pd.read_csv(DATA / f'{name}.csv')
    feat = pd.read_csv(DATA / f'features_step4_{name}.csv')          # unscaled features
    mr = pd.read_csv(DATA / f'model_ready_{name}.csv')              # scaled model inputs
    b = mr.select_dtypes(include='bool').columns; mr[b] = mr[b].astype(int)
    assert len(raw) == len(feat) == len(mr)
    assert (raw['Order Id'].values == feat['Order Id'].values).all()
    X = mr.drop(columns='Late_delivery_risk'); y = mr['Late_delivery_risk'].values
    return raw, feat, X, y

raw_tr, feat_tr, X_tr, y_tr = load('train')
raw_va, feat_va, X_va, y_va = load('val')
raw_te, feat_te, X_te, y_te = load('test')
FEATURES = list(X_tr.columns)

pkl = ROOT / 'models' / 'xgboost_tuned.pkl'
if pkl.exists():
    model = joblib.load(pkl)
else:
    params = json.load(open(DATA / 'optuna_xgb_best_params.json'))
    model = xgb.XGBClassifier(**params, random_state=SEED, n_jobs=-1, eval_metric='logloss').fit(X_tr, y_tr)
model.get_booster().save_model(str(OUT / 'xgb.json'))
booster_model = xgb.XGBClassifier(); booster_model.load_model(str(OUT / 'xgb.json'))
p_va = booster_model.predict_proba(X_va)[:, 1]; p_te = booster_model.predict_proba(X_te)[:, 1]
print('ROC AUC val %.4f test %.4f' % (roc_auc_score(y_va, p_va), roc_auc_score(y_te, p_te)))

# ---------- scaler (rebuilt from the unscaled training features, matches StandardScaler) ----------
SCALED = ['Sales','Order Item Quantity','n_line_items','n_distinct_categories','Benefit_per_order_capped',
          'priority_value_component','sales_per_scheduled_day','country_delay_rate','region_delay_rate','category_frequency']
scaler = {c: {'mean': float(feat_tr[c].mean()), 'std': float(feat_tr[c].std(ddof=0))} for c in SCALED}
for c in SCALED:
    z = (feat_va[c] - scaler[c]['mean']) / scaler[c]['std']
    assert np.abs(z - X_va[c]).max() < 1e-6, c
json.dump({'features': FEATURES, 'scaled': scaler}, open(OUT / 'scaler.json', 'w'), indent=1)

# ---------- operating point and tiers (validation only) ----------
def threshold_for_recall(p, y, target):
    best = 0.0
    for t in np.round(np.arange(0.01, 0.99, 0.01), 2):
        if recall_score(y, (p >= t).astype(int)) >= target: best = t
    return float(best)
THRESH = threshold_for_recall(p_va, y_va, TARGET_RECALL)
S_va, S_te = raw_va['Sales'].values, raw_te['Sales'].values
pr_va = p_va * S_va
Q_CRIT, Q_HIGH = [float(q) for q in np.quantile(pr_va, [0.90, 0.70])]
def tier_of(p, S):
    pr = p * S
    t = np.where(pr >= Q_CRIT, 'Critical', np.where(pr >= Q_HIGH, 'High', 'Standard'))
    return np.where((p < THRESH) & (t != 'Critical'), 'Standard', t)
config = {'engine': 'XGBoost (tuned, Optuna on PR AUC)', 'formula': 'priority = p_late ** alpha * Sales', 'alpha': 1.0,
          'risk_threshold': THRESH, 'target_recall': TARGET_RECALL,
          'tier_cutoffs': {'critical_min': Q_CRIT, 'high_min': Q_HIGH},
          'tiers_defined_on': 'validation: top 10 percent Critical, next 20 percent High'}
json.dump(config, open(OUT / 'config.json', 'w'), indent=1)
print('threshold', THRESH, 'cutoffs', round(Q_CRIT), round(Q_HIGH))

# ---------- SHAP for every test order ----------
expl = shap.TreeExplainer(booster_model)
sv = expl.shap_values(X_te); base = float(np.atleast_1d(expl.expected_value)[-1])
sv = np.asarray(sv); sv = sv[:, :, 1] if sv.ndim == 3 else sv
print('SHAP', sv.shape)

LABEL = {'Sales':'Order value','Order Item Quantity':'Items ordered','Benefit per order':'Profit on order','n_line_items':'Number of lines',
 'n_distinct_categories':'Product categories','Benefit_per_order_capped':'Profit on order','priority_value_component':'Order value',
 'order_hour':'Hour of order','order_dayofweek':'Day of week','order_month':'Month','order_is_weekend':'Weekend order',
 'order_is_holiday_season':'Holiday season','sales_per_scheduled_day':'Value per scheduled day','is_express_shipping':'Express shipping',
 'country_delay_rate':'Country late rate','region_delay_rate':'Region late rate','Shipping Mode_First Class':'First Class shipping',
 'Shipping Mode_Same Day':'Same Day shipping','Shipping Mode_Second Class':'Second Class shipping','Shipping Mode_Standard Class':'Standard Class shipping',
 'Customer Segment_Consumer':'Consumer customer','Customer Segment_Corporate':'Corporate customer','Customer Segment_Home Office':'Home Office customer',
 'Type_CASH':'Paid by cash','Type_DEBIT':'Paid by debit','Type_PAYMENT':'Paid by payment','Type_TRANSFER':'Paid by transfer','category_frequency':'Product category popularity'}
fx = {c: feat_te[c].values for c in feat_te.columns}
def show_value(f, i):
    v = fx.get(f, None)
    if f.startswith(('Shipping Mode_','Customer Segment_','Type_')): return 'Yes' if bool(v[i]) else 'No'
    if f in ('order_is_weekend','order_is_holiday_season','is_express_shipping'): return 'Yes' if v[i] else 'No'
    if f == 'order_hour': return f'{int(v[i]):02d}:00'
    if f in ('order_dayofweek',): return ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][int(v[i])]
    if f in ('Sales','Benefit_per_order_capped','Benefit per order','priority_value_component','sales_per_scheduled_day'):
        src = {'priority_value_component':'Sales'}.get(f, f); return f'{fx[src][i]:,.0f}'
    if f.endswith('_rate') or f == 'category_frequency': return f'{fx[f][i]*100:.0f}%'
    return f'{v[i]:g}' if v is not None else ''

mode = np.where(raw_te['Shipping Mode'] == 'Same Day', 'Same Day', raw_te['Shipping Mode'])
hour = pd.to_datetime(raw_te['order date (DateOrders)']).dt.hour.values
tiers = tier_of(p_te, S_te)

def headline(i, drivers):
    m, h = raw_te['Shipping Mode'].iloc[i], hour[i]
    if m == 'Same Day' and h >= 12: return 'Same Day order placed after noon'
    if m == 'Same Day': return 'Same Day order placed before noon'
    if m == 'First Class': return 'First Class shipping is late almost every time'
    if m == 'Second Class': return 'Second Class shipping runs late more often than not'
    up = [d for d in drivers if d['shap'] > 0]
    return (up[0]['label'] + ' raises the risk') if up else 'No strong risk signals'

orders = []
for i in range(len(raw_te)):
    idx = np.argsort(-np.abs(sv[i]))[:6]
    drivers = [{'feature': FEATURES[j], 'label': LABEL.get(FEATURES[j], FEATURES[j]), 'value': show_value(FEATURES[j], i), 'shap': round(float(sv[i, j]), 3)} for j in idx]
    r = raw_te.iloc[i]
    orders.append({'id': int(r['Order Id']), 'date': str(r['order date (DateOrders)']), 'mode': r['Shipping Mode'], 'region': r['Order Region'],
        'country': r['Order Country'], 'city': r['Order City'], 'segment': r['Customer Segment'], 'type': r['Type'], 'category': r['Category Name'],
        'sales': round(float(r['Sales']), 2), 'qty': int(r['Order Item Quantity']), 'lines': int(r['n_line_items']),
        'p': round(float(p_te[i]), 4), 'priority': round(float(p_te[i] * r['Sales']), 1), 'tier': str(tiers[i]),
        'flag': bool(p_te[i] >= THRESH), 'late': int(y_te[i]), 'why': headline(i, drivers), 'drivers': drivers})
with gzip.open(OUT / 'orders.json.gz', 'wt') as f: json.dump({'base_value': base, 'orders': orders}, f)
print('orders', len(orders))
rawf = feat_te[['Order Id'] + FEATURES].copy()
for c in rawf.columns:
    if rawf[c].dtype == bool: rawf[c] = rawf[c].astype(int)
rawf.to_csv(OUT / 'features_test.csv.gz', index=False)

# ---------- trust / evaluation data ----------
def rule_key(df):
    pm = (df['Shipping Mode'] == 'Same Day') & (pd.to_datetime(df['order date (DateOrders)']).dt.hour >= 12)
    return df['Shipping Mode'].astype(str) + np.where(pm, ' (after noon)', '')
rate_mode = raw_tr.groupby('Shipping Mode')['Late_delivery_risk'].mean()
rate_key = raw_tr.assign(k=rule_key(raw_tr)).groupby('k')['Late_delivery_risk'].mean()
def schemes(raw, p, y):
    S = raw['Sales'].values; rng = np.random.default_rng(SEED)
    return {'Random order': rng.random(len(y)), 'Sales only': S, 'Simple rule': rule_key(raw).map(rate_key).values * S,
            'Risk only': p + 1e-12 * S, 'Heads Up': p * S, 'Oracle': y * S + 1e-9 * S}
def vp(sc, S, y, k):
    n = int(len(y) * k); idx = np.argsort(-sc, kind='stable')[:n]
    return float((S * y)[idx].sum() / (S * y).sum()), float(y[idx].mean())
def gain(sc, S, y, pts=100):
    idx = np.argsort(-sc, kind='stable'); cum = np.cumsum((S * y)[idx]) / (S * y).sum()
    xs = np.linspace(0, 1, pts + 1); pos = (xs * (len(y) - 1)).astype(int)
    return [0.0] + [round(float(cum[q]), 4) for q in pos[1:]]
def calib(p, y):
    q = pd.qcut(p, 10, duplicates='drop')
    g = pd.DataFrame({'p': p, 'y': y}).groupby(q, observed=True).agg(pred=('p', 'mean'), actual=('y', 'mean'), n=('y', 'size'))
    return [{'pred': round(float(a), 3), 'actual': round(float(b), 3), 'n': int(c)} for a, b, c in g.itertuples(index=False)]

trust = {'config': config, 'splits': {}}
for nm, raw, p, y in (('validation', raw_va, p_va, y_va), ('test', raw_te, p_te, y_te)):
    S = raw['Sales'].values; sc_all = schemes(raw, p, y); ks = [0.05, 0.10, 0.20, 0.30]
    flagged = p >= THRESH
    trust['splits'][nm] = {
        'n': int(len(y)), 'late_rate': float(y.mean()), 'avg_sales': float(S.mean()), 'median_sales': float(np.median(S)),
        'roc_auc': float(roc_auc_score(y, p)), 'pr_auc': float(average_precision_score(y, p)),
        'operating_point': {'threshold': THRESH, 'recall': float(recall_score(y, flagged)), 'precision': float(precision_score(y, flagged)), 'flagged_share': float(flagged.mean())},
        'schemes': {k: {f'{int(kk*100)}': dict(zip(['revenue_reached', 'precision'], vp(v, S, y, kk))) for kk in ks} for k, v in sc_all.items()},
        'gain': {k: gain(v, S, y) for k, v in sc_all.items()},
        'calibration': calib(p, y),
        'alpha': [dict(label=l, alpha=a, **dict(zip(['revenue_reached', 'precision'], vp((p ** a) * S if a > 0 else S, S, y, 0.10)))) for l, a in (('Money first', 0), ('', 0.5), ('Balanced', 1), ('', 2), ('', 3), ('Risk first', 5))],
    }
train_rule = raw_tr.assign(k=rule_key(raw_tr)).groupby('k')['Late_delivery_risk'].agg(['mean', 'size'])
trust['rule_table'] = [{'segment': k, 'late_rate': float(m), 'orders': int(n)} for k, (m, n) in train_rule.sort_values('mean').iterrows()]
sd = raw_tr[raw_tr['Shipping Mode'] == 'Same Day'].assign(h=lambda d: pd.to_datetime(d['order date (DateOrders)']).dt.hour).groupby('h')['Late_delivery_risk'].agg(['mean', 'size'])
trust['same_day_by_hour'] = [{'hour': int(h), 'late_rate': float(m), 'orders': int(n)} for h, (m, n) in sd.iterrows()]
trust['sales_by_split'] = [{'split': n, 'mean': float(d.Sales.mean()), 'median': float(d.Sales.median())} for n, d in (('Train', raw_tr), ('Validation', raw_va), ('Test', raw_te))]
imp = np.abs(sv).mean(axis=0); order_i = np.argsort(-imp)[:12]
trust['global_importance'] = [{'feature': FEATURES[j], 'label': LABEL.get(FEATURES[j], FEATURES[j]), 'value': float(imp[j])} for j in order_i]
# tier tables
def tier_tab(raw, p, y):
    S = raw['Sales'].values; t = tier_of(p, S)
    df = pd.DataFrame({'tier': t, 'late': y, 'S': S}); df['lv'] = df.late * df.S
    g = df.groupby('tier').agg(orders=('late', 'size'), late_rate=('late', 'mean'), avg_sales=('S', 'mean'), lv=('lv', 'sum'))
    return {k: {'orders': int(r.orders), 'share_orders': float(r.orders / len(df)), 'late_rate': float(r.late_rate), 'avg_sales': float(r.avg_sales), 'share_late_revenue': float(r.lv / df.lv.sum())} for k, r in g.iterrows()}
trust['tiers'] = {'validation': tier_tab(raw_va, p_va, y_va), 'test': tier_tab(raw_te, p_te, y_te)}
# weekly replay (test period)
dts = pd.to_datetime(raw_te['order date (DateOrders)']); wk = dts.dt.to_period('W').astype(str)
rep = []
for w in sorted(wk.unique()):
    m = (wk == w).values; ps, ss, ys = p_te[m], S_te[m], y_te[m]
    tt = tiers[m]
    rep.append({'week': w.split('/')[0], 'orders': int(m.sum()), 'critical': int((tt == 'Critical').sum()), 'high': int((tt == 'High').sum()),
                'revenue_at_risk': float((ps * ss).sum()), 'late_revenue': float((ss * ys).sum()), 'flagged': int((ps >= THRESH).sum())})
trust['replay'] = rep
json.dump(trust, open(OUT / 'trust.json', 'w'))
print('done. files:', [f.name for f in OUT.iterdir()])
