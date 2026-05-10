"""Google Drive upload service.

Uploads processed files to Google Drive with configurable credentials
and folder. Sets reader (anyone-with-link) permission by default.

Supports both:
- Service Account credentials (for Shared Drives)
- OAuth user credentials (for personal Drive)
"""
import os
import json
from dataclasses import dataclass
from typing import Optional

from backend.config import drive_config

# Lazy import for google-api-python-client (installed separately)
_drive_client = None


def _get_oauth_credentials():
    """Get OAuth2 credentials from drive_credentials.json."""
    from google.oauth2.credentials import Credentials
    from google.auth.transport.requests import Request

    creds_path = drive_config.credentials_path
    if not os.path.exists(creds_path):
        return None

    with open(creds_path, 'r') as f:
        data = json.load(f)

    # Check if it's OAuth credentials (have refresh_token)
    if 'refresh_token' in data:
        creds = Credentials(
            token=data.get('token'),
            refresh_token=data.get('refresh_token'),
            token_uri=data.get('token_uri', 'https://oauth2.googleapis.com/token'),
            client_id=data.get('client_id'),
            client_secret=data.get('client_secret'),
            scopes=data.get('scopes')
        )
        # Refresh if needed
        if creds.expired:
            creds.refresh(Request())
        return creds

    return None


def _get_drive_client():
    """Lazily import and return Google Drive client."""
    global _drive_client
    if _drive_client is None:
        try:
            from googleapiclient.discovery import build
        except ImportError:
            raise RuntimeError(
                "google-api-python-client is required for Drive upload. "
                "Install with: pip install google-api-python-client"
            )

        # Try OAuth first (user credentials for personal Drive)
        creds = _get_oauth_credentials()
        if creds:
            _drive_client = build("drive", "v3", credentials=creds)
            return _drive_client

        # Fall back to service account (for Shared Drives)
        from google.oauth2 import service_account
        creds = service_account.Credentials.from_service_account_file(
            drive_config.credentials_path,
            scopes=["https://www.googleapis.com/auth/drive.file"],
        )
        _drive_client = build("drive", "v3", credentials=creds)

    return _drive_client


@dataclass
class DriveUploadResult:
    """Result of a Drive upload attempt."""
    success: bool
    file_id: Optional[str] = None
    web_view_link: Optional[str] = None
    error: Optional[str] = None


def upload_file_to_drive(
    file_path: str,
    filename: str,
    folder_id: Optional[str] = None,
) -> DriveUploadResult:
    """
    Upload a file to Google Drive and set it to reader (anyone-with-link).

    Args:
        file_path: Absolute path to the local file.
        filename: Name to give the file in Drive.
        folder_id: Optional Drive folder ID. Uses config default if not provided.

    Returns:
        DriveUploadResult with file metadata or error.
    """
    if not drive_config.is_configured:
        return DriveUploadResult(
            success=False,
            error="Drive not configured. Set GOOGLE_DRIVE_CREDENTIALS_PATH and GOOGLE_DRIVE_FOLDER_ID.",
        )

    if not os.path.isfile(file_path):
        return DriveUploadResult(success=False, error=f"File not found: {file_path}")

    target_folder = folder_id or drive_config.folder_id

    try:
        client = _get_drive_client()

        # Build file metadata
        file_metadata = {
            "name": filename,
            "parents": [target_folder] if target_folder else [],
        }

        # Upload file
        import mimetypes
        mime_type = mimetypes.guess_type(file_path)[0] or "application/octet-stream"

        from googleapiclient.http import MediaFileUpload
        media = MediaFileUpload(file_path, mimetype=mime_type, resumable=True)

        uploaded_file = client.files().create(
            body=file_metadata,
            media_body=media,
            fields="id, webViewLink",
        ).execute()

        file_id = uploaded_file.get("id")
        web_view_link = uploaded_file.get("webViewLink")

        # Set permission to reader (anyone with link can view)
        if drive_config.link_permission == "reader" and file_id:
            permission = {
                "type": "anyone",
                "role": "reader",
            }
            client.permissions().create(
                fileId=file_id,
                body=permission,
            ).execute()

        return DriveUploadResult(
            success=True,
            file_id=file_id,
            web_view_link=web_view_link,
        )

    except Exception as e:
        return DriveUploadResult(success=False, error=str(e))
