"""Update processed frames with Drive link and send email."""
import sys
import os
sys.path.insert(0, '.')
from dotenv import load_dotenv
load_dotenv('C:/Users/Usuario/Desktop/Aplicaciones/MarcosScript/backend/.env')

import sqlite3
import httpx
from datetime import datetime

conn = sqlite3.connect('backend/db/marcosscript.db')
cursor = conn.cursor()

# Get frame ID 14 (just processed) and update it
frame_id = 14
drive_file_id = "1oCoKK7uORsLBHpNZBmFD44puShHR31tC"
drive_link = "https://drive.google.com/file/d/1oCoKK7uORsLBHpNZBmFD44puShHR31tC/view?usp=drivesdk"

cursor.execute('''
    UPDATE processed_frames
    SET drive_file_id = ?, drive_web_view_link = ?, drive_uploaded_at = ?, drive_upload_error = NULL
    WHERE id = ?
''', (drive_file_id, drive_link, datetime.utcnow().isoformat(), frame_id))
conn.commit()
print(f"Updated frame {frame_id} with Drive link")

# Now test email send
print("\nSENDING EMAIL...")
email_payload = {
    "processed_frame_ids": [14],
    "recipients": [
        {"email": "alarmasciplima@gmail.com", "name": "Usuario Test"}
    ],
    "subject": "MarcosScript - Foto lista",
    "body": "Aqui tienes tu foto procesada",
    "html": True
}

r = httpx.post("http://localhost:8000/events/1/email/send", json=email_payload, timeout=30)
print(f"Email status: {r.status_code}")
print(f"Response: {r.text[:500] if r.text else 'empty'}")

conn.close()
