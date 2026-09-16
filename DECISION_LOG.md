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
**Made by:** Sanjana K D A  
**Decision:** Collapse line item level rows to a single row per Order Id before modeling.  
**Reason:** The prediction target (late delivery) is a property of the whole order/shipment, not of an individual line item — modeling at line item level would duplicate the label across rows and leak information across the train/test split.  
**Alternatives considered:** Keeping line item granularity and using groupby only at evaluation time — rejected because it complicates the stratified split and risks the same order appearing in both train and test sets.

### [2026-09-12] Primary evaluation metric: Recall
**Made by:** Sanjana K D A  
**Decision:** Recall (Sensitivity) will be the primary metric, with Precision, F1, ROC-AUC, and PR-AUC as supporting metrics.  
**Reason:** A missed late delivery (false negative) results in unmanaged penalties and customer dissatisfaction, which is more costly to the business than a false alarm — so minimizing missed late orders matters more than raw accuracy.  
**Alternatives considered:** Accuracy — rejected because the late/on-time class split is unlikely to be balanced, making accuracy misleading; F1-only — rejected as primary because it doesn't sufficiently penalize false negatives on its own.

<!-- Add new entries above this line -->