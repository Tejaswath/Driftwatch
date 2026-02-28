import argparse
import hashlib
import json
import math
import os
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

import pandas as pd
import requests

from common import get_supabase, log, now_iso
from nordea_client import build_headers, fetch_access_token, load_nordea_config, validate_sandbox_bypass


FEATURE_COLUMNS = [
    "daily_spend_30d",
    "daily_income_30d",
    "rent_ratio",
    "subscription_count",
    "top_merchant_share",
    "txn_count_7d",
    "avg_txn_amount_30d",
    "weekday_spend_entropy",
    "cashflow_ratio_30d",
    "merchant_diversity_30d",
]

SUBSCRIPTION_HINTS = {
    "spotify",
    "netflix",
    "youtube",
    "apple",
    "icloud",
    "amazon prime",
    "adobe",
    "gym",
    "hbo",
    "disney",
    "viaplay",
    "tv4",
}

RENT_HINTS = {"rent", "hyra", "landlord", "heimstaden", "balder", "hus"}


def compute_schema_hash(df: pd.DataFrame) -> str:
    payload = [(column, str(dtype)) for column, dtype in zip(df.columns, df.dtypes)]
    return hashlib.sha256(json.dumps(payload, sort_keys=True).encode("utf-8")).hexdigest()


def env_bool(name: str, default: bool = False) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "y", "on"}


def choose_base_api_url(base_url: str) -> str:
    base = base_url.rstrip("/")
    if base.endswith("/v5"):
        return base
    return f"{base}/v5"


def parse_datetime(value: Any) -> Optional[datetime]:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.astimezone(timezone.utc) if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if isinstance(value, date):
        return datetime(value.year, value.month, value.day, tzinfo=timezone.utc)
    if not isinstance(value, str):
        return None
    raw = value.strip()
    if not raw:
        return None
    if raw.endswith("Z"):
        raw = raw[:-1] + "+00:00"
    try:
        parsed = datetime.fromisoformat(raw)
        return parsed.astimezone(timezone.utc) if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
    except ValueError:
        pass
    try:
        parsed = datetime.strptime(value, "%Y-%m-%d")
        return parsed.replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def to_float(value: Any) -> Optional[float]:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        cleaned = value.strip().replace(",", ".")
        if not cleaned:
            return None
        try:
            return float(cleaned)
        except ValueError:
            return None
    return None


def extract_amount(tx: Dict[str, Any]) -> Optional[float]:
    amount = to_float(tx.get("amount"))
    if amount is None:
        nested = tx.get("transactionAmount")
        if isinstance(nested, dict):
            amount = to_float(nested.get("amount") or nested.get("value"))
    if amount is None:
        return None

    indicator = str(
        tx.get("creditDebitIndicator")
        or tx.get("credit_debit_indicator")
        or tx.get("type")
        or ""
    ).upper()
    if indicator in {"DBIT", "DEBIT"} and amount > 0:
        amount = -amount
    elif indicator in {"CRDT", "CREDIT"} and amount < 0:
        amount = abs(amount)
    return amount


def extract_merchant(tx: Dict[str, Any]) -> str:
    for key in (
        "merchantName",
        "merchant",
        "creditorName",
        "debtorName",
        "counterpartyName",
        "description",
        "remittanceInformationUnstructured",
        "reference",
    ):
        value = tx.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return "unknown"


def extract_timestamp(tx: Dict[str, Any]) -> Optional[datetime]:
    for key in ("bookingDateTime", "bookingDate", "valueDate", "transactionDate", "date"):
        parsed = parse_datetime(tx.get(key))
        if parsed:
            return parsed
    return None


def gather_lists(node: Any, depth: int = 0) -> List[List[Dict[str, Any]]]:
    if depth > 5:
        return []
    found: List[List[Dict[str, Any]]] = []
    if isinstance(node, list):
        dict_items = [item for item in node if isinstance(item, dict)]
        if dict_items:
            found.append(dict_items)
        for item in node:
            found.extend(gather_lists(item, depth + 1))
    elif isinstance(node, dict):
        for value in node.values():
            found.extend(gather_lists(value, depth + 1))
    return found


