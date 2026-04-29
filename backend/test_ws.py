import asyncio
import websockets

async def test():
    try:
        uri = "ws://127.0.0.1:8000/ws/events/1"
        print(f"Intentando conectar a {uri}...")
        async with websockets.connect(uri) as ws:
            print('✅ Conectado al WS exitosamente')
            await ws.send('ping')
            await asyncio.sleep(1)
            print('✅ Prueba de ping terminada. Servidor funcionando.')
    except Exception as e:
        print(f"❌ Error al conectar: {e}")

if __name__ == "__main__":
    asyncio.run(test())
