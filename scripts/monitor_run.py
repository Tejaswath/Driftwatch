import argparse
import hashlib
import io
import json
import os
import traceback
import uuid
import warnings
from pathlib import Path
from typing import Any, Dict, List, Tuple

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


def to_json_number(value: Any) -> Any:
    if isinstance(value, (int, float)):
        return float(value)
    return value


def compute_schema_hash(df: pd.DataFrame) -> str:
    payload = [(column, str(dtype)) for column, dtype in zip(df.columns, df.dtypes)]
    return hashlib.sha256(json.dumps(payload, sort_keys=True).encode("utf-8")).hexdigest()


def storage_bucket() -> str:
    return os.getenv("DRIFTWATCH_STORAGE_BUCKET", "driftwatch-artifacts")


def load_csv_from_storage(supabase, bucket: str, path: str) -> pd.DataFrame:
    raw = supabase.download_public_bytes(bucket, path)
    return pd.read_csv(io.BytesIO(raw))


def load_baseline_dataframe(
    supabase, domain_id: str, domain_key: str, baseline_version: str
) -> Tuple[Dict[str, Any], pd.DataFrame, str]:
    bucket = storage_bucket()
    baseline_path = f"baselines/{domain_key}/{baseline_version}.csv"
    baseline_uri = supabase.public_object_url(bucket, baseline_path)

    baseline_source = "storage"
    try:
        baseline_df = load_csv_from_storage(supabase, bucket, baseline_path)
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
                "reason": f"monitor reference source={baseline_source}",
            }
        ],
        on_conflict="domain_id,baseline_version",
    )
    return upserted[0], baseline_df, baseline_source


def load_current_dataframe(supabase, domain_key: str) -> Tuple[pd.DataFrame, str]:
    bucket = storage_bucket()
    current_path = f"feature-batches/{domain_key}/current.csv"
    try:
        current_df = load_csv_from_storage(supabase, bucket, current_path)
        return current_df, "synced_feature_batch"
    except Exception as exc:  # noqa: BLE001
        current_df = pd.read_csv(Path("data/demo/current.csv"))
        return current_df, f"demo_fallback ({exc})"


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

    # Evidently >= 0.7.x likely pydantic model API
    if hasattr(report, "model_dump"):
        data = report.model_dump()  # type: ignore[no-any-return]
        if isinstance(data, dict):
            return data

    if hasattr(report, "dict"):
        data = report.dict()  # type: ignore[no-any-return]
        if isinstance(data, dict):
            return data

    # JSON-string fallbacks
    if hasattr(report, "as_json"):
        raw = report.as_json()  # type: ignore[no-any-return]
        if isinstance(raw, str):
            return json.loads(raw)
        if isinstance(raw, dict):
            return raw

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


def summarize_drift(drift_result: Dict[str, Any]) -> Tuple[str, Dict[str, Any]]:
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
        "deterministic_summary": (
            f"{drifted_count} of {total_columns} monitored features drifted. "
            f"Recommended action: {'investigate immediately' if status == 'red' else 'continue monitoring'}"
        ),
    }
    return status, summary


def extract_feature_rows(run_id: str, drift_result: Dict[str, Any]) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    for feature_name, details in drift_result.get("drift_by_columns", {}).items():
        score = details.get("drift_score")
        severity = "low"
        if isinstance(score, (int, float)):
            if score >= 0.25:
                severity = "high"
            elif score >= 0.1:
                severity = "medium"

        rows.append(
            {
                "run_id": run_id,
                "feature_name": feature_name,
                "test_name": details.get("stattest_name", "unknown"),
                "score": to_json_number(score),
                "p_value": to_json_number(details.get("p_value")),
                "drifted": bool(details.get("drift_detected", False)),
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
        current_df, current_source = load_current_dataframe(supabase=supabase, domain_key=args.domain)
        current_df = align_to_reference_schema(current_df=current_df, reference_df=baseline_df)

        log(
            "monitor sources "
            f"baseline={baseline_source} current={current_source} "
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
            # Chi-square/stat-test internals can emit divide-by-zero warnings on sparse demo bins.
            warnings.filterwarnings("ignore", message="divide by zero encountered in divide")
            report.run(reference_data=baseline_df, current_data=current_df)
        report_dict = report_to_dict(report)
        drift_result = get_drift_result(report_dict)

        drift_status, drift_summary = summarize_drift(drift_result)
        feature_rows = extract_feature_rows(run_id, drift_result)
        if feature_rows:
            supabase.upsert(
                "feature_drift_metrics",
                feature_rows,
                on_conflict="run_id,feature_name,test_name",
            )

        html_report_uri = None
        storage_bucket = os.getenv("DRIFTWATCH_STORAGE_BUCKET", "driftwatch-artifacts")
        if os.getenv("DRIFTWATCH_UPLOAD_HTML", "true").lower() in {"1", "true", "yes"}:
            html_temp = Path("/tmp") / f"{run_id}.html"
            report.save_html(str(html_temp))
            html_report_uri = supabase.upload_bytes(
                storage_bucket,
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
            },
            "drift": drift_summary,
        }

        if drift_status == "red":
            supabase.insert(
                "action_tickets",
                [
                    {
                        "run_id": run_id,
                        "ticket_type": "investigate",
                        "status": "open",
                        "payload": {
                            "reason": "Critical drift detected",
                            "top_features": drift_summary["top_features"],
                        },
                    }
                ],
            )

        supabase.update(
            "monitor_runs",
            filters={"id": f"eq.{run_id}"},
            data={
                "baseline_id": baseline["id"],
                "status": "completed",
                "drift_status": drift_status,
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

        log(f"run {run_id} completed with drift_status={drift_status}")
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
