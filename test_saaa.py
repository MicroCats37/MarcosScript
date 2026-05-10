"""Test SAAA both public and find-by-id endpoints."""
import httpx

SAAA_URL = "http://172.16.93.83:9007/api/v1"

archivo_id = "3c2e0d53-8e83-48ff-acaa-ed7efeaa9cb2"
archivador_id = "inscripciones"

print("Testing SAAA public download with ID from previous upload")
print("-" * 50)

try:
    with httpx.Client(timeout=10) as client:
        # Try public endpoint
        r1 = client.get(f"{SAAA_URL}/archivo/public/{archivador_id}/{archivo_id}")
        print(f"GET /archivo/public/{archivador_id}/{archivo_id} => {r1.status_code}")
        print(f"  Response: {r1.text[:100]}")

        # Try find-by-id endpoint
        r2 = client.get(f"{SAAA_URL}/archivo/find-by-id/{archivador_id}/{archivo_id}")
        print(f"GET /archivo/find-by-id/{archivador_id}/{archivo_id} => {r2.status_code}")
        print(f"  Response: {r2.text[:100]}")

except Exception as e:
    print(f"Error: {e}")
