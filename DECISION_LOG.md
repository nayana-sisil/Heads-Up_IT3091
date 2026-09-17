# Decision Log

Record every significant project decision here - what was decided, why, and by whom. This is graded evidence of workflow reasoning, so keep entries specific and dated.

## Format

### [YYYY-MM-DD] Short decision title
**Made by:** Name(s)
**Decision:** What was decided.
**Reason:** Why this option was chosen over alternatives.
**Alternatives considered:** What else was on the table, and why it was rejected.

---

### [2026-09-10] Unit of analysis: aggregate to Order Id
**Made by:** Asindi  
**Decision:** Collapse line item level rows to a single row per Order Id before modeling.  
**Reason:** The prediction target (late delivery) is a property of the whole order/shipment, not of an individual line item - modeling at line item level would duplicate the label across rows and leak information across the train/test split.  
**Alternatives considered:** Keeping line item granularity and using groupby only at evaluation time - rejected because it complicates the stratified split and risks the same order appearing in both train and test sets.

### [2026-09-12] Primary evaluation metric: Recall
**Made by:** Asindi  
**Decision:** Recall (Sensitivity) will be the primary metric, with Precision, F1, ROC-AUC, and PR-AUC as supporting metrics.  
**Reason:** A missed late delivery (false negative) results in unmanaged penalties and customer dissatisfaction, which is more costly to the business than a false alarm - so minimizing missed late orders matters more than raw accuracy.  
**Alternatives considered:** Accuracy - rejected because the late/on time class split is unlikely to be balanced, making accuracy misleading; F1-only - rejected as primary because it doesn't sufficiently penalize false negatives on its own.

### [2026-09-17] Recall justification revisited after EDA
**Made by:** Nayana  
**Decision:** Keep Recall as the primary metric, but the reasoning changes slightly from the 09-12 entry.  
**Reason:** EDA on the actual data shows the class split is 54.83% late vs 45.17% on time - basically balanced, not imbalanced like we assumed earlier. So the real reason to prioritize Recall isn't imbalance, it's cost: missing a late order (false negative) costs more than flagging one that turns out fine (false positive). Keeping this as a separate entry instead of editing the old one so there's a record of what we actually checked.  
**Alternatives considered:** None new - same metric choice, just correcting the justification now that we have real numbers instead of an assumption.

### [2026-09-17] Order level aggregation rule per column
**Made by:** Heshani  
**Decision:** When collapsing line items to Order Id (per the 09-10 decision), use: sum for Sales and Order Item Quantity, first value for order level categoricals (Shipping Mode, Order Region, Order Country, Customer Segment, etc.), and first value for Late_delivery_risk.  
**Reason:** EDA confirmed the dataset averages 2.75 line items per order, and checking a sample order showed Delivery Status/Late_delivery_risk are identical across all lines of the same order - so "first" is safe for the target. Sales/quantity genuinely differ per line item, so those need to be summed to represent the whole order, not just the first line.  
**Alternatives considered:** Using mean instead of sum for Sales - rejected, since total order value matters more for the prioritization lens than an average per line.

### [2026-09-17] Shipping canceled orders stay coded as not late
**Made by:** Nayana
**Decision:** Keep Late_delivery_risk as is, including Shipping canceled orders coded as 0.  
**Reason:** Audited Late_delivery_risk against Delivery Status directly - every category maps cleanly to one target value with no mixing. Shipping canceled (7,754 orders, ~4.3% of data) is bucketed as 0. It's not technically "on time" but it's also not a late delivery, so leaving it as is is the simplest defensible choice and we can now point to the audit numbers if asked why.  
**Alternatives considered:** Dropping canceled orders from training entirely, or tracking them as a separate flag alongside the binary target - didn't go with either since 4.3% is a small enough share that it's unlikely to distort the model much either way.

### [2026-09-17] Train/test split: chronological by proportion, not calendar year
**Made by:** Nayana,Heshani  
**Decision:** Sort orders by date and use the most recent ~15-20% as the test set, instead of a random split or a strict "train on 2015-2017, test on 2018" cutoff.  
**Reason:** Checked late rate by year and it's stable (54.5-56.3% across 2015-2018, no real drift), so a chronological split isn't rescuing us from a big pattern shift. But the data only goes up to Jan 2018 - that's a single month, ~2,100 orders, way too thin and seasonally narrow to use as a standalone test set. Splitting by proportion instead of calendar year keeps the "test on the future" logic without that problem.  
**Alternatives considered:** Random stratified split (what the Initial Submission originally said) - moved away from this since the data spans multiple years and a random split risks the model being validated on a mix of past and future orders rather than genuinely unseen future data. Strict calendar year split (train 2015-17 / test 2018) - rejected for the thin sample reason above.

### [2026-09-17] Order Country naming needs standardizing
**Made by:** Nayana  
**Decision:** Standardize Order Country values before encoding in Stage 3.  
**Reason:** Noticed during EDA that country names are inconsistently in English and Spanish (Hungría, Irlanda, Malasia, Costa de Marfil for Ivory Coast, etc.). If any country is split across two different spellings it'll dilute that country's signal, so this needs a cleanup pass before target-encoding by country.  
**Alternatives considered:** Leaving as is - rejected, since it could quietly create duplicate categories for the same country.

### [2026-09-17] Benefit per order: cap outliers, decide separately how negative profit affects priority ranking
**Made by:** Nayana 
**Decision:** Cap/winsorize Benefit per order for model training. Separately, decide explicitly how a negative profit order should factor into the shipment prioritization score, rather than just plugging it into risk x value as is.  
**Reason:** 10.49% of orders are outliers by IQR, with one order as low as -$4,275. That's a real number, not a data error, but it's extreme enough to distort both model training and the priority ranking formula if we don't handle it deliberately-— a huge loss order shouldn't automatically get treated as "high value, high priority" without thinking about what that means.  
**Alternatives considered:** Dropping outlier rows outright - rejected, since that's ~10% of the data and the values are real business outcomes, not errors.

<!-- Add new entries above this line -->
