"""Full flow test - directly without HTTP."""
import sys
import os
sys.path.insert(0, '.')
from dotenv import load_dotenv
load_dotenv('C:/Users/Usuario/Desktop/Aplicaciones/MarcosScript/backend/.env')

import sqlite3
from datetime import datetime

# Import backend modules
from backend.database import SessionLocal
from backend.models import Event, PhotoState, ProcessedFrame
from backend.services.processor import process_photo_with_frames
from backend.services.google_drive import upload_file_to_drive
from backend.services.noti_client import send_email_via_noti, NotiSendRequest
from backend.config import noti_config

print("=" * 60)
print("FULL FLOW TEST - DIRECT")
print("=" * 60)

db = SessionLocal()

try:
    # 1. Get event
    print("\n1. GETTING EVENT...")
    event = db.query(Event).filter(Event.id == 1).first()
    if not event:
        print("No event found!")
        sys.exit(1)
    print(f"Event: {event.name}")

    # 2. Get photos
    print("\n2. GETTING PHOTOS...")
    photos = db.query(PhotoState).filter(PhotoState.event_id == 1).order_by(PhotoState.id.desc()).limit(2).all()
    if not photos:
        print("No photos found!")
        sys.exit(1)
    photo_ids = [p.id for p in photos]
    print(f"Photo IDs: {photo_ids}")

    # 3. Get frames
    print("\n3. GETTING FRAMES...")
    frame_path = os.path.join(event.frames_path, "3d5736559b2d150d16fc88342d2357d1-marcos-de-marco-en-negrita.webp")
    if not os.path.isfile(frame_path):
        print(f"Frame not found: {frame_path}")
        sys.exit(1)
    print(f"Frame path: {frame_path}")

    # 4. Process photos
    print("\n4. PROCESSING PHOTOS...")
    for photo in photos:
        source_path = os.path.join(event.source_photos_path, photo.filename)
        if not os.path.isfile(source_path):
            print(f"Source not found: {source_path}")
            continue

        results = process_photo_with_frames(
            source_path=source_path,
            frame_paths=[frame_path],
            output_dir=event.output_path,
            output_prefix="",
            opacity=1.0,
        )

        for r in results:
            if r["success"]:
                # Check if already exists
                existing = db.query(ProcessedFrame).filter(
                    ProcessedFrame.photo_state_id == photo.id,
                    ProcessedFrame.frame_filename == os.path.basename(frame_path),
                ).first()

                if not existing:
                    pf = ProcessedFrame(
                        photo_state_id=photo.id,
                        frame_filename=os.path.basename(frame_path),
                        output_filename=r["output_filename"],
                    )
                    db.add(pf)
                    db.flush()

                    # Upload to Drive
                    file_to_upload = os.path.join(event.output_path, r["output_filename"])
                    print(f"  Uploading to Drive: {r['output_filename']}")
                    drive_result = upload_file_to_drive(
                        file_path=file_to_upload,
                        filename=r["output_filename"],
                    )

                    if drive_result.success:
                        pf.drive_file_id = drive_result.file_id
                        pf.drive_web_view_link = drive_result.web_view_link
                        pf.drive_uploaded_at = datetime.utcnow()
                        print(f"    SUCCESS! Link: {drive_result.web_view_link}")
                    else:
                        pf.drive_upload_error = drive_result.error
                        print(f"    FAILED: {drive_result.error}")

    db.commit()

    # 5. Get processed frames with Drive links
    print("\n5. GETTING PROCESSED FRAMES WITH DRIVE LINKS...")
    frames = db.query(ProcessedFrame).filter(
        ProcessedFrame.drive_web_view_link.isnot(None)
    ).all()

    frame_ids = []
    for f in frames:
        print(f"  Frame {f.id}: {f.output_filename}")
        print(f"    Link: {f.drive_web_view_link}")
        frame_ids.append(f.id)

    if not frame_ids:
        print("No frames with Drive links!")
        sys.exit(1)

    # 6. Send email
    print("\n6. SENDING EMAIL...")
    frame_to_send = db.query(ProcessedFrame).filter(ProcessedFrame.id == frame_ids[0]).first()
    print(f"Noti URL: {noti_config.send_email_url}")
    print(f"Noti configured: {noti_config.is_configured}")

    email_body = f"""
    <html><body>
    <h1>Tu foto procesada!</h1>
    <p>Aqui esta tu foto:</p>
    <img src="{frame_to_send.drive_web_view_link}" width="400" />
    <br><br>
    <a href="{frame_to_send.drive_web_view_link}">Ver en Google Drive</a>
    </body></html>
    """

    request = NotiSendRequest(
        to=["alarmasciplima@gmail.com"],
        asunto="MarcosScript - Tu foto lista",
        contenido=email_body,
        html=True,
    )

    result = send_email_via_noti(request)
    if result.success:
        print("EMAIL SENT!")
    else:
        print(f"EMAIL FAILED: {result.error}")

    print("\n" + "=" * 60)
    print("DONE!")
    print("=" * 60)

finally:
    db.close()
