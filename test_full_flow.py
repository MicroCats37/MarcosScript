"""Test full flow with Aplicaciones backend."""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from dotenv import load_dotenv
load_dotenv('backend/.env')

import httpx

BASE_URL = "http://localhost:8000"

print("=" * 60)
print("FULL FLOW TEST - APLICACIONES BACKEND")
print("=" * 60)

# 1. Check events
print("\n1. CHECKING EVENTS...")
r = httpx.get(f"{BASE_URL}/events/", timeout=10, follow_redirects=True)
print(f"Status: {r.status_code}")
events = r.json()
print(f"Events: {events}")
if not events:
    print("No events found!")
    sys.exit(1)

event_id = events[2]['id']  # Use "Dia de la madre" which has photos
print(f"Using event_id: {event_id}")

# 2. Get photos for event
print("\n2. GETTING PHOTOS...")
r = httpx.get(f"{BASE_URL}/events/{event_id}/photos", timeout=10)
photos = r.json()
print(f"Photos: {len(photos)} found")
if not photos:
    print("No photos found!")
    sys.exit(1)

photo_ids = [p['id'] for p in photos[:2]]
print(f"Photo IDs to process: {photo_ids}")

# 3. Get available frames
print("\n3. GETTING FRAMES...")
r = httpx.get(f"{BASE_URL}/events/{event_id}/frames", timeout=10)
frames = r.json()
print(f"Frames: {len(frames)} found")
if not frames:
    print("No frames found!")
    sys.exit(1)

frame_names = [f['filename'] for f in frames[:1]]
print(f"Frames to use: {frame_names}")

# 4. Process photos
print("\n4. PROCESSING PHOTOS...")
process_payload = {
    "photo_ids": photo_ids,
    "frame_filenames": frame_names
}
r = httpx.post(f"{BASE_URL}/events/{event_id}/process", json=process_payload, timeout=30)
print(f"Status: {r.status_code}")
if r.status_code != 200:
    print(f"Error: {r.text}")
    sys.exit(1)

result = r.json()
print(f"Processed: {result['total_processed']}, Skipped: {result['total_skipped']}")

# 5. Get processed frames
print("\n5. GETTING PROCESSED FRAMES...")
r = httpx.get(f"{BASE_URL}/events/{event_id}/photos", timeout=10)
photos = r.json()

all_frame_ids = []
for photo in photos:
    for frame in photo.get('processed_frames', []):
        if frame.get('drive_web_view_link'):
            all_frame_ids.append(frame['id'])
            print(f"  Frame {frame['id']}: {frame['output_filename']}")
            print(f"    Drive link: {frame['drive_web_view_link']}")

if not all_frame_ids:
    print("No processed frames with Drive links!")
    sys.exit(1)

# 6. Send email
print("\n6. SENDING EMAIL...")
email_payload = {
    "processed_frame_ids": all_frame_ids[:2],
    "recipients": [
        {"email": "alarmasciplima@gmail.com", "name": "Usuario Test"}
    ],
    "subject": "MarcosScript - Test Completo",
    "body": "Este es un test del flujo completo",
    "html": True
}
r = httpx.post(f"{BASE_URL}/events/{event_id}/email/send", json=email_payload, timeout=30)
print(f"Status: {r.status_code}")
print(f"Response: {r.text[:500] if r.text else 'empty'}")

print("\n" + "=" * 60)
print("DONE!")
print("=" * 60)
