"""Router for CIP (Colegiado Information Service) lookup endpoints."""
from fastapi import APIRouter, HTTPException, status

from backend.schemas import CipLookupResponse
from backend.services.cip_client import CipLookupError, CipNotFoundError, lookup_cip

router = APIRouter(prefix="/cip", tags=["cip"])


@router.get("/{cip}/lookup", response_model=CipLookupResponse)
def cip_lookup(cip: str):
    """
    Look up a CIP to get normalized person data (email, name).

    Args:
        cip: The CIP identifier to look up.

    Returns:
        CipLookupResponse with found status and person data.

    Raises:
        HTTPException: If lookup fails due to service error (not if not found).
    """
    try:
        person = lookup_cip(cip)
        return CipLookupResponse(
            cip=person.cip,
            name=person.name,
            email=person.email,
            found=True,
        )
    except CipNotFoundError:
        return CipLookupResponse(
            cip=cip,
            name=None,
            email=None,
            found=False,
        )
    except CipLookupError as e:
        # Return 422 for service configuration/unavailability errors
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"CIP service error: {str(e)}",
        )