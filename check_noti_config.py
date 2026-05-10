"""Check noti config at runtime."""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from dotenv import load_dotenv
load_dotenv('backend/.env')

from backend.config import noti_config

print("=" * 50)
print("NOTI CONFIG CHECK")
print("=" * 50)
print(f"base_url: {noti_config.base_url}")
print(f"send_email_url: {noti_config.send_email_url}")
print(f"notificante_id: {noti_config.notificante_id}")
print(f"is_configured: {noti_config.is_configured}")
print(f"timeout_seconds: {noti_config.timeout_seconds}")
print("=" * 50)
