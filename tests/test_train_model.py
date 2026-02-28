from nordea_sync import build_feature_batch, generate_synthetic_transactions
from train_model import create_training_target, train_model


def _baseline_df(rows: int = 120):
    tx = generate_synthetic_transactions("stable_salary", seed=42, days=max(rows + 45, 120))
    return build_feature_batch(tx, rows=rows)


def test_create_training_target_is_binary_and_non_constant() -> None:
    df = _baseline_df(120)
    y = create_training_target(df)

    assert set(y.unique()).issubset({0, 1})
    assert y.nunique() == 2


def test_train_model_returns_pipeline_predictions_and_metrics() -> None:
    df = _baseline_df(140)
    pipeline, probs, metrics = train_model(df)

    assert hasattr(pipeline, "predict_proba")
    assert len(probs) == len(df)
    assert 0.0 <= metrics["accuracy"] <= 1.0
    assert metrics["n_samples"] == len(df)
    assert metrics["n_features"] == len(df.columns)
