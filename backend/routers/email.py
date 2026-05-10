"""Router for email sending and history endpoints."""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import EmailSend, Event
from backend.schemas import (
    EmailSendBatchResponse,
    EmailSendRequest,
    EmailSendResponse,
)
from backend.services.email_send import (
    EmailSendValidationError,
    send_email_batch,
)

router = APIRouter(tags=["email"])


@router.post("/events/{event_id}/email/send", response_model=EmailSendBatchResponse)
def send_email(
    event_id: int,
    request: EmailSendRequest,
    db: Session = Depends(get_db),
):
    """
    Send email with Drive links to selected recipients.

    Creates one EmailSend per recipient and EmailSendItem rows for each
    processed photo. Validates that all frames have Drive links before sending.

    Args:
        event_id: Event ID for the send records.
        request: EmailSendRequest with frame IDs, recipients, subject, body.

    Returns:
        EmailSendBatchResponse with created send records and their items.

    Raises:
        HTTPException: If event not found or validation fails.
    """
    # Verify event exists
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Event {event_id} not found",
        )

    # Validate recipients
    if not request.recipients:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one recipient is required",
        )

    # Convert recipients to dicts
    recipients = [
        {
            "email": r.email,
            "name": r.name,
            "cip": r.cip,
        }
        for r in request.recipients
    ]

    try:
        email_sends = send_email_batch(
            db=db,
            event_id=event_id,
            processed_frame_ids=request.processed_frame_ids,
            recipients=recipients,
            subject=request.subject,
            body=request.body,
            html=request.html,
            cc=request.cc,
            bcc=request.bcc,
            usuario_creacion=request.usuario_creacion,
        )

        return EmailSendBatchResponse(
            sends=[EmailSendResponse.model_validate(es) for es in email_sends]
        )

    except EmailSendValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.get("/events/{event_id}/email/sends", response_model=list[EmailSendResponse])
def list_email_sends(
    event_id: int,
    status_filter: Optional[str] = Query(None, alias="status"),
    db: Session = Depends(get_db),
):
    """
    List all email sends for an event, optionally filtered by status.

    Args:
        event_id: Event ID to filter by.
        status_filter: Optional status to filter by (pending, sent_to_noti, failed).

    Returns:
        List of EmailSendResponse records.
    """
    query = db.query(EmailSend).filter(EmailSend.event_id == event_id)

    if status_filter:
        query = query.filter(EmailSend.status == status_filter)

    email_sends = query.order_by(EmailSend.created_at.desc()).all()
    return email_sends


@router.get("/email/sends/{send_id}", response_model=EmailSendResponse)
def get_email_send(send_id: int, db: Session = Depends(get_db)):
    """
    Get a single email send with its items.

    Args:
        send_id: EmailSend ID.

    Returns:
        EmailSendResponse with items.

    Raises:
        HTTPException: If send not found.
    """
    email_send = db.query(EmailSend).filter(EmailSend.id == send_id).first()
    if not email_send:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Email send {send_id} not found",
        )
    return email_send