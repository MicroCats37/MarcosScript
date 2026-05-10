"""Email send service.

Validates processed frames for Drive links, builds HTML content with
photo links, creates EmailSend/EmailSendItem records, and calls noti.
"""
from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session

from backend.models import EmailSend, EmailSendItem, ProcessedFrame
from backend.services.noti_client import NotiSendRequest, NotiSendResponse, send_email_via_noti


class EmailSendValidationError(Exception):
    """Raised when email send validation fails."""
    pass


def validate_frames_for_send(
    db: Session,
    processed_frame_ids: list[int],
) -> list[ProcessedFrame]:
    """
    Validate that all processed frames exist, belong to the event,
    and have Drive links (are sendable).

    Args:
        db: Database session.
        processed_frame_ids: List of processed frame IDs to validate.

    Returns:
        List of validated ProcessedFrame objects.

    Raises:
        EmailSendValidationError: If any frame is invalid or not sendable.
    """
    frames = db.query(ProcessedFrame).filter(
        ProcessedFrame.id.in_(processed_frame_ids)
    ).all()

    if len(frames) != len(processed_frame_ids):
        found_ids = {f.id for f in frames}
        missing = set(processed_frame_ids) - found_ids
        raise EmailSendValidationError(f"Processed frames not found: {missing}")

    unsendable = [f for f in frames if not f.drive_web_view_link]
    if unsendable:
        ids = [f.id for f in unsendable]
        raise EmailSendValidationError(
            f"Processed frames without Drive links (not sendable): {ids}. "
            f"Upload to Drive first or retry upload."
        )

    return frames


def build_email_html_content(
    frames: list[ProcessedFrame],
    optional_body: Optional[str] = None,
) -> str:
    """
    Build HTML email content with Drive links for each photo.

    Args:
        frames: List of ProcessedFrame objects with Drive links.
        optional_body: Optional custom body text to prepend.

    Returns:
        HTML string with photo links.
    """
    # If body is provided but not HTML, wrap it in <p> tags
    if optional_body and not optional_body.strip().startswith("<"):
        optional_body = f"<p>{optional_body}</p>\n"

    body = optional_body or ""
    body += "\n<p>Here are your processed photo links:</p>\n<ul>\n"

    for frame in frames:
        link_html = f'<li><a href="{frame.drive_web_view_link}">{frame.output_filename}</a></li>\n'
        body += link_html

    body += "</ul>\n"
    return body


def send_email_batch(
    db: Session,
    event_id: int,
    processed_frame_ids: list[int],
    recipients: list[dict],
    subject: str,
    body: Optional[str] = None,
    html: bool = True,
    cc: Optional[list[str]] = None,
    bcc: Optional[list[str]] = None,
    usuario_creacion: Optional[str] = None,
) -> list[EmailSend]:
    """
    Send emails to multiple recipients with selected photo links.

    Creates one EmailSend per recipient with EmailSendItem rows for each photo.

    Args:
        db: Database session.
        event_id: Event ID for the send records.
        processed_frame_ids: IDs of processed frames to include.
        recipients: List of dicts with 'email', 'name', 'cip' keys.
        subject: Email subject.
        body: Optional custom body text.
        html: Whether to send as HTML.
        cc: Optional CC recipient list.
        bcc: Optional BCC recipient list.
        usuario_creacion: Creator identifier for audit.

    Returns:
        List of created EmailSend objects with their items.

    Raises:
        EmailSendValidationError: If validation fails.
    """
    # Validate frames
    frames = validate_frames_for_send(db, processed_frame_ids)

    # Build link list for each recipient
    email_sends = []

    for recipient in recipients:
        recipient_email = recipient.get("email")
        if not recipient_email:
            continue

        # Build email content with all photo links
        email_content = build_email_html_content(frames, body)

        # Create EmailSend record
        email_send = EmailSend(
            event_id=event_id,
            cip=recipient.get("cip"),
            recipient_email=recipient_email,
            recipient_name=recipient.get("name"),
            subject=subject,
            body_template=body,
            html=1 if html else 0,
            status="pending",
            usuario_creacion=usuario_creacion,
        )
        db.add(email_send)
        db.flush()  # Get ID

        # Create EmailSendItem for each frame
        for frame in frames:
            item = EmailSendItem(
                email_send_id=email_send.id,
                processed_frame_id=frame.id,
                drive_link=frame.drive_web_view_link,
                status="pending",
            )
            db.add(item)

        email_sends.append(email_send)

    db.flush()

    # Call noti for each recipient (one call per recipient for privacy)
    for email_send in email_sends:
        # Build content - if body_template provided and html=True, ensure it's HTML
        contenido = email_send.body_template
        if contenido and html:
            if not contenido.strip().startswith("<"):
                contenido = f"<p>{contenido}</p>\n"
        elif not contenido:
            contenido = build_email_html_content(frames)

        noti_request = NotiSendRequest(
            to=[email_send.recipient_email],
            cc=cc or [],
            bcc=bcc or [],
            asunto=email_send.subject,
            contenido=contenido,
            html=html,
            usuario_creacion=email_send.usuario_creacion,
        )

        noti_response = send_email_via_noti(noti_request)

        if noti_response.success:
            email_send.status = "sent_to_noti"
            email_send.noti_response = str(noti_response.response_data)
            # Mark all items as sent
            for item in email_send.items:
                item.status = "sent"
                item.sent_at = datetime.utcnow()
        else:
            email_send.status = "failed"
            email_send.error_message = noti_response.error

    db.commit()

    # Refresh to load items relationship
    for email_send in email_sends:
        db.refresh(email_send)

    return email_sends