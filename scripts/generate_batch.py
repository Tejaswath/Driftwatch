import argparse
from datetime import datetime, timezone
from typing import Optional

from common import get_supabase, log, now_iso
from nordea_sync import (
    SCENARIOS,
    build_feature_batch,
    compute_schema_hash,
    generate_synthetic_transactions,
)


def build_batch_id(provided: Optional[str]) -> str:
    if provided:
        return provided
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    return f"batch-{stamp}"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--domain", default="nordea")
    parser.add_argument("--scenario", default="stable_salary", choices=sorted(SCENARIOS.keys()))
    parser.add_argument("--batch-id", default=None)
    parser.add_argument("--rows", type=int, default=100)
    parser.add_argument("--seed", type=int, default=None)
    args = parser.parse_args()

    batch_id = build_batch_id(args.batch_id)
    supabase = get_supabase()

    domains = supabase.select("domains", select="id,key", filters={"key": f"eq.{args.domain}"}, limit=1)
    if not domains:
        raise RuntimeError(f"Domain '{args.domain}' not found")
    domain_id = domains[0]["id"]

    transactions = generate_synthetic_transactions(
        scenario=args.scenario,
        seed=args.seed,
        days=max(args.rows + 45, 90),
    )
    frame = build_feature_batch(transactions, rows=args.rows)
    schema_hash = compute_schema_hash(frame)

    bucket = "driftwatch-artifacts"
    storage_path = f"feature-batches/{args.domain}/{batch_id}.csv"
    storage_uri = supabase.upload_bytes(
        bucket,
        storage_path,
        frame.to_csv(index=False).encode("utf-8"),
        "text/csv",
    )

    supabase.upsert(
        "feature_batches",
        [
            {
                "domain_id": domain_id,
                "batch_id": batch_id,
                "scenario": args.scenario,
                "row_count": len(frame),
                "storage_uri": storage_uri,
                "schema_hash": schema_hash,
                "source_mode": "synthetic",
            }
        ],
        on_conflict="domain_id,batch_id",
    )

    supabase.update(
        "domains",
        filters={"id": f"eq.{domain_id}"},
        data={"last_worker_heartbeat": now_iso()},
    )

    log(
        "generate_batch completed "
        f"domain={args.domain} scenario={args.scenario} batch_id={batch_id} rows={len(frame)}"
    )


if __name__ == "__main__":
    main()
