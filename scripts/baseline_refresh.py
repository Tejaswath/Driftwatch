import argparse
import hashlib
import json
from pathlib import Path

import pandas as pd

from common import get_supabase, log


def compute_schema_hash(df: pd.DataFrame) -> str:
    payload = [(column, str(dtype)) for column, dtype in zip(df.columns, df.dtypes)]
    return hashlib.sha256(json.dumps(payload, sort_keys=True).encode("utf-8")).hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--domain", default="nordea")
    parser.add_argument("--schema-version", default="v1")
    parser.add_argument("--baseline-version", default="v1")
    args = parser.parse_args()

    supabase = get_supabase()
    domains = supabase.select("domains", select="id,key", filters={"key": f"eq.{args.domain}"}, limit=1)
    if not domains:
        raise RuntimeError("Domain not found")

    domain_id = domains[0]["id"]
    baseline_df = pd.read_csv(Path("data/demo/baseline.csv"))
    schema_hash = compute_schema_hash(baseline_df)

    storage_uri = supabase.upload_bytes(
        "driftwatch-artifacts",
        f"baselines/{args.domain}/{args.baseline_version}.csv",
        baseline_df.to_csv(index=False).encode("utf-8"),
        "text/csv",
    )

    supabase.upsert(
        "baselines",
        [
            {
                "domain_id": domain_id,
                "baseline_version": args.baseline_version,
                "schema_version": args.schema_version,
                "schema_hash": schema_hash,
                "row_count": len(baseline_df),
                "storage_uri": storage_uri,
                "reason": "manual baseline refresh",
            }
        ],
        on_conflict="domain_id,baseline_version",
    )

    log(
        "baseline refreshed "
        f"domain={args.domain} baseline_version={args.baseline_version} schema_hash={schema_hash}"
    )


if __name__ == "__main__":
    main()
