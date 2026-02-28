import argparse
import hashlib
import io
import json
import os
import traceback
import uuid
import warnings
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urlparse

import joblib
import numpy as np
import pandas as pd

try:
    # Evidently newer API
    from evidently import Report
except ImportError:
    # Evidently 0.6.x API
    from evidently.report import Report
try:
    # Evidently <= 0.6.x
    from evidently.metric_preset import DataDriftPreset
except ImportError:
    # Evidently >= 0.7.x
    from evidently.presets import DataDriftPreset

from common import get_supabase, log, now_iso
from nordea_sync import FEATURE_COLUMNS


STATUS_RANK = {"green": 0, "yellow": 1, "red": 2}


def to_json_number(value: Any) -> Any:
    if isinstance(value, (int, float)):
        return float(value)
    return value


def compute_schema_hash(df: pd.DataFrame) -> str:
    payload = [(column, str(dtype)) for column, dtype in zip(df.columns, df.dtypes)]
    return hashlib.sha256(json.dumps(payload, sort_keys=True).encode("utf-8")).hexdigest()


def storage_bucket() -> str:
    return os.getenv("DRIFTWATCH_STORAGE_BUCKET", "driftwatch-artifacts")


def storage_path_from_uri(uri: str, bucket: str) -> Optional[str]:
    if not uri:
        return None
    parsed = urlparse(uri)
    marker = f"/storage/v1/object/public/{bucket}/"
    if marker in parsed.path:
        return parsed.path.split(marker, 1)[1]
    return None


def load_csv_from_storage(supabase, bucket: str, path: str) -> pd.DataFrame:
    raw = supabase.download_public_bytes(bucket, path)
    return pd.read_csv(io.BytesIO(raw))


def load_bytes_from_storage_uri(supabase, bucket: str, uri: str) -> bytes:
    path = storage_path_from_uri(uri, bucket)
    if not path:
        raise RuntimeError(f"Unsupported storage URI format: {uri}")
    return supabase.download_public_bytes(bucket, path)


def load_baseline_dataframe(
    supabase, domain_id: str, domain_key: str, baseline_version: str
) -> Tuple[Dict[str, Any], pd.DataFrame, str]:
    bucket = storage_bucket()
    baseline_path = f"baselines/{domain_key}/{baseline_version}.csv"
    baseline_uri_default = supabase.public_object_url(bucket, baseline_path)

    rows = supabase.select(
        "baselines",
        select=(
            "id,domain_id,baseline_version,schema_version,schema_hash,row_count,storage_uri,reason,"
            "model_uri,baseline_predictions_json"
        ),
        filters={"domain_id": f"eq.{domain_id}", "baseline_version": f"eq.{baseline_version}"},
        limit=1,
    )
    baseline_row = rows[0] if rows else None

    baseline_source = "storage"
    baseline_df: Optional[pd.DataFrame] = None

    if baseline_row and baseline_row.get("storage_uri"):
        try:
            baseline_df = pd.read_csv(io.BytesIO(load_bytes_from_storage_uri(supabase, bucket, baseline_row["storage_uri"])))
            baseline_source = "baseline.storage_uri"
        except Exception as exc:  # noqa: BLE001
            baseline_source = f"baseline.storage_uri_fallback ({exc})"

    if baseline_df is None:
        try:
            baseline_df = load_csv_from_storage(supabase, bucket, baseline_path)
            baseline_source = "default_baseline_path"
        except Exception as exc:  # noqa: BLE001
            baseline_df = pd.read_csv(Path("data/demo/baseline.csv"))
            supabase.upload_bytes(
                bucket,
                baseline_path,
                baseline_df.to_csv(index=False).encode("utf-8"),
                "text/csv",
            )
            baseline_source = f"demo_fallback ({exc})"

    schema_hash = compute_schema_hash(baseline_df)
    upsert_payload: Dict[str, Any] = {
        "domain_id": domain_id,
        "baseline_version": baseline_version,
        "schema_version": "v1",
        "schema_hash": schema_hash,
        "row_count": len(baseline_df),
        "storage_uri": baseline_row.get("storage_uri") if baseline_row and baseline_row.get("storage_uri") else baseline_uri_default,
        "reason": f"monitor reference source={baseline_source}",
    }
    if baseline_row and baseline_row.get("model_uri"):
        upsert_payload["model_uri"] = baseline_row["model_uri"]
    if baseline_row and baseline_row.get("baseline_predictions_json"):
        upsert_payload["baseline_predictions_json"] = baseline_row["baseline_predictions_json"]

    upserted = supabase.upsert(
        "baselines",
        [upsert_payload],
        on_conflict="domain_id,baseline_version",
    )
    return upserted[0], baseline_df, baseline_source


