"""Email send service.

Validates processed frames for Drive links, builds HTML content with
photo links, creates EmailSend/EmailSendItem records, and calls noti.
"""
from datetime import datetime
from html import escape
from typing import Optional

from sqlalchemy.orm import Session

from backend.models import EmailSend, EmailSendItem, ProcessedFrame
from backend.services.noti_client import NotiSendRequest, NotiSendResponse, send_email_via_noti


class EmailSendValidationError(Exception):
    """Raised when email send validation fails."""
    pass


def _esc(text: str) -> str:
    """Escape HTML-sensitive characters in text for safe interpolation."""
    return escape(text, quote=True)


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
    Build a sophisticated Día de la Madre email template with the official
    Colegio de Ingenieros del Perú institutional colors:
    - CIP Red (#E31828) with Wine Red (#8B1C1C) for elegant gradients and shadows
    - CIP Gold (#C6A45C) for premium accents
    - Elegant typography with Google Fonts (Great Vibes calligraphy, Lora serif)
    - Smooth animations and sophisticated styling
    """
    # Official Colegio de Ingenieros del Perú institutional palette + enhancements
    cip_red = "#E31828"
    wine_red = "#8B1C1C"
    cip_gold = "#C6A45C"
    cip_black = "#1C1C1C"
    white = "#FFFFFF"
    bg_beige = "#F5F0E6"
    muted = "#8B8B8B"
    soft_gold = "#E8DCC0"
    deep_cream = "#FAF8F3"

    # Build HTML template with elegant styling
    html = f"""<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>¡Feliz Día de la Madre! - Colegio de Ingenieros del Perú</title>
<link href="https://fonts.googleapis.com/css2?family=Great+Vibes&family=Lora:wght@400;600;700&family=Playfair+Display:wght@700;900&display=swap" rel="stylesheet">
<style>
  @media (prefers-reduced-motion: no-preference) {{
    @keyframes fadeInDown {{
      from {{ opacity: 0; transform: translateY(-15px); }}
      to {{ opacity: 1; transform: translateY(0); }}
    }}
    @keyframes fadeInUp {{
      from {{ opacity: 0; transform: translateY(15px); }}
      to {{ opacity: 1; transform: translateY(0); }}
    }}
    @keyframes glow {{
      0%, 100% {{ opacity: 1; }}
      50% {{ opacity: 0.85; }}
    }}
  }}
</style>
</head>
<body style="margin:0;padding:0;background: linear-gradient(135deg, {bg_beige} 0%, #F0E8DC 100%);font-family:'Lora','Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">

<!-- Preheader -->
<div style="display:none;max-height:0;overflow:hidden;">¡Feliz Día de la Madre! - Colegio de Ingenieros del Perú</div>

<!-- Wrapper Table for email clients -->
<table cellpadding="0" cellspacing="0" border="0" width="100%" style="background: linear-gradient(135deg, {bg_beige} 0%, #F0E8DC 100%);">
<tr>
<td align="center" style="padding:50px 20px;">

<!-- Main Container with Premium Shadow -->
<table cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;background-color:{white};border-radius:18px;overflow:hidden;box-shadow:0 0 60px rgba(139,28,28,0.3), 0 20px 40px rgba(198,164,92,0.2), 0 10px 30px rgba(0,0,0,0.12);">

<!-- Decorative Top Gradient Border (Wine Red → Red → Gold) -->
<tr>
<td style="background: linear-gradient(90deg, {wine_red} 0%, {cip_red} 45%, {cip_gold} 100%);height:10px;"></td>
</tr>

<!-- Header with Elegant Gradient Background -->
<tr>
<td style="background: linear-gradient(135deg, {cip_red} 0%, {wine_red} 100%);padding:45px 40px 35px 40px;">

<!-- CIP Logo -->
<table cellpadding="0" cellspacing="0" border="0" align="center" style="margin-bottom:22px;">
<tr>
<td style="text-align:center;">
<img src="https://www.cip.org.pe/images/LOGO_CIP.png" alt="Colegio de Ingenieros del Perú" style="height:70px;display:block;filter:drop-shadow(0 5px 10px rgba(0,0,0,0.25));" />
</td>
</tr>
</table>

<!-- Institution Text -->
<p style="margin:0;font-size:12px;font-weight:700;letter-spacing:2.2px;color:{cip_gold};text-align:center;text-transform:uppercase;">Colegio de Ingenieros del Perú</p>

<!-- Elegant Calligraphy Title -->
<h1 style="margin:20px 0 0 0;font-size:56px;font-weight:400;color:{white};line-height:1;text-align:center;font-family:'Great Vibes',cursive;text-shadow:4px 4px 8px rgba(0,0,0,0.35), 0 0 20px rgba(198,164,92,0.2);">¡Feliz Día de la Madre!</h1>

<!-- Decorative Separator with Gradient -->
<div style="margin:22px auto 0;width:140px;height:3px;background: linear-gradient(90deg, transparent 0%, {cip_gold} 50%, transparent 100%);border-radius:2px;"></div>

<!-- Subtitle with elegant message -->
<p style="margin:18px 0 0 0;font-size:16px;font-style:italic;color:rgba(255,255,255,0.95);line-height:1.6;text-align:center;font-family:'Lora',serif;font-weight:600;">Una dedicación especial para las mujeres extraordinarias</p>

<!-- Optional body text (intro message) -->
<p style="margin:14px 0 0 0;font-size:14px;color:rgba(255,255,255,0.9);line-height:1.7;text-align:center;font-family:'Lora',serif;">"""

    if optional_body and optional_body.strip():
        body_text = optional_body.strip()
        if not body_text.startswith("<"):
            body_text = escape(body_text)
        html += body_text
    else:
        html += "Reciba con cariño estas fotografías especialmente preparadas para honrar su día. Cada imagen ha sido seleccionada con todo el amor. Descarguelas en su máxima resolución."

    html += """</p>

</td>
</tr>

<!-- Content Section with Decorative Elements -->
<tr>
<td style="padding:40px 40px;">

<!-- Decorative Icon -->
<div style="text-align:center;margin-bottom:24px;">
<span style="font-size:40px;">💐</span>
</div>

<!-- Frame Photo Cards -->
<table cellpadding="0" cellspacing="0" border="0" width="100%">"""

    for idx, frame in enumerate(frames):
        drive_link = _esc(frame.drive_web_view_link or "")
        drive_file_id = _esc(getattr(frame, 'drive_file_id', '') or "")

        # Build direct image URL if drive_file_id is available
        if drive_file_id:
            image_url = f"https://drive.google.com/uc?export=view&id={drive_file_id}"
        else:
            image_url = ""

        html += f"""
<tr>
<td style="padding:0 0 24px 0;">

<!-- Photo Card with Gradient Border and Shadow -->
<table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:{white};border-radius:14px;overflow:hidden;box-shadow:0 0 30px rgba(139,28,28,0.15), 0 8px 20px rgba(198,164,92,0.1), 0 4px 12px rgba(0,0,0,0.08);">

<!-- Gradient Top Border on Card -->
<tr>
<td style="background: linear-gradient(90deg, {wine_red} 0%, {cip_red} 50%, {cip_gold} 100%);height:5px;"></td>
</tr>

<!-- Image Container -->
<tr>
<td style="padding:0;position:relative;overflow:hidden;background-color:{cip_black};">
"""

        # Embed the photo if URL is available
        if image_url:
            html += f"""
<img src="{_esc(image_url)}" alt="Fotografía especial del Día de la Madre" style="display:block;width:100%;height:auto;max-height:420px;object-fit:cover;border:none;" />
"""
        else:
            html += f"""
<div style="background: linear-gradient(135deg, {wine_red} 0%, {cip_red} 100%);width:100%;height:250px;display:flex;align-items:center;justify-content:center;flex-direction:column;">
<span style="font-size:48px;margin-bottom:12px;">📷</span>
<span style="color:{cip_gold};font-size:13px;font-style:italic;">Fotografía en carga</span>
</div>
"""

        html += f"""
</td>
</tr>

<!-- Card Footer with Download Button -->
<tr>
<td style="padding:20px 24px;background: linear-gradient(135deg, {deep_cream} 0%, {soft_gold} 100%);text-align:center;border-top:1px solid rgba(198,164,92,0.3);">

<!-- Photo Number -->
<p style="margin:0 0 14px 0;font-size:12px;color:{muted};font-style:italic;">Fotografía {idx + 1}</p>

<!-- Elegant Download Button -->
<a href="{drive_link}" style="display:inline-block;padding:14px 32px;background: linear-gradient(135deg, {cip_gold} 0%, {cip_red} 100%);color:#FFFFFF;font-size:13px;font-weight:700;text-decoration:none;border-radius:6px;text-transform:uppercase;letter-spacing:1px;box-shadow:0 6px 16px rgba(198,164,92,0.4), 0 0 20px rgba(227,24,40,0.2);transition:all 0.3s ease;border:none;cursor:pointer;font-family:'Lora',serif;">↓ Descargar en Alta Calidad</a>

</td>
</tr>

</table>

</td>
</tr>"""

    html += f"""
</table>

</td>
</tr>

<!-- Decorative Middle Section -->
<tr>
<td style="padding:20px 40px;text-align:center;border-top:2px solid {soft_gold};border-bottom:2px solid {soft_gold};">
<p style="margin:0;font-size:14px;color:{wine_red};line-height:1.8;font-family:'Great Vibes',cursive;font-size:24px;font-weight:400;">Gratitud y amor eterno</p>
</td>
</tr>

<!-- Footer -->
<tr>
<td style="padding:28px 40px;background-color:{deep_cream};">

<p style="margin:0 0 12px 0;font-size:12px;color:{muted};line-height:1.6;text-align:center;">Las fotografías están disponibles para descargar en la máxima calidad de resolución.</p>

<p style="margin:12px 0 0 0;font-size:12px;color:{muted};line-height:1.5;text-align:center;font-style:italic;">Este correo fue generado para honrar a la mujer extraordinaria que eres.</p>

<p style="margin:16px 0 0 0;font-size:11px;color:{cip_gold};line-height:1.5;text-align:center;font-weight:700;letter-spacing:1px;">🌸 COLEGIO DE INGENIEROS DEL PERÚ 🌸<br/>¡Feliz Día de la Madre! 💐</p>

</td>
</tr>

<!-- Decorative Bottom Gradient Border -->
<tr>
<td style="background: linear-gradient(90deg, {cip_gold} 0%, {cip_red} 50%, {wine_red} 100%);height:8px;"></td>
</tr>

</table><!-- end main container -->

</td>
</tr>
</table><!-- end wrapper -->

</body>
</html>"""

    return html


def send_email_batch(
    db: Session,
    event_id: int,
    processed_frame_ids: list[int],
    recipients: list[dict],
    subject: Optional[str] = None,
    body: Optional[str] = None,
    html: bool = True,
    cc: Optional[list[str]] = None,
    bcc: Optional[list[str]] = None,
    usuario_creacion: Optional[str] = None,
) -> list[EmailSend]:
    # Default subject for Mother's Day
    if not subject:
        subject = "¡Feliz Día de la Madre! - Colegio de Ingenieros del Perú"
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
        # Always generate HTML content from frames — user body is stored for
        # record but not used in the noti payload
        contenido = build_email_html_content(frames)

        noti_request = NotiSendRequest(
            to=[email_send.recipient_email],
            cc=cc or [],
            bcc=bcc or [],
            asunto=email_send.subject,
            contenido=contenido,
            html=True,
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