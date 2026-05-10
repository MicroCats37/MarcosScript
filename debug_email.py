"""Debug email send via endpoint."""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from dotenv import load_dotenv
load_dotenv('backend/.env')

import httpx
import json

BASE = "http://localhost:8000"

# Get a frame with Drive link
r = httpx.get(f"{BASE}/events/1/photos", timeout=10, follow_redirects=True)
photos = r.json()

frame_ids = []
for photo in photos:
    for frame in photo.get('processed_frames', []):
        if frame.get('drive_web_view_link'):
            frame_ids.append(frame['id'])

print(f"Frame IDs with links: {frame_ids}")

if not frame_ids:
    print("No frames with links")
    sys.exit(1)

# Send email via endpoint
payload = {
    "processed_frame_ids": frame_ids[:1],
    "recipients": [
        {"email": "alarmasciplima@gmail.com", "name": "Usuario Test"}
    ],
    "subject": "Test debug",
    "body": "Aqui tienes tus fotos",
    "html": True
}

print(f"\nSending with payload:")
print(json.dumps(payload, indent=2))

r = httpx.post(f"{BASE}/events/1/email/send", json=payload, timeout=30, follow_redirects=True)
print(f"\nStatus: {r.status_code}")

# Also test the raw noti call with HTML content
print("\n" + "="*50)
print("Direct noti call with HTML content:")

from backend.services.noti_client import NotiSendRequest
from backend.config import noti_config

contenido_html = f"<p>Aqui tienes tus fotos</p>\n<ul><li><a href='https://drive.google.com/file/d/1oCoKK7uORsLBHpNZBmFD44puShHR31tC/view'>Ver foto</a></li></ul>"

request = NotiSendRequest(
    to=["alarmasciplima@gmail.com"],
    asunto="Test debug",
    contenido=contenido_html,
    html=True,
)

from backend.services.noti_client import send_email_via_noti
result = send_email_via_noti(request)
print(f"Noti result success: {result.success}")
print(f"Noti result error: {result.error}")
