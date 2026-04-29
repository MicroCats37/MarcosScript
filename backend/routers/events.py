"""Router for event management endpoints."""
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import Event
from backend.schemas import EventCreate, EventResponse, EventUpdate
from backend.services.watcher import get_watcher_service

router = APIRouter(prefix="/events", tags=["events"])


@router.get("/", response_model=List[EventResponse])
def list_events(db: Session = Depends(get_db)):
    """List all events ordered by creation date descending."""
    events = db.query(Event).order_by(Event.created_at.desc()).all()
    return events


@router.get("/{event_id}", response_model=EventResponse)
def get_event(event_id: int, db: Session = Depends(get_db)):
    """Get a single event by ID."""
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    return event


@router.post("/", response_model=EventResponse, status_code=status.HTTP_201_CREATED)
def create_event(event_data: EventCreate, db: Session = Depends(get_db)):
    """Create a new event."""
    event = Event(
        name=event_data.name,
        source_photos_path=event_data.source_photos_path,
        frames_path=event_data.frames_path,
        output_path=event_data.output_path,
    )
    db.add(event)
    db.commit()
    db.refresh(event)

    # Automatically start the watcher for the new event
    watcher_service = get_watcher_service()
    if watcher_service.start_watching(event.id, event.source_photos_path):
        event.is_active = 1  # Using 1 for True as per SQLite model convention
        db.commit()
        db.refresh(event)

    return event


@router.put("/{event_id}", response_model=EventResponse)
def update_event(event_id: int, event_data: EventUpdate, db: Session = Depends(get_db)):
    """Update an existing event."""
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    update_data = event_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(event, field, value)

    db.commit()
    db.refresh(event)
    return event


@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_event(event_id: int, db: Session = Depends(get_db)):
    """Delete an event and all associated photos/frames."""
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    db.delete(event)
    db.commit()
    return None