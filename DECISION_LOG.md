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

---

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

---

## Stage 5/6: Baseline & Model Development

### [2026-09-20] Baseline rule fixed: dropped the region condition
- **Made by:** Nayana
- **Decision:** Changed the baseline rule to flag "Late" based on Shipping Mode alone, instead of Shipping Mode OR Region.
- **Reason:** The original rule used both conditions, but since the overall late rate is already above 50%, almost every region also sat above 50%, so the rule ended up predicting "Late" for every single order. Checking the classification report caught this. Shipping Mode alone gives a real, working baseline (Recall 0.53, Precision 0.84).
- **Alternatives considered:** Raising the threshold instead of dropping region. Went with dropping region since Shipping Mode alone already gives clean discrimination without needing an arbitrary new cutoff.

### [2026-09-20] SVM convergence issue fixed
- **Made by:** Nayana
- **Decision:** Increased LinearSVC's max_iter and set dual=False.
- **Reason:** The first run threw a "failed to converge" warning, and gave a result that looked very different from Logistic Regression. After fixing convergence, SVM's numbers came out almost identical to Logistic Regression, confirming the earlier result was just an unfinished optimization, not a real difference between the two models.
- **Alternatives considered:** None, this was a straightforward bug fix once the warning was noticed.

### [2026-09-20] Random Forest and LightGBM's built-in feature importance not trusted at face value
- **Made by:** Nayana
- **Decision:** Don't rely on Random Forest's or LightGBM's default feature importance charts for interpretability claims. Used permutation importance as a cross-check for Random Forest instead.
- **Reason:** Both charts ranked `order_hour` unexpectedly high and Shipping Mode unexpectedly low, contradicting EDA and every other model. This is a known bias, both measures favor features with many possible values over simple yes/no features, regardless of real predictive value. Permutation importance partly fixed this (Shipping Mode came back to the top) but `order_hour` still showed up as genuinely important, which is now an open question for the SHAP analysis in Stage 8.
- **Alternatives considered:** Trusting the default charts as-is. Rejected once the mismatch with EDA and other models was noticed.

### [2026-09-20] Boosting comparison: classic Gradient Boosting is not weaker than modern boosting here
- **Made by:** Nayana
- **Decision:** Corrected our assumption that older boosting methods would perform worse. Only AdaBoost actually underperforms; sklearn's classic Gradient Boosting matches XGBoost, LightGBM, and CatBoost on every metric.
- **Reason:** We expected a "boosting getting better over time" story, but the numbers show a different pattern: AdaBoost to Gradient Boosting was a real jump in performance, but Gradient Boosting to the newer libraries (XGBoost/LightGBM/CatBoost) barely changed the results. The newer libraries are likely faster to train, not more accurate, at least on this dataset.
- **Alternatives considered:** None, this is a correction based on what the results actually showed.

### [2026-09-20] Voting and Stacking ensembles not used going forward
- **Made by:** Nayana
- **Decision:** Built both a Voting Classifier and a Stacking Classifier from the top 4 individual models, but decided not to carry either forward for tuning.
- **Reason:** Both ensembles scored lower on Recall than Random Forest alone. The top 4 models picked were all tree or boosting models with no linear model mixed in, so they likely made similar mistakes, meaning averaging or combining them didn't add much. The Stacking model's own weights confirmed this: it leaned heavily on CatBoost (the weakest of the 4 on Recall) and barely used XGBoost, showing it was optimizing for something other than what we actually care about.
- **Alternatives considered:** Picking a more diverse set of 4 models by hand instead of automatically picking the top scorers. Not done for now, noted as something to try later if time allows, since it would need re-running both ensembles again.

### [2026-09-20] Final candidates chosen for Stage 8 tuning: Random Forest and the Neural Network
- **Made by:** Nayana
- **Decision:** Carry Random Forest and the Neural Network forward as the main models to tune with Optuna. XGBoost stays in as a backup third option.
- **Reason:** Random Forest currently has the best Recall (0.62), the metric we care about most. The Neural Network has the best ROC-AUC and Precision, meaning it may catch up on Recall once we tune the decision threshold in Stage 8. XGBoost, LightGBM, and CatBoost all score about the same, so picking XGBoost as a backup instead of all three keeps things simpler without losing much.
- **Alternatives considered:** Tuning all remaining models. Rejected as more work than needed given three of them (XGBoost/LightGBM/CatBoost) score almost identically.

