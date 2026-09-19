# Decision Log

Every significant project decision goes here: what was decided, why, and by whom. This is graded evidence of workflow reasoning, so entries stay specific and dated. Entries are grouped by stage and kept in chronological order within each stage.

**A note on corrections:** when a later finding changes the reasoning behind an earlier decision, we add a new dated entry rather than editing the old one. That way the log shows how our understanding actually evolved (assumption, then a check, then a correction), which is more honest and more useful than pretending we had it right from the start.

## Format

Each entry is a bullet list under a dated heading:

```
### [YYYY-MM-DD] Short decision title
- **Made by:** Name(s)
- **Decision:** What was decided.
- **Reason:** Why this option was chosen over alternatives.
- **Alternatives considered:** What else was on the table, and why it was rejected.
```

---

## Stage 2: Data Understanding & EDA

### [2026-09-10] Unit of analysis: aggregate to Order Id
- **Made by:** Asindi
- **Decision:** Collapse line-item-level rows to a single row per `Order Id` before modeling.
- **Reason:** The prediction target (late delivery) is a property of the whole order/shipment, not of an individual line item. Modeling at line-item level would duplicate the label across rows and leak information across the train/test split.
- **Alternatives considered:** Keeping line-item granularity and grouping only at evaluation time. Rejected because it complicates the split and risks the same order appearing in both train and test.

### [2026-09-12] Primary evaluation metric: Recall
- **Made by:** Asindi
- **Decision:** Recall (Sensitivity) is the primary metric, with Precision, F1, ROC-AUC, and PR-AUC as supporting metrics.
- **Reason:** A missed late delivery (false negative) causes unmanaged penalties and customer dissatisfaction. That's more costly to the business than a false alarm, so minimizing missed late orders matters more than raw accuracy.
- **Alternatives considered:** Accuracy. Rejected because the late/on-time split was assumed to be imbalanced, which would make accuracy misleading. F1-only. Rejected as primary because it doesn't sufficiently penalize false negatives on its own.

### [2026-09-15] Recall justification revisited after EDA
- **Made by:** Nayana
- **Decision:** Keep Recall as the primary metric, but correct the reasoning behind it.
- **Reason:** EDA on the actual data shows the class split is 54.83% late vs. 45.17% on-time. That's basically balanced, not imbalanced as assumed on 09-12. The real justification for Recall isn't imbalance, it's cost: missing a late order (false negative) costs more than flagging one that turns out fine (false positive).
- **Alternatives considered:** None new. Same metric, just correcting the justification now that we have real numbers instead of an assumption.

### [2026-09-15] Shipping canceled orders stay coded as not late
- **Made by:** Nayana
- **Decision:** Keep `Late_delivery_risk` as is, including `Shipping canceled` orders coded as 0.
- **Reason:** Audited `Late_delivery_risk` against `Delivery Status` directly. Every category maps cleanly to one target value with no mixing. `Shipping canceled` (7,754 orders, about 4.3% of the data) is bucketed as 0. It's not technically on time, but it's also not a late delivery, so leaving it as is is the simplest defensible choice, and we can point to the audit numbers if asked why.
- **Alternatives considered:** Dropping canceled orders from training entirely, or tracking them as a separate flag alongside the binary target. Didn't go with either, since 4.3% is a small enough share that it's unlikely to distort the model much either way.

