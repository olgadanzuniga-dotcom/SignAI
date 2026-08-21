# -*- coding: utf-8 -*-
"""Comprueba que el motor no le abre la camara a cualquiera.

El servidor ENCIENDE LA WEBCAM en cuanto algo se conecta a /ws o a /video. Antes
no habia ninguna comprobacion, asi que cualquier pagina abierta en el navegador
del usuario podia hacer new WebSocket("ws://127.0.0.1:8765/ws") y encendersela,
y leerse el MJPEG desde un <img> (que ni siquiera manda cabecera Origin).
Escuchar solo en 127.0.0.1 no protege de nada: el JavaScript del atacante corre
en la maquina de la victima.

Este test arranca su propio servidor con un token conocido y comprueba, uno por
uno, quien entra y quien no.

Uso:  py pruebas/seguridad/probar_autorizacion.py
"""
from __future__ import annotations

import asyncio
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
SERVIDOR = RAIZ / "Avances" / "Modelo Transformer" / "SignAI Server.py"
TOKEN = "token-de-prueba-no-usar-en-produccion"
PUERTO = int(os.environ.get("SIGNAI_PUERTO_PRUEBA", "8799"))
BASE = f"http://127.0.0.1:{PUERTO}"
ORIGEN_MALO = "https://sitio-malicioso.example"

fallos: list[str] = []


def comprobar(desc: str, obtenido, esperado) -> None:
    ok = obtenido == esperado
    if not ok:
        fallos.append(f"{desc}: esperaba {esperado!r}, obtuvo {obtenido!r}")
    print(f"  {'OK  ' if ok else 'FALLA'}  {desc:.<52} {obtenido}")


def pedir(ruta: str, metodo: str = "GET", cabeceras: dict | None = None) -> int:
    req = urllib.request.Request(BASE + ruta, method=metodo,
                                 headers=cabeceras or {})
    try:
        with urllib.request.urlopen(req, timeout=5) as r:
            return r.status
    except urllib.error.HTTPError as e:
        return e.code
    except Exception:
        return 0


def esperar_arranque(timeout=180) -> bool:
    limite = time.time() + timeout
    while time.time() < limite:
        if pedir("/health") == 200:
            return True
        time.sleep(1.0)
    return False


def esperar_sin_consumidores(timeout=15) -> int:
    """Ultimo valor del contador de consumidores, esperando a que baje a 0."""
    limite = time.time() + timeout
    n = -1
    while time.time() < limite:
        try:
            with urllib.request.urlopen(BASE + "/health", timeout=5) as r:
                n = json.load(r)["consumidores"]
        except Exception:
            pass
        if n == 0:
            return 0
        time.sleep(0.5)
    return n


async def ws_entra(cabeceras: dict) -> bool:
    """True si el WebSocket acepta la conexion y manda el hello."""
    import websockets
    try:
        async with websockets.connect(f"ws://127.0.0.1:{PUERTO}/ws",
                                      open_timeout=5,
                                      additional_headers=cabeceras) as ws:
            json.loads(await asyncio.wait_for(ws.recv(), timeout=5))
            return True
    except Exception:
        return False


def main() -> int:
    print(f"Arrancando el motor en el puerto {PUERTO} (carga torch, tarda)...")
    proc = subprocess.Popen(
        [sys.executable, str(SERVIDOR)],
        cwd=str(SERVIDOR.parent),
        env={**os.environ, "SIGNAI_TOKEN": TOKEN, "SIGNAI_PORT": str(PUERTO)},
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    try:
        if not esperar_arranque():
            print("FALLA: el servidor no llego a responder a /health")
            return 2

        con_token = {"X-SignAI-Token": TOKEN}

        print("\nHTTP - lo que puede intentar una web ajena:")
        comprobar("GET  /video  sin token", pedir("/video"), 403)
        comprobar("POST /modelo sin token",
                  pedir("/modelo?modelo=estatico", "POST"), 403)
        comprobar("GET  /video  con Origin ajeno",
                  pedir("/video", cabeceras={"Origin": ORIGEN_MALO}), 403)
        comprobar("POST /modelo con token pero Origin ajeno",
                  pedir("/modelo?modelo=estatico", "POST",
                        {**con_token, "Origin": ORIGEN_MALO}), 403)

        print("\nHTTP - lo que hace SignAI:")
        comprobar("POST /modelo con token (Electron empaquetado, file://)",
                  pedir("/modelo?modelo=estatico", "POST",
                        {**con_token, "Origin": "file://"}), 200)
        comprobar("POST /modelo con token (desarrollo, Vite)",
                  pedir("/modelo?modelo=estatico", "POST",
                        {**con_token, "Origin": "http://localhost:5173"}), 200)
        comprobar("GET  /health sin token (lo sondea Electron al arrancar)",
                  pedir("/health"), 200)

        print("\nWebSocket - es el camino por el que se enciende la camara:")
        comprobar("sin token", asyncio.run(ws_entra({})), False)
        comprobar("con Origin ajeno y sin token",
                  asyncio.run(ws_entra({"Origin": ORIGEN_MALO})), False)
        comprobar("con token pero Origin ajeno",
                  asyncio.run(ws_entra({**con_token, "Origin": ORIGEN_MALO})),
                  False)
        comprobar("con token (SignAI)",
                  asyncio.run(ws_entra({**con_token, "Origin": "file://"})),
                  True)

        # Que no queden consumidores colgados: si quedaran, la camara seguiria
        # abierta y ninguna otra pantalla podria usarla. Se espera en vez de
        # mirar una sola vez, porque el servidor no se entera de que un WS se
        # ha ido hasta que le falla el siguiente envio. Una fuga de verdad
        # nunca llega a 0 y el limite salta igual.
        print("\nDespues de todo lo anterior:")
        comprobar("consumidores acaban en 0 (camara liberada)",
                  esperar_sin_consumidores(), 0)
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=10)
        except subprocess.TimeoutExpired:
            proc.kill()

    print()
    if fallos:
        print(f"{len(fallos)} FALLOS:")
        for f in fallos:
            print("  - " + f)
        return 1
    print("Todo correcto: el motor solo le abre la camara a SignAI.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
