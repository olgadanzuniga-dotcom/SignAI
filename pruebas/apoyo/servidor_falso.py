"""Servidor de mentira que habla el protocolo WS de SignAI y emite una
secuencia fija de commits. Sirve para probar el frontend (transcripcion) sin
depender de la camara ni del modelo."""
import asyncio, json
import websockets

# HOLA (palabra) -> espacio implicito -> A G U A (deletreo) -> PERRO (palabra)
SECUENCIA = ["HOLA", "A", "G", "U", "A", "PERRO"]

async def manejar(ws):
    await ws.send(json.dumps({
        "tipo": "hello",
        "clases": ["A", "G", "U", "PERRO", "HOLA", "AGUA"],
        "modelos": ["dinamico", "estatico", "unificado"],
        "modelo": "unificado",
    }))
    await asyncio.sleep(1.0)
    for sena in SECUENCIA:
        await ws.send(json.dumps({"tipo": "status", "estado": "DETECTANDO",
                                  "letra": sena, "conf": 0.93, "hand": True}))
        await asyncio.sleep(0.35)
        await ws.send(json.dumps({"tipo": "commit", "letra": sena, "conf": 0.93}))
        print("commit ->", sena, flush=True)
        await asyncio.sleep(0.6)
    while True:
        await asyncio.sleep(1)

async def main():
    async with websockets.serve(manejar, "127.0.0.1", 8765):
        print("servidor falso escuchando en ws://127.0.0.1:8765/ws", flush=True)
        await asyncio.Future()

asyncio.run(main())