---

## Stage 7/8: Hyperparameter Optimization, Explainability & Final Evaluation

### [2026-09-30] Random Forest tuned on validation Recall, search space widened
- **Made by:** Nayana
- **Decision:** Tune the Random Forest with Optuna (50 trials, one fit and one validation score per trial) maximizing validation Recall, with `max_depth` allowed up to 50. Keep the result: `max_depth=50`, `n_estimators=124`, `min_samples_split=5`, `min_samples_leaf=1`, `max_features=None`, `class_weight=None`.
- **Reason:** The first run, capped at `max_depth=30`, scored Recall 0.6125, below the untuned default (0.6172), so the cap was treated as the problem and widened to 50. The second run reached 0.6289. Because Recall alone can be raised just by predicting "Late" more often, the full metrics were checked before accepting it: ROC-AUC rose from 0.7580 to 0.7621 and PR-AUC from 0.8234 to 0.8266, with Precision down from 0.7924 to 0.7751 and F1 flat. Both ranking metrics improved, so the gain is real and not a threshold artifact. `class_weight=None` matches the EDA finding that the classes are close to balanced.
- **Alternatives considered:** Keeping the depth cap of 30. Rejected, since it produced a result worse than the default. Re-running the search with a PR-AUC objective, as was done for XGBoost. Not done, because the AUC check above showed the Recall-only search had not caused the problem it caused for XGBoost. Worth stating in the report: the best of 50 trials scored on one validation set is optimistic by construction, and the Random Forest is the only model tuned on Recall instead of PR-AUC.

### [2026-09-30] XGBoost tuning objective changed from Recall to PR-AUC
- **Made by:** Nayana
- **Decision:** Discard the first XGBoost search (objective: validation Recall) and re-run it maximizing validation PR-AUC instead. Carry the PR-AUC-tuned model forward (`n_estimators=426`, `max_depth=10`, `learning_rate=0.013`, `gamma=4.95`, `subsample=0.99`, `colsample_bytree=0.97`).
- **Reason:** The Recall search reached 0.6773, a 7 point gain that looked like a clear win. The full metrics check showed it was not: Precision fell from 0.8160 to 0.7060, F1 was flat, and ROC-AUC (0.7595 to 0.7405) and PR-AUC (0.8250 to 0.8063) both fell. The model had only moved its operating point toward predicting "Late" more often. Tuning for Recall inside Optuna does implicitly what threshold selection already does explicitly, but with no cost on false alarms. PR-AUC does not depend on the threshold, so tuning for it improves ranking quality and leaves the operating point to be chosen separately. The revised search reached PR-AUC 0.8325 (untuned 0.8250). At matched Recall (0.60 to 0.75) the tuned model has higher Precision at every level, by roughly 0.5 to 2 points, which confirms a real ranking improvement. The gain is small, which is the honest size of what tuning adds here.
- **Alternatives considered:** Keeping the Recall objective and accepting the higher Recall. Rejected after the Precision and AUC drops above. A Recall objective with a Precision floor. Not tried, since PR-AUC already addresses the problem without choosing an arbitrary floor.

