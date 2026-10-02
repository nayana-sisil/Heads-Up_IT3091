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
