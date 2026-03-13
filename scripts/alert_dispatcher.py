"""Alert dispatcher: routes drift alerts to GitHub Issues via GITHUB_TOKEN.

Only fires when drift_status == "red". Requires GITHUB_REPO env var (e.g. "owner/repo").
GITHUB_TOKEN is automatically available in GitHub Actions — no extra secret needed.
"""
import os
from typing import Any, Dict, List, Optional

import requests

from common import log, now_iso


def _log_alert(run_id: str, channel: str, status: str, response_code: Optional[int], supabase) -> None:
    try:
        supabase.insert("alert_logs", [{
            "run_id": run_id,
            "channel": channel,
            "status": status,
            "response_code": response_code,
            "sent_at": now_iso(),
        }])
    except Exception as exc:  # noqa: BLE001
        log(f"alert_dispatcher: failed to log alert for channel={channel}: {exc}")


def _send_github_issue(
    run_id: str,
    drift_status: str,
    prediction_drift_score: Optional[float],
    top_features: List[Dict[str, Any]],
    app_origin: str,
    supabase,
) -> None:
    github_repo = os.getenv("GITHUB_REPO", "")
    github_token = os.getenv("GITHUB_TOKEN", "")
    if not github_repo or not github_token:
        _log_alert(run_id, "github_issue", "skipped", None, supabase)
        log("alert_dispatcher: github_issue skipped (GITHUB_REPO or GITHUB_TOKEN not set)")
        return

    run_url = f"{app_origin}/runs/{run_id}" if app_origin else f"runs/{run_id}"
    psi_text = f"{prediction_drift_score:.4f}" if prediction_drift_score is not None else "n/a"

    feature_rows = "\n".join(
        f"| `{f['feature']}` | {f.get('score', 0):.4f} | {'yes' if f.get('drifted') else 'no'} |"
        for f in (top_features or [])[:5]
    ) or "_No feature data available_"

    body = f"""## DriftWatch: Red Drift Detected

**Run ID**: `{run_id}`
**Drift Status**: `{drift_status.upper()}`
**Prediction PSI**: `{psi_text}`
**Detected at**: `{now_iso()}`

### Top Drifted Features

| Feature | Score | Drifted |
|---------|-------|---------|
{feature_rows}

### Action Required

Review the run and investigate root cause:
- [View Run]({run_url})

This issue was auto-created by DriftWatch. Close when investigation is complete.
"""

    payload = {
        "title": f"[DriftWatch] Red drift detected — run {run_id[:8]}",
        "body": body,
        "labels": ["drift-alert"],
    }

    api_url = f"https://api.github.com/repos/{github_repo}/issues"
    headers = {
        "Authorization": f"Bearer {github_token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }

    try:
        response = requests.post(api_url, json=payload, headers=headers, timeout=20)
        status = "sent" if response.ok else "failed"
        _log_alert(run_id, "github_issue", status, response.status_code, supabase)
        if response.ok:
            issue_url = response.json().get("html_url", "")
            log(f"alert_dispatcher: github issue created for run {run_id}: {issue_url}")
        else:
            log(f"alert_dispatcher: github issue failed ({response.status_code}): {response.text[:200]}")
    except Exception as exc:  # noqa: BLE001
        _log_alert(run_id, "github_issue", "failed", None, supabase)
        log(f"alert_dispatcher: github issue error: {exc}")


def dispatch_alert(
    run_id: str,
    drift_status: str,
    prediction_drift_score: Optional[float],
    top_features: List[Dict[str, Any]],
    supabase,
) -> None:
    """Dispatch drift alert via GitHub Issues. No-ops if GITHUB_REPO/GITHUB_TOKEN not set."""
    if drift_status != "red":
        return

    app_origin = os.getenv("APP_ORIGIN", "").rstrip("/")
    _send_github_issue(run_id, drift_status, prediction_drift_score, top_features, app_origin, supabase)