def pick_transaction_list(payload: Any) -> List[Dict[str, Any]]:
    candidates = gather_lists(payload)
    scored: List[Tuple[int, List[Dict[str, Any]]]] = []
    for candidate in candidates:
        score = 0
        for item in candidate[:10]:
            if any(key in item for key in ("transactionAmount", "amount", "bookingDate", "bookingDateTime", "valueDate")):
                score += 1
        if score > 0:
            scored.append((score, candidate))
    if not scored:
        return []
    scored.sort(key=lambda row: (row[0], len(row[1])), reverse=True)
    return scored[0][1]


def pick_account_list(payload: Any) -> List[Dict[str, Any]]:
    if isinstance(payload, list):
        return [item for item in payload if isinstance(item, dict)]
    if not isinstance(payload, dict):
        return []
    for key in ("accounts", "accountList", "items", "data"):
        value = payload.get(key)
        if isinstance(value, list):
            return [item for item in value if isinstance(item, dict)]
    for value in payload.values():
        if isinstance(value, dict):
            nested = pick_account_list(value)
            if nested:
                return nested
    return []


def first_present(record: Dict[str, Any], keys: Sequence[str]) -> Optional[Any]:
    for key in keys:
        value = record.get(key)
        if value is not None and value != "":
            return value
    return None


def account_id_of(record: Dict[str, Any]) -> Optional[str]:
    raw = first_present(record, ["accountId", "id", "resourceId", "account_id"])
    return str(raw) if raw is not None else None


def http_get_json(url: str, headers: Dict[str, str], params: Optional[Dict[str, str]] = None) -> Any:
    response = requests.get(url, headers=headers, params=params, timeout=30)
    if response.status_code >= 400:
        body = (response.text or "").strip().replace("\n", " ")
        raise RuntimeError(
            f"Nordea GET failed url={url} params={params} status={response.status_code} "
            f"content_type={response.headers.get('Content-Type', '')} body={body[:260]}"
        )
    try:
        return response.json()
    except ValueError as exc:
        body = (response.text or "").strip().replace("\n", " ")
        raise RuntimeError(
            f"Nordea GET returned non-JSON url={url} params={params} status={response.status_code} "
            f"content_type={response.headers.get('Content-Type', '')} body={body[:260]}"
        ) from exc


