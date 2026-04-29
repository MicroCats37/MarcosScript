"""Watchdog-based file system monitoring service for photo directories."""
import os
import threading
from typing import Dict, Optional

from watchdog.events import FileSystemEventHandler, FileSystemEvent
from watchdog.observers import Observer

from backend.database import SessionLocal
from backend.models import Event, PhotoState


class PhotoEventHandler(FileSystemEventHandler):
    """Handler for new photo files discovered in monitored directories."""

    def __init__(self, event_id: int):
        super().__init__()
        self.event_id = event_id

    def on_created(self, event: FileSystemEvent):
        """Called when a file or directory is created."""
        if event.is_directory:
            return

        # Only process image files
        if not self._is_image_file(event.src_path):
            return

        self._add_photo_state(event.src_path)

    def on_modified(self, event: FileSystemEvent):
        """Called when a file is modified."""
        if event.is_directory:
            return

        if not self._is_image_file(event.src_path):
            return

        # Check if already exists, if not add it
        self._add_photo_state(event.src_path)

    def _is_image_file(self, path: str) -> bool:
        """Check if the file is a supported image type."""
        ext = os.path.splitext(path)[1].lower()
        return ext in (".jpg", ".jpeg", ".png", ".webp")

    def _add_photo_state(self, filepath: str):
        """Add a PhotoState entry for the discovered file."""
        db = SessionLocal()
        try:
            filename = os.path.basename(filepath)

            # Check if already exists for this event
            existing = db.query(PhotoState).filter(
                PhotoState.event_id == self.event_id,
                PhotoState.filename == filename,
            ).first()

            if not existing:
                photo_state = PhotoState(
                    event_id=self.event_id,
                    filename=filename,
                    status="pending",
                )
                db.add(photo_state)
                db.commit()
                
                # Signal: New photo discovered
                from backend.services.websocket_manager import manager
                manager.broadcast_sync(self.event_id, {"type": "photo_added"})
        except Exception as e:
            print(f"Error adding photo state for {filepath}: {e}")
            db.rollback()
        finally:
            db.close()


class FrameEventHandler(FileSystemEventHandler):
    """Handler for new frame files discovered in frames directories."""

    def __init__(self, event_id: int):
        super().__init__()
        self.event_id = event_id

    def on_created(self, event: FileSystemEvent):
        if event.is_directory: return
        if self._is_image_file(event.src_path):
            self._signal_refresh()

    def on_modified(self, event: FileSystemEvent):
        if event.is_directory: return
        if self._is_image_file(event.src_path):
            self._signal_refresh()

    def _is_image_file(self, path: str) -> bool:
        ext = os.path.splitext(path)[1].lower()
        return ext in (".jpg", ".jpeg", ".png", ".webp")

    def _signal_refresh(self):
        from backend.services.websocket_manager import manager
        manager.broadcast_sync(self.event_id, {"type": "frame_added"})


class WatcherService:
    """Service to manage watchdog observers for event directories."""

    def __init__(self):
        self._observers: Dict[int, Observer] = {}
        self._handlers: Dict[int, Dict[str, FileSystemEventHandler]] = {}

    def start_watching(self, event_id: int, photos_path: str, frames_path: str = None) -> bool:
        """
        Start monitoring directories for new photos and frames.
        """
        if event_id in self._observers:
            return True

        observer = Observer()
        self._handlers[event_id] = {}

        try:
            # 1. Setup Photos Watcher
            if os.path.isdir(photos_path):
                self._initial_scan(event_id, photos_path)
                photo_handler = PhotoEventHandler(event_id=event_id)
                observer.schedule(photo_handler, photos_path, recursive=False)
                self._handlers[event_id]["photos"] = photo_handler

            # 2. Setup Frames Watcher (Optional)
            if frames_path and os.path.isdir(frames_path):
                frame_handler = FrameEventHandler(event_id=event_id)
                observer.schedule(frame_handler, frames_path, recursive=False)
                self._handlers[event_id]["frames"] = frame_handler

            observer.start()
            self._observers[event_id] = observer
            
            from backend.services.websocket_manager import manager
            manager.broadcast_sync(event_id, {"type": "watcher_status", "is_watching": True})

            return True
        except Exception as e:
            print(f"Error starting watcher for event {event_id}: {e}")
            return False

    def _initial_scan(self, event_id: int, photos_path: str):
        """Scan directory for existing images and add them to the database."""
        handler = PhotoEventHandler(event_id=event_id)
        try:
            for filename in os.listdir(photos_path):
                filepath = os.path.join(photos_path, filename)
                if os.path.isfile(filepath) and handler._is_image_file(filepath):
                    handler._add_photo_state(filepath)
        except Exception as e:
            print(f"Error during initial scan of {photos_path}: {e}")

    def stop_watching(self, event_id: int) -> bool:
        """Stop monitoring for a specific event."""
        if event_id not in self._observers:
            return False

        try:
            observer = self._observers.pop(event_id)
            observer.stop()
            observer.join(timeout=5)
            self._handlers.pop(event_id, None)

            from backend.services.websocket_manager import manager
            manager.broadcast_sync(event_id, {"type": "watcher_status", "is_watching": False})

            return True
        except Exception as e:
            print(f"Error stopping watcher for event {event_id}: {e}")
            return False

    def is_watching(self, event_id: int) -> bool:
        """Check if an event is currently being watched."""
        return event_id in self._observers

    def get_active_watchers(self) -> list[int]:
        """Return list of event IDs currently being watched."""
        return list(self._observers.keys())


# Global singleton instance
_watcher_service: Optional[WatcherService] = None


def get_watcher_service() -> WatcherService:
    """Get the global WatcherService singleton."""
    global _watcher_service
    if _watcher_service is None:
        _watcher_service = WatcherService()
    return _watcher_service


def resume_all_watchers():
    """Restart all watchers for events marked as active in the database."""
    from backend.database import SessionLocal
    from backend.models import Event
    
    db = SessionLocal()
    try:
        active_events = db.query(Event).filter(Event.is_active == True).all()
        watcher_service = get_watcher_service()
        for event in active_events:
            print(f"Resuming watcher for event: {event.name} (ID: {event.id})")
            watcher_service.start_watching(
                event.id, 
                event.source_photos_path, 
                event.frames_path
            )
    except Exception as e:
        print(f"Error resuming watchers: {e}")
    finally:
        db.close()