### [2026-10-01] Neural Network tuning: no improvement, and the objective was fixed after a degenerate first run
- **Made by:** Nayana
- **Decision:** Tune the Neural Network on validation PR-AUC (30 trials), add a one-minute smoke test before the search, and report the result as it is: tuning made no meaningful difference. There is no reason to prefer the tuned network over the untuned one.
- **Reason:** The first run used a Recall objective and returned a "best score" of 1.0, which is a sign something was wrong rather than a result. The objective was changed to PR-AUC and a smoke test was added: a fixed configuration should score a PR-AUC around 0.82 to 0.84, and about 1.0 means stop, something is leaking. The smoke test passed (0.8295). After 30 trials the best PR-AUC was 0.8307 against 0.8301 untuned (+0.0006). Every metric on the 40-epoch retrain moved by about 0.1 percentage point or less, which is smaller than the variation between random seeds. Two plausible explanations: a two-hidden-layer network may already be near its ceiling at 46,026 rows and 28 features, or the defaults from the model development stage were already a good configuration. The trial count is 30, not the 50 used for the tree models, because each trial trains a full network and is much slower (21 to 72 seconds each, about 20 minutes in total).
- **Alternatives considered:** Keeping the Recall objective. Rejected for the reason in the XGBoost entry above. Dropping the Neural Network from the project at this point. Not done, since it still matches the best tree models on ranking quality at default settings, but its case as a separate deployment candidate is weaker than it looked after the model development stage.

### [2026-10-01] Final model: tuned Random Forest, chosen after a matched-Recall comparison
- **Made by:** Nayana
- **Decision:** Use the tuned Random Forest as the final model for threshold selection and test evaluation. XGBoost stays documented as an equally good alternative.
- **Reason:** At the default 0.5 threshold the three tuned models look different (Random Forest has the best Recall, the others the best Precision), but that mostly reflects where each draws its line. Compared at the same Recall, which matters because the final threshold comes from a Recall target, they are tied at the operating point we use: at Recall 0.80 and above, Precision is about 0.64 for all three, within half a point. At lower Recall targets (0.60 to 0.75) XGBoost is ahead by roughly 1 to 2 points of Precision. In ranking metrics XGBoost is also slightly ahead (ROC-AUC about 0.769 against 0.762, PR-AUC about 0.832 against 0.827). Random Forest was the Recall leader going into tuning and is not worse at the chosen operating point, so it was kept. This is a defensible choice, not a clear win.
- **Alternatives considered:** XGBoost as the final model. Equally defensible, with better ranking metrics and SHAP that takes about 1 second instead of about 15 minutes. If a later stage needs a lighter or faster model, it can replace the Random Forest with no real loss at this operating point. The Neural Network. Rejected, since tuning gave it no advantage and it is harder to explain.

### [2026-10-01] SHAP computed on a 1,000-row sample, and a SHAP output-format bug fixed
- **Made by:** Nayana
- **Decision:** Run SHAP on a random sample of 1,000 validation rows (fixed seed) instead of all 7,890, and extract the "Late" class values with a helper that handles every format SHAP can return. Cache the Random Forest SHAP values so the slow step runs once.
- **Reason:** `shap.TreeExplainer` on a Random Forest costs trees x depth x rows, and this forest has 124 trees at depth up to 50. 1,000 rows took about 15 minutes, so all 7,890 rows was impractical, and summary and dependence plots show overall patterns, which a sample of this size reproduces closely. Separately, the first SHAP notebook failed on the force plot. The installed SHAP version returns Random Forest values as one array of shape (rows, features, classes), where older versions returned a list of two arrays. The original code never selected the "Late" class, so `sv_rf[0]` was a 28 by 2 matrix rather than one order's 28 values and the force plot rejected it as "multiple samples". The summary and dependence plots had also been given the wrong 3D array. The helper now returns the 2D "Late" class array in any format.
- **Alternatives considered:** SHAP on the full validation set. Rejected on runtime. A faster explainer approximation. Not used, since exact tree SHAP was affordable on a sample and keeps the values exact.