def load_live_transactions() -> Tuple[List[Dict[str, Any]], Dict[str, Any], str]:
    cfg = load_nordea_config()
    validate_sandbox_bypass(cfg)

    token = os.getenv("NORDEA_ACCESS_TOKEN", "").strip()
    if token:
        log("nordea_sync using NORDEA_ACCESS_TOKEN override")
    else:
        token = fetch_access_token(cfg)
    if not token:
        raise RuntimeError("Missing token credentials. Set NORDEA_TOKEN_URL, NORDEA_CLIENT_ID, NORDEA_CLIENT_SECRET.")

    headers = build_headers(cfg, token)
    api_base = choose_base_api_url(cfg.api_base_url)
    accounts_url = f"{api_base}/accounts"
    accounts_payload = http_get_json(accounts_url, headers=headers)
    accounts = pick_account_list(accounts_payload)
    if not accounts:
        raise RuntimeError("Live read: no accounts returned from Nordea.")

    preferred_account = os.getenv("NORDEA_ACCOUNT_ID", "").strip()
    account = None
    if preferred_account:
        for candidate in accounts:
            if account_id_of(candidate) == preferred_account:
                account = candidate
                break
        if not account:
            raise RuntimeError(f"Live read: NORDEA_ACCOUNT_ID={preferred_account} not found in account list.")
    else:
        account = accounts[0]

    account_id = account_id_of(account)
    if not account_id:
        raise RuntimeError("Live read: selected account is missing accountId/id/resourceId.")

    to_date = datetime.now(timezone.utc).date()
    from_date = to_date - timedelta(days=30)
    transactions_url = f"{api_base}/accounts/{account_id}/transactions"

    tx_payload: Any = None
    attempts = [
        {"fromDate": from_date.isoformat(), "toDate": to_date.isoformat()},
        {"dateFrom": from_date.isoformat(), "dateTo": to_date.isoformat()},
        None,
    ]
    last_error: Optional[Exception] = None
    for params in attempts:
        try:
            tx_payload = http_get_json(transactions_url, headers=headers, params=params)
            break
        except Exception as exc:  # noqa: BLE001
            last_error = exc
    if tx_payload is None:
        raise RuntimeError(f"Live read: failed to fetch transactions. Last error: {last_error}")

    tx_records = pick_transaction_list(tx_payload)
    if not tx_records:
        raise RuntimeError("Live read: transactions payload did not contain parsable transaction records.")

    normalized: List[Dict[str, Any]] = []
    for tx in tx_records:
        ts = extract_timestamp(tx)
        amount = extract_amount(tx)
        if ts is None or amount is None:
            continue
        if ts.date() < from_date:
            continue
        normalized.append(
            {
                "ts": ts,
                "date": ts.date(),
                "amount": float(amount),
                "merchant": extract_merchant(tx),
                "raw": tx,
            }
        )

    if not normalized:
        raise RuntimeError("Live read: no valid transactions in last 30 days after normalization.")

    raw_bundle = {
        "fetched_at": now_iso(),
        "accounts_endpoint": accounts_url,
        "transactions_endpoint": transactions_url,
        "account_id": account_id,
        "accounts": accounts_payload,
        "transactions": tx_payload,
        "normalized_count": len(normalized),
    }
    return normalized, raw_bundle, account_id


def safe_entropy(counts: Iterable[float]) -> float:
    values = [v for v in counts if v > 0]
    total = sum(values)
    if total <= 0:
        return 0.0
    entropy = 0.0
    for value in values:
        p = value / total
        entropy -= p * math.log(p)
    return entropy / math.log(7) if len(values) > 1 else 0.0


def compute_features_for_anchor(transactions: List[Dict[str, Any]], anchor_day: date) -> Dict[str, float]:
    window_start = anchor_day - timedelta(days=29)
    window_tx = [tx for tx in transactions if window_start <= tx["date"] <= anchor_day]
    if not window_tx:
        return {column: 0.0 for column in FEATURE_COLUMNS}

    spend_tx = [tx for tx in window_tx if tx["amount"] < 0]
    income_tx = [tx for tx in window_tx if tx["amount"] > 0]
    total_spend = sum(abs(tx["amount"]) for tx in spend_tx)
    total_income = sum(tx["amount"] for tx in income_tx)

    rent_spend = 0.0
    merchant_spend: Dict[str, float] = defaultdict(float)
    subscription_merchants = set()

    for tx in spend_tx:
        merchant = tx["merchant"].lower()
        merchant_spend[merchant] += abs(tx["amount"])
        if any(hint in merchant for hint in RENT_HINTS):
            rent_spend += abs(tx["amount"])
        if any(hint in merchant for hint in SUBSCRIPTION_HINTS):
            subscription_merchants.add(merchant)

    top_merchant_share = max(merchant_spend.values()) / total_spend if total_spend > 0 else 0.0

    recent_start = anchor_day - timedelta(days=6)
    txn_count_7d = sum(1 for tx in window_tx if recent_start <= tx["date"] <= anchor_day)

    avg_txn_amount_30d = (
        sum(abs(tx["amount"]) for tx in window_tx) / len(window_tx) if window_tx else 0.0
    )

    weekday_spend = [0.0] * 7
    for tx in spend_tx:
        weekday_spend[tx["date"].weekday()] += abs(tx["amount"])

    merchant_diversity = len({tx["merchant"].lower() for tx in window_tx}) / len(window_tx) if window_tx else 0.0

    features = {
        "daily_spend_30d": total_spend / 30.0,
        "daily_income_30d": total_income / 30.0,
        "rent_ratio": rent_spend / total_spend if total_spend > 0 else 0.0,
        "subscription_count": float(len(subscription_merchants)),
        "top_merchant_share": top_merchant_share,
        "txn_count_7d": float(txn_count_7d),
        "avg_txn_amount_30d": avg_txn_amount_30d,
        "weekday_spend_entropy": safe_entropy(weekday_spend),
        "cashflow_ratio_30d": total_income / total_spend if total_spend > 0 else 0.0,
        "merchant_diversity_30d": merchant_diversity,
    }
    return features


