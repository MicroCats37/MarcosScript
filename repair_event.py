import os
import sqlite3
from backend.services.watcher import get_watcher_service
from backend.database import SessionLocal
from backend.models import Event

def repair_event(event_id: int):
    db = SessionLocal()
    try:
        event = db.query(Event).filter(Event.id == event_id).first()
        if not event:
            print(f"Event {event_id} not found")
            return
        
        print(f"Scanning photos for event: {event.name} (Path: {event.source_photos_path})")
        watcher_service = get_watcher_service()
        # This will trigger the _initial_scan we added
        watcher_service._initial_scan(event.id, event.source_photos_path)
        print("Scan complete! Check your database or UI now.")
    finally:
        db.close()

if __name__ == "__main__":
    # We know your event ID is 1
    repair_event(1)
