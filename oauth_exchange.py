"""Exchange authorization code for tokens - save properly."""
import os
import sys
sys.path.insert(0, os.path.dirname(__file__))

SCOPES = ['https://www.googleapis.com/auth/drive.file']
CLIENT_SECRETS_FILE = r"C:\Users\Usuario\Desktop\Aplicaciones\MarcosScript\client_secret_890408621654-7nv66s4f60106l7obt5vn7gdbnk79s5h.apps.googleusercontent.com.json"

CODE = "4/0AeoWuM9L3icTo-xlvoIgrHQNOPjoNgK5hYt5i9bZoiY-VcoxI2ysQatqQ6qk_qhauJeYtw"

def main():
    print("Exchanging code for tokens...")

    import json
    import requests

    with open(CLIENT_SECRETS_FILE, 'r') as f:
        secrets = json.load(f)

    client_id = secrets['installed']['client_id']
    client_secret = secrets['installed']['client_secret']

    token_request_body = {
        'code': CODE,
        'client_id': client_id,
        'client_secret': client_secret,
        'redirect_uri': 'http://localhost',
        'grant_type': 'authorization_code',
    }

    response = requests.post('https://oauth2.googleapis.com/token', data=token_request_body)

    if response.status_code != 200:
        print(f"Error: {response.status_code} - {response.text}")
        return

    credentials = response.json()
    print(f"\nSUCCESS!")
    print(f"Access token: {credentials.get('access_token', 'N/A')[:50]}...")
    print(f"Refresh token: {credentials.get('refresh_token', 'N/A')}")

    # Save to backend/drive_credentials.json (absolute path)
    creds_path = r"C:\Users\Usuario\Desktop\Aplicaciones\MarcosScript\backend\drive_credentials.json"
    os.makedirs(os.path.dirname(creds_path), exist_ok=True)

    with open(creds_path, 'w') as f:
        json.dump({
            'token': credentials.get('access_token'),
            'refresh_token': credentials.get('refresh_token'),
            'token_uri': 'https://oauth2.googleapis.com/token',
            'client_id': client_id,
            'client_secret': client_secret,
            'scopes': SCOPES
        }, f, indent=2)

    print(f"\nCredentials saved to {creds_path}")
    print("\nRun test_email.py now to test the upload!")

if __name__ == "__main__":
    main()