### [2026-10-01] The `order_hour` question is resolved: it is a Same Day shipping interaction
- **Made by:** Nayana
- **Decision:** Keep `order_hour` in the feature set and record that it matters through one interaction: Same Day shipping combined with the hour of the order. This closes the question left open on 2026-09-20.
- **Reason:** On the SHAP summary plots `order_hour` ranks 4th of 28 for the Random Forest and 5th of 28 for XGBoost, so it is a top-5 feature in both models once measured with SHAP. XGBoost's own gain-based chart (near last) was the misleading measure. The original hypothesis, an interaction with `Shipping Mode_First Class`, was **not** supported: coloring the dependence plot by First Class does not split the points. A follow-up check found that every one of the 53 sampled orders with a large `order_hour` effect is a Same Day order, and XGBoost flags the same 53. The data confirms the mechanism: in the training set, Same Day orders placed before 12:00 were late 0 of 1,332 times, and Same Day orders placed at 12:00 or later were late 96% of the time (the same pattern holds on validation: 0% against about 95%). This also explains why EDA found `order_hour` flat: Same Day orders are only about 5 to 6% of the data, so the effect disappears in an average over all orders. This is not leakage, since shipping mode and order hour are both known at order placement. The split is clean enough (0% against 96%) to look like a rule built into the dataset, so real operations may show a weaker effect. "Same Day order placed after noon" is a message ops can understand directly, which helps the explainability panel.
- **Alternatives considered:** Dropping `order_hour` as a weak feature, as its standalone signal suggested. Rejected, since it carries one of the strongest single interactions in the model. Also noted for follow-up but not yet investigated: `Type_TRANSFER` ranks 2nd for the Random Forest and 3rd for XGBoost, and always pushes predicted risk down. That is a stronger payment-type effect than EDA suggested.

### [2026-10-01] Threshold chosen from a Recall target, after a cost-based threshold proved degenerate
- **Made by:** Nayana
- **Decision:** Choose the operating point as the highest threshold whose validation Recall reaches a target of 0.80, which gives a threshold of **0.38** (validation Recall 0.814, Precision 0.633, 70% of orders flagged). Treat the 0.80 target as a placeholder for a group decision, to be revisited once we know how many orders ops can check each day.
- **Reason:** The planned approach was a cost-sensitive threshold with a missed late order costing 3 times a false alarm. That gave a threshold of 0.11, Recall 0.9998 and Precision 0.5575, which looked like a large win but is not: Precision is almost exactly the late share (54.2%) because the rule flags about 97% of all orders, which is the same as flagging everything. Flagging everything costs 3,611, the "best" threshold costs 3,399 (about 6% lower), and the default 0.5 costs about 5,544, which is worse than flagging everything. This is arithmetic, not a bug: with more than half the orders late, "intervene on everything" is cheaper than any selective rule a model with ROC-AUC of about 0.76 can produce. A sweep over ratios showed only 1:1 gives a selective rule (threshold 0.58, 37% flagged), and every ratio from 2:1 up flags 97% of orders. A single cost ratio is the wrong tool on this dataset. A Recall target gives a controllable trade-off: moving from 0.5 to 0.38 buys about 18 points of Recall for about 14 points of Precision, at the cost of acting on 70% of orders.
- **Alternatives considered:** A 1:1 cost ratio. Rejected, since it contradicts the Recall-first framing from 2026-09-12 and 2026-09-15. A higher Recall target (0.85 to 0.90). Available in the notebook's table, but the last five points of Recall cost about 9% more orders flagged for 3 more points of Precision. A fixed workload limit (top K% of orders). Kept as a second view for the prioritization lens, not as the threshold rule: the top 10% of orders by risk were all late on validation.

### [2026-10-02] Final test evaluation: result reported as it is, with two uses of the model
- **Made by:** Nayana
- **Decision:** Report the test result without adjustment and describe the model as two things: a broad high-Recall watch list (the 0.38 threshold) and a short ranked action queue (the top of the ranking). The test set was opened once, after a leakage audit, and the threshold was not changed afterward.
- **Reason:** On the test set (11,836 orders, 55.1% late) the tuned Random Forest at 0.38 reaches Recall **0.882** and Precision **0.606** (F1 0.719), catching 5,758 of 6,526 late orders and missing 768, with 3,742 false alarms. Ranking quality held up with a small drop: ROC-AUC 0.762 to 0.752 and PR-AUC 0.827 to 0.823. The higher Recall than on validation (0.882 against 0.814) is not a better model. The model gave higher scores to test orders overall, so 80% of test orders were flagged against 70% on validation, which means more late orders caught and also more false alarms. We have not investigated why scores shifted upward on the most recent orders. The practical lesson is that a fixed threshold chosen on validation does not give the same workload on later data, so the app should re-check how many orders it flags as data arrives. The setup is high Recall with low selectivity: only 30% of on-time orders are cleared, and flagging every order would give Precision 55.1%, so 60.6% is a modest gain for 12 points of Recall. The top of the ranking is the strongest part (the top 10% of test orders, 1,183 orders, were all late), but that top 10% is made up of First Class orders and Same Day orders placed after noon, segments that were already about 95% late. So the result is largely a Shipping Mode result, and the open question for the report is how well the model ranks the middle of the list.
- **Alternatives considered:** Re-selecting the threshold on the test set to hit the workload seen on validation. Rejected, since that would use the test set for tuning. Not done and worth stating as a limitation: only the final model was scored on the test set, so the baseline rule and the other models have no test numbers, and the improvement over the baseline is a validation-set statement (Recall 0.535 for the baseline against 0.629 for the tuned Random Forest, both at 0.5).

