from pathlib import Path
from typing import Optional
import numpy as np
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from engine import Engine, MODES, SEGMENTS, TYPES

app = FastAPI(title='Heads Up API', version='1.0')
app.add_middleware(CORSMiddleware, allow_origins=['*'], allow_methods=['*'], allow_headers=['*'])
E = Engine()
DIST = Path(__file__).parent / 'static'


@app.get('/api/health')
def health(): return {'ok': True, 'orders': len(E.df), 'engine': E.config['engine']}


@app.get('/api/meta')
def meta():
    d = E.df
    return {'config': E.config, 'modes': MODES, 'segments': SEGMENTS, 'types': TYPES,
            'regions': sorted(d['region'].unique().tolist()), 'date_min': str(d['dt'].min().date()), 'date_max': str(d['dt'].max().date())}


@app.get('/api/summary')
def summary(date_from: Optional[str] = None, date_to: Optional[str] = None):
    return E.summary(date_from, date_to)


@app.get('/api/orders')
def orders(tier: Optional[str] = None, mode: Optional[str] = None, region: Optional[str] = None, q: Optional[str] = None,
           flagged: Optional[bool] = None, alpha: float = Query(1.0, ge=0, le=6), date_from: Optional[str] = None, date_to: Optional[str] = None,
           limit: int = Query(50, ge=1, le=500), offset: int = Query(0, ge=0)):
    d = E.subset(date_from, date_to)
    if tier: d = d[d['tier'] == tier]
    if mode: d = d[d['mode'] == mode]
    if region: d = d[d['region'] == region]
    if flagged is not None: d = d[d['flag'] == flagged]
    if q:
        ql = q.lower(); d = d[d['id'].astype(str).str.contains(ql) | d['country'].str.lower().str.contains(ql) | d['city'].str.lower().str.contains(ql) | d['category'].str.lower().str.contains(ql)]
    score = (d['p'] ** alpha) * d['sales'] if alpha > 0 else d['sales']
    d = d.assign(score=score).sort_values('score', ascending=False)
    cols = ['id', 'date', 'mode', 'region', 'country', 'city', 'segment', 'type', 'category', 'sales', 'p', 'priority', 'score', 'tier', 'flag', 'late', 'why']
    return {'total': int(len(d)), 'items': d.iloc[offset:offset + limit][cols].round(4).to_dict('records')}


@app.get('/api/orders/{order_id}')
def order(order_id: int):
    r = E.df[E.df['id'] == order_id]
    if r.empty: raise HTTPException(404, 'Order not found')
    o = r.iloc[0].drop(['dt']).to_dict(); o['drivers'] = E.drivers[order_id]; o['base_value'] = E.base_value
    o['rank'] = int((E.df['priority'] > o['priority']).sum() + 1); o['total'] = int(len(E.df))
    return o


class WhatIf(BaseModel):
    mode: Optional[str] = None
    hour: Optional[int] = None
    pay_type: Optional[str] = None
    segment: Optional[str] = None
    sales: Optional[float] = None


@app.post('/api/orders/{order_id}/whatif')
def whatif(order_id: int, body: WhatIf):
    if order_id not in E.raw.index: raise HTTPException(404, 'Order not found')
    if body.mode and body.mode not in MODES: raise HTTPException(422, 'Unknown shipping mode')
    if body.hour is not None and not 0 <= body.hour <= 23: raise HTTPException(422, 'Hour must be 0 to 23')
    return E.whatif(order_id, **body.model_dump())


@app.get('/api/capacity')
def capacity(alpha: float = Query(1.0, ge=0, le=6), budget: float = Query(0.10, gt=0, le=1), date_from: Optional[str] = None, date_to: Optional[str] = None):
    r = E.capacity(alpha, budget, date_from, date_to)
    if r is None: raise HTTPException(404, 'No orders in range')
    return r


@app.get('/api/trust')
def trust(): return E.trust


@app.get('/api/replay')
def replay(): return E.trust['replay']


if DIST.exists():
    app.mount('/assets', StaticFiles(directory=DIST / 'assets'), name='assets')

    @app.get('/{path:path}')
    def spa(path: str):
        f = DIST / path
        return FileResponse(f if f.is_file() else DIST / 'index.html')
