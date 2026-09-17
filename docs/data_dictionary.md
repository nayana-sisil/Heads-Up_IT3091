# Data Dictionary — Heads-Up

Reference for every column in the DataCo Smart Supply Chain dataset (180,519 rows × 53 columns, order-line level). This is the authoritative source for what Stage 3/4 can and cannot use as model inputs — it replaces guessing column-by-column mid-pipeline.

**Classification key:**
- `target` — the prediction target, never a feature
- `safe` — known at order time, usable as a model input
- `excluded` — post-outcome, would leak the answer, never used as input
- `not used` — dropped in preprocessing (empty, redundant, or not relevant to either lens)

Note: a few column names/types below assume the standard public version of this dataset. Double-check against `schema_overview` in `notebooks/01_eda.ipynb` if your CSV mirror differs.

---

## Target

| Column | Type | Classification | Notes |
|---|---|---|---|
| `Late_delivery_risk` | int (0/1) | **target** | Audited against `Delivery Status` — clean mapping, zero inconsistencies. `Shipping canceled` orders coded as 0 (see `DECISION_LOG.md`, 2026-09-17). |
| `Delivery Status` | categorical | excluded | Post-outcome. Only exists because the target already came from it — do not use as a feature. |

---

## Order & shipping context (order-time-safe)

| Column | Type | Classification | Notes |
|---|---|---|---|
| `Shipping Mode` | categorical | safe | **Strongest predictor found in EDA** — 57pp spread in late rate across modes (First Class 95.3% vs. Standard Class 38.1%). Check for multicollinearity with `Days for shipment (scheduled)` before finalizing feature set. |
| `Days for shipment (scheduled)` | int (0–4) | safe | Likely tightly coupled to `Shipping Mode` — see note above. No missing values, no outliers. |
| `Type` | categorical (payment method) | safe | No missing values. |
| `Order Status` | categorical | check before use | Includes a `SUSPECTED_FRAUD` category not used in our current lens; confirm it doesn't itself leak delivery outcome before including as a feature. |

## Post-outcome fields (excluded — do not use as inputs)

| Column | Type | Classification | Notes |
|---|---|---|---|
| `Days for shipping (real)` | int | excluded | Only known after fulfillment — this is essentially the leakage version of the target. |
| `shipping date (DateOrders)` | datetime | excluded | Only known after the order actually ships. |

---

## Geographic

| Column | Type | Classification | Notes |
|---|---|---|---|
| `Order Region` | categorical | safe | Moderate signal — 9pp spread in late rate (48.8% Canada to 58.0% Central Africa). |
| `Order Country` | categorical | safe, needs cleanup | Wider signal than region — 30pp spread (36.9% Togo to 67.0% Ecuador), though some standout countries have smaller sample sizes. **Inconsistent localization found (English/Spanish mixed)** — standardize before encoding (see `DECISION_LOG.md`). |
| `Order City` | categorical | safe | High cardinality (3,597 unique) — likely too granular for direct encoding; `Order Region`/`Order Country` are the practical feature candidates. |
| `Order State` | categorical | safe | Not deeply explored in EDA; available if needed. |
| `Order Zipcode` | numeric | check before use | 86.24% missing — likely systemic, tied to country. Confirm with `groupby('Order Country')` in Stage 3; probably drop or convert to a binary "zipcode known" flag rather than impute. |
| `Latitude` / `Longitude` | float | safe, unused by default | Available for either lens if geographic distance-based features are wanted later; not part of the current planned feature set. |
| `Customer Country` | categorical | **not used** | Only 2 unique values (Puerto Rico, US) in this dataset — synthetic/limited customer master data, not representative of real order geography. Use `Order Country` instead. |
| `Customer City` / `Customer State` / `Customer Street` / `Customer Zipcode` | various | not used | Customer address fields are not part of either lens; `Customer Zipcode` has 3 negligible missing values if ever needed. |

---

## Product & order attributes

