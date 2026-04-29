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
