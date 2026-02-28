import argparse
from pathlib import Path

from common import log
from nordea_sync import build_batch_from_synthetic


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--baseline-scenario", default="stable_salary")
    parser.add_argument("--current-scenario", default="inflation_shift")
    parser.add_argument("--baseline-rows", type=int, default=200)
    parser.add_argument("--current-rows", type=int, default=100)
    parser.add_argument("--baseline-seed", type=int, default=42)
    parser.add_argument("--current-seed", type=int, default=99)
    args = parser.parse_args()

    baseline = build_batch_from_synthetic(
        scenario=args.baseline_scenario,
        rows=args.baseline_rows,
        seed=args.baseline_seed,
    )
    current = build_batch_from_synthetic(
        scenario=args.current_scenario,
        rows=args.current_rows,
        seed=args.current_seed,
    )

    out_dir = Path("data/demo")
    out_dir.mkdir(parents=True, exist_ok=True)

    baseline_path = out_dir / "baseline.csv"
    current_path = out_dir / "current.csv"

    baseline.to_csv(baseline_path, index=False)
    current.to_csv(current_path, index=False)

    log(
        "regenerated demo CSVs "
        f"baseline_rows={len(baseline)} current_rows={len(current)} "
        f"baseline={baseline_path} current={current_path}"
    )


if __name__ == "__main__":
    main()
