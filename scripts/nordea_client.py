import os
import uuid
from dataclasses import dataclass
from typing import Dict, Optional

import requests

from common import log, now_iso, require_env


@dataclass
class NordeaConfig:
    env: str
    bypass_signature: bool
    token_url: str
    api_base_url: str
    client_id: str
    client_secret: str


def load_nordea_config() -> NordeaConfig:
    return NordeaConfig(
        env=os.getenv("NORDEA_ENV", "sandbox"),
        bypass_signature=os.getenv("NORDEA_SIGNATURE_BYPASS", "true").lower() in {"1", "true", "yes"},
        token_url=os.getenv("NORDEA_TOKEN_URL", ""),
        api_base_url=os.getenv("NORDEA_API_BASE_URL", ""),
        client_id=os.getenv("NORDEA_CLIENT_ID", ""),
        client_secret=os.getenv("NORDEA_CLIENT_SECRET", ""),
    )


def validate_sandbox_bypass(cfg: NordeaConfig) -> None:
    if cfg.bypass_signature and cfg.env != "sandbox":
        raise RuntimeError("NORDEA_SIGNATURE_BYPASS is enabled outside sandbox. Refusing to run.")


def build_headers(cfg: NordeaConfig, access_token: Optional[str] = None) -> Dict[str, str]:
    validate_sandbox_bypass(cfg)
    headers: Dict[str, str] = {
        "Accept": "application/json",
        "x-request-id": str(uuid.uuid4()),
    }
    if access_token:
        headers["Authorization"] = f"Bearer {access_token}"

    if cfg.bypass_signature:
        headers["Signature"] = "SKIP_SIGNATURE_VALIDATION_FOR_SANDBOX"
        log(f"Nordea sandbox bypass applied at {now_iso()} request_id={headers['x-request-id']}")

    return headers


def fetch_access_token(cfg: NordeaConfig) -> Optional[str]:
    if not (cfg.token_url and cfg.client_id and cfg.client_secret):
        return None

    response = requests.post(
        cfg.token_url,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        data={"grant_type": "client_credentials"},
        auth=(cfg.client_id, cfg.client_secret),
        timeout=30,
    )

    if response.status_code >= 400:
        raise RuntimeError(f"Nordea token request failed: {response.status_code} {response.text}")

    payload = response.json()
    token = payload.get("access_token")
    if not token:
        raise RuntimeError("Nordea token response missing access_token")
    return token


def probe_nordea(cfg: NordeaConfig) -> Dict[str, str]:
    if not cfg.api_base_url:
        return {"status": "mock", "reason": "NORDEA_API_BASE_URL missing"}

    token = fetch_access_token(cfg)
    headers = build_headers(cfg, token)
    endpoint = f"{cfg.api_base_url.rstrip('/')}/health"
    response = requests.get(endpoint, headers=headers, timeout=20)
    return {
        "status": "ready" if response.status_code < 400 else "error",
        "endpoint": endpoint,
        "http_status": str(response.status_code),
    }
