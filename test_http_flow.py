"""Full flow test via HTTP - using user's backend."""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from dotenv import load_dotenv
load_dotenv('backend/.env')

import httpx

BASE = "http://localhost:8000"

print("=" * 60)
print("FULL FLOW TEST VIA HTTP")
print("=" * 60)

# 1. Get events
print("\n1. GET EVENTS...")
r = httpx.get(f"{BASE}/events/", timeout=10, follow_redirects=True)
print(f"Status: {r.status_code}")
events = r.json()
print(f"Found {len(events)} events")

# Use event 1 (Dia de la madre)
event_id = 1
print(f"Using event_id: {event_id}")

# 2. Get photos
print("\n2. GET PHOTOS...")
r = httpx.get(f"{BASE}/events/{event_id}/photos", timeout=10, follow_redirects=True)
photos = r.json()
print(f"Found {len(photos)} photos")

# Pick 2 photos
photo_ids = [p['id'] for p in photos[:2]]
print(f"Photo IDs: {photo_ids}")

# 3. Get frames
print("\n3. GET FRAMES...")
r = httpx.get(f"{BASE}/events/{event_id}/frames", timeout=10, follow_redirects=True)
frames = r.json()
print(f"Found {len(frames)} frames")

frame_name = frames[0]['filename']
print(f"Using frame: {frame_name}")

# 4. Process photos
print("\n4. PROCESS PHOTOS...")
payload = {
    "photo_ids": photo_ids,
    "frame_filenames": [frame_name]
}
r = httpx.post(f"{BASE}/events/{event_id}/process", json=payload, timeout=60, follow_redirects=True)
print(f"Status: {r.status_code}")
result = r.json()
print(f"Processed: {result['total_processed']}, Skipped: {result['total_skipped']}")

# 5. Get photos again and check Drive links
print("\n5. CHECK DRIVE LINKS...")
r = httpx.get(f"{BASE}/events/{event_id}/photos", timeout=10, follow_redirects=True)
photos = r.json()

frame_ids_with_links = []
for photo in photos:
    for frame in photo.get('processed_frames', []):
        link = frame.get('drive_web_view_link')
        if link:
            frame_ids_with_links.append(frame['id'])
            print(f"  Frame {frame['id']}: {frame['output_filename']}")
            print(f"    Link: {link}")

print(f"\nFrames with Drive links: {len(frame_ids_with_links)}")

if not frame_ids_with_links:
    print("NO FRAMES WITH DRIVE LINKS!")
    sys.exit(1)

# 6. Send email
print("\n6. SEND EMAIL...")
email_payload = {
    "processed_frame_ids": frame_ids_with_links[:2],
    "recipients": [
        {"email": "alarmasciplima@gmail.com", "name": "Usuario Test"}
    ],
    "subject": "MarcosScript - Tus fotos listas",
    "body": "Aqui tienes tus fotos procesadas",
    "html": True
}
r = httpx.post(f"{BASE}/events/{event_id}/email/send", json=email_payload, timeout=30, follow_redirects=True)
print(f"Status: {r.status_code}")
print(f"Response: {r.text[:800] if r.text else 'empty'}")

print("\n" + "=" * 60)
print("DONE!")
print("=" * 60)
