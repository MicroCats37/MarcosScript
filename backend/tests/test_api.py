"""API integration tests for the FastAPI endpoints."""
import os
import tempfile
from datetime import datetime
from unittest.mock import patch

import pytest
from PIL import Image
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.database import Base, get_db
from backend.main import app


# Create in-memory SQLite database for testing
TEST_DATABASE_URL = "sqlite:///:memory:"

test_engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


def override_get_db():
    """Override get_db dependency for testing."""
    db = TestSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(scope="module")
def client():
    """Create a test client with fresh database for each test module."""
    Base.metadata.create_all(bind=test_engine)
    yield TestClient(app)
    Base.metadata.drop_all(bind=test_engine)


@pytest.fixture
def temp_event_dirs():
    """Create temporary directories for event source, frames, and output."""
    with tempfile.TemporaryDirectory() as tmpdir:
        source_dir = os.path.join(tmpdir, "source_photos")
        frames_dir = os.path.join(tmpdir, "frames")
        output_dir = os.path.join(tmpdir, "output")
        os.makedirs(source_dir)
        os.makedirs(frames_dir)
        os.makedirs(output_dir)

        # Create a dummy frame image
        frame_path = os.path.join(frames_dir, "frame1.png")
        img = Image.new("RGBA", (100, 100), color=(255, 0, 0, 128))
        img.save(frame_path, format="PNG")

        yield {
            "source": source_dir,
            "frames": frames_dir,
            "output": output_dir,
        }


@pytest.fixture
def sample_event(client: TestClient, temp_event_dirs: dict) -> dict:
    """Create a sample event and return its data."""
    event_data = {
        "name": "Test Event",
        "source_photos_path": temp_event_dirs["source"],
        "frames_path": temp_event_dirs["frames"],
        "output_path": temp_event_dirs["output"],
    }
    response = client.post("/events/", json=event_data)
    assert response.status_code == 201
    return response.json()


class TestEventsEndpoints:
    """Tests for /events endpoints."""

    def test_list_events_empty(self, client: TestClient):
        """Test listing events when none exist."""
        response = client.get("/events/")
        assert response.status_code == 200
        assert response.json() == []

    def test_create_event(self, client: TestClient, temp_event_dirs: dict):
        """Test creating a new event."""
        event_data = {
            "name": "My Event",
            "source_photos_path": temp_event_dirs["source"],
            "frames_path": temp_event_dirs["frames"],
            "output_path": temp_event_dirs["output"],
        }
        response = client.post("/events/", json=event_data)
        assert response.status_code == 201

        data = response.json()
        assert data["name"] == "My Event"
        assert data["source_photos_path"] == temp_event_dirs["source"]
        assert data["is_active"] is True
        assert "id" in data

    def test_get_event(self, client: TestClient, sample_event: dict):
        """Test getting a single event by ID."""
        response = client.get(f"/events/{sample_event['id']}")
        assert response.status_code == 200
        assert response.json()["id"] == sample_event["id"]

    def test_get_nonexistent_event(self, client: TestClient):
        """Test getting an event that doesn't exist returns 404."""
        response = client.get("/events/99999")
        assert response.status_code == 404

    def test_update_event(self, client: TestClient, sample_event: dict):
        """Test updating an event."""
        update_data = {"name": "Updated Event Name"}
        response = client.put(f"/events/{sample_event['id']}", json=update_data)
        assert response.status_code == 200
        assert response.json()["name"] == "Updated Event Name"

    def test_delete_event(self, client: TestClient, sample_event: dict):
        """Test deleting an event."""
        response = client.delete(f"/events/{sample_event['id']}")
        assert response.status_code == 204

        # Verify it's gone
        response = client.get(f"/events/{sample_event['id']}")
        assert response.status_code == 404

    def test_list_events_after_create(self, client: TestClient, sample_event: dict):
        """Test listing events includes the created event."""
        response = client.get("/events/")
        assert response.status_code == 200
        events = response.json()
        assert len(events) >= 1
        assert any(e["id"] == sample_event["id"] for e in events)


class TestPhotosEndpoints:
    """Tests for /events/{id}/photos endpoints."""

    def test_list_photos_empty(self, client: TestClient, sample_event: dict):
        """Test listing photos when none exist for an event."""
        response = client.get(f"/events/{sample_event['id']}/photos")
        assert response.status_code == 200
        assert response.json() == []

    def test_list_photos_nonexistent_event(self, client: TestClient):
        """Test listing photos for nonexistent event returns 404."""
        response = client.get("/events/99999/photos")
        assert response.status_code == 404


class TestFramesEndpoints:
    """Tests for /events/{id}/frames endpoints."""

    def test_list_frames(self, client: TestClient, sample_event: dict):
        """Test listing frames for an event."""
        response = client.get(f"/events/{sample_event['id']}/frames")
        assert response.status_code == 200
        frames = response.json()
        assert len(frames) >= 1
        assert any(f["filename"] == "frame1.png" for f in frames)

    def test_list_frames_nonexistent_event(self, client: TestClient):
        """Test listing frames for nonexistent event returns 404."""
        response = client.get("/events/99999/frames")
        assert response.status_code == 404


class TestWatcherEndpoints:
    """Tests for /events/{id}/watcher endpoints."""

    def test_watcher_start(self, client: TestClient, sample_event: dict):
        """Test starting watcher for an event."""
        response = client.post(f"/events/{sample_event['id']}/watcher/start")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "watching"
        assert data["event_id"] == sample_event["id"]

    def test_watcher_stop(self, client: TestClient, sample_event: dict):
        """Test stopping watcher for an event."""
        # Start first
        client.post(f"/events/{sample_event['id']}/watcher/start")

        # Then stop
        response = client.post(f"/events/{sample_event['id']}/watcher/stop")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "stopped"
        assert data["event_id"] == sample_event["id"]

    def test_watcher_status(self, client: TestClient, sample_event: dict):
        """Test getting watcher status for an event."""
        # Start watcher first
        client.post(f"/events/{sample_event['id']}/watcher/start")

        response = client.get(f"/events/{sample_event['id']}/watcher/status")
        assert response.status_code == 200
        data = response.json()
        assert data["event_id"] == sample_event["id"]
        assert data["is_watching"] is True

        # Stop for cleanup
        client.post(f"/events/{sample_event['id']}/watcher/stop")

    def test_watcher_status_inactive(self, client: TestClient, sample_event: dict):
        """Test watcher status when not watching."""
        # Stop watcher first since it starts automatically now
        client.post(f"/events/{sample_event['id']}/watcher/stop")

        response = client.get(f"/events/{sample_event['id']}/watcher/status")
        assert response.status_code == 200
        data = response.json()
        assert data["is_watching"] is False

    def test_watcher_start_nonexistent_event(self, client: TestClient):
        """Test starting watcher for nonexistent event returns 404."""
        response = client.post("/events/99999/watcher/start")
        assert response.status_code == 404


class TestHealthEndpoints:
    """Tests for health and root endpoints."""

    def test_root_endpoint(self, client: TestClient):
        """Test root endpoint returns status."""
        response = client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"

    def test_health_endpoint(self, client: TestClient):
        """Test health check endpoint."""
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