def load_current_dataframe(
    supabase,
    domain_id: str,
    domain_key: str,
    batch_id: str,
) -> Tuple[pd.DataFrame, str, Optional[Dict[str, Any]]]:
    bucket = storage_bucket()

    filters = {"domain_id": f"eq.{domain_id}"}
    if batch_id:
        filters["batch_id"] = f"eq.{batch_id}"

    batch_rows = supabase.select(
        "feature_batches",
        select="id,batch_id,scenario,row_count,storage_uri,schema_hash,source_mode,created_at",
        filters=filters,
        order="created_at.desc",
        limit=1,
    )

    if not batch_rows and batch_id:
        batch_rows = supabase.select(
            "feature_batches",
            select="id,batch_id,scenario,row_count,storage_uri,schema_hash,source_mode,created_at",
            filters={"domain_id": f"eq.{domain_id}"},
            order="created_at.desc",
            limit=1,
        )

    if batch_rows:
        batch = batch_rows[0]
        try:
            current_df = pd.read_csv(io.BytesIO(load_bytes_from_storage_uri(supabase, bucket, batch["storage_uri"])))
            return current_df, f"feature_batches:{batch['batch_id']}", batch
        except Exception as exc:  # noqa: BLE001
            log(f"feature batch load fallback for batch_id={batch.get('batch_id')} reason={exc}")

    legacy_path = f"feature-batches/{domain_key}/current.csv"
    try:
        legacy_df = load_csv_from_storage(supabase, bucket, legacy_path)
        return legacy_df, "legacy_current_csv", None
    except Exception as exc:  # noqa: BLE001
        current_df = pd.read_csv(Path("data/demo/current.csv"))
        return current_df, f"demo_fallback ({exc})", None


def align_to_reference_schema(current_df: pd.DataFrame, reference_df: pd.DataFrame) -> pd.DataFrame:
    reference_columns = list(reference_df.columns)
    current_columns = list(current_df.columns)

    missing = [column for column in reference_columns if column not in current_columns]
    extra = [column for column in current_columns if column not in reference_columns]
    if missing or extra:
        raise RuntimeError(
            "Schema column mismatch between baseline and current batch. "
            f"missing={missing} extra={extra}"
        )

    aligned = current_df[reference_columns].copy()
    for column in reference_columns:
        target_dtype = reference_df[column].dtype
        if pd.api.types.is_numeric_dtype(target_dtype):
            aligned[column] = pd.to_numeric(aligned[column], errors="coerce").fillna(0)
            if pd.api.types.is_integer_dtype(target_dtype):
                aligned[column] = aligned[column].round().astype(target_dtype)
            else:
                aligned[column] = aligned[column].astype(target_dtype)
        else:
            aligned[column] = aligned[column].astype(str)

    return aligned


def report_to_dict(report: Report) -> Dict[str, Any]:
    # Evidently <= 0.6.x
    if hasattr(report, "as_dict"):
        return report.as_dict()  # type: ignore[no-any-return]

    if hasattr(report, "dict"):
        data = report.dict()  # type: ignore[no-any-return]
        if isinstance(data, dict):
            return data

    if hasattr(report, "json"):
        raw = report.json()  # type: ignore[no-any-return]
        if isinstance(raw, str):
            return json.loads(raw)
        if isinstance(raw, dict):
            return raw

    raise RuntimeError("Unable to serialize Evidently report; unsupported API surface.")


def get_drift_result(report_dict: Dict[str, Any]) -> Dict[str, Any]:
    metrics = report_dict.get("metrics", [])
    for metric in metrics:
        result = metric.get("result", {})
        if "drift_by_columns" in result:
            return result
    return {}


def summarize_feature_drift(drift_result: Dict[str, Any]) -> Tuple[str, Dict[str, Any]]:
    drift_by_columns = drift_result.get("drift_by_columns", {})
    total_columns = max(len(drift_by_columns), 1)
    drifted_count = sum(1 for details in drift_by_columns.values() if details.get("drift_detected"))
    drift_ratio = drifted_count / total_columns

    if drift_ratio >= 0.5:
        status = "red"
    elif drift_ratio >= 0.2:
        status = "yellow"
    else:
        status = "green"

    top = sorted(
        (
            {
                "feature": name,
                "score": to_json_number(details.get("drift_score")),
                "drifted": details.get("drift_detected", False),
                "test": details.get("stattest_name", "unknown"),
            }
            for name, details in drift_by_columns.items()
        ),
        key=lambda item: (item["score"] is None, item["score"] if item["score"] is not None else -1),
        reverse=True,
    )[:5]

    summary = {
        "drifted_columns": drifted_count,
        "total_columns": total_columns,
        "drift_ratio": round(drift_ratio, 4),
        "top_features": top,
    }
    return status, summary


