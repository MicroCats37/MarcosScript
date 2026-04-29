"""Tests for the watcher.py file monitoring service."""
import os
import tempfile
import time
from unittest.mock import MagicMock, patch

import pytest

from backend.services.watcher import (
    PhotoEventHandler,
    WatcherService,
    get_watcher_service,
)


class TestPhotoEventHandler:
    """Tests for PhotoEventHandler filesystem event handler."""

    def test_is_image_file_accepts_jpg(self):
        """Test that .jpg files are recognized as images."""
        handler = PhotoEventHandler(event_id=1)
        assert handler._is_image_file("/path/to/photo.jpg") is True

    def test_is_image_file_accepts_jpeg(self):
        """Test that .jpeg files are recognized as images."""
        handler = PhotoEventHandler(event_id=1)
        assert handler._is_image_file("/path/to/photo.jpeg") is True

    def test_is_image_file_accepts_png(self):
        """Test that .png files are recognized as images."""
        handler = PhotoEventHandler(event_id=1)
        assert handler._is_image_file("/path/to/photo.png") is True

    def test_is_image_file_accepts_webp(self):
        """Test that .webp files are recognized as images."""
        handler = PhotoEventHandler(event_id=1)
        assert handler._is_image_file("/path/to/photo.webp") is True

    def test_is_image_file_rejects_non_image(self):
        """Test that non-image files are rejected."""
        handler = PhotoEventHandler(event_id=1)
        assert handler._is_image_file("/path/to/document.txt") is False
        assert handler._is_image_file("/path/to/video.mp4") is False
        assert handler._is_image_file("/path/to/script.py") is False

    def test_is_image_file_case_insensitive(self):
        """Test that file extension check is case insensitive."""
        handler = PhotoEventHandler(event_id=1)
        assert handler._is_image_file("/path/to/photo.JPG") is True
        assert handler._is_image_file("/path/to/photo.PNG") is True
        assert handler._is_image_file("/path/to/photo.JpG") is True


class TestWatcherService:
    """Tests for WatcherService managing observers."""

    def test_start_watching_creates_observer(self, temp_image_dir: str):
        """Test that start_watching creates an observer for the event."""
        service = WatcherService()
        result = service.start_watching(event_id=1, photos_path=temp_image_dir)

        assert result is True
        assert service.is_watching(1) is True

        # Cleanup
        service.stop_watching(1)

    def test_start_watching_returns_false_for_invalid_directory(self):
        """Test that start_watching returns False for nonexistent directory."""
        service = WatcherService()
        result = service.start_watching(event_id=999, photos_path="/nonexistent/directory")

        assert result is False
        assert service.is_watching(999) is False

    def test_start_watching_idempotent(self, temp_image_dir: str):
        """Test that starting watch twice for same event is idempotent."""
        service = WatcherService()
        result1 = service.start_watching(event_id=1, photos_path=temp_image_dir)
        result2 = service.start_watching(event_id=1, photos_path=temp_image_dir)

        assert result1 is True
        assert result2 is True  # Should return True, not error
        assert service.is_watching(1) is True

        # Cleanup
        service.stop_watching(1)

    def test_stop_watching_removes_observer(self, temp_image_dir: str):
        """Test that stop_watching removes the observer."""
        service = WatcherService()
        service.start_watching(event_id=1, photos_path=temp_image_dir)

        assert service.is_watching(1) is True

        result = service.stop_watching(1)

        assert result is True
        assert service.is_watching(1) is False

    def test_stop_watching_returns_false_for_nonexistent(self):
        """Test that stopping a non-watched event returns False."""
        service = WatcherService()
        result = service.stop_watching(999)

        assert result is False

    def test_get_active_watchers_returns_correct_list(self, temp_image_dir: str):
        """Test that get_active_watchers returns list of watched event IDs."""
        service = WatcherService()

        assert service.get_active_watchers() == []

        service.start_watching(event_id=1, photos_path=temp_image_dir)
        service.start_watching(event_id=2, photos_path=temp_image_dir)

        assert 1 in service.get_active_watchers()
        assert 2 in service.get_active_watchers()
        assert len(service.get_active_watchers()) == 2

        # Cleanup
        service.stop_watching(1)
        service.stop_watching(2)

    def test_get_active_watchers_after_stop(self, temp_image_dir: str):
        """Test that get_active_watchers reflects stopped watchers."""
        service = WatcherService()
        service.start_watching(event_id=1, photos_path=temp_image_dir)
        service.start_watching(event_id=2, photos_path=temp_image_dir)
        service.stop_watching(1)

        assert 1 not in service.get_active_watchers()
        assert 2 in service.get_active_watchers()


class TestGetWatcherService:
    """Tests for get_watcher_service singleton getter."""

    def test_returns_watcher_service_instance(self):
        """Test that get_watcher_service returns a WatcherService instance."""
        # Reset the global singleton
        import backend.services.watcher as watcher_module
        watcher_module._watcher_service = None

        service = get_watcher_service()
        assert isinstance(service, WatcherService)

    def test_returns_same_instance(self):
        """Test that get_watcher_service returns the same singleton instance."""
        import backend.services.watcher as watcher_module
        watcher_module._watcher_service = None

        service1 = get_watcher_service()
        service2 = get_watcher_service()

        assert service1 is service2
