"""Compare both approaches."""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))
from dotenv import load_dotenv
load_dotenv('backend/.env')

import httpx
from backend.services.noti_client import NotiSendRequest
from backend.config import noti_config

print("=" * 60)
print("COMPARISON")
print("=" * 60)

print(f"\nNoti URL: {noti_config.send_email_url}")
print(f"Notificante ID from config: {noti_config.notificante_id}")

# Test 1: My working script (bare minimum)
print("\n1. MY WORKING SCRIPT (bare minimum)...")
payload1 = {
    "notificanteId": "inscripciones",
    "to": ["alarmasciplima@gmail.com"],
    "cc": [],
    "bcc": [],
    "asunto": "Test",
    "contenido": "<html><body><h1>Test</h1></body></html>",
    "html": True,
    "usuarioCreacion": 1
}
r = httpx.post(noti_config.send_email_url, json=payload1, timeout=10)
print(f"Status: {r.status_code}, Response: {r.text}")

# Test 2: What noti_client sends
print("\n2. WHAT NOTI_CLIENT BUILDS...")
request = NotiSendRequest(
    to=["alarmasciplima@gmail.com"],
    asunto="Test",
    contenido="<html><body><h1>Test</h1></body></html>",
    html=True,
)
payload2 = request.to_noti_payload(noti_config.notificante_id)
import json
print(f"Payload: {json.dumps(payload2, indent=2)}")
r = httpx.post(noti_config.send_email_url, json=payload2, timeout=10)
print(f"Status: {r.status_code}, Response: {r.text}")

# Test 3: With exact same payload as #1 but via noti_client
print("\n3. NOTI_CLIENT WITH SAME VALUES AS #1...")
request3 = NotiSendRequest(
    to=["alarmasciplima@gmail.com"],
    asunto="Test",
    contenido="<html><body><h1>Test</h1></body></html>",
    html=True,
    usuario_creacion="1",  # string like #1
)
payload3 = request3.to_noti_payload(noti_config.notificante_id)
print(f"Payload: {json.dumps(payload3, indent=2)}")
r = httpx.post(noti_config.send_email_url, json=payload3, timeout=10)
print(f"Status: {r.status_code}, Response: {r.text}")

print("\n" + "=" * 60)
