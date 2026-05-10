"""Pydantic schemas for request/response validation."""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


# --- Event Schemas ---
class EventCreate(BaseModel):
    """Schema for creating an event."""
    name: str = Field(..., min_length=1, max_length=255)
    source_photos_path: str = Field(..., min_length=1)
    frames_path: str = Field(..., min_length=1)
    output_path: str = Field(..., min_length=1)


class EventUpdate(BaseModel):
    """Schema for updating an event."""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    source_photos_path: Optional[str] = Field(None, min_length=1)
    frames_path: Optional[str] = Field(None, min_length=1)
    output_path: Optional[str] = Field(None, min_length=1)
    is_active: Optional[bool] = None


class EventResponse(BaseModel):
    """Schema for event response."""
    id: int
    name: str
    source_photos_path: str
    frames_path: str
    output_path: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# --- PhotoState Schemas ---
class PhotoStateBase(BaseModel):
    """Base schema for photo state."""
    filename: str
    file_hash: Optional[str] = None
    status: str = "pending"


class PhotoStateCreate(PhotoStateBase):
    """Schema for creating a photo state."""
    event_id: int


class PhotoStateResponse(PhotoStateBase):
    """Schema for photo state response."""
    id: int
    event_id: int
    error_message: Optional[str] = None
    created_at: datetime
    processed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ProcessedFrameResponse(BaseModel):
    """Schema for processed frame response."""
    id: int
    frame_filename: str
    output_filename: str
    processed_at: datetime
    # Drive metadata
    drive_file_id: Optional[str] = None
    drive_web_view_link: Optional[str] = None
    drive_uploaded_at: Optional[datetime] = None
    drive_upload_error: Optional[str] = None

    @property
    def is_sendable(self) -> bool:
        return self.drive_web_view_link is not None

    class Config:
        from_attributes = True


class PhotoWithFramesResponse(PhotoStateResponse):
    """Schema for photo state response with processed frames."""
    processed_frames: list[ProcessedFrameResponse] = []


# --- ProcessedFrame Schemas ---
class ProcessedFrameCreate(BaseModel):
    """Schema for creating a processed frame."""
    photo_state_id: int
    frame_filename: str
    output_filename: str


# --- Process Request ---
class ProcessRequest(BaseModel):
    """Schema for requesting photo processing."""
    photo_ids: list[int] = Field(..., min_length=1)
    frame_filenames: list[str] = Field(..., min_length=1)


class ProcessResult(BaseModel):
    """Schema for a single processing result."""
    photo_id: int
    photo_filename: str
    frame_filename: str
    status: str  # "processed" or "skipped"
    output_filename: Optional[str] = None
    error: Optional[str] = None


class ProcessResponse(BaseModel):
    """Schema for processing response."""
    results: list[ProcessResult]
    total_processed: int
    total_skipped: int


# --- Frame Listing ---
class FrameResponse(BaseModel):
    """Schema for frame file info."""
    filename: str
    path: str


# --- CIP Lookup Schemas ---
class CipLookupResponse(BaseModel):
    """Schema for CIP lookup response."""
    cip: str
    name: Optional[str] = None
    email: Optional[str] = None
    found: bool


# --- Email Send Schemas ---
class RecipientInput(BaseModel):
    """Schema for a single email recipient."""
    cip: Optional[str] = None
    name: Optional[str] = None
    email: str = Field(..., min_length=1)


class EmailSendRequest(BaseModel):
    """Schema for email send request."""
    processed_frame_ids: list[int] = Field(..., min_length=1)
    recipients: list[RecipientInput] = Field(..., min_length=1)
    subject: str = Field(..., min_length=1, max_length=1024)
    body: Optional[str] = None
    html: bool = True
    cc: list[str] = Field(default_factory=list)
    bcc: list[str] = Field(default_factory=list)
    usuario_creacion: Optional[str] = None


class EmailSendItemResponse(BaseModel):
    """Schema for email send item response."""
    id: int
    processed_frame_id: int
    drive_link: str
    status: str
    error_message: Optional[str] = None
    sent_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class EmailSendResponse(BaseModel):
    """Schema for email send response."""
    id: int
    event_id: int
    cip: Optional[str] = None
    recipient_email: str
    recipient_name: Optional[str] = None
    subject: str
    body_template: Optional[str] = None
    html: bool
    status: str
    noti_response: Optional[str] = None
    error_message: Optional[str] = None
    usuario_creacion: Optional[str] = None
    created_at: datetime
    items: list[EmailSendItemResponse] = []

    class Config:
        from_attributes = True


class EmailSendResult(BaseModel):
    """Schema for email send result (one per recipient)."""
    email_send: EmailSendResponse
    items_created: int


class EmailSendBatchResponse(BaseModel):
    """Schema for email send batch response (multiple recipients)."""
    sends: list[EmailSendResponse]


# --- Drive Upload Schemas ---
class DriveUploadResponse(BaseModel):
    """Schema for drive upload response."""
    drive_file_id: Optional[str] = None
    drive_web_view_link: Optional[str] = None
    drive_uploaded_at: Optional[datetime] = None
    drive_upload_error: Optional[str] = None
    success: bool
    message: str
