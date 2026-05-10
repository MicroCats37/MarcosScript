"""Test env loading from backend dir."""
from dotenv import load_dotenv
from pathlib import Path
import os

# Change to backend directory where .env is
os.chdir(Path(__file__).parent / "backend")

_env_path = Path(".env")
print(f'.env path: {_env_path.absolute()}')
print(f'.env exists: {_env_path.exists()}')

load_dotenv(_env_path)
print(f"URL_SERVICIOS_NOTI: {os.environ.get('URL_SERVICIOS_NOTI', 'NOT SET')}")
print(f"NOTI_NOTIFICANTE_ID: {os.environ.get('NOTI_NOTIFICANTE_ID', 'NOT SET')}")
