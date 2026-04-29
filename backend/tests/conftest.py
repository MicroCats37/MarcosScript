"""Pytest configuration and fixtures for backend tests."""
import os
import tempfile
from typing import Generator

import pytest
from PIL import Image
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
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


def override_get_db() -> Generator[Session, None, None]:
    """Override get_db dependency for testing."""
    db = TestSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(scope="function")
def db_session() -> Generator[Session, None, None]:
    """Create a fresh database session for each test."""
    # Create tables
    Base.metadata.create_all(bind=test_engine)

    session = TestSessionLocal()
    try:
        yield session
    finally:
        session.close()
        # Drop all tables after test
        Base.metadata.drop_all(bind=test_engine)


@pytest.fixture
def temp_image_dir() -> Generator[str, None, None]:
    """Create a temporary directory with dummy images for testing."""
    with tempfile.TemporaryDirectory() as tmpdir:
        yield tmpdir


@pytest.fixture
def dummy_source_image(temp_image_dir: str) -> str:
    """Create a dummy source JPG image and return its path."""
    img_path = os.path.join(temp_image_dir, "source.jpg")
    img = Image.new("RGB", (100, 100), color="red")
    img.save(img_path, format="JPEG")
    return img_path


@pytest.fixture
def dummy_frame_png(temp_image_dir: str) -> str:
    """Create a dummy frame PNG image and return its path."""
    img_path = os.path.join(temp_image_dir, "frame.png")
    img = Image.new("RGBA", (100, 100), color=(0, 255, 0, 128))
    img.save(img_path, format="PNG")
    return img_path


@pytest.fixture
def dummy_frame_with_alpha(temp_image_dir: str) -> str:
    """Create a dummy frame PNG with transparency gradient and return its path."""
    img_path = os.path.join(temp_image_dir, "frame_alpha.png")
    img = Image.new("RGBA", (100, 100), color=(0, 0, 255, 64))
    img.save(img_path, format="PNG")
    return img_path
