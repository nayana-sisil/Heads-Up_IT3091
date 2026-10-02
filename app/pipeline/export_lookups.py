"""Export the training-set lookup tables the app needs to score a brand new order.

Run from the repo root:  python app/pipeline/export_lookups.py
Everything here comes from the TRAIN split only, exactly like notebook 03.
"""
import json
from pathlib import Path
import numpy as np, pandas as pd

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / 'data' / 'processed'
OUT = ROOT / 'app' / 'backend' / 'artifacts'

tr = pd.read_csv(DATA / 'train.csv')
ft = pd.read_csv(DATA / 'features_step4_train.csv')
y = tr['Late_delivery_risk']

country = y.groupby(tr['Order Country']).mean()
region = y.groupby(tr['Order Region']).mean()
cat_freq = tr['Category Name'].value_counts(normalize=True)
country_n = tr['Order Country'].value_counts()
country_region = tr.groupby('Order Country')['Order Region'].agg(lambda s: s.mode().iloc[0])

lines_default = {}
for n in range(1, 6):
    sub = tr[tr.n_line_items == n]
    lines_default[str(n)] = {'distinct': int(sub.n_distinct_categories.median()), 'median_sales': float(sub.Sales.median()), 'median_qty': float(sub['Order Item Quantity'].median())}

lookups = {
    'global_late_rate': float(y.mean()),
    'country_late_rate': {k: float(v) for k, v in country.items()},
    'region_late_rate': {k: float(v) for k, v in region.items()},
    'country_orders': {k: int(v) for k, v in country_n.items()},
    'country_region': country_region.to_dict(),
    'category_frequency': {k: float(v) for k, v in cat_freq.items()},
    'category_frequency_fallback': float(cat_freq.min()),
    'benefit_cap': [float(ft['Benefit_per_order_capped'].min()), float(ft['Benefit_per_order_capped'].max())],
    'median_margin': float((tr['Benefit per order'] / tr['Sales']).median()),
    'lines_default': lines_default,
    'sales_range': [float(tr.Sales.min()), float(tr.Sales.max())],
    'typical': {'Sales': float(tr.Sales.median()), 'Order Item Quantity': float(tr['Order Item Quantity'].median())},
}
json.dump(lookups, open(OUT / 'lookups.json', 'w'), indent=1)
print('countries', len(country), 'categories', len(cat_freq), 'regions', len(region), 'cap', lookups['benefit_cap'])
