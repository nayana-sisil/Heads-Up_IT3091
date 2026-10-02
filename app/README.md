# Heads Up: decision support app

A web app for the DataCo operations team. It ranks orders by **chance of being late × order value**, shows why each order is risky, and lets you test what would change the risk.

**Live demo:** https://huggingface.co/spaces/nayanasisil2700/heads-up (free static Space, the model runs in your browser).

**Engine:** tuned XGBoost. **Demo data:** the 11,836 test orders (Aug 2017 to Jan 2018) from the DataCo Smart Supply Chain dataset. The test set was not used to choose any setting.

## Pages

| Page | What it does |
|---|---|
| Home | One sentence on what needs action, three numbers, the noon pattern |
| Check an order | Eight plain answers in, one verdict and next step out. "Try a change" shows how the risk moves. "Show the numbers" gives the reasons (SHAP) |
| Score a file | Upload a CSV of new orders, get a ranked list, download the results. Runs in your browser |
| Orders to handle | Critical, High and Standard orders in one list, with search |
| Capacity planner | How much late revenue a team reaches at a given review budget |
| Replay | The queue week by week |
| Model report | Calibration, comparison with a simple rule, tier results, known weak spots |

**What "predict" means here:** the app scores one order at the moment it is placed. It does not forecast next week's volume. Fields you are not asked for are filled with typical training values, and the page tells you which.

## Run it yourself

```bash
# from the repo root: rebuild the app data (needs data/processed and the trained XGBoost model)
python app/pipeline/export_app_data.py
python app/pipeline/export_lookups.py      # training lookup tables for scoring new orders

# API
cd app/backend && pip install -r requirements.txt && uvicorn main:app --port 7860

# web interface (development)
cd app/frontend && npm install && npm run dev      # opens on http://localhost:5173

# static build (no server, this is what Hugging Face hosts)
python app/pipeline/make_static_data.py
cd app/frontend && npm run build:static             # output in dist-static
npm run check:features                               # rebuilds features for all 11,836 test orders and compares
python app/deploy_static.py                          # needs HF_TOKEN in the environment

# or build everything as one container (needs a host that runs Docker)
cd app && docker build -t heads-up . && docker run -p 7860:7860 heads-up
```

The static build runs the XGBoost trees and exact TreeSHAP in the browser. A check against the Python API gave probability differences below 0.000001 and identical SHAP values on 48 what-if cases.

Run the API tests with `cd app/backend && python -m pytest tests`.

## Honest limits

- A two-line shipping rule reaches about the same late revenue as the model in the top 10% of the queue. The model adds a separate chance and a reason for every order.
- Order values fell in the test period, so fewer orders reach the Critical tier there. Tier cut points should be refreshed on recent data.
- The strong Same Day noon effect looks like a rule built into the dataset. Real operations may show a weaker one.
