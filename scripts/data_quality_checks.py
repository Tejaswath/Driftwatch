"""Data quality monitoring: checks missing rates, outliers, and schema integrity."""
from typing import Any, Dict, List, Tuple

import numpy as np
import pandas as pd

from common import log, now_iso


OUTLIER_SIGMA = 3.0
MISSING_WARN_RATE = 0.05
OUTLIER_WARN_RATE = 0.10


def check_missing_rates(df: pd.DataFrame) -> Dict[str, float]:
    """Return fraction of null/NaN values per feature column."""
    return {col: float(df[col].isna().mean()) for col in df.columns}


def check_outliers(current_df: pd.DataFrame, reference_df: pd.DataFrame) -> Dict[str, float]:
    """Return fraction of rows outside mean ± 3σ (using reference stats) per numeric feature."""
    result: Dict[str, float] = {}
    for col in current_df.columns:
        if not pd.api.types.is_numeric_dtype(current_df[col]):
            result[col] = 0.0
            continue
        ref_mean = float(reference_df[col].mean())
        ref_std = float(reference_df[col].std())
        if ref_std < 1e-9:
            result[col] = 0.0
            continue
        lower = ref_mean - OUTLIER_SIGMA * ref_std
        upper = ref_mean + OUTLIER_SIGMA * ref_std
        outlier_mask = (current_df[col] < lower) | (current_df[col] > upper)
        result[col] = float(outlier_mask.mean())
    return result


def check_schema(df: pd.DataFrame, expected_columns: List[str]) -> Tuple[bool, List[str], List[str]]:
    """Check if df has exactly the expected columns. Returns (ok, missing, extra)."""
    missing = [c for c in expected_columns if c not in df.columns]
    extra = [c for c in df.columns if c not in expected_columns]
    return (len(missing) == 0 and len(extra) == 0), missing, extra


def run_quality_checks(
    run_id: str,
    current_df: pd.DataFrame,
    reference_df: pd.DataFrame,
    expected_columns: List[str],
    supabase,
) -> List[Dict[str, Any]]:
    """Run all data quality checks and store results in Supabase. Returns list of metric rows."""
    schema_ok, missing_cols, extra_cols = check_schema(current_df, expected_columns)
    if not schema_ok:
        raise RuntimeError(
            f"Schema quality check failed: missing={missing_cols} extra={extra_cols}"
        )

    missing_rates = check_missing_rates(current_df)
    outlier_rates = check_outliers(current_df, reference_df)

    rows = []
    for col in expected_columns:
        missing_rate = missing_rates.get(col, 0.0)
        outlier_rate = outlier_rates.get(col, 0.0)
        row: Dict[str, Any] = {
            "run_id": run_id,
            "feature_name": col,
            "missing_rate": round(missing_rate, 6),
            "outlier_rate": round(outlier_rate, 6),
            "null_ratio": round(missing_rate, 6),
            "schema_change": False,
            "computed_at": now_iso(),
        }
        if missing_rate > MISSING_WARN_RATE:
            log(f"DATA QUALITY WARNING: {col} missing_rate={missing_rate:.3f} exceeds {MISSING_WARN_RATE}")
        if outlier_rate > OUTLIER_WARN_RATE:
            log(f"DATA QUALITY WARNING: {col} outlier_rate={outlier_rate:.3f} exceeds {OUTLIER_WARN_RATE}")
        rows.append(row)

    if rows:
        supabase.upsert("data_quality_metrics", rows, on_conflict="run_id,feature_name")
        log(f"data quality: stored {len(rows)} metrics for run {run_id}")

    return rows