### [2026-10-02] Stage 8 experiment notebooks consolidated into one notebook, and models retrained in the current environment
- **Made by:** Nayana
- **Decision:** Merge the Stage 8 experiment notebooks (Random Forest tuning, both XGBoost versions, both Neural Network versions, SHAP, threshold tuning, final test evaluation) into one shared notebook, `notebooks/05_hyperparameter_tuning_and_evaluation.ipynb`. The three Optuna searches are off by default (`RUN_SEARCH = False`) and reuse the saved best parameters, so the notebook runs in a few minutes. The tuned models are retrained from those parameters when the notebook runs.
- **Reason:** `notebooks/` is meant to hold one canonical reference per stage, with personal drafts in `experiments/`. The full searches take about 80 minutes in total (the Random Forest alone about 60), which makes a notebook that always repeats them impractical to re-run. Retraining from saved parameters with fixed seeds also fixes an environment mismatch: the saved models had been pickled with scikit-learn 1.4.0 and were being loaded under 1.9.1, which produced version warnings and the risk of invalid results. The first XGBoost attempt and the first Neural Network attempt are kept in the notebook only as short "what went wrong" notes, not re-run. The consolidated notebook reproduced the validation and test numbers recorded in the entries above, with small differences for XGBoost (for example ROC-AUC 0.7684 against 0.7690) that are most likely library-version effects.
- **Alternatives considered:** Moving the experiment notebooks into `notebooks/` unchanged. Rejected, since they include abandoned runs and would leave six overlapping notebooks for one stage. Always re-running the searches. Rejected on runtime, but the switch is there if the group wants to repeat them.

---

## Stage 9: Shipment Prioritization (secondary lens)

### [2026-10-02] Priority score defined as chance of late times Sales
- **Made by:** Nayana
- **Decision:** Rank orders by `priority = P(late) x Sales`, the expected revenue at stake if nothing is done. The chance comes from the tuned Random Forest. `Sales` is the order level total, in real currency.
- **Reason:** The secondary lens asks which orders a team with limited time should handle first. A late order that is worth a lot hurts more than a late order that is worth little, so risk alone and money alone both miss something. Using `Sales` follows the 2026-09-18 decision: it is always positive and known at order time, while `Benefit per order` can be negative and is partly an outcome of the delivery itself. Before multiplying a chance by money, we checked the chances are honest. Brier score is 0.190 on validation and 0.194 on test, against 0.248 for always guessing the average. The top two deciles line up with reality (predicted 0.78 and 0.95, actual 0.77 and 0.93). The weak spot is the lowest risk decile, predicted 0.18 but 27% really late, so a low score does not mean safe.
- **Alternatives considered:** Risk only. Rejected, since it fills the queue with cheap orders that are almost sure to be late. Sales only. Rejected, since its precision is about 53%, no better than random at finding late orders. Using `Benefit per order` as the value term. Rejected for the sign and leakage reasons above.

