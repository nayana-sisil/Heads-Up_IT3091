import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import pytest
from fastapi.testclient import TestClient
import main

c = TestClient(main.app)


def test_health():
    r = c.get('/api/health').json()
    assert r['ok'] and r['orders'] == 11836


def test_meta_and_config():
    m = c.get('/api/meta').json()
    assert set(m['modes']) == {'First Class', 'Same Day', 'Second Class', 'Standard Class'}
    assert 0 < m['config']['risk_threshold'] < 1


def test_orders_sorted_and_filtered():
    r = c.get('/api/orders?tier=Critical&limit=20').json()
    scores = [o['score'] for o in r['items']]
    assert scores == sorted(scores, reverse=True)
    assert all(o['tier'] == 'Critical' for o in r['items'])
    assert r['total'] > 100
    only = c.get('/api/orders?mode=Same Day&limit=5').json()
    assert all(o['mode'] == 'Same Day' for o in only['items'])


def test_tiers_partition_orders():
    s = c.get('/api/summary').json()
    assert sum(t['orders'] for t in s['tiers'].values()) == s['orders']


def test_order_detail_and_404():
    oid = c.get('/api/orders?limit=1').json()['items'][0]['id']
    d = c.get(f'/api/orders/{oid}').json()
    assert d['rank'] == 1 and len(d['drivers']) == 6
    assert c.get('/api/orders/1').status_code == 404


def test_whatif_noop_matches_stored_score():
    o = c.get('/api/orders?limit=1').json()['items'][0]
    w = c.post(f"/api/orders/{o['id']}/whatif", json={}).json()
    assert abs(w['after']['p'] - w['before']['p']) < 1e-3


def test_whatif_noon_effect():
    sd = c.get('/api/orders?mode=Same Day&limit=1').json()['items'][0]['id']
    am = c.post(f'/api/orders/{sd}/whatif', json={'mode': 'Same Day', 'hour': 9}).json()['after']['p']
    pm = c.post(f'/api/orders/{sd}/whatif', json={'mode': 'Same Day', 'hour': 15}).json()['after']['p']
    assert am < 0.2 and pm > 0.8


def test_whatif_validation():
    oid = c.get('/api/orders?limit=1').json()['items'][0]['id']
    assert c.post(f'/api/orders/{oid}/whatif', json={'mode': 'Teleport'}).status_code == 422
    assert c.post(f'/api/orders/{oid}/whatif', json={'hour': 30}).status_code == 422
    assert c.post('/api/orders/1/whatif', json={}).status_code == 404


def test_capacity_monotonic_and_bounded():
    a = c.get('/api/capacity?budget=0.05').json()
    b = c.get('/api/capacity?budget=0.30').json()
    assert 0 <= a['revenue_reached'] <= b['revenue_reached'] <= 1
    assert a['revenue_reached'] <= a['oracle_reached'] + 1e-9
    assert all(abs(v[0]) < 1e-9 and v[-1] > 0.99 for k, v in a['curves'].items() if k in ('Heads Up', 'Oracle'))


def test_capacity_rejects_bad_budget():
    assert c.get('/api/capacity?budget=0').status_code == 422
    assert c.get('/api/capacity?budget=2').status_code == 422


def test_trust_reports_known_numbers():
    t = c.get('/api/trust').json()
    te = t['splits']['test']
    assert te['schemes']['Heads Up']['10']['revenue_reached'] > te['schemes']['Risk only']['10']['revenue_reached']
    assert te['schemes']['Oracle']['10']['revenue_reached'] >= te['schemes']['Heads Up']['10']['revenue_reached']


