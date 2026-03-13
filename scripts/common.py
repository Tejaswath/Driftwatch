import json
import os
import time
from dataclasses import dataclass
from urllib.parse import quote
from typing import Any, Dict, Iterable, List, Optional

import requests
from requests.exceptions import RequestException


def _retry_request(func, *args, retries: int = 3, **kwargs) -> requests.Response:
    """Execute a requests call with exponential backoff retry."""
    for attempt in range(retries):
        try:
            return func(*args, **kwargs)
        except RequestException as exc:
            if attempt == retries - 1:
                raise
            wait = 2 ** attempt
            print(f"[driftwatch] request failed (attempt {attempt + 1}/{retries}), retrying in {wait}s: {exc}", flush=True)
            time.sleep(wait)
    raise RuntimeError("unreachable")


@dataclass
class SupabaseClient:
    url: str
    service_key: str

    @property
    def rest_base(self) -> str:
        return f"{self.url}/rest/v1"

    @property
    def storage_base(self) -> str:
        return f"{self.url}/storage/v1"

    @property
    def headers(self) -> Dict[str, str]:
        return {
            "apikey": self.service_key,
            "Authorization": f"Bearer {self.service_key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        }

    def select(
        self,
        table: str,
        select: str = "*",
        filters: Optional[Dict[str, str]] = None,
        order: Optional[str] = None,
        limit: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        params: Dict[str, str] = {"select": select}
        if filters:
            params.update(filters)
        if order:
            params["order"] = order
        if limit is not None:
            params["limit"] = str(limit)

        response = _retry_request(
            requests.get, f"{self.rest_base}/{table}", headers=self.headers, params=params, timeout=30
        )
        response.raise_for_status()
        return response.json()

    def insert(self, table: str, rows: Iterable[Dict[str, Any]]) -> List[Dict[str, Any]]:
        payload = list(rows)
        response = _retry_request(
            requests.post, f"{self.rest_base}/{table}", headers=self.headers, data=json.dumps(payload), timeout=30
        )
        response.raise_for_status()
        return response.json()

    def upsert(self, table: str, rows: Iterable[Dict[str, Any]], on_conflict: str) -> List[Dict[str, Any]]:
        payload = list(rows)
        headers = {**self.headers, "Prefer": "resolution=merge-duplicates,return=representation"}
        response = _retry_request(
            requests.post,
            f"{self.rest_base}/{table}?on_conflict={on_conflict}",
            headers=headers,
            data=json.dumps(payload),
            timeout=30,
        )
        response.raise_for_status()
        return response.json()

    def update(self, table: str, filters: Dict[str, str], data: Dict[str, Any]) -> List[Dict[str, Any]]:
        response = _retry_request(
            requests.patch, f"{self.rest_base}/{table}", headers=self.headers, params=filters, data=json.dumps(data), timeout=30
        )
        response.raise_for_status()
        return response.json()

    def delete_storage_object(self, bucket: str, path: str) -> bool:
        """Delete a single object from Supabase Storage. Returns True on success."""
        url = f"{self.storage_base}/object/{bucket}/{path}"
        headers = {
            "apikey": self.service_key,
            "Authorization": f"Bearer {self.service_key}",
        }
        try:
            response = requests.delete(url, headers=headers, timeout=30)
            response.raise_for_status()
            return True
        except RequestException as exc:
            print(f"[driftwatch] storage delete failed for {path}: {exc}", flush=True)
            return False

    def get_storage_bucket_stats(self, bucket: str) -> Optional[Dict[str, Any]]:
        """Fetch bucket metadata from Supabase Storage API."""
        url = f"{self.storage_base}/bucket/{bucket}"
        headers = {
            "apikey": self.service_key,
            "Authorization": f"Bearer {self.service_key}",
        }
        try:
            response = requests.get(url, headers=headers, timeout=20)
            response.raise_for_status()
            return response.json()
        except RequestException:
            return None

    def upload_bytes(self, bucket: str, path: str, content: bytes, content_type: str) -> str:
        url = f"{self.storage_base}/object/{bucket}/{path}"
        headers = {
            "apikey": self.service_key,
            "Authorization": f"Bearer {self.service_key}",
            "Content-Type": content_type,
            "x-upsert": "true",
        }
        response = _retry_request(requests.post, url, headers=headers, data=content, timeout=60)
        response.raise_for_status()
        return f"{self.storage_base}/object/public/{bucket}/{path}"

    def public_object_url(self, bucket: str, path: str) -> str:
        safe_path = quote(path.lstrip("/"), safe="/")
        return f"{self.storage_base}/object/public/{bucket}/{safe_path}"

    def download_public_bytes(self, bucket: str, path: str) -> bytes:
        url = self.public_object_url(bucket, path)
        headers = {
            "apikey": self.service_key,
            "Authorization": f"Bearer {self.service_key}",
        }
        response = _retry_request(requests.get, url, headers=headers, timeout=60)
        response.raise_for_status()
        return response.content


def now_iso() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def require_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"Missing environment variable: {name}")
    return value


def get_supabase() -> SupabaseClient:
    return SupabaseClient(url=require_env("SUPABASE_URL"), service_key=require_env("SUPABASE_SERVICE_ROLE_KEY"))


def log(message: str) -> None:
    print(f"[driftwatch] {message}", flush=True)
