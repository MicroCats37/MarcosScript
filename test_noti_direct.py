"""Debug noti payload directly."""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from dotenv import load_dotenv
load_dotenv('backend/.env')

import httpx
import json
from backend.services.noti_client import NotiSendRequest
from backend.config import noti_config

print(f"Noti URL: {noti_config.send_email_url}")
print(f"Notificante ID: {noti_config.notificante_id}")

# Test with simple HTML that worked before
payload1 = {
    "notificanteId": "inscripciones",
    "to": ["alarmasciplima@gmail.com"],
    "cc": [],
    "bcc": [],
    "asunto": "Test 1",
    "contenido": "<html><body><h1>Test</h1></body></html>",
    "html": True,
    "usuarioCreacion": 1
}
r1 = httpx.post(noti_config.send_email_url, json=payload1, timeout=10)
print(f"\nTest 1 (simple HTML): {r1.status_code}")

# Test with link
payload2 = {
    "notificanteId": "inscripciones",
    "to": ["alarmasciplima@gmail.com"],
    "cc": [],
    "bcc": [],
    "asunto": "Test 2",
    "contenido": "<p>Click <a href='https://drive.google.com/file/d/1oCoKK7uORsLBHpNZBmFD44puShHR31tC/view'>here</a></p>",
    "html": True,
    "usuarioCreacion": 1
}
r2 = httpx.post(noti_config.send_email_url, json=payload2, timeout=10)
print(f"Test 2 (HTML with link): {r2.status_code}")

# Test via noti_client with the same content as email_send would build
content = build_email_html = "<p>Aqui tienes tus fotos</p>\n<ul><li><a href=\"https://drive.google.com/file/d/1oCoKK7uORsLBHpNZBmFD44puShHR31tC/view\">images.jpg</a></li></ul>"
request = NotiSendRequest(
    to=["alarmasciplima@gmail.com"],
    asunto="Test 3",
    contenido=content,
    html=True,
)
payload3 = request.to_noti_payload(noti_config.notificante_id)
print(f"\nTest 3 payload:")
print(json.dumps(payload3, indent=2))
r3 = httpx.post(noti_config.send_email_url, json=payload3, timeout=10)
print(f"Test 3 (via client): {r3.status_code} - {r3.text}")
