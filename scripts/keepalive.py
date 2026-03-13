import os

import requests

STORAGE_WARN_BYTES = 400 * 1024 * 1024  # 400 MB warn threshold


def check_storage_quota(supabase_url: str, service_key: str, bucket: str = "driftwatch-artifacts") -> None:
    """Log storage bucket size and warn if approaching 0.5GB Supabase free limit."""
    url = f"{supabase_url}/storage/v1/bucket/{bucket}"
    headers = {"apikey": service_key, "Authorization": f"Bearer {service_key}"}
    try:
        response = requests.get(url, headers=headers, timeout=20)
        if response.ok:
            data = response.json()
            size = data.get("size", 0) or 0
            size_mb = size / (1024 * 1024)
            print(f"storage bucket '{bucket}' size: {size_mb:.1f} MB")
            if size > STORAGE_WARN_BYTES:
                print(f"WARNING: storage bucket '{bucket}' exceeds 400 MB ({size_mb:.1f} MB). Approaching Supabase free 1 GB limit.")
        else:
            print(f"storage quota check skipped (status {response.status_code})")
    except Exception as exc:  # noqa: BLE001
        print(f"storage quota check failed: {exc}")


def main() -> None:
    health_url = os.getenv("HEALTH_URL")
    if health_url:
        response = requests.get(health_url, timeout=20)
        response.raise_for_status()
        print(f"health ping ok: {health_url}")
        return

    supabase_url = os.getenv("SUPABASE_URL")
    anon_key = os.getenv("SUPABASE_ANON_KEY")
    service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not supabase_url or not anon_key:
        raise RuntimeError("Provide HEALTH_URL or SUPABASE_URL + SUPABASE_ANON_KEY")

    response = requests.get(
        f"{supabase_url}/rest/v1/domains?select=key&limit=1",
        headers={"apikey": anon_key, "Authorization": f"Bearer {anon_key}"},
        timeout=20,
    )
    response.raise_for_status()
    print("supabase keepalive ok")

    # Check storage quota if service key available
    if service_key:
        bucket = os.getenv("DRIFTWATCH_STORAGE_BUCKET", "driftwatch-artifacts")
        check_storage_quota(supabase_url, service_key, bucket)


if __name__ == "__main__":
    main()
