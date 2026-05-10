"""Tests for email send service and API validation with mocked noti."""
from datetime import datetime
from unittest.mock import patch, MagicMock
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.database import Base
from backend.models import Event, PhotoState as Photo, ProcessedFrame, EmailSend, EmailSendItem
from backend.services.email_send import (
    validate_frames_for_send,
    build_email_html_content,
    send_email_batch,
    EmailSendValidationError,
)


@pytest.fixture
def db_session():
    """In-memory SQLite session for email send tests."""
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def sample_event_session(db_session):
    """Create a sample event, photo, and processed frames."""
    event = Event(
        name="Test Event",
        source_photos_path="/source",
        frames_path="/frames",
        output_path="/output",
        is_active=True,
    )
    db_session.add(event)
    db_session.flush()

    photo = Photo(
        event_id=event.id,
        filename="photo1.jpg",
        status="completed",
    )
    db_session.add(photo)
    db_session.flush()

        # Sendable frame with Drive link
    sendable_frame = ProcessedFrame(
        photo_state_id=photo.id,
        frame_filename="frame1.png",
        output_filename="photo1_frame1.png",
        processed_at=datetime(2024, 1, 1, 0, 0, 0),
        drive_file_id="drive-file-123",
        drive_web_view_link="https://drive.google.com/file/d/drive-file-123/view",
    )
    db_session.add(sendable_frame)

    # Unsnedable frame (no Drive link)
    unsendable_frame = ProcessedFrame(
        photo_state_id=photo.id,
        frame_filename="frame2.png",
        output_filename="photo1_frame2.png",
        processed_at=datetime(2024, 1, 1, 0, 0, 0),
    )
    db_session.add(unsendable_frame)
    db_session.commit()

    return {
        "session": db_session,
        "event": event,
        "photo": photo,
        "sendable_frame": sendable_frame,
        "unsendable_frame": unsendable_frame,
    }


class TestValidateFramesForSend:
    """Tests for validate_frames_for_send."""

    def test_raises_on_missing_frame_ids(self, sample_event_session):
        """Validation raises error when frame IDs don't exist."""
        db = sample_event_session["session"]
        with pytest.raises(EmailSendValidationError, match="not found"):
            validate_frames_for_send(db, [9999])

    def test_raises_on_unsendable_frames(self, sample_event_session):
        """Validation raises error when frames lack Drive links."""
        db = sample_event_session["session"]
        unsendable = sample_event_session["unsendable_frame"]
        with pytest.raises(EmailSendValidationError, match="not sendable"):
            validate_frames_for_send(db, [unsendable.id])

    def test_validates_sendable_frames_success(self, sample_event_session):
        """Validation passes when all frames have Drive links."""
        db = sample_event_session["session"]
        sendable = sample_event_session["sendable_frame"]
        result = validate_frames_for_send(db, [sendable.id])
        assert len(result) == 1
        assert result[0].id == sendable.id


class TestBuildEmailHtmlContent:
    """Tests for build_email_html_content."""

    def test_build_email_html_content_with_frames(self, sample_event_session):
        """HTML builder includes Drive links for each frame."""
        db = sample_event_session["session"]
        sendable = sample_event_session["sendable_frame"]
        # Refresh to ensure relationships are loaded in this session's scope
        sendable_in_session = db.merge(sendable)
        db.refresh(sendable_in_session)

        html = build_email_html_content([sendable_in_session])
        assert sendable_in_session.drive_web_view_link in html
        assert sendable_in_session.output_filename in html

    def test_build_email_html_content_with_custom_body(self, sample_event_session):
        """HTML builder prepends custom body text."""
        db = sample_event_session["session"]
        sendable = sample_event_session["sendable_frame"]
        sendable_in_session = db.merge(sendable)
        db.refresh(sendable_in_session)

        html = build_email_html_content([sendable_in_session], optional_body="Custom intro.")
        assert "Custom intro." in html


class TestSendEmailBatch:
    """Tests for send_email_batch."""

    def test_send_email_batch_creates_records_per_recipient(self, sample_event_session):
        """Batch creates one EmailSend per recipient."""
        db = sample_event_session["session"]
        sendable = sample_event_session["sendable_frame"]
        event = sample_event_session["event"]
        sendable_in_session = db.merge(sendable)
        db.refresh(sendable_in_session)
        event_in_session = db.merge(event)

        with patch('backend.services.email_send.send_email_via_noti') as mock_noti:
            mock_noti.return_value = MagicMock(success=True, response_data={})

            sends = send_email_batch(
                db=db,
                event_id=event_in_session.id,
                processed_frame_ids=[sendable_in_session.id],
                recipients=[
                    {"email": "a@test.com", "name": "A"},
                    {"email": "b@test.com", "name": "B"},
                ],
                subject="Test Subject",
                body="Test body",
            )

        assert len(sends) == 2
        assert sends[0].recipient_email == "a@test.com"
        assert sends[1].recipient_email == "b@test.com"
        # Each should have one item
        assert len(sends[0].items) == 1
        assert len(sends[1].items) == 1

    def test_send_email_batch_marks_failed_on_noti_error(self, sample_event_session):
        """Batch marks EmailSend as failed when noti returns error."""
        db = sample_event_session["session"]
        sendable = sample_event_session["sendable_frame"]
        event = sample_event_session["event"]
        sendable_in_session = db.merge(sendable)
        db.refresh(sendable_in_session)
        event_in_session = db.merge(event)

        with patch('backend.services.email_send.send_email_via_noti') as mock_noti:
            mock_noti.return_value = MagicMock(success=False, error="Noti unavailable")

            sends = send_email_batch(
                db=db,
                event_id=event_in_session.id,
                processed_frame_ids=[sendable_in_session.id],
                recipients=[{"email": "fail@test.com"}],
                subject="Test",
            )

        assert sends[0].status == "failed"
        assert "Noti unavailable" in sends[0].error_message

    def test_send_email_batch_raises_on_unsendable_frame(self, sample_event_session):
        """Batch raises validation error if any frame is not sendable."""
        db = sample_event_session["session"]
        unsendable = sample_event_session["unsendable_frame"]
        event = sample_event_session["event"]
        unsendable_in_session = db.merge(unsendable)
        event_in_session = db.merge(event)

        with pytest.raises(EmailSendValidationError, match="not sendable"):
            send_email_batch(
                db=db,
                event_id=event_in_session.id,
                processed_frame_ids=[unsendable_in_session.id],
                recipients=[{"email": "test@test.com"}],
                subject="Test",
            )
