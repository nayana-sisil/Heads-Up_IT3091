# Heads-Up

Late Delivery Risk Prediction & Shipment Prioritization for logistics and supply chain operations, built on the **DataCo Smart Supply Chain** dataset.

**Group ID:** 2026-DS-05 | **Batch:** Y3.S1.WE.DS.0102 | **Module:** Machine Learning (IT3091)

## Team


| ID | Name |
|---|---|---|
| IT24102372 | Sanjana K D A
| IT24101446 | Wijesinghe D H R 
| IT24102364 | Pahalawaththage P W I H 
| IT24101303 | Wijekoon W M N S B


## Project Overview

A logistics company wants to improve delivery reliability and reduce operational delays. This project builds a supervised binary classification model to predict whether an order will be **Late** or **On Time**, then combines that risk score with order value/profit to produce a prioritized action list for operations teams.

- **Primary lens:** Late Delivery Risk Prediction
- **Secondary lens:** Shipment Prioritization

## Workflow

1. Business Problem Identification
2. Data Understanding & EDA
3. Data Preprocessing
4. Feature Engineering & Transformation
5. Baseline Strategy & Model Exploration
6. Model Development (Logistic Regression, Random Forest, XGBoost)
7. Evaluation (Recall-led, with Precision/F1/ROC-AUC/PR-AUC)
8. Hyperparameter Optimization (Optuna) & SHAP Analysis
9. Recommendation

## Repo Structure

```
heads-up/
├── data/                # raw / interim / processed data (raw CSV gitignored)
├── notebooks/           # numbered notebooks matching workflow stages
├── src/                 # reusable pipeline code (data, features, models, evaluation)
├── experiments/         # one folder per member for individual experimentation
│   ├── nayana_dev1/
│   ├── heshan_dev2/
│   ├── asindi_dev3/
│   └── heshani_dev4/
├── app/                 # optional scoring / demo interface
├── docs/                # problem canvas, workflow diagram, data dictionary
└── reports/             # submission PDFs and figures
```

## Branching Workflow

Each member works on their own branch (`<name>_devN`) inside their own `experiments/<name>_devN/` folder. When something is ready to become part of the shared pipeline, open a Pull Request into `main`. See `DECISION_LOG.md` for how decisions get recorded.

## Setup

```bash
git clone <repo-url>
cd heads-up
pip install -r requirements.txt
```
