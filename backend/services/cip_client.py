"""CIP (Colegiado Information Service) lookup client.

Proxies requests to the external CIP service and normalizes the response
to extract email and name. Email preference: correoPers > correoInst.
"""
from dataclasses import dataclass
from typing import Optional

import httpx

from backend.config import cip_config


class CipLookupError(Exception):
    """Raised when CIP lookup fails."""
    pass


class CipNotFoundError(CipLookupError):
    """Raised when CIP is not found in the service."""
    pass


@dataclass
class CipPerson:
    """Normalized CIP person data."""
    cip: str
    name: Optional[str] = None
    email: Optional[str] = None


def lookup_cip(cip: str) -> CipPerson:
    """
    Look up a CIP in the external service and return normalized person data.

    Args:
        cip: The CIP identifier to look up.

    Returns:
        CipPerson with normalized data.

    Raises:
        CipNotFoundError: When CIP is not found.
        CipLookupError: When service is unavailable or returns an error.
    """
    if not cip_config.is_configured:
        raise CipLookupError("CIP service not configured. Set CIP_SERVICE_URL.")

    # Build request URL
    url = f"{cip_config.service_url.rstrip('/')}/{cip}"

    headers = {}
    if cip_config.auth_header and cip_config.auth_token:
        headers[cip_config.auth_header] = cip_config.auth_token

    try:
        response = httpx.get(
            url,
            headers=headers if headers else None,
            timeout=15.0,
        )

        if response.status_code == 404:
            raise CipNotFoundError(f"CIP not found: {cip}")

        response.raise_for_status()
        data = response.json()

        # Normalize response - adapt to common CIP API shapes
        # Expected shape: { "cip": "...", "correoPers": "...", "correoInst": "...", "nombre": "..." }
        # or: { "data": { "correoPers": ..., "nombre": ... } }
        person_data = data if isinstance(data, dict) else {}

        # Handle nested data wrapper
        if "data" in person_data:
            person_data = person_data["data"]

        # Extract email with preference: correoPers > correoInst
        email = person_data.get("correoPers") or person_data.get("correoInst")
        name = person_data.get("nombre") or person_data.get("name")

        return CipPerson(
            cip=cip,
            name=name,
            email=email,
        )

    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            raise CipNotFoundError(f"CIP not found: {cip}")
        raise CipLookupError(f"CIP service error: {e}")
    except httpx.RequestError as e:
        raise CipLookupError(f"CIP service unavailable: {e}")