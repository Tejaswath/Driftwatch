import statistics

from nordea_sync import SCENARIOS, generate_synthetic_transactions


def _salary_values(tx: list[dict]) -> list[float]:
    return [row["amount"] for row in tx if row.get("merchant") == "Employer AB" and row.get("amount", 0) > 0]


def test_generator_is_deterministic_with_seed() -> None:
    tx_a = generate_synthetic_transactions("stable_salary", seed=42, days=60)
    tx_b = generate_synthetic_transactions("stable_salary", seed=42, days=60)
    assert tx_a == tx_b


def test_generator_varies_with_different_seeds() -> None:
    tx_a = generate_synthetic_transactions("stable_salary", seed=42, days=60)
    tx_b = generate_synthetic_transactions("stable_salary", seed=99, days=60)
    assert tx_a != tx_b


def test_all_scenarios_generate_transactions() -> None:
    for scenario in SCENARIOS.keys():
        tx = generate_synthetic_transactions(scenario, seed=1, days=60)
        assert len(tx) > 0


def test_income_drop_salary_lower_than_stable_salary() -> None:
    stable = generate_synthetic_transactions("stable_salary", seed=42, days=90)
    drop = generate_synthetic_transactions("income_drop", seed=42, days=90)

    stable_salary = _salary_values(stable)
    drop_salary = _salary_values(drop)

    assert stable_salary and drop_salary
    assert statistics.mean(drop_salary) < statistics.mean(stable_salary)
