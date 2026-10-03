"""Draw the README result charts from the same report.json the website reads."""
import json
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

ROOT = Path(__file__).resolve().parents[1]
R = json.load(open(ROOT / 'app/frontend/public/data/report.json'))
OUT = ROOT / 'docs/images'
BLUE, ORANGE, PURPLE, TEAL, GREY, RED = '#2a6fdb', '#c8691a', '#8a63d2', '#1b9e8a', '#8a93b0', '#d1344b'
plt.rcParams.update({'font.family': 'DejaVu Sans', 'font.size': 11, 'axes.spines.top': False, 'axes.spines.right': False,
                     'axes.edgecolor': '#c9d0e4', 'axes.labelcolor': '#4a5578', 'xtick.color': '#4a5578', 'ytick.color': '#1b2340'})

# 1. Late revenue reached by the top 10% of the queue (test set)
P = R['prioritization_top10']['XGBoost']['test']
rows = [('Random order', 'Random order', GREY), ('Risk only', 'Risk only', ORANGE), ('Sales only', 'Sales only', PURPLE),
        ('Simple shipping rule x Sales', 'Simple rule', BLUE), ('Heads Up (risk x Sales)', 'Heads Up', TEAL)]
fig, ax = plt.subplots(figsize=(9, 3.6), dpi=170)
for i, (lab, key, col) in enumerate(rows):
    v = P[key]['revenue'] * 100
    ax.hlines(i, 0, v, color=col, alpha=.45, lw=3); ax.plot(v, i, 'o', color=col, ms=11, mec='white', mew=2)
    ax.text(v + 1.6, i, f'{v:.1f}%', va='center', fontweight='bold', color='#1b2340')
ceil = P['Oracle']['revenue'] * 100
ax.axvline(ceil, color=RED, ls='--', lw=1.4); ax.text(ceil - .8, 4.45, f'best possible {ceil:.1f}%', color=RED, ha='right', fontsize=10)
ax.set_yticks(range(len(rows))); ax.set_yticklabels([r[0] for r in rows]); ax.set_xlim(0, 56); ax.set_ylim(-.6, 4.7)
ax.set_xlabel('Share of late revenue reached by reviewing the top 10% of orders (test set)'); ax.grid(axis='x', color='#e6eaf5'); ax.set_axisbelow(True)
fig.tight_layout(); fig.savefig(OUT / 'chart-top10-queue.png', facecolor='white'); plt.close(fig)

# 2. Threshold trade off (XGBoost, validation)
M = R['models']['XGBoost']; sw = M['sweep_val']
t = [x['t'] for x in sw]
fig, ax = plt.subplots(figsize=(9, 3.8), dpi=170)
ax.plot(t, [x['recall'] * 100 for x in sw], color=BLUE, lw=2.4, label='Recall (late orders caught)')
ax.plot(t, [x['precision'] * 100 for x in sw], color=ORANGE, lw=2.4, label='Precision (flags that were right)')
ax.plot(t, [x['flagged'] * 100 for x in sw], color=PURPLE, lw=2.2, ls='--', label='Share of orders flagged')
ax.axvline(M['threshold'], color=GREY, lw=1.3, ls=':'); ax.text(M['threshold'] + .01, 6, f'chosen line {M["threshold"]:.2f}', color='#4a5578', fontsize=10)
ax.set_xlabel('Flag orders above this chance of being late (validation set)'); ax.set_ylabel('Percent'); ax.set_ylim(0, 102)
ax.grid(color='#e6eaf5'); ax.set_axisbelow(True); ax.legend(frameon=False, loc='lower left', fontsize=10)
fig.tight_layout(); fig.savefig(OUT / 'chart-threshold.png', facecolor='white'); plt.close(fig)

# 3. Both models on unseen test orders
fig, ax = plt.subplots(figsize=(9, 3.6), dpi=170)
names = ['Recall', 'Precision', 'Orders flagged']; keys = ['recall', 'precision', 'flagged']
w = .34
for j, (mn, col) in enumerate([('Random Forest', BLUE), ('XGBoost', ORANGE)]):
    o = R['models'][mn]['test']['at_threshold']
    vals = [o[k] * 100 for k in keys]
    xs = [i + (j - .5) * w for i in range(3)]
    b = ax.bar(xs, vals, w * .92, color=col, label=f'{mn} ({"report" if j == 0 else "live app"} model)')
    for x, v in zip(xs, vals): ax.text(x, v + 1.5, f'{v:.0f}%', ha='center', fontsize=10, fontweight='bold', color='#1b2340')
ax.set_xticks(range(3)); ax.set_xticklabels(names); ax.set_ylim(0, 100); ax.set_ylabel('Percent'); ax.grid(axis='y', color='#e6eaf5'); ax.set_axisbelow(True)
ax.legend(frameon=False, ncol=2, loc='upper center', bbox_to_anchor=(.5, 1.14))
fig.tight_layout(); fig.savefig(OUT / 'chart-test-results.png', facecolor='white'); plt.close(fig)
print('charts written')
