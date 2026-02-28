import argparse

from common import log
from train_model import run_training


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--domain", default="nordea")
    parser.add_argument("--schema-version", default="v1")
    parser.add_argument("--baseline-version", default="v1")
    parser.add_argument("--rows", type=int, default=200)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--scenario", default="stable_salary")
    args = parser.parse_args()

    _ = args.schema_version  # kept for workflow/API compatibility

    result = run_training(
        domain=args.domain,
        baseline_version=args.baseline_version,
        rows=args.rows,
        seed=args.seed,
        scenario=args.scenario,
    )

    log(
        "baseline refreshed "
        f"domain={args.domain} baseline_version={args.baseline_version} "
        f"schema_hash={result['schema_hash']}"
    )


if __name__ == "__main__":
    main()
