# Heads Up: decision support app

A web app for the DataCo operations team. It ranks orders by **chance of being late × order value**, shows why each order is risky, and lets you test what would change the risk.

**Live demo:** https://huggingface.co/spaces/nayanasisil2700/heads-up (free static Space, the model runs in your browser).

**Engine:** tuned XGBoost. **Demo data:** the 11,836 test orders (Aug 2017 to Jan 2018) from the DataCo Smart Supply Chain dataset. The test set was not used to choose any setting.

## Pages

**Use it** (the decision support tool)

| Page | What it does |
|---|---|
| Home | One sentence on what needs action, three numbers, the noon pattern |
| Check an order | Eight plain answers in, one verdict and next step out. "Try a change" shows how the risk moves. "Show the numbers" gives the reasons (SHAP) |
| Score a file | Upload a CSV of new orders, get a ranked list, download the results. Runs in your browser |
| Orders to handle | Critical, High and Standard orders in one list, with search |
| Team capacity | How much late revenue a team reaches at a given review budget |
| Replay | The queue week by week |
| Business case | Problem, users, a day with the tool, tier actions, value, recommendation and limits |
| Trust and limits | Calibration, comparison with a simple rule, known weak spots |

**How it was built** (for the viva and the demo)

| Page | Source notebook |
|---|---|
| 1. Problem and target | README, 01 |
| 2. Data and EDA | 01 |
| 3. Cleaning and split | 02 |
| 4. Features (with a live feature builder) | 03 |
| 5. Models (12 models and the baseline) | 04 |
| 6. Tuning and threshold (with a threshold explorer) | 05 |
| 7. Explainability | 05 section 6 |
| 8. Final evaluation (Random Forest and XGBoost side by side) | 05 sections 7 and 8 |
| 9. Prioritization | 06 |
| 10. The app itself | app/ |
| Decision log, Viva cheat sheet, About | DECISION_LOG.md, whole project |

**What "predict" means here:** the app scores one order at the moment it is placed. It does not forecast next week's volume. Fields you are not asked for are filled with typical training values, and the page tells you which.

## Run it yourself

```bash
# from the repo root: rebuild the app data (needs data/processed and the trained XGBoost model)
python app/pipeline/export_app_data.py
python app/pipeline/export_lookups.py      # training lookup tables for scoring new orders
python app/pipeline/export_report_data.py  # numbers for the How it was built pages (needs data/raw data and models/)

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
