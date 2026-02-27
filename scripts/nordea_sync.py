import argparse
import hashlib
import json
from pathlib import Path

import pandas as pd

from common import get_supabase, log, now_iso


def compute_schema_hash(df: pd.DataFrame) -> str:
    payload = [(column, str(dtype)) for column, dtype in zip(df.columns, df.dtypes)]
    return hashlib.sha256(json.dumps(payload, sort_keys=True).encode("utf-8")).hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--domain", default="nordea")
    parser.add_argument("--baseline-version", default="v1")
    args = parser.parse_args()

    supabase = get_supabase()
    domains = supabase.select("domains", select="id,key", filters={"key": f"eq.{args.domain}"}, limit=1)
    if not domains:
        raise RuntimeError("Domain not found")
    domain = domains[0]

    current_df = pd.read_csv(Path("data/demo/current.csv"))
    schema_hash = compute_schema_hash(current_df)

    storage_uri = supabase.upload_bytes(
        "driftwatch-artifacts",
        f"feature-batches/{args.domain}/current.csv",
        current_df.to_csv(index=False).encode("utf-8"),
        "text/csv",
    )

    supabase.upsert(
        "baselines",
        [
            {
                "domain_id": domain["id"],
                "baseline_version": args.baseline_version,
                "schema_version": "v1",
                "schema_hash": schema_hash,
                "row_count": len(current_df),
                "storage_uri": storage_uri,
                "reason": "sync-generated baseline placeholder",
            }
        ],
        on_conflict="domain_id,baseline_version",
    )

    supabase.update(
        "domains",
        filters={"id": f"eq.{domain['id']}"},
        data={"last_worker_heartbeat": now_iso()},
    )

    log(f"sync completed for domain={args.domain}")


if __name__ == "__main__":
    main()