| Column | Type | Classification | Notes |
|---|---|---|---|
| `Category Name` | categorical | safe | Moderate signal — 21pp spread in late rate (Golf Bags & Carts ~69% to Men's Golf Clubs ~48%). |
| `Category Id` | int | safe (redundant with Category Name) | **51 unique values vs. 50 for Category Name — check this mismatch in Stage 3** before relying on either for feature engineering. |
| `Department Id` / `Department Name` | various | safe, unused by default | Available if category-level features prove insufficient. |
| `Product Description` | text | **not used** | 100% missing across every row — drop outright, nothing to impute. |
| `Product Name` / `Product Card Id` / `Product Category Id` / `Product Image` / `Product Status` | various | not used | Product catalog metadata, not relevant to either lens. |
| `Order Item Quantity` | int (1–5) | safe | Line-item field — **aggregate by sum** when collapsing to order level (see `DECISION_LOG.md`). No missing values, no outliers. |
| `Order Item Product Price` | float | safe | Line-item field, varies per line within an order — needs an aggregation rule if used at order level. |
| `Order Item Discount` / `Order Item Discount Rate` | float | safe, unused by default | Available if discount-related features are wanted later. |
| `Order Item Cardprod Id` / `Order Item Id` | ID fields | not used | Identifiers, not predictive features. |
| `Order Item Profit Ratio` / `Order Item Total` | float | check before use | Derived financial fields — confirm these are order-time-known (based on listed price, not actual fulfillment cost) before treating as safe. |

---

## Financial (supports secondary lens — shipment prioritisation)

| Column | Type | Classification | Notes |
|---|---|---|---|
| `Sales` | float | safe | Right-skewed but minimal outliers (0.27% by IQR). Line-item field — **aggregate by sum** to order level. Used as the order-value term in the priority score. |
| `Benefit per order` | float | safe, needs capping | **10.49% outliers by IQR, including a minimum of –$4,274.98.** Not a leakage issue — genuinely known at order time — but needs capping/winsorizing for model stability, and an explicit rule for how negative values factor into the priority-ranking formula (see `DECISION_LOG.md`). |
| `Sales per customer` | float | safe, unused by default | Available if customer-level aggregation features are wanted later. |
| `Order Profit Per Order` | float | safe, likely redundant with Benefit per order | Confirm relationship to `Benefit per order` in Stage 3 before using both. |

---

## Customer profile

| Column | Type | Classification | Notes |
|---|---|---|---|
| `Customer Segment` | categorical | safe | No missing values. Available as a feature; not deeply explored in EDA yet. |
| `Customer Id` / `Customer Fname` / `Customer Lname` / `Customer Email` / `Customer Password` | various | not used | Identity/PII fields — not features, and some are already masked in the raw data (`XXXXXXXXX`). `Customer Lname` has 8 negligible missing values, irrelevant since the column isn't used. |
| `Order Customer Id` | ID field | not used | Identifier, not a predictive feature. |

---

## Temporal

| Column | Type | Classification | Notes |
|---|---|---|---|
| `order date (DateOrders)` | text → parsed to datetime | safe | Stored as text in the raw file — parse with `pd.to_datetime()`. Source for engineered features: year, month, day-of-week. **Day-of-week and month showed almost no variation in late rate (flat ~53–55%)** — calendar features are a weak standalone signal; low priority in Stage 4. Also the field used to build the chronological train/test split (see `DECISION_LOG.md`). |

---

## Identifiers (not features)

| Column | Type | Classification | Notes |
|---|---|---|---|
| `Order Id` | int | not used (as feature) | The aggregation key for collapsing line items to order level — essential for preprocessing, not a model input. |
| `Market` | categorical | safe, unused by default | Broader geographic grouping than `Order Region`; available if needed. |

---

## Summary counts

- **53 total columns**
- **1 target**
- **2 excluded (post-outcome leakage)**
- **~15–18 safe / planned as active features**
- **Remainder:** identifiers, customer PII, product catalog metadata, or fields dropped for being empty/redundant — not used

## Known data-quality issues to handle in Stage 3

1. `Product Description` — 100% missing, drop.
2. `Order Zipcode` — 86.24% missing, likely systemic by country, confirm and drop or flag.
3. `Category Id` (51 unique) vs. `Category Name` (50 unique) — check for a mismatch before relying on either.
4. `Order Country` — inconsistent English/Spanish naming, standardize before encoding.
5. `Benefit per order` — 10.49% outliers, cap/winsorize; separate decision needed for the priority formula.
6. `Customer Country` — only 2 values, synthetic/limited; do not use for geographic features, use `Order Country` instead.

Full reasoning behind each of these is in `DECISION_LOG.md` and `notebooks/01_eda.ipynb`.
