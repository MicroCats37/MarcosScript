"""Server-side configuration from environment variables.

All secrets and external service URLs are read here and must NOT be exposed
in API responses or frontend-accessible endpoints.
"""
import os
from dataclasses import dataclass


def _get_env(key: str, default: str = "") -> str:
    """Get environment variable, returning empty string if not set."""
    return os.environ.get(key, default)


@dataclass
class DriveConfig:
    """Google Drive configuration."""
    credentials_path: str = _get_env("GOOGLE_DRIVE_CREDENTIALS_PATH")
    folder_id: str = _get_env("GOOGLE_DRIVE_FOLDER_ID")
    link_permission: str = _get_env("DRIVE_LINK_PERMISSION", "reader")

    @property
    def is_configured(self) -> bool:
        return bool(self.credentials_path and self.folder_id)


@dataclass
class CipConfig:
    """CIP lookup service configuration."""
    service_url: str = _get_env("CIP_SERVICE_URL", "http://172.16.93.83:9001/api/v1/colegiado/")
    auth_header: str = _get_env("CIP_AUTH_HEADER")
    auth_token: str = _get_env("CIP_AUTH_TOKEN")

    @property
    def is_configured(self) -> bool:
        return bool(self.service_url)


@dataclass
class NotiConfig:
    """Noti email service configuration."""
    base_url: str = _get_env("URL_SERVICIOS_NOTI", "http://localhost:9000")
    notificante_id: str = _get_env("NOTI_NOTIFICANTE_ID", "MarcosScript")
    timeout_seconds: int = int(_get_env("NOTI_TIMEOUT_SECONDS", "30"))

    @property
    def is_configured(self) -> bool:
        return bool(self.base_url)

    @property
    def send_email_url(self) -> str:
        return f"{self.base_url.rstrip('/')}/sender/send-email"


@dataclass
class AppConfig:
    """Application-level defaults."""
    default_usuario_creacion: str = _get_env("DEFAULT_USUARIO_CREACION", "MarcosScript_Backend")


# Singleton config instances
drive_config = DriveConfig()
cip_config = CipConfig()
noti_config = NotiConfig()
app_config = AppConfig()