def compute_psi(expected: np.ndarray, current: np.ndarray, epsilon: float = 1e-6) -> float:
    expected_safe = np.clip(expected, epsilon, None)
    current_safe = np.clip(current, epsilon, None)
    expected_safe = expected_safe / expected_safe.sum()
    current_safe = current_safe / current_safe.sum()
    values = (current_safe - expected_safe) * np.log(current_safe / expected_safe)
    return float(np.sum(values))


def prediction_status_from_psi(psi: float) -> str:
    if psi >= 0.25:
        return "red"
    if psi >= 0.1:
        return "yellow"
    return "green"


def compute_prediction_drift(
    supabase,
    baseline: Dict[str, Any],
    current_df: pd.DataFrame,
) -> Optional[Dict[str, Any]]:
    model_uri = baseline.get("model_uri")
    baseline_pred = baseline.get("baseline_predictions_json")
    if not model_uri or not isinstance(baseline_pred, dict):
        return None

    distribution = baseline_pred.get("distribution")
    bins = baseline_pred.get("bins")
    if not isinstance(distribution, list) or not distribution:
        return None

    expected = np.array([float(v) for v in distribution], dtype=float)
    if isinstance(bins, list) and len(bins) == len(expected) + 1:
        bin_edges = np.array([float(v) for v in bins], dtype=float)
    else:
        bin_edges = np.linspace(0.0, 1.0, len(expected) + 1)

    model_bytes = load_bytes_from_storage_uri(supabase, storage_bucket(), model_uri)
    model = joblib.load(io.BytesIO(model_bytes))

    input_columns = [column for column in FEATURE_COLUMNS if column in current_df.columns]
    if not input_columns:
        return None
    current_probs = model.predict_proba(current_df[input_columns])[:, 1]

    current_counts, _ = np.histogram(current_probs, bins=bin_edges)
    current_dist = current_counts / max(int(current_counts.sum()), 1)

    psi = compute_psi(expected=expected, current=current_dist)
    return {
        "psi": round(psi, 6),
        "status": prediction_status_from_psi(psi),
        "baseline_mean": float(baseline_pred.get("mean", 0.0)),
        "current_mean": float(np.mean(current_probs)) if len(current_probs) else 0.0,
        "baseline_distribution": expected.tolist(),
        "current_distribution": current_dist.tolist(),
    }


def combine_status(feature_status: str, prediction_status: Optional[str]) -> str:
    if prediction_status is None:
        return feature_status
    return feature_status if STATUS_RANK[feature_status] >= STATUS_RANK[prediction_status] else prediction_status


def extract_feature_rows(run_id: str, drift_result: Dict[str, Any]) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    for feature_name, details in drift_result.get("drift_by_columns", {}).items():
        score = details.get("drift_score")
        drifted = bool(details.get("drift_detected", False))
        test_name = details.get("stattest_name", "unknown")

        severity = "low"
        if drifted and isinstance(score, (int, float)):
            score_value = float(score)
            if "p_value" in test_name.lower() or "p-value" in test_name.lower():
                if score_value < 0.01:
                    severity = "high"
                elif score_value < 0.05:
                    severity = "medium"
            else:
                if score_value >= 0.25:
                    severity = "high"
                elif score_value >= 0.1:
                    severity = "medium"

        rows.append(
            {
                "run_id": run_id,
                "feature_name": feature_name,
                "test_name": test_name,
                "score": to_json_number(score),
                "p_value": to_json_number(details.get("p_value")),
                "drifted": drifted,
                "severity": severity,
            }
        )
    return rows


