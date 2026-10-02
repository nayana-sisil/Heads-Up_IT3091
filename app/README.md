---
title: Heads Up
emoji: 📦
colorFrom: blue
colorTo: indigo
sdk: docker
app_port: 7860
pinned: false
short_description: Late delivery risk and shipment prioritization
---

# Heads Up: decision support app

A web app for the DataCo operations team. It ranks orders by **chance of being late × order value**, shows why each order is risky, and lets you test what would change the risk.

**Engine:** tuned XGBoost. **Demo data:** the 11,836 test orders (Aug 2017 to Jan 2018) from the DataCo Smart Supply Chain dataset. The test set was not used to choose any setting.

## Pages

| Page | What it does |
|---|---|
| Today | Revenue at risk, tier mix, risk by shipping option and region, the noon cliff |
| Action board | Critical, High and Standard lanes with search and filters |
| Order drawer | Chance of late, priority score, SHAP reasons, suggested action |
| Capacity | How much late revenue a team reaches at a given review budget |
| What if | Change shipping option, hour, payment or customer and watch the risk move |
| Replay | The queue week by week |
| Trust | Calibration, comparison with a simple rule, tier results, known weak spots |

## Run it yourself

```bash
# from the repo root: rebuild the app data (needs data/processed and the trained XGBoost model)
python app/pipeline/export_app_data.py

# API
cd app/backend && pip install -r requirements.txt && uvicorn main:app --port 7860

# web interface (development)
cd app/frontend && npm install && npm run dev      # opens on http://localhost:5173

# or build everything as one container
cd app && docker build -t heads-up . && docker run -p 7860:7860 heads-up
```

Run the API tests with `cd app/backend && python -m pytest tests`.

## Honest limits

- A two-line shipping rule reaches about the same late revenue as the model in the top 10% of the queue. The model adds a separate chance and a reason for every order.
- Order values fell in the test period, so fewer orders reach the Critical tier there. Tier cut points should be refreshed on recent data.
- The strong Same Day noon effect looks like a rule built into the dataset. Real operations may show a weaker one.