def test_rebuilt_features_match_saved_for_all_test_orders():
    """Rebuild features from raw order fields for every test order and compare with the saved predictions."""
    import pandas as pd, numpy as np
    raw = pd.read_csv(Path(__file__).resolve().parents[3] / 'data' / 'processed' / 'test.csv')
    rows = [dict(mode=r['Shipping Mode'], when=r['order date (DateOrders)'], pay_type=r['Type'], segment=r['Customer Segment'], country=r['Order Country'],
                 category=r['Category Name'], qty=r['Order Item Quantity'], sales=r['Sales'], profit=r['Benefit per order'], lines=int(r['n_line_items']),
                 distinct=int(r['n_distinct_categories']), region=r['Order Region']) for _, r in raw.iterrows()]
    out = main.E.score_many(rows)
    saved = main.E.df.set_index('id').loc[raw['Order Id'].values]
    assert np.abs(np.array([o['p'] for o in out]) - saved['p'].values).max() < 1e-4
    assert [o['tier'] for o in out] == saved['tier'].tolist()


def test_check_new_order_and_defaults():
    body = dict(mode='Same Day', when='2026-10-05T15:00', pay_type='DEBIT', segment='Consumer', country='Estados Unidos', category="Women's Apparel", qty=6, sales=900)
    r = c.post('/api/check', json=body).json()
    assert r['p'] > 0.9 and r['tier'] in ('Critical', 'High') and r['assumed']
    safe = c.post('/api/check', json={**body, 'when': '2026-10-05T09:00'}).json()
    assert safe['p'] < 0.15 and safe['tier'] == 'Standard'


def test_check_unknown_country_falls_back_and_rejects_bad_input():
    body = dict(mode='Standard Class', when='2026-10-05T10:00', pay_type='DEBIT', segment='Consumer', country='Atlantis', category='Zzz', qty=2, sales=100)
    r = c.post('/api/check', json=body).json()
    assert len(r['notes']) == 2 and 0 <= r['p'] <= 1
    assert c.post('/api/check', json={**body, 'mode': 'Teleport'}).status_code == 422
    assert c.post('/api/check', json={**body, 'when': 'not a date'}).status_code == 422
    assert c.post('/api/check', json={**body, 'sales': 0}).status_code == 422


def test_score_many_and_lookups():
    body = dict(mode='Standard Class', when='2026-10-05T10:00', pay_type='DEBIT', segment='Consumer', country='India', category='Cleats', qty=2, sales=100)
    r = c.post('/api/score', json={'rows': [body, {**body, 'mode': 'First Class'}]}).json()
    assert len(r) == 2 and r[1]['p'] > r[0]['p']
    L = c.get('/api/lookups').json()
    assert 'Estados Unidos' in L['countries'] and len(L['categories']) == 24


def test_report_numbers_match_project_files():
    """The numbers on the 'How it was built' pages must equal the saved project results."""
    import json
    root = Path(__file__).resolve().parents[3]
    rep = json.load(open(root / 'app' / 'frontend' / 'public' / 'data' / 'report.json'))
    final = json.load(open(root / 'data' / 'processed' / 'final_test_results.json'))
    thr = json.load(open(root / 'data' / 'processed' / 'chosen_threshold.json'))
    rf = rep['models']['Random Forest']
    assert rf['threshold'] == thr['threshold']
    assert abs(rf['test']['at_threshold']['recall'] - final['test_recall']) < 5e-4
    assert abs(rf['test']['at_threshold']['precision'] - final['test_precision']) < 5e-4
    assert abs(rf['test']['roc_auc'] - final['test_roc_auc']) < 5e-4
    assert abs(rf['val']['at_threshold']['recall'] - thr['validation_recall_at_threshold']) < 5e-4
    xg = rep['models']['XGBoost']
    assert xg['threshold'] == main.E.config['risk_threshold']
    assert rep['splits'][0]['orders'] == 46026 and rep['splits'][1]['orders'] == 7890 and rep['splits'][2]['orders'] == 11836
    assert rep['raw']['rows'] == 180519 and rep['raw']['orders'] == 65752
    dec = json.load(open(root / 'app' / 'frontend' / 'public' / 'data' / 'decisions.json'))
    assert sum(len(s['entries']) for s in dec['stages']) == open(root / 'DECISION_LOG.md', encoding='utf-8').read().count('\n### [') - 1  # minus the template entry