def get_domain_id(supabase, key: str) -> str:
    rows = supabase.select("domains", select="id,key", filters={"key": f"eq.{key}"}, limit=1)
    if not rows:
        raise RuntimeError(f"Domain '{key}' not found. Did you apply supabase/schema.sql?")
    return rows[0]["id"]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--domain", default=os.getenv("DOMAIN", "nordea"))
    parser.add_argument("--baseline-version", default=os.getenv("BASELINE_VERSION", "v1"))
    parser.add_argument("--batch-id", default=os.getenv("BATCH_ID", "manual"))
    args = parser.parse_args()

    supabase = get_supabase()
    run_id = str(uuid.uuid4())
    domain_id = get_domain_id(supabase, args.domain)

    supabase.insert(
        "monitor_runs",
        [
            {
                "id": run_id,
                "domain_id": domain_id,
                "domain_key": args.domain,
                "baseline_version": args.baseline_version,
                "batch_id": args.batch_id,
                "status": "queued",
            }
        ],
    )

    try:
        supabase.update(
            "monitor_runs",
            filters={"id": f"eq.{run_id}"},
            data={"status": "processing", "started_at": now_iso()},
        )

        baseline, baseline_df, baseline_source = load_baseline_dataframe(
            supabase=supabase,
            domain_id=domain_id,
            domain_key=args.domain,
            baseline_version=args.baseline_version,
        )
        current_df, current_source, feature_batch = load_current_dataframe(
            supabase=supabase,
            domain_id=domain_id,
            domain_key=args.domain,
            batch_id=args.batch_id,
        )
        current_df = align_to_reference_schema(current_df=current_df, reference_df=baseline_df)

        log(
            "monitor sources "
            f"baseline={baseline_source} current_batch={current_source} "
            f"batch_id={args.batch_id}"
        )

        current_schema_hash = compute_schema_hash(current_df)
        if current_schema_hash != baseline["schema_hash"]:
            raise RuntimeError(
                "Schema hash mismatch between baseline and current batch. "
                f"baseline={baseline['schema_hash']} current={current_schema_hash}"
            )

        report = Report(metrics=[DataDriftPreset()])
        with warnings.catch_warnings():
            warnings.filterwarnings("ignore", message="divide by zero encountered in divide")
            report.run(reference_data=baseline_df, current_data=current_df)
        report_dict = report_to_dict(report)
        drift_result = get_drift_result(report_dict)

        feature_status, drift_summary = summarize_feature_drift(drift_result)
        prediction = compute_prediction_drift(supabase=supabase, baseline=baseline, current_df=current_df)
        prediction_status = prediction.get("status") if prediction else None
        overall_status = combine_status(feature_status=feature_status, prediction_status=prediction_status)

        deterministic = (
            f"{drift_summary['drifted_columns']} of {drift_summary['total_columns']} monitored features drifted. "
            f"Recommended action: {'investigate immediately' if overall_status == 'red' else 'continue monitoring'}"
        )
        if prediction:
            deterministic += f" Prediction PSI={prediction['psi']} ({prediction['status']})."
        drift_summary["deterministic_summary"] = deterministic

        feature_rows = extract_feature_rows(run_id, drift_result)
        if feature_rows:
            supabase.upsert(
                "feature_drift_metrics",
                feature_rows,
                on_conflict="run_id,feature_name,test_name",
            )

        html_report_uri = None
        bucket = storage_bucket()
        if os.getenv("DRIFTWATCH_UPLOAD_HTML", "true").lower() in {"1", "true", "yes"}:
            html_temp = Path("/tmp") / f"{run_id}.html"
            report.save_html(str(html_temp))
            html_report_uri = supabase.upload_bytes(
                bucket,
                f"reports/{run_id}.html",
                html_temp.read_bytes(),
                "text/html",
            )

        compact_report = {
            "domain": args.domain,
            "baseline_version": args.baseline_version,
            "generated_at": now_iso(),
            "source": {
                "baseline": baseline_source,
                "current_batch": current_source,
                "feature_batch_id": feature_batch.get("id") if feature_batch else None,
                "scenario": feature_batch.get("scenario") if feature_batch else None,
                "source_mode": feature_batch.get("source_mode") if feature_batch else "legacy",
            },
            "drift": drift_summary,
            "prediction_drift": prediction,
        }

        if overall_status == "red":
            top_features = drift_summary.get("top_features", [])
            supabase.insert(
                "action_tickets",
                [
                    {
                        "run_id": run_id,
                        "ticket_type": "investigate",
                        "title": "Critical drift detected",
                        "description": "Feature and/or prediction drift exceeded critical thresholds.",
                        "status": "open",
                        "payload": {
                            "reason": "Critical drift detected",
                            "top_features": top_features,
                            "prediction_drift": prediction,
                        },
                    }
                ],
            )

        supabase.update(
            "monitor_runs",
            filters={"id": f"eq.{run_id}"},
            data={
                "baseline_id": baseline["id"],
                "feature_batch_id": feature_batch.get("id") if feature_batch else None,
                "scenario": feature_batch.get("scenario") if feature_batch else None,
                "status": "completed",
                "drift_status": overall_status,
                "prediction_drift_score": prediction.get("psi") if prediction else None,
                "report_json": compact_report,
                "html_report_uri": html_report_uri,
                "finished_at": now_iso(),
                "error_text": None,
            },
        )
        supabase.update(
            "domains",
            filters={"id": f"eq.{domain_id}"},
            data={"last_worker_heartbeat": now_iso()},
        )

        log(f"run {run_id} completed with drift_status={overall_status}")
    except Exception as exc:
        log(f"run {run_id} failed: {exc}")
        log(traceback.format_exc())
        supabase.update(
            "monitor_runs",
            filters={"id": f"eq.{run_id}"},
            data={"status": "failed", "error_text": str(exc), "finished_at": now_iso()},
        )
        supabase.update(
            "domains",
            filters={"id": f"eq.{domain_id}"},
            data={"last_worker_heartbeat": now_iso()},
        )
        raise


if __name__ == "__main__":
    main()
