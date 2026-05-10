"""OAuth flow for Google Drive - Get authorization URL only."""
import os
import sys
sys.path.insert(0, os.path.dirname(__file__))

from google_auth_oauthlib.flow import InstalledAppFlow

SCOPES = ['https://www.googleapis.com/auth/drive.file']
CLIENT_SECRETS_FILE = r"C:\Users\Usuario\Desktop\Aplicaciones\MarcosScript\client_secret_890408621654-7nv66s4f60106l7obt5vn7gdbnk79s5h.apps.googleusercontent.com.json"

def main():
    flow = InstalledAppFlow.from_client_secrets_file(CLIENT_SECRETS_FILE, scopes=SCOPES)
    auth_url, _ = flow.authorization_url(prompt='consent', access_type='offline')

    print("=" * 60)
    print("FOLLOW THESE STEPS:")
    print("=" * 60)
    print(f"\n1. Open this URL in your browser:\n")
    print(f"   {auth_url}")
    print(f"\n2. Sign in with alarmasciplima@gmail.com")
    print(f"3. Click 'Allow' to authorize access")
    print(f"4. You will be redirected to localhost (error page - this is normal)")
    print(f"5. Copy the FULL URL from the browser address bar")
    print(f"\n6. Paste it here when prompted")
    print("=" * 60)

if __name__ == "__main__":
    main()
