"""Noti email service client.

Sends email via the internal noti microservice using the standard
noti payload format:ificanteId, to, cc, bcc, asunto, contenido, html, usuarioCreacion.
"""
from dataclasses import dataclass
from typing import Optional

import httpx

from backend.config import noti_config


class NotiSendError(Exception):
    """Raised when noti email send fails."""
    pass


@dataclass
class NotiSendRequest:
    """Payload for noti email send."""
    to: list[str]
    asunto: str
    contenido: str
    cc: list[str] = None
    bcc: list[str] = None
    html: bool = True
    usuario_creacion: Optional[str] = None

    def to_noti_payload(self, notificante_id: str) -> dict:
        """Convert to noti API payload format."""
        # usuarioCreacion should be an integer, default to 1 if not provided
        usuario_creacion = self.usuario_creacion
        if usuario_creacion is None:
            usuario_creacion = 1
        elif isinstance(usuario_creacion, str):
            usuario_creacion = int(usuario_creacion) if usuario_creacion.isdigit() else 1

        return {
            "notificanteId": notificante_id,
            "to": self.to,
            "cc": self.cc or [],
            "bcc": self.bcc or [],
            "asunto": self.asunto,
            "contenido": self.contenido,
            "html": self.html,
            "usuarioCreacion": usuario_creacion,
        }


@dataclass
class NotiSendResponse:
    """Response from noti email send."""
    success: bool
    response_data: Optional[dict] = None
    error: Optional[str] = None


def send_email_via_noti(request: NotiSendRequest) -> NotiSendResponse:
    """
    Send an email via the noti service.

    Args:
        request: NotiSendRequest with email details.

    Returns:
        NotiSendResponse with result.

    Raises:
        NotiSendError: When noti service is unavailable or returns an error.
    """
    if not noti_config.is_configured:
        return NotiSendResponse(
            success=False,
            error="Noti service not configured. Set URL_SERVICIOS_NOTI.",
        )

    try:
        payload = request.to_noti_payload(noti_config.notificante_id)

        response = httpx.post(
            noti_config.send_email_url,
            json=payload,
            timeout=float(noti_config.timeout_seconds),
        )

        if response.status_code >= 400:
            return NotiSendResponse(
                success=False,
                error=f"Noti returned status {response.status_code}: {response.text[:200]}",
            )

        return NotiSendResponse(
            success=True,
            response_data=response.json() if response.text else {},
        )

    except httpx.RequestError as e:
        return NotiSendResponse(
            success=False,
            error=f"Noti service unavailable: {e}",
        )