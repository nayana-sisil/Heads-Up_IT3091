# Heads Up

**Heads Up gives DataCo's ops team a warning before a delivery goes wrong, not a report after it already has.**

A late delivery risk prediction and shipment prioritization decision support tool for logistics operations.

---

## What this project actually does

Heads Up is an end to end machine learning system that predicts whether an incoming order is likely to be delivered late, then ranks flagged orders by combining that risk with order value and profit. The point is simple. Operations teams get a short, actionable list of the shipments worth intervening on, instead of a generic risk score they have to triage by hand.

Two lenses, one model:

- Primary lens. Late delivery risk prediction, framed as binary classification.
- Secondary lens. Shipment prioritization, where the risk score gets combined with business value and turned into a ranked action queue.

Inputs are strictly the kind of information available at order placement time. Nothing post fulfillment leaks in.

---

## Project identifiers

| Field | Value |
|---|---|
| Track | Guided Data Track |
| Domain | Logistics and Supply Chain |
| Dataset | DataCo Smart Supply Chain |
| Institution | Sri Lanka Institute of Information Technology |
| Course | Machine Learning (IT3091) |
| Year and semester | 2026, Year 3, Semester 1 |
| Group ID | 2026 DS 05 |
| Batch | Y3.S1.WE.DS.0102 |

---

## The team

| Member | Student ID | Role |
|---|---|---|
| Wijesinghe D H R | IT24102372 | Business problem framing, EDA, final recommendation |
| Sanjana K D A | IT24102364 | Preprocessing and feature engineering |
| Wijekoon W M N S B | IT24101446 | Baseline strategy and model development |
| Pahalawaththage P W I H | IT24101303 | Evaluation, hyperparameter optimization, SHAP |

---

## The problem, in one paragraph

A logistics company moves hundreds of orders a day. Right now ops only finds out something went wrong after it already did. We want to flag risky orders at placement time, then tell the team which ones are actually worth the cost of intervening on. The model classifies orders as late or on time, and the prioritization layer turns those probabilities into a ranked queue weighted by order value, profit, and urgency.

Target variable: `Late_delivery_risk` where 1 means late or shipping cancelled and 0 means on time or early.

---

## Pipeline at a glance

The project runs through nine stages, matching the initial submission document:

1. Business problem identification
2. Data understanding and EDA
3. Data preprocessing, including unit of analysis aggregation, missing value handling, outlier capping, and the leakage aware split
4. Feature engineering and transformation
5. Baseline strategy. A rule based historical frequency classifier that the ML models have to beat
6. Model development across Logistic Regression, Random Forest, and XGBoost
7. Evaluation. Recall is the primary metric, with Precision, F1, ROC AUC, PR AUC, and a Top K hit rate on the prioritization output as supporting measures
8. Hyperparameter optimization with Optuna, plus SHAP for feature attribution
9. Recommendation and the Streamlit decision support app

Full stage descriptions live in `docs/proposal/2026_DS_05_Initial_Submission.pdf`.

---

## Folder layout

```
headsup-it3091/
├── README.md
├── DECISION_LOG.md
├── .gitignore
├── data/
│   ├── raw/                 # original DataCo CSV, gitignored, never committed
│   ├── interim/             # intermediate cleaning outputs, gitignored
│   ├── processed/           # modeling ready datasets
│   └── README.md
├── notebooks/
│   ├── 01_eda/
│   ├── 02_preprocessing/
│   ├── 03_feature_eng/
│   ├── 04_modeling/
│   └── 05_evaluation/
├── src/
│   ├── data/                # loaders and validators
│   ├── features/            # feature engineering transforms
│   ├── models/              # training and inference
│   └── utils/               # shared helpers
├── app/                     # Streamlit decision support UI
├── docs/
│   ├── proposal/            # initial submission PDF
│   ├── meeting_notes/
│   └── references/
├── reports/
│   ├── figures/
│   └── final_report/
└── experiments/             # personal sandboxes, one per team member
    ├── wijesinghe/
    ├── sanjana/
    ├── wijekoon/
    └── pahalawaththage/
```

The split between `notebooks/` and `experiments/<yourname>/` is intentional. Shared stage work goes in `notebooks/` so the team has one canonical reference per stage. Personal sandboxes go in `experiments/` so nobody's draft notebook overwrites someone else's mid flight.

---

## Tech stack

- Python 3.11
- pandas and NumPy for data wrangling
- scikit learn, XGBoost, and imbalanced learn for modeling
- Optuna for hyperparameter tuning, SHAP for explainability
- matplotlib and seaborn for plots
- Streamlit for the decision support UI

---

## Getting it running locally

```bash
# 1. Clone
git clone https://github.com/nayana-sisil/Heads-Up_IT3091.git
cd Heads-Up_IT3091

# 2. Virtual environment
python -m venv .venv
source .venv/bin/activate          # Linux or macOS
.venv\Scripts\activate             # Windows

# 3. Install dependencies (requirements.txt gets added once Stage 2 starts)
pip install -r requirements.txt
```

---

## How decisions get logged

Every non trivial choice we make as a team goes into `DECISION_LOG.md` with context, options considered, and the reason we picked what we picked. If a supervisor asks "why did you do it that way", the answer should already be sitting in that file. New entries follow the template at the top of the log so the format stays consistent.

---

## How we work together

1. Branch off main for everything. Use `git checkout -b feature/<yourname>-<short-desc>`.
2. Small commits. One idea per commit, with a clear message.
3. Open a pull request when you want feedback or you're done with the work.
4. Wait for at least one review before merging into main.
5. Never push straight to main. Branch protection is on, and it stays on.

If you want to try something risky, do it in `experiments/<yourname>/` first. Promote it into the shared pipeline only once it actually works.

---

## License

Academic use only. Sri Lanka Institute of Information Technology, IT3091, 2026.