### [2026-10-02] How the prioritization is judged: revenue reached and precision at a review budget
- **Made by:** Nayana
- **Decision:** Judge each ranking with two numbers at a review budget of the top 5%, 10%, 20% and 30% of orders: revenue reached (Sales of truly late orders inside the top K, divided by Sales of all truly late orders) and precision (share of reviewed orders that were really late). Compare against random order, Sales only, risk only, two simple lookup rules, and an oracle that knows which orders are late. Use validation for decisions and the test set as one confirmatory look.
- **Reason:** Accuracy style metrics do not describe a work queue. A manager has a fixed number of orders they can handle, so the useful question is how much late revenue those orders cover. The oracle gives a ceiling, so results can be stated as a share of the best possible outcome. The simple rules (late rate by Shipping Mode, and Shipping Mode with Same Day split at noon, learned from the training split only) are the fair "do we need ML?" comparison, and follow directly from the `order_hour` finding on 2026-10-01.
- **Alternatives considered:** Reusing Recall and Precision at the 0.38 threshold. Rejected for this lens, since that threshold flags 70% to 80% of orders, which is not a prioritized queue. Ranking metrics such as NDCG. Not used, since revenue reached is easier to explain to a non technical reader.

### [2026-10-02] Result: Risk x Sales beats risk or Sales alone, but a simple rule ties the model
- **Made by:** Nayana
- **Decision:** Report the result as it is. In the top 10% queue, Risk x Sales reaches 27.2% of late order revenue on validation and 35.9% on test. Risk only reaches 22.0% and 23.4%. Sales only reaches 20.3% and 31.9%. The oracle ceiling is 34.7% and 48.4%, so Heads Up reaches about 78% and 74% of the best possible result. The model does not beat the simple rule "Shipping Mode plus Same Day after noon" for this purpose: that rule reaches 27.3% and 36.0%.
- **Reason:** A paired bootstrap of 300 resamples gives an average gap (model minus rule) of -0.10 percentage points on validation (range -0.63 to +0.41) and -0.19 on test (range -0.72 to +0.43). Both ranges include zero, so this is a tie. This matches the finding on 2026-10-02 that the top of the ranking is mostly a Shipping Mode result. The model is still ahead on PR-AUC (0.827 against 0.759 for the rule on validation, 0.823 against 0.765 on test), because it orders the large middle group better than a four value lookup can. It also gives a separate chance for every order, and SHAP explains each one. The report will say that the model's value for prioritization is the finer ordering in the middle and the explanations, not a higher score in the top 10%.
- **Alternatives considered:** Leaving the rule comparison out of the report. Rejected, since a supervisor can ask for it and an honest tie is a stronger answer than a gap we did not test.

### [2026-10-02] Risk weight kept at 1, and exposed as a setting in the app
- **Made by:** Nayana
- **Decision:** Keep `P(late) x Sales` (risk weight alpha = 1) as the default score. The app will offer the weight as a setting, with labels such as Money first, Balanced and Risk first.
- **Reason:** Raising the chance to a power (`P^alpha x Sales`) shifts the queue from money to risk. At the top 10% on validation, alpha = 1 reaches the most revenue (27.2%, precision 86%). Alpha = 2 reaches 26.9% with precision 92%, so almost the same money with fewer wasted reviews. On test, alpha = 2 gives up more (33.5% against 35.9%, precision 84% against 70%). Because the better setting depends on the split, we keep the one that is simple to explain, expected revenue at stake, and let the user move the dial.
- **Alternatives considered:** Fixing alpha = 2 for cleaner queues. Rejected, since the validation gain in precision comes with a loss in revenue on test. Tuning alpha on validation and locking it in. Rejected as false precision, given the two splits disagree.

