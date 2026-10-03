"""Check that the numbers written in README.md match the report file the website reads.

Run from the repo root:  python docs/check_readme_numbers.py
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
R = json.load(open(ROOT / 'app/frontend/public/data/report.json'))
D = json.load(open(ROOT / 'app/frontend/public/data/decisions.json'))
text = (ROOT / 'README.md').read_text(encoding='utf-8')

rf, xg = R['models']['Random Forest'], R['models']['XGBoost']
pct = lambda v, d=1: f'{v * 100:.{d}f}%'
P = R['prioritization_top10']['XGBoost']['test']
sp = {s['name']: s for s in R['splits']}
expected = {
    'RF flag line': f"| Flag line (set on validation) | {rf['threshold']:.2f} | {xg['threshold']:.2f} |",
    'RF recall': pct(rf['test']['at_threshold']['recall']), 'XGB recall': pct(xg['test']['at_threshold']['recall']),
    'RF precision': pct(rf['test']['at_threshold']['precision']), 'XGB precision': pct(xg['test']['at_threshold']['precision']),
    'RF F1': pct(rf['test']['at_threshold']['f1']), 'XGB F1': pct(xg['test']['at_threshold']['f1']),
    'RF flagged': pct(rf['test']['at_threshold']['flagged']), 'XGB flagged': pct(xg['test']['at_threshold']['flagged']),
    'RF ROC-AUC': f"{rf['test']['roc_auc']:.3f}", 'XGB ROC-AUC': f"{xg['test']['roc_auc']:.3f}",
    'RF PR-AUC': f"{rf['test']['pr_auc']:.3f}", 'XGB PR-AUC': f"{xg['test']['pr_auc']:.3f}",
    'top 10% Heads Up': pct(P['Heads Up']['revenue']), 'top 10% random': pct(P['Random order']['revenue']),
    'orders': f"{R['raw']['orders']:,}", 'lines': f"{R['raw']['rows']:,}", 'late share': pct(R['eda']['late_rate'], 2),
    'train orders': f"{sp['Train']['orders']:,}", 'validation orders': f"{sp['Validation']['orders']:,}", 'test orders': f"{sp['Test']['orders']:,}",
    'avg sales train': f"${sp['Train']['avg_sales']:.0f}", 'avg sales validation': f"${sp['Validation']['avg_sales']:.0f}", 'avg sales test': f"${sp['Test']['avg_sales']:.0f}",
    'decision count': f"{sum(len(s['entries']) for s in D['stages'])}_decisions",
    'live model size': f"{R['models']['XGBoost']['size_mb']:.2f} MB",
}
bad = [k for k, v in expected.items() if v not in text]
for k in bad: print('MISSING in README:', k, '->', expected[k])
print('README numbers OK' if not bad else f'{len(bad)} mismatch(es)')
sys.exit(1 if bad else 0)
