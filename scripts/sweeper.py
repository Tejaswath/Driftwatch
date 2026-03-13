import argparse
import datetime as dt
from urllib.parse import urlparse

from common import get_supabase, log, now_iso


def storage_path_from_uri(uri: str, bucket: str) -> str | None:
    if not uri:
        return None
    parsed = urlparse(uri)
    marker = f"/storage/v1/object/public/{bucket}/"
    if marker in parsed.path:
        return parsed.path.split(marker, 1)[1]
    return None


def main() -> None:
    parser = argparse.ArgumentParser()
    # Default threshold matches sweep interval (sweeper runs every 30 min)
    parser.add_argument("--timeout-minutes", type=int, default=25)
    parser.add_argument("--purge-days", type=int, default=30,
                        help="Delete HTML reports older than this many days")
    args = parser.parse_args()

    supabase = get_supabase()
    bucket = "driftwatch-artifacts"
    cutoff = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(minutes=args.timeout_minutes)).isoformat()
    purge_cutoff = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=args.purge_days)).isoformat()

    # 1. Mark stale processing runs as failed
    stale = supabase.select(
        "monitor_runs",
        select="id,status,started_at,html_report_uri",
        filters={"status": "eq.processing", "started_at": f"lt.{cutoff}"},
    )

    for run in stale:
        supabase.update(
            "monitor_runs",
            filters={"id": f"eq.{run['id']}"},
            data={
                "status": "failed",
                "error_text": "timeout: run exceeded sweeper threshold",
                "finished_at": now_iso(),
            },
        )
        # Clean up HTML report if present
        uri = run.get("html_report_uri")
        if uri:
            path = storage_path_from_uri(uri, bucket)
            if path:
                supabase.delete_storage_object(bucket, path)
                log(f"deleted stale report {path}")

    log(f"sweeper marked {len(stale)} stale runs as failed")

    # 2. Purge old HTML reports from completed/failed runs
    old_runs = supabase.select(
        "monitor_runs",
        select="id,html_report_uri",
        filters={
            "html_report_uri": "not.is.null",
            "finished_at": f"lt.{purge_cutoff}",
        },
    )

    purged = 0
    for run in old_runs:
        uri = run.get("html_report_uri")
        if not uri:
            continue
        path = storage_path_from_uri(uri, bucket)
        if path and supabase.delete_storage_object(bucket, path):
            supabase.update(
                "monitor_runs",
                filters={"id": f"eq.{run['id']}"},
                data={"html_report_uri": None},
            )
            purged += 1

    log(f"sweeper purged {purged} HTML reports older than {args.purge_days} days")


if __name__ == "__main__":
    main()
