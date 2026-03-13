"""Model performance monitoring: computes accuracy, precision, recall, F1, AUC on current batch."""
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd

try:
    from sklearn.metrics import (
        accuracy_score,
        precision_score,
        recall_score,
        f1_score,
        roc_auc_score,
    )
except ImportError:
    raise RuntimeError("scikit-learn is required for performance_monitor.py")

from common import log, now_iso


def create_ground_truth_labels(df: pd.DataFrame) -> pd.Series:
    """Generate synthetic ground truth labels using the same rule as training.

    high_spender = daily_spend_30d > median(daily_spend_30d)
    This is consistent with train_model.py:create_training_target().
    """
    if "daily_spend_30d" not in df.columns:
        raise RuntimeError("Cannot compute ground truth: 'daily_spend_30d' not in columns")
    threshold = float(df["daily_spend_30d"].median())
    labels = (df["daily_spend_30d"] > threshold).astype(int)
    # Ensure at least 2 classes
    if labels.nunique() < 2:
        alt = float(df["daily_spend_30d"].quantile(0.6))
        labels = (df["daily_spend_30d"] > alt).astype(int)
    return labels


def compute_performance_metrics(
    run_id: str,
    model,
    current_df: pd.DataFrame,
    feature_columns: List[str],
    supabase,
) -> Optional[Dict[str, float]]:
    """Score the current batch, derive ground truth labels, compute and store metrics."""
    input_cols = [c for c in feature_columns if c in current_df.columns]
    if not input_cols:
        log("performance_monitor: no feature columns found, skipping")
        return None

    try:
        y_true = create_ground_truth_labels(current_df)
        probs = model.predict_proba(current_df[input_cols])[:, 1]
        y_pred = (probs >= 0.5).astype(int)

        metrics: Dict[str, float] = {
            "accuracy": float(accuracy_score(y_true, y_pred)),
            "precision": float(precision_score(y_true, y_pred, zero_division=0)),
            "recall": float(recall_score(y_true, y_pred, zero_division=0)),
            "f1": float(f1_score(y_true, y_pred, zero_division=0)),
        }
        if y_true.nunique() >= 2:
            metrics["auc"] = float(roc_auc_score(y_true, probs))

        rows: List[Dict[str, Any]] = [
            {
                "run_id": run_id,
                "metric_name": name,
                "metric_value": round(value, 6),
                "computed_at": now_iso(),
            }
            for name, value in metrics.items()
        ]

        supabase.insert("model_performance_metrics", rows)
        log(
            f"performance: acc={metrics['accuracy']:.4f} "
            f"prec={metrics['precision']:.4f} "
            f"rec={metrics['recall']:.4f} "
            f"f1={metrics['f1']:.4f} "
            + (f"auc={metrics.get('auc', 0):.4f}" if "auc" in metrics else "auc=n/a")
        )
        return metrics

    except Exception as exc:  # noqa: BLE001
        log(f"performance_monitor: non-fatal error: {exc}")
        return None