def build_feature_batch(transactions: List[Dict[str, Any]], rows: int = 10) -> pd.DataFrame:
    latest_day = max(tx["date"] for tx in transactions)
    anchors = [latest_day - timedelta(days=offset) for offset in range(rows - 1, -1, -1)]
    feature_rows = [compute_features_for_anchor(transactions, anchor_day) for anchor_day in anchors]
    frame = pd.DataFrame(feature_rows, columns=FEATURE_COLUMNS)
    frame = frame.fillna(0.0)
    return frame


def align_to_template_dtypes(df: pd.DataFrame, template_path: Path) -> pd.DataFrame:
    template = pd.read_csv(template_path)
    result = df.copy()
    for column in template.columns:
        if column not in result.columns:
            result[column] = 0
        target_dtype = template[column].dtype
        try:
            if str(target_dtype).startswith("int"):
                result[column] = pd.to_numeric(result[column], errors="coerce").fillna(0).round().astype(target_dtype)
            else:
                result[column] = pd.to_numeric(result[column], errors="coerce").fillna(0).astype(target_dtype)
        except Exception:  # noqa: BLE001
            result[column] = pd.to_numeric(result[column], errors="coerce").fillna(0)
    ordered = result[template.columns]
    return ordered


def load_mock_features() -> pd.DataFrame:
    return pd.read_csv(Path("data/demo/current.csv"))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--domain", default="nordea")
    parser.add_argument("--baseline-version", default="v1")
    parser.add_argument("--batch-id", default=f"manual-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}")
    args = parser.parse_args()

    supabase = get_supabase()
    domains = supabase.select("domains", select="id,key", filters={"key": f"eq.{args.domain}"}, limit=1)
    if not domains:
        raise RuntimeError("Domain not found")
    domain = domains[0]

    live_read_enabled = env_bool("NORDEA_LIVE_READ", default=False)
    source_mode = "mock"
    source_reason = "NORDEA_LIVE_READ disabled."
    live_account_id = ""
    raw_storage_uri = ""

    current_df: pd.DataFrame
    if live_read_enabled:
        try:
            transactions, raw_bundle, live_account_id = load_live_transactions()
            current_df = build_feature_batch(transactions, rows=10)
            source_mode = "live"
            source_reason = f"Loaded {len(transactions)} transactions from Nordea sandbox."
            raw_storage_uri = supabase.upload_bytes(
                "driftwatch-artifacts",
                f"raw/nordea/{args.batch_id}.json",
                json.dumps(raw_bundle, ensure_ascii=True, indent=2).encode("utf-8"),
                "application/json",
            )
            log(f"nordea_sync source_mode=live account_id={live_account_id} tx_count={len(transactions)}")
        except Exception as exc:  # noqa: BLE001
            source_mode = "mock_fallback"
            source_reason = f"Live read failed; fallback to demo data. reason={exc}"
            log(f"nordea_sync source_mode=mock_fallback reason={exc}")
            current_df = load_mock_features()
    else:
        current_df = load_mock_features()
        log("nordea_sync source_mode=mock reason=NORDEA_LIVE_READ disabled")

    current_df = align_to_template_dtypes(current_df, Path("data/demo/current.csv"))
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
                "reason": (
                    f"sync mode={source_mode}; {source_reason}; "
                    f"raw_uri={raw_storage_uri or 'none'}; account_id={live_account_id or 'n/a'}"
                ),
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