### [2026-10-02] Action tiers defined on validation, with a warning about shifting order values
- **Made by:** Nayana
- **Decision:** Turn the score into three tiers: Critical (top 10% of validation priority scores), High (next 20%) and Standard (the rest). Orders below the 0.38 risk threshold cannot be High. The cut points (priority score about 708 and 407) come from validation and are applied unchanged to test. They are saved in `priority_config.json` for the app.
- **Reason:** A tier is easier to act on than a continuous score. On validation, Critical is 86% late with an average order of 1,055 and holds 27% of all late revenue with 10% of the orders. Standard is 46% late with an average order of 495. On test the tiers still sort risk correctly (late rate 73%, 70% and 52%), but only 6% of test orders are Critical and 9% High instead of 10% and 19%. The cause is a drop in order value: average `Sales` is 591 in train, 612 in validation and 401 in test (median 293). We have not investigated why the most recent months have smaller orders. In production the cut points must be refreshed on recent data, or defined as shares of recent orders instead of fixed currency values.
- **Alternatives considered:** Tiers by rank share on each split. Not used for evaluation, since it would hide the drift, but it is the likely fix for the app. Defining tiers on test. Rejected, since that would use the test set for design.

### [2026-10-02] Value file mislabeled as unscaled: corrected file added, not edited in place
- **Made by:** Nayana
- **Decision:** Leave `priority_value_unscaled.csv` untouched and write a new file, `priority_value_sales.csv`, with the real `Sales` values and a split column. The Streamlit app reads the new file. This corrects the 2026-09-19 entry about keeping a separate unscaled copy of `priority_value_component`.
- **Reason:** The 2026-09-19 plan was to keep an unscaled copy so an operations user sees a real order value. The saved file does not do that: it was written after scaling in `notebooks/03_feature_engineering.ipynb`, so it holds standardized values (average -0.09, spread 1.05, including negative numbers). `priority_value_component` is also identical to `Sales` in all three splits, so it adds no information and can be dropped from the model features in a later clean up. Both issues were found by checking the file contents, not by an error.
- **Alternatives considered:** Overwriting the old file. Rejected, since two notebooks reference it and a changed schema could break them without a visible error. Renaming the old file. Not done yet; worth doing once the references in `03_feature_engineering.ipynb` and the experiment notebook are updated.

---

## Stage 10: Decision Support App

### [2026-10-02] The app runs on XGBoost, not the Random Forest
- **Made by:** Nayana
- **Decision:** The deployed app uses the tuned XGBoost model for scoring, reasons and the what-if tool. The tuned Random Forest stays the model evaluated in the report for the primary lens (Stage 8). The app and the report must both say which model each number comes from.
- **Reason:** The Random Forest file is 103 MB, over the 100 MB GitHub file limit and too heavy for free hosting. SHAP on it takes about 15 minutes for 1,000 orders, so "why is this order risky?" cannot run live. The XGBoost file is 0.7 MB and explains an order in about a second. The 2026-10-01 entry already found the two models tied at the chosen operating point, and said XGBoost could replace the Random Forest with no real loss. Scored on the same splits, XGBoost gives validation ROC-AUC 0.768 and test 0.772. With the same Recall 0.80 rule the threshold is 0.39 (validation Recall 0.809, Precision 0.636, 69% flagged). On test it reaches Recall 0.855 and Precision 0.631 with 75% flagged. The same warning as before applies: the share of flagged orders rises on later data.
- **Alternatives considered:** Keep the Random Forest and ship pre-computed scores only. Rejected, since the app would be a static viewer with no what-if tool and no live reasons. Compress the Random Forest. Not tried, since cutting trees would change the model we evaluated.

### [2026-10-02] Prioritization re-run with XGBoost: same conclusion, better calibration
- **Made by:** Nayana
- **Decision:** Recompute the priority score, tiers and evaluation with XGBoost and use these numbers in the app. The Stage 9 conclusions stand.
- **Reason:** In the top 10% queue, Risk x Sales reaches 27.8% of late revenue on validation and 36.2% on test. A simple Shipping Mode plus Same Day noon rule reaches 27.3% and 36.0%, so the tie remains. Risk only reaches 18.8% and 19.0%, Sales only 20.3% and 31.9%, and the oracle ceiling is 34.7% and 48.4%. XGBoost is better calibrated than the Random Forest: every risk decile sits within about 5 points of the diagonal on both splits, while the Random Forest under-predicted its lowest decile by 9 points. That makes the chance x Sales product safer to read as an expected value. New tier cut points from validation (top 10% Critical, next 20% High): priority score 697 and 398. On test, 4.9% of orders are Critical and 9.0% are High (late rate 87% and 74%, Standard 51%), so the order value drift from the 2026-10-02 Stage 9 entry still applies.
- **Alternatives considered:** Keeping the Random Forest cut points (708 and 407). Rejected, since the tiers must match the model that scores the orders.

