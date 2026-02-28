import argparse
import hashlib
import io
import json
from datetime import datetime, timezone
from typing import Any, Dict, Optional, Tuple

import joblib
import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from common import get_supabase, log, now_iso
from nordea_sync import FEATURE_COLUMNS, build_feature_batch, generate_synthetic_transactions


def compute_schema_hash(df: pd.DataFrame) -> str:
    payload = [(column, str(dtype)) for column, dtype in zip(df.columns, df.dtypes)]
    return hashlib.sha256(json.dumps(payload, sort_keys=True).encode("utf-8")).hexdigest()


def create_training_target(df: pd.DataFrame) -> pd.Series:
    threshold = float(df["daily_spend_30d"].median())
    target = (df["daily_spend_30d"] > threshold).astype(int)
    if target.nunique() < 2:
        alt_threshold = float(df["daily_spend_30d"].quantile(0.6))
        target = (df["daily_spend_30d"] > alt_threshold).astype(int)
    if target.nunique() < 2:
        target.iloc[-1] = 1 - int(target.iloc[-1])
    return target


def histogram_distribution(values: np.ndarray, bins: int = 10) -> Dict[str, Any]:
    edges = np.linspace(0.0, 1.0, bins + 1)
    counts, _ = np.histogram(values, bins=edges)
    total = max(int(counts.sum()), 1)
    distribution = (counts / total).tolist()
    return {
        "bins": edges.tolist(),
        "distribution": distribution,
        "mean": float(np.mean(values)) if len(values) else 0.0,
        "n_samples": int(len(values)),
    }


def train_model(baseline_df: pd.DataFrame) -> Tuple[Pipeline, np.ndarray, Dict[str, Any]]:
    X = baseline_df[FEATURE_COLUMNS]
    y = create_training_target(baseline_df)

    pipeline = Pipeline(
        steps=[
            ("scaler", StandardScaler()),
            ("clf", LogisticRegression(random_state=42, max_iter=1000)),
        ]
    )
    pipeline.fit(X, y)

    probs = pipeline.predict_proba(X)[:, 1]
    preds = (probs >= 0.5).astype(int)
    accuracy = float((preds == y.values).mean())

    metrics = {
        "accuracy": accuracy,
        "n_samples": int(len(X)),
        "n_features": int(X.shape[1]),
        "target": "high_spender",
        "positive_rate": float(y.mean()),
        "trained_at": now_iso(),
    }
    return pipeline, probs, metrics


def run_training(
    *,
    domain: str,
    baseline_version: str,
    rows: int,
    seed: Optional[int],
    scenario: str,
) -> Dict[str, Any]:
    supabase = get_supabase()
    domains = supabase.select("domains", select="id,key", filters={"key": f"eq.{domain}"}, limit=1)
    if not domains:
        raise RuntimeError(f"Domain '{domain}' not found")
    domain_id = domains[0]["id"]

    tx = generate_synthetic_transactions(scenario=scenario, seed=seed, days=max(rows + 45, 120))
    baseline_df = build_feature_batch(tx, rows=rows)
    schema_hash = compute_schema_hash(baseline_df)

    model, baseline_probs, metrics = train_model(baseline_df)
    prediction_hist = histogram_distribution(baseline_probs, bins=10)

    bucket = "driftwatch-artifacts"
    baseline_path = f"baselines/{domain}/{baseline_version}.csv"
    baseline_uri = supabase.upload_bytes(
        bucket,
        baseline_path,
        baseline_df.to_csv(index=False).encode("utf-8"),
        "text/csv",
    )

    model_path = f"models/{domain}/{baseline_version}/model.joblib"
    model_buffer = io.BytesIO()
    joblib.dump(model, model_buffer)
    model_uri = supabase.upload_bytes(
        bucket,
        model_path,
        model_buffer.getvalue(),
        "application/octet-stream",
    )

    upserted = supabase.upsert(
        "baselines",
        [
            {
                "domain_id": domain_id,
                "baseline_version": baseline_version,
                "schema_version": "v1",
                "schema_hash": schema_hash,
                "row_count": len(baseline_df),
                "storage_uri": baseline_uri,
                "model_uri": model_uri,
                "baseline_predictions_json": prediction_hist,
                "reason": f"synthetic baseline refresh scenario={scenario}",
            }
        ],
        on_conflict="domain_id,baseline_version",
    )[0]

    supabase.update(
        "domains",
        filters={"id": f"eq.{domain_id}"},
        data={"last_worker_heartbeat": now_iso()},
    )

    log(
        "model trained "
        f"domain={domain} baseline={baseline_version} rows={len(baseline_df)} "
        f"accuracy={metrics['accuracy']:.4f} model_uri={model_uri}"
    )

    return {
        "baseline": upserted,
        "metrics": metrics,
        "schema_hash": schema_hash,
        "baseline_uri": baseline_uri,
        "model_uri": model_uri,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--domain", default="nordea")
    parser.add_argument("--baseline-version", default="v1")
    parser.add_argument("--rows", type=int, default=200)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--scenario", default="stable_salary")
    args = parser.parse_args()

    run_training(
        domain=args.domain,
        baseline_version=args.baseline_version,
        rows=args.rows,
        seed=args.seed,
        scenario=args.scenario,
    )


if __name__ == "__main__":
    main()
