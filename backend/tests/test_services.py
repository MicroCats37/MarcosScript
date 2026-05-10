"""Tests for CIP lookup service with mocked httpx."""
from unittest.mock import patch, MagicMock
import pytest
from backend.services.cip_client import (
    lookup_cip,
    CipPerson,
    CipLookupError,
    CipNotFoundError,
)


class TestCipLookupService:
    """Tests for cip_client module."""

    def test_lookup_cip_not_configured(self):
        """CIP lookup raises error when service is not configured."""
        with patch('backend.services.cip_client.cip_config') as mock_cfg:
            mock_cfg.is_configured = False
            with pytest.raises(CipLookupError, match="CIP service not configured"):
                lookup_cip("12345")

    def test_lookup_cip_success_personal_email(self):
        """CIP lookup returns normalized data with personal email priority."""
        with patch('backend.services.cip_client.cip_config') as mock_cfg:
            mock_cfg.is_configured = True
            mock_cfg.service_url = "http://cip.example.com"
            mock_cfg.auth_header = None
            mock_cfg.auth_token = None

            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.json.return_value = {
                "cip": "12345",
                "correoPers": "personal@test.com",
                "correoInst": "institutional@test.com",
                "nombre": "Juan Perez",
            }
            mock_response.raise_for_status = MagicMock()

            with patch('backend.services.cip_client.httpx.get', return_value=mock_response) as mock_get:
                result = lookup_cip("12345")

            assert result.cip == "12345"
            assert result.email == "personal@test.com"
            assert result.name == "Juan Perez"

    def test_lookup_cip_falls_back_to_institutional(self):
        """CIP lookup falls back to institutional email when personal not present."""
        with patch('backend.services.cip_client.cip_config') as mock_cfg:
            mock_cfg.is_configured = True
            mock_cfg.service_url = "http://cip.example.com"
            mock_cfg.auth_header = None
            mock_cfg.auth_token = None

            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.json.return_value = {
                "cip": "99999",
                "correoInst": "inst@test.com",
                "nombre": "Maria Lopez",
            }
            mock_response.raise_for_status = MagicMock()

            with patch('backend.services.cip_client.httpx.get', return_value=mock_response) as mock_get:
                result = lookup_cip("99999")

            assert result.email == "inst@test.com"
            assert result.name == "Maria Lopez"

    def test_lookup_cip_not_found(self):
        """CIP lookup raises CipNotFoundError on 404."""
        with patch('backend.services.cip_client.cip_config') as mock_cfg:
            mock_cfg.is_configured = True
            mock_cfg.service_url = "http://cip.example.com"
            mock_cfg.auth_header = None
            mock_cfg.auth_token = None

            error = MagicMock()
            error.response.status_code = 404

            with patch('backend.services.cip_client.httpx.get', side_effect=[
                MagicMock(status_code=404),
            ]):
                with pytest.raises(CipNotFoundError, match="CIP not found: 54321"):
                    lookup_cip("54321")

    def test_lookup_cip_service_unavailable(self):
        """CIP lookup raises CipLookupError on network error."""
        with patch('backend.services.cip_client.cip_config') as mock_cfg:
            mock_cfg.is_configured = True
            mock_cfg.service_url = "http://cip.example.com"
            mock_cfg.auth_header = None
            mock_cfg.auth_token = None

            import httpx
            with patch('backend.services.cip_client.httpx.get', side_effect=httpx.RequestError("Connection refused")):
                with pytest.raises(CipLookupError, match="CIP service unavailable"):
                    lookup_cip("12345")

    def test_lookup_cip_with_auth_headers(self):
        """CIP lookup passes configured auth headers."""
        with patch('backend.services.cip_client.cip_config') as mock_cfg:
            mock_cfg.is_configured = True
            mock_cfg.service_url = "http://cip.example.com"
            mock_cfg.auth_header = "Authorization"
            mock_cfg.auth_token = "Bearer token123"

            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.json.return_value = {"cip": "12345", "correoPers": "test@test.com"}
            mock_response.raise_for_status = MagicMock()

            with patch('backend.services.cip_client.httpx.get') as mock_get:
                mock_get.return_value = mock_response
                lookup_cip("12345")

                mock_get.assert_called_once()
                call_kwargs = mock_get.call_args.kwargs
                assert call_kwargs["headers"]["Authorization"] == "Bearer token123"
