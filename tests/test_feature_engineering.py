from datetime import date, datetime, timedelta, timezone

from nordea_sync import (
    FEATURE_COLUMNS,
    build_feature_batch,
    compute_features_for_anchor,
    extract_amount,
    safe_entropy,
)


def _sample_transactions() -> list[dict]:
    anchor = date(2026, 1, 30)
    tx = []
    for i in range(30):
        day = anchor - timedelta(days=i)
        tx.append(
            {
                "ts": datetime(day.year, day.month, day.day, 12, 0, tzinfo=timezone.utc),
                "date": day,
                "amount": -100.0 - (i % 5),
                "merchant": "ICA",
            }
        )
    tx.append(
        {
            "ts": datetime(anchor.year, anchor.month, 25, 8, 0, tzinfo=timezone.utc),
            "date": date(anchor.year, anchor.month, 25),
            "amount": 42000.0,
            "merchant": "Employer AB",
        }
    )
    return tx


def test_safe_entropy_handles_empty_and_single_value() -> None:
    assert safe_entropy([]) == 0.0
    assert safe_entropy([10.0]) == 0.0


def test_safe_entropy_uniform_greater_than_skewed() -> None:
    uniform = safe_entropy([1, 1, 1, 1, 1, 1, 1])
    skewed = safe_entropy([7, 0, 0, 0, 0, 0, 0])
    assert 0.99 <= uniform <= 1.0
    assert skewed == 0.0


def test_extract_amount_handles_credit_debit_and_nested_values() -> None:
    assert extract_amount({"amount": "100", "creditDebitIndicator": "DBIT"}) == -100.0
    assert extract_amount({"amount": "-100", "creditDebitIndicator": "CRDT"}) == 100.0
    assert extract_amount({"transactionAmount": {"amount": "50"}, "creditDebitIndicator": "DBIT"}) == -50.0
    assert extract_amount({"amount": None}) is None


def test_compute_features_returns_expected_columns_and_floats() -> None:
    tx = _sample_transactions()
    anchor = date(2026, 1, 30)
    features = compute_features_for_anchor(tx, anchor)

    assert set(features.keys()) == set(FEATURE_COLUMNS)
    assert all(isinstance(features[column], float) for column in FEATURE_COLUMNS)


def test_compute_features_empty_window_returns_zeros() -> None:
    features = compute_features_for_anchor([], date(2026, 1, 30))
    assert all(value == 0.0 for value in features.values())


def test_build_feature_batch_shape_and_columns() -> None:
    tx = _sample_transactions()
    frame = build_feature_batch(tx, rows=20)
    assert frame.shape == (20, len(FEATURE_COLUMNS))
    assert list(frame.columns) == FEATURE_COLUMNS
