"""Tests for noti email service client with mocked httpx."""
from unittest.mock import patch, MagicMock
import pytest
from backend.services.noti_client import (
    NotiSendRequest,
    NotiSendResponse,
    send_email_via_noti,
    NotiSendError,
)


class TestNotiClient:
    """Tests for noti_client module."""

    def test_send_email_not_configured(self):
        """Noti send returns failure when service not configured."""
        with patch('backend.services.noti_client.noti_config') as mock_cfg:
            mock_cfg.is_configured = False
            result = send_email_via_noti(
                NotiSendRequest(
                    to=["test@example.com"],
                    asunto="Test",
                    contenido="Body",
                )
            )
            assert result.success is False
            assert "not configured" in result.error

    def test_send_email_success(self):
        """Noti send returns success on 200 response."""
        with patch('backend.services.noti_client.noti_config') as mock_cfg:
            mock_cfg.is_configured = True
            mock_cfg.send_email_url = "http://noti.example.com/sender/send-email"
            mock_cfg.notificante_id = "notif-001"
            mock_cfg.timeout_seconds = 30

            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.text = '{"message":"ok"}'
            mock_response.json.return_value = {"message": "ok"}

            with patch('backend.services.noti_client.httpx.post', return_value=mock_response) as mock_post:
                result = send_email_via_noti(
                    NotiSendRequest(
                        to=["a@test.com", "b@test.com"],
                        cc=["cc@test.com"],
                        asunto="Subject",
                        contenido="Content",
                        html=True,
                        usuario_creacion="admin",
                    )
                )

            assert result.success is True
            assert result.response_data == {"message": "ok"}

            # Verify payload
            call_args = mock_post.call_args
            payload = call_args.kwargs["json"]
            assert payload["notificanteId"] == "notif-001"
            assert payload["to"] == ["a@test.com", "b@test.com"]
            assert payload["cc"] == ["cc@test.com"]
            assert payload["asunto"] == "Subject"

    def test_send_email_http_error(self):
        """Noti send returns failure on non-200 status."""
        with patch('backend.services.noti_client.noti_config') as mock_cfg:
            mock_cfg.is_configured = True
            mock_cfg.send_email_url = "http://noti.example.com/sender/send-email"
            mock_cfg.notificante_id = "notif-001"
            mock_cfg.timeout_seconds = 30

            mock_response = MagicMock()
            mock_response.status_code = 500
            mock_response.text = "Internal Server Error"

            with patch('backend.services.noti_client.httpx.post', return_value=mock_response):
                result = send_email_via_noti(
                    NotiSendRequest(to=["test@example.com"], asunto="S", contenido="B")
                )

            assert result.success is False
            assert "500" in result.error

    def test_send_email_network_error(self):
        """Noti send returns failure on network error."""
        with patch('backend.services.noti_client.noti_config') as mock_cfg:
            mock_cfg.is_configured = True
            mock_cfg.send_email_url = "http://noti.example.com/sender/send-email"
            mock_cfg.notificante_id = "notif-001"
            mock_cfg.timeout_seconds = 30

            import httpx
            with patch('backend.services.noti_client.httpx.post', side_effect=httpx.RequestError("Connection refused")):
                result = send_email_via_noti(
                    NotiSendRequest(to=["test@example.com"], asunto="S", contenido="B")
                )

            assert result.success is False
            assert "unavailable" in result.error

    def test_noti_request_payload_includes_all_fields(self):
        """NotiSendRequest.to_noti_payload() builds correct payload."""
        request = NotiSendRequest(
            to=["a@test.com"],
            cc=["cc@test.com"],
            bcc=["bcc@test.com"],
            asunto="Subject",
            contenido="Body content",
            html=False,
            usuario_creacion="user1",
        )
        with patch('backend.services.noti_client.noti_config') as mock_cfg:
            mock_cfg.notificante_id = "default-notif"
            payload = request.to_noti_payload("custom-notif")
            assert payload["notificanteId"] == "custom-notif"
            assert payload["to"] == ["a@test.com"]
            assert payload["cc"] == ["cc@test.com"]
            assert payload["bcc"] == ["bcc@test.com"]
            assert payload["asunto"] == "Subject"
            assert payload["contenido"] == "Body content"
            assert payload["html"] is False
            assert payload["usuarioCreacion"] == "user1"
