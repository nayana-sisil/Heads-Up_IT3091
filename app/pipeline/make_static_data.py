"""Copy the app artifacts into frontend/public/data for the static (in-browser) build.
Run after export_app_data.py:  python app/pipeline/make_static_data.py
"""
import gzip, json, shutil
from pathlib import Path
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / 'backend' / 'artifacts'
OUT = ROOT / 'frontend' / 'public' / 'data'
OUT.mkdir(parents=True, exist_ok=True)
for name in ('trust.json', 'config.json', 'scaler.json'):
    shutil.copy(ART / name, OUT / name)
shutil.copy(ART / 'orders.json.gz', OUT / 'orders.dat')   # gzip data; the app detects it
# model: keep only what the browser needs
m = json.load(open(ART / 'xgb.json'))
lm = m['learner']; trees = lm['gradient_booster']['model']['trees']
base = float(str(lm['learner_model_param']['base_score']).strip('[]'))
slim = {'base_score': base, 'trees': [{k: t[k] for k in ('left_children', 'right_children', 'split_indices', 'split_conditions', 'default_left', 'sum_hessian')} for t in trees]}
json.dump(slim, open(OUT / 'model.json', 'w'), separators=(',', ':'))
# raw (unscaled) features per test order
f = pd.read_csv(ART / 'features_test.csv.gz')
payload = {'cols': [c for c in f.columns if c != 'Order Id'], 'ids': f['Order Id'].astype(int).tolist(), 'rows': f.drop(columns='Order Id').values.tolist()}
with gzip.open(OUT / 'features_test.dat', 'wt') as fh: json.dump(payload, fh, separators=(',', ':'))
print({p.name: p.stat().st_size for p in OUT.iterdir()})
