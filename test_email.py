"""Test full flow: upload to Drive + send email with link."""
import os
import sys

# Add project root to path
sys.path.insert(0, os.path.dirname(__file__))

from dotenv import load_dotenv
# Load from backend/.env
env_path = os.path.join(os.path.dirname(__file__), 'backend', '.env')
load_dotenv(env_path)

from backend.services.google_drive import upload_file_to_drive
from backend.services.noti_client import send_email_via_noti, NotiSendRequest
from backend.config import drive_config, noti_config

# Image to upload (exists in output folder)
image_path = r"C:\Users\Usuario\Desktop\Aplicaciones\MarcosScript\madreo\Marco_diaz - copia (3)_3d5736559b2d150d16fc88342d2357d1-marcos-de-marco-en-negrita.jpg"

print("=== DRIVE UPLOAD ===")
print(f"Drive configured: {drive_config.is_configured}")
print(f"Drive folder: {drive_config.folder_id}")
print(f"Credentials path: {drive_config.credentials_path}")

if not os.path.isfile(image_path):
    print(f"ERROR: File not found: {image_path}")
    sys.exit(1)

print(f"\nUploading: {os.path.basename(image_path)}")

result = upload_file_to_drive(
    file_path=image_path,
    filename=os.path.basename(image_path),
)

if result.success:
    print(f"SUCCESS: Uploaded!")
    print(f"  File ID: {result.file_id}")
    print(f"  Web View Link: {result.web_view_link}")
else:
    print(f"FAILED: {result.error}")
    sys.exit(1)

print("\n=== EMAIL SEND ===")

# Build email with Drive link
email_body = f"""
<html>
<body>
<h1>Foto procesada - MarcosScript</h1>
<p>Tu foto ha sido procesada exitosamente.</p>
<p>Puedes verla aqui:</p>
<a href="{result.web_view_link}">
<img src="{result.web_view_link}" width="400" style="border:1px solid #ccc; margin:10px;" />
</a>
<p><a href="{result.web_view_link}">Ver foto en Google Drive</a></p>
</body>
</html>
"""

request = NotiSendRequest(
    to=["alarmasciplima@gmail.com"],
    asunto="MarcosScript - Tu foto procesada",
    contenido=email_body,
    html=True,
)

print(f"Sending email with Drive link...")
email_result = send_email_via_noti(request)

if email_result.success:
    print(f"SUCCESS: Email sent!")
else:
    print(f"FAILED: {email_result.error}")

print("\n=== DONE ===")
print(f"Drive link: {result.web_view_link}")
