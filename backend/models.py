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

    # Relationships
    photo_state = relationship("PhotoState", back_populates="processed_frames")

    __table_args__ = (
        UniqueConstraint("photo_state_id", "frame_filename", name="uq_photo_frame"),
    )
