"""Router for photo and frame listing endpoints, plus photo processing."""
import os
from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import Event, PhotoState, ProcessedFrame
from backend.schemas import (
    DriveUploadResponse,
    FrameResponse,
    PhotoWithFramesResponse,
    ProcessRequest,
    ProcessResponse,
    ProcessResult,
)
from backend.services.processor import process_photo_with_frames
from backend.services import google_drive
from backend.config import drive_config

router = APIRouter(prefix="/events", tags=["photos"])


def _attempt_drive_upload(processed_frame: ProcessedFrame, output_dir: str) -> None:
    """
    Attempt to upload a processed frame to Google Drive.
    Updates the ProcessedFrame with Drive metadata or error.
    This is non-blocking - failures are logged but don't stop processing.
    """
    if not drive_config.is_configured:
        return  # Drive not configured, skip silently

    file_path = os.path.join(output_dir, processed_frame.output_filename)
    if not os.path.isfile(file_path):
        processed_frame.drive_upload_error = f"Output file not found: {file_path}"
        return

    result = google_drive.upload_file_to_drive(
        file_path=file_path,
        filename=processed_frame.output_filename,
    )

    if result.success:
        from datetime import datetime
        processed_frame.drive_file_id = result.file_id
        processed_frame.drive_web_view_link = result.web_view_link
        processed_frame.drive_uploaded_at = datetime.utcnow()
        processed_frame.drive_upload_error = None
    else:
        processed_frame.drive_upload_error = result.error


@router.get("/{event_id}/photos", response_model=List[PhotoWithFramesResponse])
def list_photos(event_id: int, db: Session = Depends(get_db)):
    """List all photos for an event with their processed frames."""
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    photos = db.query(PhotoState).filter(PhotoState.event_id == event_id)\
        .order_by(PhotoState.created_at.desc()).all()
    return photos


@router.get("/{event_id}/frames", response_model=List[FrameResponse])
def list_frames(event_id: int, db: Session = Depends(get_db)):
    """List all available frame files in an event's frames directory."""
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    frames_path = event.frames_path
    if not os.path.isdir(frames_path):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Frames directory does not exist: {frames_path}",
        )

    frames = []
    for filename in os.listdir(frames_path):
        if filename.lower().endswith((".png", ".jpg", ".jpeg", ".webp")):
            frames.append(FrameResponse(
                filename=filename,
                path=os.path.join(frames_path, filename),
            ))

    return frames


@router.post("/{event_id}/process", response_model=ProcessResponse)
def process_photos(event_id: int, request: ProcessRequest, db: Session = Depends(get_db)):
    """
    Process selected photos with selected frames.

    Args:
        event_id: ID of the event.
        request: ProcessRequest with photo_ids and frame_filenames.

    Returns:
        ProcessResponse with results for each photo/frame combination.
    """
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    # Validate photo_ids exist for this event
    photos = db.query(PhotoState).filter(
        PhotoState.event_id == event_id,
        PhotoState.id.in_(request.photo_ids),
    ).all()

    if len(photos) != len(request.photo_ids):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Some photo IDs were not found for this event",
        )

    results: list[ProcessResult] = []
    total_processed = 0
    total_skipped = 0

    # Build full frame paths
    frame_paths = []
    for frame_filename in request.frame_filenames:
        frame_path = os.path.join(event.frames_path, frame_filename)
        if not os.path.isfile(frame_path):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Frame not found: {frame_filename}",
            )
        frame_paths.append(frame_path)

    for photo in photos:
        source_path = os.path.join(event.source_photos_path, photo.filename)
        if not os.path.isfile(source_path):
            results.append(ProcessResult(
                photo_id=photo.id,
                photo_filename=photo.filename,
                frame_filename="",
                status="error",
                error=f"Source photo not found: {source_path}",
            ))
            continue

        # Process the photo with all selected frames
        process_results = process_photo_with_frames(
            source_path=source_path,
            frame_paths=frame_paths,
            output_dir=event.output_path,
            output_prefix="",
            opacity=1.0,
        )

        for process_result in process_results:
            frame_filename = process_result["frame_filename"]
            output_filename = process_result["output_filename"]
            success = process_result["success"]

            # Check if already processed (skip duplicate)
            existing = db.query(ProcessedFrame).filter(
                ProcessedFrame.photo_state_id == photo.id,
                ProcessedFrame.frame_filename == frame_filename,
            ).first()

            if existing:
                results.append(ProcessResult(
                    photo_id=photo.id,
                    photo_filename=photo.filename,
                    frame_filename=frame_filename,
                    status="skipped",
                    output_filename=existing.output_filename,
                ))
                total_skipped += 1
            elif success:
                # Record the processed frame
                processed_frame = ProcessedFrame(
                    photo_state_id=photo.id,
                    frame_filename=frame_filename,
                    output_filename=output_filename,
                )
                db.add(processed_frame)
                db.flush()  # Get ID for Drive upload

                # Attempt Drive upload (non-blocking - continue even if it fails)
                _attempt_drive_upload(processed_frame, event.output_path)

                # Update photo status to completed
                photo.status = "completed"
                photo.processed_at = datetime.utcnow()

                results.append(ProcessResult(
                    photo_id=photo.id,
                    photo_filename=photo.filename,
                    frame_filename=frame_filename,
                    status="processed",
                    output_filename=output_filename,
                ))
                total_processed += 1
            else:
                results.append(ProcessResult(
                    photo_id=photo.id,
                    photo_filename=photo.filename,
                    frame_filename=frame_filename,
                    status="error",
                    error="Processing failed",
                ))

    db.commit()

    # Signal: Photos updated with processed frames
    from backend.services.websocket_manager import manager
    manager.broadcast_sync(event_id, {"type": "photo_updated"})

    return ProcessResponse(
        results=results,
        total_processed=total_processed,
        total_skipped=total_skipped,
    )


@router.post("/processed-frames/{frame_id}/drive-upload", response_model=DriveUploadResponse)
def retry_drive_upload(frame_id: int, db: Session = Depends(get_db)):
    """
    Retry Drive upload for a processed frame.

    Useful when previous upload failed or Drive wasn't configured during processing.
    """
    frame = db.query(ProcessedFrame).filter(ProcessedFrame.id == frame_id).first()
    if not frame:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Processed frame not found")

    # Get the photo state to find event output path
    photo_state = db.query(PhotoState).filter(PhotoState.id == frame.photo_state_id).first()
    if not photo_state:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Photo state not found")

    event = db.query(Event).filter(Event.id == photo_state.event_id).first()
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    # Attempt upload
    file_path = os.path.join(event.output_path, frame.output_filename)
    if not os.path.isfile(file_path):
        return DriveUploadResponse(
            success=False,
            message=f"Output file not found: {file_path}",
            drive_upload_error=f"File not found: {file_path}",
        )

    result = google_drive.upload_file_to_drive(
        file_path=file_path,
        filename=frame.output_filename,
    )

    # Update frame with result
    from datetime import datetime
    if result.success:
        frame.drive_file_id = result.file_id
        frame.drive_web_view_link = result.web_view_link
        frame.drive_uploaded_at = datetime.utcnow()
        frame.drive_upload_error = None
        db.commit()
        return DriveUploadResponse(
            success=True,
            message="Upload successful",
            drive_file_id=result.file_id,
            drive_web_view_link=result.web_view_link,
            drive_uploaded_at=frame.drive_uploaded_at,
        )
    else:
        frame.drive_upload_error = result.error
        db.commit()
        return DriveUploadResponse(
            success=False,
            message=f"Upload failed: {result.error}",
            drive_upload_error=result.error,
        )