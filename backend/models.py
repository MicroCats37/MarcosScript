"""SQLAlchemy ORM models for MarcosScript."""
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import relationship

from backend.database import Base


class Event(Base):
    """Event model representing a photo processing event."""

    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    source_photos_path = Column(Text, nullable=False)
    frames_path = Column(Text, nullable=False)
    output_path = Column(Text, nullable=False)
    is_active = Column(Integer, default=0, nullable=False)  # SQLite doesn't have bool
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    photos = relationship("PhotoState", back_populates="event", cascade="all, delete-orphan")


class PhotoState(Base):
    """PhotoState model tracking discovered source photos."""

    __tablename__ = "photo_states"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id", ondelete="CASCADE"), nullable=False)
    filename = Column(String(512), nullable=False)
    file_hash = Column(String(64), nullable=True)  # SHA256 hex digest
    status = Column(String(32), default="pending", nullable=False)  # pending|processing|completed|error
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    processed_at = Column(DateTime, nullable=True)

    # Relationships
    event = relationship("Event", back_populates="photos")
    processed_frames = relationship("ProcessedFrame", back_populates="photo_state", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("event_id", "filename", name="uq_event_photo_filename"),
    )


class ProcessedFrame(Base):
    """ProcessedFrame model tracking which frames have been applied to which photos."""

    __tablename__ = "processed_frames"

    id = Column(Integer, primary_key=True, index=True)
    photo_state_id = Column(Integer, ForeignKey("photo_states.id", ondelete="CASCADE"), nullable=False)
    frame_filename = Column(String(512), nullable=False)
    output_filename = Column(String(512), nullable=False)
    processed_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Drive upload metadata
    drive_file_id = Column(String(255), nullable=True)
    drive_web_view_link = Column(String(1024), nullable=True)
    drive_uploaded_at = Column(DateTime, nullable=True)
    drive_upload_error = Column(Text, nullable=True)

    # Relationships
    photo_state = relationship("PhotoState", back_populates="processed_frames")

    __table_args__ = (
        UniqueConstraint("photo_state_id", "frame_filename", name="uq_photo_frame"),
    )


class EmailSend(Base):
    """EmailSend model tracking batch send attempts to a single recipient."""

    __tablename__ = "email_sends"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id", ondelete="CASCADE"), nullable=False)
    cip = Column(String(64), nullable=True)
    recipient_email = Column(String(512), nullable=False)
    recipient_name = Column(String(512), nullable=True)
    subject = Column(String(1024), nullable=False)
    body_template = Column(Text, nullable=True)
    html = Column(Integer, default=1, nullable=False)  # 1=html, 0=plain
    status = Column(String(32), default="pending", nullable=False)  # pending|sent_to_noti|failed
    noti_response = Column(Text, nullable=True)
    error_message = Column(Text, nullable=True)
    usuario_creacion = Column(String(128), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    event = relationship("Event")
    items = relationship("EmailSendItem", back_populates="email_send", cascade="all, delete-orphan")


class EmailSendItem(Base):
    """EmailSendItem model tracking individual photo links sent in an EmailSend."""

    __tablename__ = "email_send_items"

    id = Column(Integer, primary_key=True, index=True)
    email_send_id = Column(Integer, ForeignKey("email_sends.id", ondelete="CASCADE"), nullable=False)
    processed_frame_id = Column(Integer, ForeignKey("processed_frames.id", ondelete="CASCADE"), nullable=False)
    drive_link = Column(String(1024), nullable=False)
    status = Column(String(32), default="pending", nullable=False)  # pending|sent|failed
    error_message = Column(Text, nullable=True)
    sent_at = Column(DateTime, nullable=True)

    # Relationships
    email_send = relationship("EmailSend", back_populates="items")
    processed_frame = relationship("ProcessedFrame")
