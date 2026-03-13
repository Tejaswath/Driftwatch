"""Tests for common.py: SupabaseClient, retry logic, and helpers."""
import json
from unittest.mock import MagicMock, patch, call

import pytest
import requests

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts"))

from common import _retry_request, now_iso, SupabaseClient


class FakeResponse:
    def __init__(self, status_code: int, body=None):
        self.status_code = status_code
        self._body = body or {}
        self.ok = status_code < 400
        self.content = json.dumps(self._body).encode()

    def json(self):
        return self._body

    def raise_for_status(self):
        if not self.ok:
            raise requests.HTTPError(f"{self.status_code}", response=self)


# ---------- _retry_request ----------

def test_retry_succeeds_on_first_attempt():
    mock_fn = MagicMock(return_value=FakeResponse(200, {"ok": True}))
    result = _retry_request(mock_fn, "http://example.com", retries=3)
    assert mock_fn.call_count == 1
    assert result.json() == {"ok": True}


def test_retry_retries_on_network_error_then_succeeds():
    mock_fn = MagicMock(side_effect=[
        requests.ConnectionError("timeout"),
        FakeResponse(200, {"ok": True}),
    ])
    with patch("common.time.sleep"):
        result = _retry_request(mock_fn, "http://example.com", retries=3)
    assert mock_fn.call_count == 2
    assert result.json() == {"ok": True}


def test_retry_exhausts_retries_and_raises():
    mock_fn = MagicMock(side_effect=requests.ConnectionError("always fails"))
    with patch("common.time.sleep"):
        with pytest.raises(requests.ConnectionError):
            _retry_request(mock_fn, "http://example.com", retries=3)
    assert mock_fn.call_count == 3


# ---------- now_iso ----------

def test_now_iso_format():
    ts = now_iso()
    import re
    # e.g. 2026-03-13T10:00:00Z
    assert re.match(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z", ts), f"Unexpected format: {ts}"


# ---------- SupabaseClient.select ----------

def test_supabase_select_constructs_correct_url():
    client = SupabaseClient(url="https://example.supabase.co", service_key="test-key")
    fake_resp = FakeResponse(200, [{"id": "1"}])

    with patch("common._retry_request", return_value=fake_resp) as mock_retry:
        result = client.select("domains", select="id,key", filters={"key": "eq.nordea"}, limit=1)

    assert result == [{"id": "1"}]
    args, kwargs = mock_retry.call_args
    assert "domains" in args[1]
    assert kwargs["params"]["select"] == "id,key"
    assert kwargs["params"]["key"] == "eq.nordea"
    assert kwargs["params"]["limit"] == "1"


def test_supabase_delete_storage_object_returns_true_on_success():
    client = SupabaseClient(url="https://example.supabase.co", service_key="test-key")
    fake_resp = FakeResponse(200, {})
    fake_resp.raise_for_status = lambda: None

    with patch("requests.delete", return_value=fake_resp):
        result = client.delete_storage_object("my-bucket", "path/to/object.html")

    assert result is True


def test_supabase_delete_storage_object_returns_false_on_error():
    client = SupabaseClient(url="https://example.supabase.co", service_key="test-key")

    with patch("requests.delete", side_effect=requests.ConnectionError("network error")):
        result = client.delete_storage_object("my-bucket", "path/to/object.html")

    assert result is False