### [2026-10-02] App design: a control tower built as a real web app, evaluated on replayed test orders
- **Made by:** Nayana
- **Decision:** Build the app as a FastAPI service plus a React interface in one container, deployed on Hugging Face Spaces. Pages: Today, Action board, order drawer, Capacity planner, What if, Replay and Trust. Demo data is the 11,836 test orders, scored by the model as if they arrived in order. Real outcomes are hidden by default and shown only behind a "Reveal what really happened" switch.
- **Reason:** Streamlit is faster to build but looks generic, and the assignment rewards a clear decision support story. The Trust page repeats the weak spots from this log in plain words: the simple rule ties the model in the top 10%, the Same Day noon effect looks like a rule built into the dataset, and test order values are lower, so tiers need refreshing on recent data. The what-if tool rebuilds the model inputs from the training scaler. A test confirms that changing nothing reproduces the stored score, and another confirms that moving a Same Day order across noon changes the risk from below 20% to above 80%. 11 API tests pass. The Capacity and Trust pages use real outcomes, so they describe a replay of past orders and not live performance.
- **Alternatives considered:** Streamlit. Rejected for the look and for limited control over layout. Accepting a CSV upload so users can score new orders. Not built in the first version. It was added in the redesign (next entries).

### [2026-10-02] Free hosting: the model runs inside the browser
- **Made by:** Nayana
- **Decision:** Publish the app as a static Hugging Face Space. The XGBoost trees, the SHAP calculation and all data logic run in the visitor's browser. The FastAPI and Docker version stays in the repo for anyone who runs it locally.
- **Reason:** Creating a Docker Space returned "402 Payment Required", so it needs a paid plan. A static Space is free. The browser version needs the same answers as the Python version, so the SHAP method (path dependent TreeSHAP) was ported to TypeScript and checked against XGBoost. The first version differed by up to 2.5 points of probability because XGBoost works in 32 bit numbers. After matching that, the largest difference is 0.00004 and the SHAP values are identical. The model file, orders and test features are shipped as small data files.
- **Alternatives considered:** Paying for a Docker Space. Not needed for the demo. Running only the API on a free service that sleeps. Rejected, since a sleeping first load makes a poor demo.

### [2026-10-02] App redesign: a tool to use, with new orders scored live
- **Made by:** Nayana
- **Decision:** Rebuild the app around what a user does, not what an analyst reads. Section "Use it": Home, Check an order, Score a file, Orders to handle. Section "Under the hood": Capacity planner, Replay, Model report. "Check an order" takes eight plain answers and returns one verdict, one next step and a "Try a change" row. "Score a file" ranks a CSV of new orders and lets the user download the result. The risk weight dial and the period filter moved off the main screens.
- **Reason:** The first version was good to look at but only described past orders, and it had too many controls. Predicting a new order at the moment it is placed is the real use of the model, and it matches the primary lens. To do this the app needs the same feature rules as notebook 03, so the lookup tables from the training data only (country and region late rates, product popularity, typical profit and line counts) are exported and the features are rebuilt from plain fields. Fields the user is not asked for are filled with typical training values and the page lists them. Unknown countries and products use the training average. Checks: rebuilding features from raw fields for all 11,836 test orders gives the same predictions as the saved ones (largest difference 0.00005) and the same tier for every order, in both Python and the browser code. 15 API tests pass.
- **Limits stated in the app:** "Predict" means scoring one order when it is placed. It is not a forecast of how many orders will come next week. The model learned from 2015 to 2018 orders and can drift. The Same Day noon effect looks like a rule in the dataset, so it may not hold for a real carrier.
- **Alternatives considered:** A next week volume forecast. Not built, since the project question is about late risk per order and the models were not trained or tested for volume forecasting. A full 28 field form. Rejected as too long for a user to fill in.

<!-- Add new entries above this line -->
