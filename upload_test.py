"""Manually upload a processed frame to Drive."""
import sys
import os
sys.path.insert(0, '.')
from dotenv import load_dotenv
load_dotenv('C:/Users/Usuario/Desktop/Aplicaciones/MarcosScript/backend/.env')

from backend.services.google_drive import upload_file_to_drive

# Get the output file that was just processed
output_file = r"C:\Users\Usuario\Desktop\Aplicaciones\MarcosScript\madreo\images_3d5736559b2d150d16fc88342d2357d1-marcos-de-marco-en-negrita.jpg"

print(f"File exists: {os.path.isfile(output_file)}")

print("Uploading to Drive...")
result = upload_file_to_drive(
    file_path=output_file,
    filename=os.path.basename(output_file),
)

if result.success:
    print(f"SUCCESS!")
    print(f"  File ID: {result.file_id}")
    print(f"  Link: {result.web_view_link}")
else:
    print(f"FAILED: {result.error}")
