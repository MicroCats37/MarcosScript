"""Check noti payload."""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))
from dotenv import load_dotenv
load_dotenv('backend/.env')

from backend.services.noti_client import NotiSendRequest
from backend.config import noti_config

request = NotiSendRequest(
    to=['alarmasciplima@gmail.com'],
    asunto='Test',
    contenido='<html><body><h1>Test</h1></body></html>',
    html=True,
)

payload = request.to_noti_payload(noti_config.notificante_id)
import json
print("Payload:")
print(json.dumps(payload, indent=2))
