import argparse
import json
import uuid

from common import get_supabase, log, now_iso
from nordea_client import build_headers, load_nordea_config, validate_sandbox_bypass


PROFILES = {
    "stable_salary_profile": {
        "salary": 42000,
        "rent": -13500,
        "grocery": -4500,
        "subscriptions": -999,
    },
    "inflation_shift_profile": {
        "salary": 42000,
        "rent": -15800,
        "grocery": -5900,
        "subscriptions": -1299,
    },
    "subscription_spike_profile": {
        "salary": 42000,
        "rent": -13500,
        "grocery": -4500,
        "subscriptions": -2199,
    },
    "income_drop_profile": {
        "salary": 31000,
        "rent": -13500,
        "grocery": -4500,
        "subscriptions": -999,
    },
}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--profile", default="stable_salary_profile")
    args = parser.parse_args()

    if args.profile not in PROFILES:
        raise RuntimeError(f"Unknown profile: {args.profile}")

    cfg = load_nordea_config()
    validate_sandbox_bypass(cfg)
    headers = build_headers(cfg)

    seed_id = str(uuid.uuid4())
    payload = {
        "seed_id": seed_id,
        "profile": args.profile,
        "transactions": [
            {"merchant": "Employer AB", "amount": PROFILES[args.profile]["salary"], "currency": "SEK"},
            {"merchant": "Rent", "amount": PROFILES[args.profile]["rent"], "currency": "SEK"},
            {"merchant": "ICA", "amount": PROFILES[args.profile]["grocery"], "currency": "SEK"},
            {"merchant": "Subscriptions", "amount": PROFILES[args.profile]["subscriptions"], "currency": "SEK"},
        ],
        "sandbox_signature_header": headers.get("Signature"),
        "created_at": now_iso(),
    }

    supabase = get_supabase()
    bucket = "driftwatch-artifacts"
    storage_path = f"seed/{seed_id}.json"
    storage_uri = supabase.upload_bytes(
        bucket,
        storage_path,
        json.dumps(payload, indent=2).encode("utf-8"),
        "application/json",
    )

    supabase.insert(
        "nordea_seed_runs",
        [
            {
                "id": seed_id,
                "profile": args.profile,
                "status": "completed_mock",
                "params": {
                    "storage_uri": storage_uri,
                    "sandbox_signature_header": headers.get("Signature"),
                    "note": "Mock seed payload persisted. Replace with live Nordea API calls when credentials are verified.",
                },
            }
        ],
    )

    log(f"seed run {seed_id} created for profile={args.profile}")


if __name__ == "__main__":
    main()