### [2026-09-17] Train/test split: chronological by proportion, not calendar year
- **Made by:** Nayana, Heshani
- **Decision:** Sort orders by date and use the most recent 15 to 20% as the test set, instead of a random split or a strict "train on 2015 to 2017, test on 2018" cutoff.
- **Reason:** Late rate by year is stable (54.5 to 56.3% across 2015 to 2018, no real drift), so a chronological split isn't rescuing us from a big pattern shift. But the data only goes up to Jan 2018, a single month with about 2,100 orders, too thin and seasonally narrow to use as a standalone test set. Splitting by proportion instead of calendar year keeps the "test on the future" logic without that problem.
- **Alternatives considered:** Random stratified split (the Initial Submission's original plan). Moved away from this since the data spans multiple years and a random split risks validating on a mix of past and future orders rather than genuinely unseen future data. Strict calendar-year split (train 2015 to 17, test 2018). Rejected for the thin-sample reason above.

### [2026-09-17] Order Country naming appears to need standardizing
- **Made by:** Nayana
- **Decision:** Flagged `Order Country` for standardization before encoding in Stage 3.
- **Reason:** EDA sample showed country names apparently mixing English and Spanish (Hungría, Irlanda, Malasia, Costa de Marfil for Ivory Coast, etc). If any country were split across two spellings, it would dilute that country's signal.
- **Alternatives considered:** Leaving as is. Rejected at the time, since a split-spelling risk seemed worth avoiding.
- **Status:** superseded. See the 2026-09-17 Stage 3 entry below. The full list turned out to show no actual mixing.

### [2026-09-17] Benefit per order: outliers found, treatment deferred
- **Made by:** Nayana
- **Decision:** Flagged `Benefit per order` for capping in Stage 3, with a separate decision needed on how negative-profit orders should factor into the shipment prioritization score.
- **Reason:** 10.49% of orders are outliers by IQR at line-item level, with one order as low as negative $4,275. That's a real number, not a data error, but extreme enough to distort both model training and the priority formula if not handled deliberately. A huge-loss order shouldn't automatically count as high value, high priority.
- **Alternatives considered:** Dropping outlier rows outright. Rejected, since that's roughly 10% of the data and the values are real business outcomes, not errors.
- **Status:** resolved. See the 2026-09-17 Stage 3 entry below for the actual capping bounds and final formula.

---

## Stage 3: Data Preprocessing

### [2026-09-16] Order-level aggregation rule per column
- **Made by:** Heshani
- **Decision:** When collapsing line items to `Order Id`, use sum for `Sales` and `Order Item Quantity`; first value for order-level categoricals (`Shipping Mode`, `Order Region`, `Order Country`, `Customer Segment`, etc); first value for `Late_delivery_risk`.
- **Reason:** The dataset averages 2.75 line items per order, and checking a sample order confirmed `Delivery Status`/`Late_delivery_risk` are identical across all lines of the same order, so `first` is safe for the target. Sales and quantity genuinely differ per line item, so those need to be summed to represent the whole order.
- **Alternatives considered:** Mean instead of sum for `Sales`. Rejected, since total order value matters more for the prioritization lens than a per-line average.

### [2026-09-17] Category Name/Id require mode, not first, and two new features added
- **Made by:** Nayana
- **Decision:** Aggregate `Category Name` and `Category Id` using the mode (most frequent value) rather than `first`. Add two new order-level features: `n_line_items` (line-item count per order) and `n_distinct_categories` (number of distinct categories per order).
- **Reason:** A variability check before aggregating found `Category Name`/`Category Id` vary up to 5 times within a single order, unlike every other planned field, which is genuinely constant. Using `first` would have silently kept one arbitrary category out of up to 5 and discarded the rest. The scale confirmed this mattered: **44,563 orders (67.77% of the dataset) contain more than one product category**. Not a rare edge case, the majority of orders.
- **Alternatives considered:** Keeping `first`. Rejected once the variability check ran, since it would have affected two thirds of the dataset. Dropping category entirely. Rejected, since `n_distinct_categories` preserves real signal that `first` would have thrown away.

### [2026-09-17] Order Zipcode dropped entirely
- **Made by:** Nayana
- **Decision:** Drop `Order Zipcode` from the feature set rather than keeping it as a binary "has zipcode" flag.
- **Reason:** 87.42% of orders are missing a zipcode, and checking availability by country confirmed this is fully systemic. Every low-availability country shows exactly 0.0% zipcode availability, not partial or noisy missingness. Since the pattern is essentially "zipcode exists only for a specific subset of countries," a binary flag would be near redundant with `Order Country`, which is already in the feature set.
- **Alternatives considered:** Keeping a binary `has_zipcode` flag. Rejected as redundant given the evidence above.

### [2026-09-17] Order Country standardization: correction, no fix actually needed
- **Made by:** Nayana
- **Decision:** No standardization applied to `Order Country`. Supersedes the 2026-09-17 EDA-stage entry above.
- **Reason:** Listing all 164 unique country values directly, rather than relying on the smaller EDA sample, showed the column is consistently in Spanish throughout. The earlier "mixed English/Spanish" read was a misinterpretation: entries that looked English (Ghana, Canada, Portugal, Argentina, Austria) simply have Spanish spellings identical or near identical to their English ones. There is no country split across two spellings.
- **Alternatives considered:** Not applicable. This entry corrects an earlier assumption rather than choosing between options. One cosmetic, non duplicating quirk noted but left alone: `SudAfrica` (South Africa) is written without a space, inconsistent with other multi-word names, but doesn't collide with any other spelling.

### [2026-09-17] Category Id/Name mismatch resolved: department scoped IDs, not a data error
- **Made by:** Nayana
- **Decision:** Use `Category Name` as the canonical category feature. Exclude `Category Id` as a standalone feature; only use it in combination with `Department Id` if department-level granularity is needed later.
- **Reason:** The mismatch first noticed in EDA (51 unique `Category Id` vs. 50 unique `Category Name` values) turned out to be far bigger on closer inspection: 28 `Category Id` values map to more than one name, and 24 names are shared across multiple IDs (for example, `Category Id` 17 maps to both "Accessories" and "Cleats"). Pairing `Category Id` with `Department Id` and re-checking showed **zero** remaining inconsistencies, confirming category IDs are scoped within a department, not globally unique. This is a normal ID-scoping convention, not corrupted data.
- **Alternatives considered:** Treating the mismatch as a data-quality error and dropping category entirely. Rejected once the department-scoping check confirmed the IDs behave exactly as expected once given the right context.

### [2026-09-18] Benefit per order: final capping bounds and priority formula resolved
- **Made by:** Nayana
- **Decision:** Cap `Benefit per order` at the 1st/99th percentile (bounds: negative $645.22 to $422.12 at order level), affecting 1,316 orders (2.00%). For the secondary lens's priority score, use `Sales` (always positive) as the value term, not raw `Benefit per order`.
- **Reason:** Post-aggregation, outliers by IQR sit at 7.89% (down from 10.49% at line-item level, since summing line items smooths out extremes). Capping at the 1st/99th percentile preserves all orders while preventing a handful of extreme values from dominating model training. Using `Sales` as the priority formula's value term avoids the sign-confusion problem entirely: a large negative profit order won't be miscounted as high value, deprioritize nothing.
- **Alternatives considered:** Using raw, uncapped `Benefit per order` for both modeling and the priority formula. Rejected due to the sign and scale issues above. Dropping outlier rows outright. Already rejected in the earlier EDA stage entry.

### [2026-09-18] Train/validation/test split added, three way not two way
- **Made by:** Nayana
- **Decision:** Split chronologically into three chunks instead of two: train (earliest 70%, Jan 2015 to Mar 2017), validation (next 12%, Mar to Aug 2017), test (most recent 18%, Aug 2017 to Jan 2018).
- **Reason:** The Initial Submission planned Optuna-based hyperparameter tuning across 4 candidate models. Running full cross-validation inside every single Optuna trial is computationally expensive at this scale. A single fixed validation set lets each trial be scored once; the test set stays completely untouched until final evaluation. Class balance was confirmed to hold tightly across all three splits (Train 54.85%/45.15%, Validation 54.23%/45.77%, Test 55.14%/44.86%, all within about 1 percentage point of the overall average), so the extra three-way split doesn't introduce any new imbalance risk.
- **Alternatives considered:** Two way train/test split only, relying on `TimeSeriesSplit` cross validation for tuning. Kept as an optional extra robustness check later if time permits, but not the primary tuning approach, given the compute cost across 4 models and many trials.

## Stage 4: Feature Engineering

### [2026-09-19] Temporal features kept despite weak standalone signal
- **Made by:** Nayana
- **Decision:** Engineer `order_hour`, `order_dayofweek`, `order_month`, `order_is_weekend`, and `order_is_holiday_season` and keep them in the feature set, even though EDA found these patterns are essentially flat.
- **Reason:** Checked the late-rate spread for each feature on the training split directly, and all four came back under 2.5 percentage points (day of week 1.5pp, month 2.4pp, weekend 0.5pp, holiday season 0.1pp), confirming the EDA finding rather than contradicting it. A weak standalone signal doesn't rule out the model picking up a useful interaction effect (for example holiday season combined with a specific shipping mode), so the features are kept, but we don't expect them to rank as important on their own.
- **Alternatives considered:** Dropping the temporal features entirely. Rejected, since the Initial Submission commits to engineering them and there's no real cost to keeping a weak feature, only a potential cost to dropping one that might still help in combination with others.

### [2026-09-19] Days for shipment (scheduled) dropped after confirming perfect collinearity with Shipping Mode
- **Made by:** Nayana
- **Decision:** Drop `Days for shipment (scheduled)` from the feature set, but only after using it to build a new feature, `sales_per_scheduled_day`. Also add `is_express_shipping`, a binary flag for First Class or Same Day shipping.
- **Reason:** A crosstab of `Shipping Mode` against `Days for shipment (scheduled)` on the training data showed a perfect 1:1 mapping with zero exceptions: First Class always 1 day, Same Day always 0 days, Second Class always 2 days, Standard Class always 4 days. This is stronger than the "near-deterministic" relationship flagged in EDA, it's total redundancy. Keeping both columns would destabilize Logistic Regression's coefficients, which matters since interpretability is the reason we're using it as a baseline. `sales_per_scheduled_day` needed the raw column to exist first, so the drop happens after that feature is built, not before.
- **Alternatives considered:** Keeping both columns and letting regularization sort it out. Rejected once the relationship was confirmed to be perfect rather than just strong, since perfect collinearity is a real problem for Logistic Regression specifically, not just a minor inefficiency.

### [2026-09-19] Feature engineering pipeline ordering bug caught and fixed
- **Made by:** Nayana
- **Decision:** Corrected the order of operations in the shipping features step: build `sales_per_scheduled_day` from `Days for shipment (scheduled)` first, then drop the column. An earlier draft had this backwards.
- **Reason:** The first version of this step dropped `Days for shipment (scheduled)` before the feature that depends on it was built, which silently produced a feature matrix missing both `sales_per_scheduled_day` and `is_express_shipping`, with no error raised at the time. This was only caught by explicitly checking the final column list against what was expected in the last assembly step, three notebooks downstream from where the bug was introduced.
- **Alternatives considered:** Not applicable, this is a bug fix rather than a choice between options. Logged mainly because catching and fixing it is itself worth recording, and because it's a reminder to explicitly verify expected columns exist right after any step that both derives a feature from a column and removes that same column.

### [2026-09-19] Geographic target encoding fit strictly on training data
- **Made by:** Nayana
- **Decision:** Target-encode `Order Country` and `Order Region` as average delay rate per category, fitting the encoding map only on the training split. Validation and test rows use the training map, with any unseen category falling back to the training set's global mean late rate.
- **Reason:** Fitting an encoding on the full dataset before splitting would leak future information into the training data, exactly the kind of mistake the project's leakage-prevention plan is meant to catch. Checked coverage directly: all 164 countries seen in training also appear in validation and test, so the fallback logic is correctly in place but never actually had to trigger.
- **Alternatives considered:** Fitting the encoding on the full dataset before splitting. Rejected as a clear leakage risk. One-hot encoding `Order Country` instead of target encoding. Rejected due to the high cardinality (164 values), which would blow up the feature space for little benefit given the target encoding already captures the delay-rate signal directly.

### [2026-09-19] Remaining categorical encoding: one-hot for low cardinality, frequency for Category Name
- **Made by:** Nayana
- **Decision:** One-hot encode `Shipping Mode`, `Customer Segment`, and `Type` (4, 3, and 4 unique values respectively). Frequency-encode `Category Name` using the same train-only-fit rule as the geographic encoding.
- **Reason:** Low cardinality fields suit one-hot encoding without creating too many columns. `Category Name` was confirmed reliable as the canonical category feature in Stage 3 after resolving the department-scoping question, so frequency encoding it directly is safe. Column alignment across train, validation, and test was handled explicitly by reindexing validation and test to the training set's columns, to guard against a category being missing from one split.
- **Alternatives considered:** One-hot encoding `Category Name` as well. Rejected due to its higher cardinality (~50 categories) compared to the other categoricals, where frequency encoding gives a more compact, still-informative representation.

### [2026-09-19] Final feature set locked in: dropped columns, scaling approach, and unscaled priority reference
- **Made by:** Nayana
- **Decision:** Drop raw columns now superseded by engineered or encoded versions (`Order Id`, `Order Country`, `Order Region`, `Order City`, `Order State`, `Category Name`, `Category Id`, `order date (DateOrders)`, `Delivery Status`). Scale all numeric features with `StandardScaler` fit on the training set only. Keep a separate unscaled copy of `priority_value_component` for the Streamlit app's priority ranking display, since a standardized value can be negative and wouldn't be meaningful to show an operations user as an order's value.
- **Reason:** The raw columns are either identifiers, post-outcome fields, or fully replaced by an engineered feature, so keeping them would be redundant or unsafe. Scaling is needed for Logistic Regression's coefficients to be comparable across features; tree-based models don't strictly need it but aren't hurt by it either, so one scaled version is used for the whole feature set rather than maintaining two. The final matrix has 28 features plus the target across 46,026 training orders, 7,890 validation orders, and 11,836 test orders, with no missing values in any split.
- **Alternatives considered:** Maintaining separate scaled and unscaled feature sets for tree-based versus linear models. Rejected as unnecessary complexity, since scaling doesn't harm tree-based model performance.

<!-- Add new entries above this line -->
