"""Router for watcher management endpoints."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import Event
from backend.services.watcher import get_watcher_service

router = APIRouter(prefix="/events", tags=["watcher"])


@router.post("/{event_id}/watcher/start")
def start_watcher(event_id: int, db: Session = Depends(get_db)):
    """Start the watchdog service for an event's photo directory."""
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    watcher_service = get_watcher_service()
    success = watcher_service.start_watching(
        event_id, 
        event.source_photos_path, 
        event.frames_path
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to start watcher. Directory may not exist: {event.source_photos_path}",
        )

    # Update event's is_active state
    event.is_active = True
    db.commit()

    return {"status": "watching", "event_id": event_id, "path": event.source_photos_path}


@router.post("/{event_id}/watcher/stop")
def stop_watcher(event_id: int, db: Session = Depends(get_db)):
    """Stop the watchdog service for an event."""
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    watcher_service = get_watcher_service()
    success = watcher_service.stop_watching(event_id)

    # Update event's is_active state regardless of watcher stop result
    event.is_active = False
    db.commit()

    return {"status": "stopped", "event_id": event_id}


@router.get("/{event_id}/watcher/status")
def watcher_status(event_id: int, db: Session = Depends(get_db)):
    """Get the current watcher status for an event."""
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    watcher_service = get_watcher_service()
    is_watching = watcher_service.is_watching(event_id)

    return {"event_id": event_id, "is_watching": is_watching, "is_active": event.is_active}
