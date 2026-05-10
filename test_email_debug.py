"""Debug - check exact payload sent via endpoint."""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from dotenv import load_dotenv
load_dotenv('backend/.env')

import httpx
import json

BASE = "http://localhost:8000"

# Check the frame we have
r = httpx.get(f"{BASE}/events/1/photos", timeout=10, follow_redirects=True)
photos = r.json()

frame_ids = []
for photo in photos:
    for frame in photo.get('processed_frames', []):
        if frame.get('drive_web_view_link'):
            frame_ids.append(frame['id'])

print(f"Frame IDs with links: {frame_ids}")

# Send email via endpoint - body NOT HTML
payload = {
    "processed_frame_ids": frame_ids[:1],
    "recipients": [{"email": "alarmasciplima@gmail.com", "name": "Test"}],
    "subject": "Test",
    "body": "plain text body",
    "html": True
}

print(f"\nPayload sent to endpoint:")
print(json.dumps(payload, indent=2))

r = httpx.post(f"{BASE}/events/1/email/send", json=payload, timeout=30, follow_redirects=True)
print(f"\nResponse status: {r.status_code}")

# Now test with proper HTML body
payload2 = {
    "processed_frame_ids": frame_ids[:1],
    "recipients": [{"email": "alarmasciplima@gmail.com", "name": "Test"}],
    "subject": "Test HTML",
    "body": "<p>HTML body</p>",
    "html": True
}

print(f"\nPayload 2 (HTML body):")
print(json.dumps(payload2, indent=2))

r = httpx.post(f"{BASE}/events/1/email/send", json=payload2, timeout=30, follow_redirects=True)
print(f"\nResponse status: {r.status_code}")
