import os

import requests


def main() -> None:
    health_url = os.getenv("HEALTH_URL")
    if health_url:
        response = requests.get(health_url, timeout=20)
        response.raise_for_status()
        print(f"health ping ok: {health_url}")
        return

    supabase_url = os.getenv("SUPABASE_URL")
    anon_key = os.getenv("SUPABASE_ANON_KEY")
    if not supabase_url or not anon_key:
        raise RuntimeError("Provide HEALTH_URL or SUPABASE_URL + SUPABASE_ANON_KEY")

    response = requests.get(
        f"{supabase_url}/rest/v1/domains?select=key&limit=1",
        headers={"apikey": anon_key, "Authorization": f"Bearer {anon_key}"},
        timeout=20,
    )
    response.raise_for_status()
    print("supabase keepalive ok")


if __name__ == "__main__":
    main()
