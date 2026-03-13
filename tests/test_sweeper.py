"""Tests for sweeper.py: timeout detection and storage path extraction."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts"))

from sweeper import storage_path_from_uri


def test_storage_path_extracts_correctly():
    uri = "https://abc.supabase.co/storage/v1/object/public/driftwatch-artifacts/reports/run/report.html"
    path = storage_path_from_uri(uri, "driftwatch-artifacts")
    assert path == "reports/run/report.html"


def test_storage_path_returns_none_for_wrong_bucket():
    uri = "https://abc.supabase.co/storage/v1/object/public/other-bucket/reports/report.html"
    path = storage_path_from_uri(uri, "driftwatch-artifacts")
    assert path is None


def test_storage_path_returns_none_for_empty_uri():
    assert storage_path_from_uri("", "driftwatch-artifacts") is None
    assert storage_path_from_uri(None, "driftwatch-artifacts") is None


def test_storage_path_nested_path():
    uri = "https://x.supabase.co/storage/v1/object/public/driftwatch-artifacts/baselines/nordea/v1.csv"
    path = storage_path_from_uri(uri, "driftwatch-artifacts")
    assert path == "baselines/nordea/v1.csv"
