from monitor_run import (
    combine_status,
    extract_feature_rows,
    prediction_status_from_psi,
    summarize_feature_drift,
)


def _drift_payload(drifted: int, total: int = 10):
    payload = {}
    for i in range(total):
        payload[f"f{i}"] = {
            "drift_score": 0.001 if i < drifted else 0.8,
            "drift_detected": i < drifted,
            "stattest_name": "K-S p_value",
            "p_value": 0.001 if i < drifted else 0.8,
        }
    return {"drift_by_columns": payload}


def test_summarize_feature_drift_statuses() -> None:
    status_green, _ = summarize_feature_drift(_drift_payload(drifted=1, total=10))
    status_yellow, _ = summarize_feature_drift(_drift_payload(drifted=3, total=10))
    status_red, _ = summarize_feature_drift(_drift_payload(drifted=6, total=10))

    assert status_green == "green"
    assert status_yellow == "yellow"
    assert status_red == "red"


def test_prediction_status_thresholds() -> None:
    assert prediction_status_from_psi(0.05) == "green"
    assert prediction_status_from_psi(0.12) == "yellow"
    assert prediction_status_from_psi(0.30) == "red"


def test_combine_status_uses_more_severe_status() -> None:
    assert combine_status("green", "yellow") == "yellow"
    assert combine_status("red", "green") == "red"
    assert combine_status("yellow", None) == "yellow"


def test_extract_feature_rows_includes_severity() -> None:
    rows = extract_feature_rows("run-1", _drift_payload(drifted=2, total=3))
    assert len(rows) == 3
    assert {row["severity"] for row in rows if row["drifted"]} == {"high"}
