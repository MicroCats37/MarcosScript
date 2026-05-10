"""Verify Drive URL in email."""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from dotenv import load_dotenv
load_dotenv('backend/.env')

import httpx

BASE = "http://localhost:8000"

# Get a frame with Drive link
r = httpx.get(f"{BASE}/events/1/photos", timeout=10, follow_redirects=True)
photos = r.json()

frame_ids = []
for photo in photos:
    for frame in photo.get("processed_frames", []):
        if frame.get("drive_web_view_link"):
            frame_ids.append(frame["id"])
            print(f"Frame {frame['id']}: {frame['output_filename']}")
            print(f"  Drive link: {frame['drive_web_view_link']}")

# Send email with proper HTML body including the links
html_body = """
<html>
<body style="font-family: Arial;">
<h1>Hola!</h1>
<p>Tu foto esta lista:</p>
<a href="https://drive.google.com/file/d/1oCoKK7uORsLBHpNZBmFD44puShHR31tC/view?usp=drivesdk">Ver foto</a>
<br>
<img src="https://drive.google.com/uc?export=view&id=1oCoKK7uORsLBHpNZBmFD44puShHR31tC" width="300" />
</body>
</html>
"""

payload = {
    "processed_frame_ids": frame_ids[:1],
    "recipients": [{"email": "alarmasciplima@gmail.com", "name": "Test"}],
    "subject": "Test - Verifica URL en email",
    "body": html_body,
    "html": True
}

print("\nSending email with HTML body...")
r = httpx.post(f"{BASE}/events/1/email/send", json=payload, timeout=30, follow_redirects=True)
print(f"Status: {r.status_code}")
result = r.json()
print(f"Email status: {result['sends'][0]['status']}")
if result['sends'][0]['status'] == 'failed':
    print(f"Error: {result['sends'][0]['error_message']}")
