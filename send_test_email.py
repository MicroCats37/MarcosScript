"""Send email with photo link."""
import httpx

payload = {
    "notificanteId": "inscripciones",
    "to": ["alarmasciplima@gmail.com"],
    "cc": [],
    "bcc": [],
    "asunto": "MarcosScript - Tu foto procesada",
    "contenido": "<html><body><h1>Tu foto lista!</h1><img src='https://drive.google.com/uc?export=view&id=1HlOX5M62D5KVUYKeatqnlCZWUZqUJ_yP' width='400' /></body></html>",
    "html": True,
    "usuarioCreacion": 1
}

r = httpx.post("http://172.16.93.83:9003/api/v1/sender/send-email", json=payload, timeout=10)
print(f"Status: {r.status_code}")
print(f"Response: {r.text}")
