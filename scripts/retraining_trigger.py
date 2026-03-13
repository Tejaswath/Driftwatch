"""Retraining trigger policy: creates a retraining_events row when drift criteria are met.

Policy: consecutive_red_3
  - drift_status == "red"
  - prediction_drift_score > 0.10
  - last 3 consecutive completed runs for the domain are all "red"

On trigger: writes a retraining_events row with status=pending.
Admin UI shows pending events and manually approves dispatch.
"""
from typing import Any, Dict, Optional

from common import log, now_iso

POLICY_NAME = "consecutive_red_3"
CONSECUTIVE_RED_THRESHOLD = 3
MIN_PREDICTION_PSI = 0.10


def check_trigger_policy(
    run_id: str,
    domain_key: str,
    drift_status: str,
    prediction_drift_score: Optional[float],
    supabase,
) -> Optional[Dict[str, Any]]:
    """Evaluate retraining trigger policy and create event if triggered.

    Returns the retraining event row if triggered, else None.
    """
    if drift_status != "red":
        return None

    if prediction_drift_score is None or prediction_drift_score <= MIN_PREDICTION_PSI:
        return None

    # Fetch last N completed runs for this domain
    recent_runs = supabase.select(
        "monitor_runs",
        select="id,drift_status,prediction_drift_score,status",
        filters={"domain_key": f"eq.{domain_key}", "status": f"eq.completed"},
        order="created_at.desc",
        limit=CONSECUTIVE_RED_THRESHOLD,
    )

    if len(recent_runs) < CONSECUTIVE_RED_THRESHOLD:
        log(f"retraining_trigger: only {len(recent_runs)} completed runs, need {CONSECUTIVE_RED_THRESHOLD}")
        return None

    consecutive_red = all(r.get("drift_status") == "red" for r in recent_runs)
    if not consecutive_red:
        log(f"retraining_trigger: not all last {CONSECUTIVE_RED_THRESHOLD} runs are red, policy not triggered")
        return None

    # Check if there's already a pending event to avoid duplicates
    existing = supabase.select(
        "retraining_events",
        select="id",
        filters={"status": "eq.pending"},
        limit=1,
    )
    if existing:
        log("retraining_trigger: pending event already exists, skipping")
        return None

    event = {
        "trigger_run_id": run_id,
        "policy_name": POLICY_NAME,
        "consecutive_red_count": CONSECUTIVE_RED_THRESHOLD,
        "prediction_drift_score": round(prediction_drift_score, 6),
        "status": "pending",
        "triggered_at": now_iso(),
        "notes": f"Auto-triggered after {CONSECUTIVE_RED_THRESHOLD} consecutive red runs for domain={domain_key}",
    }

    inserted = supabase.insert("retraining_events", [event])
    log(
        f"retraining_trigger: TRIGGERED policy={POLICY_NAME} "
        f"psi={prediction_drift_score:.4f} domain={domain_key}"
    )
    return inserted[0] if inserted else None
