import argparse
import datetime as dt

from common import get_supabase, log, now_iso


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--timeout-minutes", type=int, default=10)
    args = parser.parse_args()

    supabase = get_supabase()
    cutoff = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(minutes=args.timeout_minutes)).isoformat()

    stale = supabase.select(
        "monitor_runs",
        select="id,status,started_at",
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

    log(f"sweeper marked {len(stale)} stale runs as failed")


if __name__ == "__main__":
    main()
