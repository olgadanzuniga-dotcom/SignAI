"""
SignAI Server.py

Servidor local de inferencia para la app SignAI (Electron/React). Reusa el
pipeline de SignAI.py / comun.py (camara + MediaPipe + features + Transformer).

Expone:
    GET  /video   -> stream MJPEG del frame anotado con landmarks.
    WS   /ws      -> eventos JSON {tipo:"status"|"commit"|"hello"|"modelo"}.
    GET  /health  -> estado real del motor (hilo vivo, camara, modelo).
                     200 si esta sano, 503 si arranco pero no puede
                     reconocer. Electron lo sondea antes de dar el
                     arranque por bueno.

La camara se ABRE solo cuando hay al menos un cliente conectado (/video o /ws)
y se LIBERA cuando no hay ninguno, asi las demas pantallas (getUserMedia) pueden
tomar la camara cuando el usuario no esta traduciendo.

Modos de inferencia (segun el modelo activo):
  - estatico:  ventana deslizante corta (~15 frames, igual que las muestras de
               entrenamiento) con inferencia continua; la letra se confirma por
               estabilidad (prediccion_estable) y confianza.
  - dinamico:  segmentacion por movimiento, espejo del grabador de dataset:
               la senia empieza cuando hay movimiento y termina tras un lapso
               de quietud; se infiere UNA vez sobre el segmento recortado con
               su longitud real (mascara correcta).
  - otro:      modo combinado (para un modelo unificado): ventana corta
               mientras la mano esta quieta + segmento dinamico cuando hay
               movimiento. Ambos caminos van al mismo modelo.

Uso:
    py "SignAI Server.py"
    SIGNAI_PORT=9000 SIGNAI_MANOS=2 py "SignAI Server.py"
"""
from __future__ import annotations

import os

# (2026-11-12) Debe ir ANTES de importar cv2. Con las "transformaciones por
# hardware" de MSMF activas, abrir la webcam y fijar 1280x720 tardaba ~9 s
# (medido: 3.1 s abrir + 5.4 s negociar resolución). Sin ellas: ~1.1 s, mismos
# 30 fps e imagen igual. setdefault: se puede volver a activar desde fuera.
os.environ.setdefault("OPENCV_VIDEOIO_MSMF_ENABLE_HW_TRANSFORMS", "0")

import json
import secrets
import tempfile
import time
import asyncio
import threading
import traceback
from pathlib import Path
from collections import deque
from contextlib import asynccontextmanager

import cv2
import numpy as np
import torch

from comun import (
    crear_hands, extraer_manos, features_frame, ahora_ms, DIR_MODELOS,
    SignTransformer, movimiento_global, PisoRuido,
    FRAMES_ESTATICO, FPS_OBJETIVO, UMBRAL_MOVIMIENTO, UMBRAL_QUIETUD_DINAMICO,
    MS_QUIETUD_PARA_FIN, MS_MARGEN_TRIM, SEG_MIN_DINAMICO, SEG_MAX_DINAMICO,
)
from SignAI import (
    construir_tensor, inferir_tta, dibujar_landmarks, prediccion_estable,
    MIN_FRAMES_INFER, INFER_CADA_FRAMES, HAND_GONE_MS_RESET,
    ANCHO_CAM, ALTO_CAM,
    IDLE, DETECTANDO,
)

from senas_nuevas import ReconocedorSenasNuevas, frame_dict, corregir_intercambio

from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
import uvicorn


PORT = int(os.environ.get("SIGNAI_PORT", "8765"))
# MediaPipe busca hasta 2 manos: las señas nuevas (AMARILLO, AZUL...) son de
# dos manos. El Transformer se entreno con una sola, asi que a el se le pasa
# solo la mano mas segura (ver mano_para_modelo).
NUM_MANOS = int(os.environ.get("SIGNAI_MANOS", "2"))
CAM_INDEX = int(os.environ.get("SIGNAI_CAM", "0"))
MAX_CAMARAS_A_PROBAR = 6   # indices 0..5; mas que eso ya no es realista en un equipo de escritorio


def listar_camaras(saltar: int | None = None) -> list[dict]:
    """Prueba los primeros indices de camara (via DirectShow en Windows, que
    abre casi al instante) y devuelve los que sí abren. OpenCV no da nombres
    de dispositivo sin dependencias extra, asi que se etiquetan por indice —
    igual que ya hacia el selector cuando el navegador no daba un `label`.

    `saltar`: el indice que el motor tiene abierto AHORA MISMO (si lo tiene).
    Probar ese mismo indice con un VideoCapture aparte compite por el mismo
    dispositivo exclusivo y el driver de Windows puede tirar una excepcion de
    C++ al soltarlo (visto en vivo: crasheaba /camaras si alguien probaba la
    lista mientras el traductor estaba abierto en otra pestaña logica). Como
    ya sabemos que ese indice funciona -esta en uso-, se agrega sin probarlo.
    """
    disponibles = []
    for i in range(MAX_CAMARAS_A_PROBAR):
        if i == saltar:
            disponibles.append({"indice": i, "nombre": f"Cámara {i + 1}"})
            continue
        cap = cv2.VideoCapture(i, cv2.CAP_DSHOW) if os.name == "nt" else cv2.VideoCapture(i)
        try:
            if cap.isOpened():
                disponibles.append({"indice": i, "nombre": f"Cámara {i + 1}"})
        except cv2.error as e:
            print(f"[camaras] indice {i} no se pudo probar: {e}", flush=True)
        finally:
            try:
                cap.release()
            except cv2.error as e:
                print(f"[camaras] indice {i} no se pudo soltar: {e}", flush=True)
    return disponibles

# --- Autorizacion ---------------------------------------------------------
# Este proceso ENCIENDE LA CAMARA cuando algo se conecta a /ws o /video. Sin
# comprobacion, cualquier pagina abierta en el navegador del usuario podia
# hacer new WebSocket("ws://127.0.0.1:8765/ws") y encenderle la webcam, y
# leerse el MJPEG desde un <img> (que ni siquiera manda cabecera Origin).
# Escuchar solo en 127.0.0.1 no protege de nada: el JavaScript del atacante
# corre en la maquina de la victima.
#
# Electron genera el token, lo pasa por SIGNAI_TOKEN y lo inyecta como
# cabecera en las peticiones de su propia sesion, asi que el frontend no
# necesita conocerlo. Una pagina de un navegador normal no puede.
TOKEN = os.environ.get("SIGNAI_TOKEN", "").strip()
CABECERA_TOKEN = "x-signai-token"
# Fichero de respaldo: permite reengancharse a un servidor que ya estaba
# corriendo (tipico en desarrollo) sin tener que matarlo.
RUTA_TOKEN = Path(tempfile.gettempdir()) / f"signai-{PORT}.token"

# Origenes legitimos del frontend: Vite en desarrollo, y el propio servidor.
# El Electron empaquetado carga con file://, que no manda Origin (o manda
# "null"), asi que la ausencia de Origin no puede tratarse como sospechosa.
ORIGENES_LOCALES = {
    "http://localhost:5173", "http://127.0.0.1:5173",
    f"http://localhost:{PORT}", f"http://127.0.0.1:{PORT}",
}
JPEG_QUALITY = 70
IDLE_SLEEP = 0.05      # espera cuando no hay clientes (camara liberada)
MAX_FALLOS_LECTURA = 30   # lecturas fallidas seguidas antes de dar la camara
                          # por perdida y reintentar abrirla (~1 s a 30 fps)
WS_QUEUE_MAX = 64      # eventos pendientes por cliente antes de descartar viejos

# Ventana deslizante para senias estaticas. Coincide con FRAMES_ESTATICO (los
# ~15 frames de cada muestra de entrenamiento): el modelo ve en vivo la misma
# longitud (+ mascara de padding) que vio al entrenar.
VENTANA_ESTATICO = int(os.environ.get("SIGNAI_VENTANA", str(FRAMES_ESTATICO)))

# Confianza minima para MOSTRAR una letra (verde) y para EMITIR commit (voz).
MIN_SHOW_CONF = float(os.environ.get("SIGNAI_MIN_CONF", "0.25"))
COMMIT_CONF = float(os.environ.get("SIGNAI_COMMIT_CONF", "0.50"))

# Confianza minima para emitir el commit de un SEGMENTO dinamico. Sin esto se
# cometia cualquier segmento (incluidas transiciones entre letras estaticas en
# modo combinado) con la confianza que fuera.
COMMIT_CONF_SEG = float(os.environ.get("SIGNAI_COMMIT_CONF_SEG",
                                       str(COMMIT_CONF)))

# La letra mostrada cambia solo si otra clase gana en LIVE_SWITCH_FRAMES
# inferencias seguidas (anti-parpadeo). Bajado de 3 a 2: con 3, el tramo
# entre "se ve la letra en verde" y "se coloca en el mensaje" se sentia
# lento (~9 frames de margen extra solo para confirmar). Con 2 sigue exigiendo
# que dos lecturas coincidan (no comete con un solo frame ruidoso) pero
# recorta ese margen a la mitad.
LIVE_SWITCH_FRAMES = int(os.environ.get("SIGNAI_SWITCH_FRAMES", "2"))

# Pasadas de TTA para la inferencia continua (estatico). La inferencia unica
# por segmento (dinamico) usa el default de SignAI.py (4).
N_TTA_LIVE = int(os.environ.get("SIGNAI_TTA", "2"))

# Tras un commit dinamico, ms antes de aceptar movimiento como senia nueva
# (evita que la cola del mismo gesto dispare otro segmento).
MS_COOLDOWN_SEGMENTO = 500
# Una toma para «Enseñar seña» que dura mas que esto fue la seña repetida o
# sin pausa: no sirve de referencia.
MS_TOMA_MAX = 4500

# Frames previos al inicio de movimiento que se conservan en el segmento
# dinamico, para no perder el arranque de la senia.
PRE_BUFFER_LEN = 5

# Frames CONSECUTIVOS con movimiento > UMBRAL_MOVIMIENTO para arrancar un
# segmento dinamico. Un pico de temblor de 1 frame supera el umbral facilmente
# (y en modo combinado secuestraba la ventana estatica: todo terminaba
# clasificado como segmento dinamico); una senia real mueve varios frames.
MOV_START_FRAMES = int(os.environ.get("SIGNAI_MOV_FRAMES", "3"))

# Estado extra (no viene de SignAI.py): senia dinamica ya predicha; se espera
# quietud->movimiento (senia nueva) o que la mano se vaya.
ESPERA = "ESPERA"

# Modelo a cargar al arrancar (clave = nombre de la subcarpeta en modelos/).
# "unificado" es el unico que se empaqueta (ver signai-server.spec), asi que
# tiene que ser tambien el default: con "estatico" la app instalada caia en la
# rama de respaldo de start() para acertar por descarte, que funciona pero deja
# el arranque dependiendo de que no haya otra carpeta antes en orden alfabetico.
MODELO_DEFAULT = os.environ.get("SIGNAI_MODELO", "unificado").strip()

# Cada modelo vive en su subcarpeta de modelos/ con estos 3 archivos; la clave
# del modelo es el nombre de la carpeta (ej. "estatico", "dinamico").
ARCHIVOS_MODELO = ("signai_transformer.pth", "label_map.json", "feature_meta.json")


def descubrir_modelos() -> dict[str, Path]:
    """{nombre_carpeta: ruta} para cada subcarpeta de modelos/ con los 3 archivos.
    Carpetas con prefijo "_" se ignoran (ej. _viejos). Si los archivos estan
    sueltos en modelos/ (layout antiguo) se expone como "default"."""
    modelos: dict[str, Path] = {}
    if DIR_MODELOS.exists():
        for sub in sorted(DIR_MODELOS.iterdir()):
            if (sub.is_dir() and not sub.name.startswith("_")
                    and all((sub / a).exists() for a in ARCHIVOS_MODELO)):
                modelos[sub.name] = sub
    if not modelos and all((DIR_MODELOS / a).exists() for a in ARCHIVOS_MODELO):
        modelos["default"] = DIR_MODELOS
    return modelos


def modo_de_modelo(nombre: str) -> str:
    """Modo de inferencia en vivo segun el modelo activo."""
    if nombre == "estatico":
        return "estatico"
    if nombre == "dinamico":
        return "dinamico"
    return "combinado"


def coords_de_modelo(nombre: str, meta: dict | None) -> str:
    """Espacio de coordenadas ("image" | "world") con el que se entreno el
    modelo activo. Los modelos nuevos lo declaran en feature_meta.json; para
    los viejos se infiere: el dataset estatico se grabo con coords de imagen
    y el dinamico con world."""
    if meta and meta.get("coords") in ("image", "world"):
        return meta["coords"]
    return "world" if nombre == "dinamico" else "image"


DEBUG_SEG = os.environ.get("SIGNAI_DEBUG", "") == "1"

# Segmentos de al menos esta duracion que no se reconocen enteros se revisan
# por ventanas buscando una seña nueva (ver lanzar_ventanas).
MS_SEG_LARGO = 4000


def mano_para_modelo(manos: dict) -> dict:
    """Con dos manos a la vista, el Transformer (entrenado a una mano) recibe
    solo la de mayor confianza, como cuando MediaPipe buscaba una sola."""
    r, l = manos.get("Right"), manos.get("Left")
    if r and l:
        return {"Right": r, "Left": None} if r["score"] >= l["score"]             else {"Right": None, "Left": l}
    return manos


def resamplear_a_fps(feats: list, ts: list, fps: int) -> list:
    """Reinterpola el segmento a la cadencia de grabacion del dataset (25fps).
    Las velocidades/aceleraciones son diferencias entre frames consecutivos:
    si la camara en vivo corre a otra cadencia, su escala temporal no coincide
    con la del entrenamiento."""
    if len(feats) < 2:
        return feats
    dur_ms = ts[-1] - ts[0]
    if dur_ms <= 0:
        return feats
    n = max(2, int(round(dur_ms / 1000.0 * fps)) + 1)
    ts_arr = np.asarray(ts, dtype=np.float64)
    grid = np.linspace(ts_arr[0], ts_arr[-1], num=n)
    arr = np.stack(feats).astype(np.float32)
    idx = np.clip(np.searchsorted(ts_arr, grid, side="right") - 1, 0, len(ts) - 2)
    den = np.maximum(ts_arr[idx + 1] - ts_arr[idx], 1e-6)
    w = ((grid - ts_arr[idx]) / den).astype(np.float32)[:, None]
    out = arr[idx] * (1.0 - w) + arr[idx + 1] * w
    return list(out)


def cargar_modelo_en(dir_modelo: Path, device):
    """Carga (model, clases, meta) desde una carpeta de modelo concreta."""
    p_modelo = dir_modelo / "signai_transformer.pth"
    p_label = dir_modelo / "label_map.json"
    p_meta = dir_modelo / "feature_meta.json"
    for p in (p_modelo, p_label, p_meta):
        if not p.exists():
            raise FileNotFoundError(f"falta {p}")

    with open(p_label, "r", encoding="utf-8") as f:
        clases = json.load(f)["classes"]
    with open(p_meta, "r", encoding="utf-8") as f:
        meta = json.load(f)

    model = SignTransformer(
        input_dim=meta["input_dim"],
        num_classes=meta["num_classes"],
        d_model=meta["d_model"],
        nhead=meta["n_heads"],
        num_layers=meta["n_layers"],
        dim_ff=meta["dim_ff"],
        dropout=meta["dropout"],
        max_len=meta["max_seq_len"],
    ).to(device)
    state = torch.load(p_modelo, map_location=device)
    model.load_state_dict(state)
    model.eval()
    return model, clases, meta


class Engine:
    """Corre la captura + inferencia en un hilo dedicado. Solo procesa cuando
    hay consumidores. Publica el ultimo JPEG y difunde eventos a los WS."""

    def __init__(self):
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model = None
        self.clases = None
        self.meta = None

        self.modelos: dict[str, Path] = {}
        self.modelo_actual: str | None = None
        # Señas agregadas sin reentrenar (comparacion con grabaciones).
        self.senas_nuevas = ReconocedorSenasNuevas()
        self._pending_modelo: str | None = None   # lo aplica el hilo del engine
        # Pantalla «Enseñar seña»: mientras tenga un nombre, cada seña que se
        # haga se guarda como toma propia de esa seña en vez de traducirse.
        self.ensenar: str | None = None

        self.cam_index = CAM_INDEX
        self._pending_cam_index: int | None = None  # lo aplica el hilo del engine
        self._cam_lock = threading.Lock()

        self._running = True
        self._consumers = 0
        self._consumers_lock = threading.Lock()

        # Estado observable desde /health: antes respondia {ok: true} aunque el
        # hilo llevara minutos muerto y la camara tomada.
        self._fallo: str | None = None      # traceback si el bucle murio
        self._camara_ok = False             # la camara esta entregando frames
        self._modelo_lock = threading.Lock()

        self._jpeg = None
        self._jpeg_lock = threading.Lock()

        # Cada conexion WS registra una asyncio.Queue; el hilo difunde via
        # call_soon_threadsafe sobre el loop principal.
        self.loop: asyncio.AbstractEventLoop | None = None
        self.ws_queues: set[asyncio.Queue] = set()
        self._ws_lock = threading.Lock()

        self._thread = threading.Thread(target=self._run, daemon=True, name="engine")

    def start(self):
        self.modelos = descubrir_modelos()
        if not self.modelos:
            raise RuntimeError(
                f"No se encontraron modelos en {DIR_MODELOS}. "
                f"Cada modelo debe estar en su subcarpeta con: {', '.join(ARCHIVOS_MODELO)}."
            )

        if MODELO_DEFAULT in self.modelos:
            self.modelo_actual = MODELO_DEFAULT
        elif "estatico" in self.modelos:
            self.modelo_actual = "estatico"
        else:
            self.modelo_actual = next(iter(self.modelos))

        print(f"[engine] modelos disponibles: {list(self.modelos)}")
        print(f"[engine] cargando '{self.modelo_actual}' en {self.device} ...")
        self.model, self.clases, self.meta = cargar_modelo_en(
            self.modelos[self.modelo_actual], self.device)
        print(f"[engine] clases ({len(self.clases)}): {self.clases}")
        print(f"[engine] señas nuevas: {self.senas_nuevas.clases}")
        self._thread.start()

    def stop(self):
        self._running = False

    def set_modelo(self, key: str) -> bool:
        """Solicita cambiar al modelo `key`; lo aplica el hilo del engine en el
        proximo ciclo. Devuelve False si el modelo no existe."""
        if key not in self.modelos:
            return False
        # Bajo lock: dos POST /modelo seguidos perdian uno de los dos.
        with self._modelo_lock:
            self._pending_modelo = key
        return True

    def set_camara(self, indice: int) -> bool:
        """Solicita cambiar a la camara `indice`; lo aplica el hilo del engine
        en el proximo ciclo, forzando a reabrir el dispositivo."""
        if indice < 0 or indice > 15:
            return False
        with self._cam_lock:
            self._pending_cam_index = indice
        return True

    def add_consumer(self):
        with self._consumers_lock:
            self._consumers += 1

    def remove_consumer(self):
        with self._consumers_lock:
            self._consumers = max(0, self._consumers - 1)

    @property
    def active(self) -> bool:
        with self._consumers_lock:
            return self._consumers > 0

    def instantanea(self) -> dict:
        """Estado del motor, coherente consigo mismo, para /health y el hello
        del WS. `ok` es falso si el hilo murio: antes no habia forma de
        distinguir "arrancando" de "muerto hace diez minutos"."""
        with self._modelo_lock:
            modelo, clases = self.modelo_actual, list(self.clases or [])
        vivo = self._thread.is_alive()
        return {
            "ok": vivo and self._fallo is None,
            "motor_vivo": vivo,
            "camara": self._camara_ok,
            "consumidores": self._consumers,
            "modelo": modelo,
            "modelos": sorted(self.modelos),
            "clases": clases + [c for c in self.senas_nuevas.clases if c not in clases],
            "camara_indice": self.cam_index,
            "fallo": self._fallo,
        }

    def get_jpeg(self):
        with self._jpeg_lock:
            return self._jpeg

    def _set_jpeg(self, frame):
        ok, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, JPEG_QUALITY])
        if ok:
            with self._jpeg_lock:
                self._jpeg = buf.tobytes()

    def broadcast(self, event: dict):
        """Difunde un evento a los WS. Corre en el HILO del engine, mientras el
        event loop puede estar agregando/quitando colas: copiar el set bajo lock
        evita el 'Set changed size during iteration' que mataria el hilo (y con
        el la camara) sin que nadie se entere."""
        if self.loop is None:
            return
        with self._ws_lock:
            colas = tuple(self.ws_queues)
        for q in colas:
            try:
                self.loop.call_soon_threadsafe(self._push, q, event)
            except Exception as e:
                print(f"[engine] no se pudo encolar el evento: {e}", flush=True)

    @staticmethod
    def _push(q: asyncio.Queue, event: dict):
        """Encola descartando lo mas viejo si el cliente no da abasto. Sin esto
        una pestania congelada hace crecer la cola sin limite."""
        try:
            q.put_nowait(event)
        except asyncio.QueueFull:
            try:
                q.get_nowait()
                q.put_nowait(event)
            except Exception:
                pass

    def _run(self):
        cap = None
        hands = None
        fallos_lectura = 0

        # --- estado compartido ---
        estado = IDLE
        frame_count = 0
        sin_mano_desde_ms = None
        shown_txt = ""          # letra mostrada (verde); persiste entre gestos
        shown_conf = 0.0
        emitida = ""            # ultima letra emitida como commit (no repetir)
        live_top3 = None

        # --- modo estatico / combinado: ventana deslizante ---
        ventana = deque(maxlen=VENTANA_ESTATICO)
        pred_history = deque(maxlen=LIVE_SWITCH_FRAMES + 2)

        # --- modo dinamico / combinado: segmentacion por movimiento ---
        pre_buffer = deque(maxlen=PRE_BUFFER_LEN)   # (feat, ts, fd) previos al movimiento
        seg_feats: list = []
        seg_fds: list = []      # manos crudas del segmento (señas nuevas)
        ultimas_munecas: dict = {}
        seg_ts: list = []
        seg_movs: list = []
        grabando = False
        quietud_desde_ms = None
        mov_seguidos = 0
        ruido = PisoRuido()   # umbrales que se adaptan al temblor de la camara
        pts_img_prev = None
        cooldown_hasta_ms = 0
        # Busqueda por ventanas (segmentos largos) en un hilo aparte: tarda
        # ~1 s y congelaria la camara. resultado_ventanas[0] = (seña, conf).
        resultado_ventanas: list = [None]
        hilo_ventanas: list = [None]

        def lanzar_ventanas(fds, ts):
            if hilo_ventanas[0] is not None and hilo_ventanas[0].is_alive():
                return
            def trabajo():
                try:
                    sena, conf, votos = self.senas_nuevas.reconocer_ventanas(
                        fds, ts, anchos_ms=(2000,), paso=6, min_votos=3)
                    if DEBUG_SEG:
                        print(f"[debug] ventanas: {votos}", flush=True)
                    if sena is not None:
                        resultado_ventanas[0] = (sena, conf)
                except Exception:
                    traceback.print_exc()
            hilo_ventanas[0] = threading.Thread(target=trabajo, daemon=True)
            hilo_ventanas[0].start()

        def reset_segmento():
            nonlocal grabando, quietud_desde_ms, mov_seguidos
            pre_buffer.clear()
            seg_feats.clear()
            seg_fds.clear()
            seg_ts.clear()
            seg_movs.clear()
            grabando = False
            quietud_desde_ms = None
            mov_seguidos = 0

        def full_reset():
            nonlocal estado, sin_mano_desde_ms, shown_txt, shown_conf
            nonlocal emitida, live_top3, pts_img_prev, cooldown_hasta_ms
            ventana.clear()
            pred_history.clear()
            reset_segmento()
            estado = IDLE
            sin_mano_desde_ms = None
            shown_txt = ""
            shown_conf = 0.0
            emitida = ""
            live_top3 = None
            pts_img_prev = None
            cooldown_hasta_ms = 0
            ultimas_munecas.clear()

        def cerrar_segmento(limite_ms, ahora):
            """Clasifica el segmento grabado (recortado hasta limite_ms si se
            da) y lo resetea. Devuelve (seña, conf) a confirmar o None."""
            nonlocal shown_txt, shown_conf, live_top3, cooldown_hasta_ms, estado
            feats_seg, fds_seg, ts_seg = seg_feats, seg_fds, seg_ts
            if limite_ms is not None:
                k = sum(1 for t in seg_ts if t <= limite_ms)
                feats_seg, fds_seg, ts_seg = seg_feats[:k], seg_fds[:k], seg_ts[:k]
            dur_util = (ts_seg[-1] - ts_seg[0]) if feats_seg else 0
            # Un segmento sin movimiento real fue temblor, no una senia.
            movio = (
                len(seg_movs) > 0
                and float(np.mean(seg_movs)) >= ruido.quietud
                and float(np.max(seg_movs)) >= ruido.inicio
            )
            valido = movio and len(feats_seg) >= 2 and dur_util >= SEG_MIN_DINAMICO * 1000
            if DEBUG_SEG:
                print(f"[debug] fin de segmento: {len(feats_seg)} frames, "
                      f"{dur_util} ms, movio={movio}, recortado={limite_ms is not None}, "
                      f"piso={ruido.piso:.4f} quietud={ruido.quietud:.4f} "
                      f"inicio={ruido.inicio:.4f}", flush=True)
            commit = None
            sena_ens = self.ensenar
            if sena_ens:
                cooldown_hasta_ms = ahora + MS_COOLDOWN_SEGMENTO
                if not valido:
                    pass  # temblor o movimiento muy corto: ni se avisa
                elif dur_util > MS_TOMA_MAX:
                    self.broadcast({"tipo": "ensenar", "sena": sena_ens, "ok": False,
                                    "msg": "Fue muy larga. Hazla una sola vez y baja las manos."})
                else:
                    try:
                        n = self.senas_nuevas.agregar_toma(
                            sena_ens, list(fds_seg), list(ts_seg))
                    except Exception:
                        traceback.print_exc()
                        n = 0
                    print(f"[enseñar] {sena_ens}: toma guardada ({n})", flush=True)
                    self.broadcast({"tipo": "ensenar", "sena": sena_ens, "ok": n > 0,
                                    "tomas": n,
                                    "msg": "" if n else "No vi bien las manos. Otra vez."})
                reset_segmento()
                return None
            if valido:
                # Primero las señas nuevas: el Transformer no las conoce y
                # diria otra cosa con confianza.
                sena_n, conf_n, pcts_n = self.senas_nuevas.reconocer(
                    list(fds_seg), list(ts_seg))
                if DEBUG_SEG and pcts_n:
                    print(f"[debug] señas nuevas: {pcts_n}", flush=True)
                if DEBUG_SEG:
                    try:
                        d = Path(tempfile.gettempdir()) / "signai_segs"
                        d.mkdir(exist_ok=True)
                        (d / f"seg_{int(ahora)}.json").write_text(json.dumps(
                            {"fds": list(fds_seg), "ts": list(ts_seg),
                             "pcts": pcts_n}), encoding="utf-8")
                    except Exception as e:
                        print(f"[debug] no se guardo el segmento: {e}", flush=True)
                cooldown_hasta_ms = ahora + MS_COOLDOWN_SEGMENTO
                if sena_n is not None:
                    orden = sorted(pcts_n, key=pcts_n.get, reverse=True)[:3]
                    live_top3 = [[c, pcts_n[c] / 100.0] for c in orden]
                    shown_txt, shown_conf = sena_n, conf_n
                    commit = (shown_txt, shown_conf)
                    estado = ESPERA
                    print(f"[seña nueva] {shown_txt}  ({shown_conf*100:.0f}%)", flush=True)
                else:
                    feats_r = resamplear_a_fps(list(feats_seg), list(ts_seg), FPS_OBJETIVO)
                    X, mask = construir_tensor(feats_r)
                    pred_idx, conf, probs = inferir_tta(self.model, X, mask, self.device)
                    top_idx = np.argsort(-probs)[:3]
                    live_top3 = [[self.clases[i], float(probs[i])] for i in top_idx]
                    if DEBUG_SEG:
                        print("[debug] transformer top3: "
                              + ", ".join(f"{c} {p*100:.0f}%" for c, p in live_top3),
                              flush=True)
                    shown_txt = self.clases[pred_idx]
                    shown_conf = conf
                    if conf >= COMMIT_CONF_SEG:
                        commit = (shown_txt, shown_conf)
                        estado = ESPERA
                        print(f"[seña] {shown_txt}  ({shown_conf*100:.0f}%)", flush=True)
                    else:
                        # confianza baja: probablemente una transicion.
                        estado = DETECTANDO
                        # Segmento largo (seña repetida o sin pausa): buscar
                        # las señas nuevas dentro, por ventanas.
                        if dur_util >= MS_SEG_LARGO and self.senas_nuevas.clases:
                            lanzar_ventanas(list(fds_seg), list(ts_seg))
                        print(f"[seg descartado] {shown_txt} ({shown_conf*100:.0f}%)",
                              flush=True)
            reset_segmento()
            return commit

        try:
            while self._running:
                # Cambio de modelo solicitado (se aplica aqui, en este hilo).
                with self._modelo_lock:
                    pend = self._pending_modelo
                    self._pending_modelo = None
                if pend is not None:
                    if pend != self.modelo_actual and pend in self.modelos:
                        try:
                            m, c, mt = cargar_modelo_en(self.modelos[pend], self.device)
                            # Publicar bajo el mismo lock que usan /health y el
                            # hello del WS: si no, podian leer las clases nuevas
                            # junto al nombre del modelo viejo.
                            with self._modelo_lock:
                                self.model, self.clases, self.meta = m, c, mt
                                self.modelo_actual = pend
                            full_reset()
                            print(f"[engine] modelo cambiado a '{pend}' "
                                  f"({len(c)} clases)", flush=True)
                            self.broadcast({"tipo": "modelo", "actual": pend, "clases": c})
                        except Exception as e:
                            print(f"[engine] error al cambiar a '{pend}': {e}", flush=True)
                            self.broadcast({
                                "tipo": "error",
                                "msg": f"No se pudo cargar el modelo '{pend}'.",
                            })

                # Cambio de camara solicitado (p.ej. desde Ajustes): se fuerza
                # a soltar el dispositivo actual para que se reabra mas abajo
                # con el indice nuevo, aunque siga habiendo consumidores.
                with self._cam_lock:
                    pend_cam = self._pending_cam_index
                    self._pending_cam_index = None
                if pend_cam is not None and pend_cam != self.cam_index:
                    self.cam_index = pend_cam
                    if cap is not None:
                        cap.release()
                        cap = None
                        self._camara_ok = False
                    full_reset()
                    print(f"[engine] camara cambiada a indice {pend_cam}", flush=True)
                    self.broadcast({"tipo": "camara", "actual": pend_cam})

                # Sin consumidores: liberar camara y dormir.
                if not self.active:
                    if cap is not None:
                        cap.release()
                        cap = None
                        self._camara_ok = False
                    # `hands` (el grafo de MediaPipe) se conserva entre sesiones:
                    # crearlo cuesta ~2.5 s y se notaba cada vez que se abría la
                    # cámara. Es uno solo, así que no acumula memoria.
                    full_reset()
                    with self._jpeg_lock:
                        self._jpeg = None
                    # Precalentar: se crea una sola vez mientras nadie usa la
                    # cámara (al arrancar), así la primera apertura ya es rápida.
                    if hands is None and not getattr(self, "_precalentado", False):
                        self._precalentado = True  # un solo intento; si falla, se crea al abrir
                        try:
                            hands = crear_hands(num_manos=NUM_MANOS, modo_estatico=False)
                        except Exception as e:
                            print(f"[engine] no se pudo precrear MediaPipe: {e}", flush=True)
                            hands = None
                    time.sleep(IDLE_SLEEP)
                    continue

                if cap is None:
                    # CAP_DSHOW: en Windows, el backend por defecto (MSMF) puede
                    # tardar varios segundos en abrir y negociar resolucion —
                    # el usuario ve el traductor "sin aparecer" ese rato.
                    # DirectShow abre casi al instante con el mismo hardware.
                    # (2026-11-11) Pero a 1280x720 DirectShow entrega ~8 fps en
                    # esta webcam (medido) contra 30 de MSMF: con 8 fps las
                    # señas con movimiento salen borrosas y a saltos. Se usa
                    # MSMF; SIGNAI_DSHOW=1 vuelve a DirectShow.
                    usar_dshow = os.name == "nt" and os.environ.get("SIGNAI_DSHOW") == "1"
                    cap = (cv2.VideoCapture(self.cam_index, cv2.CAP_DSHOW) if usar_dshow
                           else cv2.VideoCapture(self.cam_index, cv2.CAP_MSMF) if os.name == "nt"
                           else cv2.VideoCapture(self.cam_index))
                    cap.set(cv2.CAP_PROP_FRAME_WIDTH, ANCHO_CAM)
                    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, ALTO_CAM)
                    # Comprobar la camara ANTES de construir el grafo de MediaPipe:
                    # en un equipo sin webcam (o con la camara tomada por Zoom/Teams)
                    # este bloque se reintenta en bucle, y un crear_hands() por vuelta
                    # dejaba grafos sin liberar hasta agotar la memoria.
                    if not cap.isOpened():
                        print("[engine] ERROR: no se pudo abrir la camara.")
                        self.broadcast({
                            "tipo": "error",
                            "msg": "No se pudo abrir la cámara.",
                        })
                        cap.release()
                        cap = None
                        time.sleep(1.0)
                        continue
                    if hands is None:
                        hands = crear_hands(num_manos=NUM_MANOS, modo_estatico=False)
                    full_reset()

                ok, frame = cap.read()
                if not ok:
                    # La camara puede desaparecer a media sesion (cable, suspension,
                    # o la toma Teams/Zoom). Antes el bucle giraba a 100 Hz sirviendo
                    # el ultimo frame congelado y sin avisar a nadie: la UI mostraba
                    # una imagen fija con "conectado" para siempre.
                    fallos_lectura += 1
                    if fallos_lectura >= MAX_FALLOS_LECTURA:
                        print("[engine] la camara dejo de entregar frames; "
                              "se reintenta abrirla.", flush=True)
                        self._camara_ok = False
                        self.broadcast({
                            "tipo": "error",
                            "msg": "Se perdió la señal de la cámara. Comprueba que "
                                   "no la esté usando otra aplicación.",
                        })
                        cap.release()
                        cap = None
                        with self._jpeg_lock:
                            self._jpeg = None
                        fallos_lectura = 0
                        time.sleep(1.0)
                    else:
                        time.sleep(0.01)
                    continue
                fallos_lectura = 0
                self._camara_ok = True

                frame = cv2.flip(frame, 1)
                rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                results = hands.process(rgb)
                manos = extraer_manos(results)
                dibujar_landmarks(frame, manos)

                # Features en el mismo espacio de coords con que se entreno el
                # modelo activo (image | world); si no, la geometria no coincide.
                coords = coords_de_modelo(self.modelo_actual or "", self.meta)
                manos_m = mano_para_modelo(manos)
                r_pts = manos_m["Right"][coords] if manos_m.get("Right") else None
                l_pts = manos_m["Left"][coords] if manos_m.get("Left") else None
                hand_present = (r_pts is not None) or (l_pts is not None)
                feat = features_frame(r_pts, l_pts)
                fd = corregir_intercambio(frame_dict(manos), ultimas_munecas)

                # Movimiento entre frames sobre coords de imagen (rango 0..1, el
                # mismo espacio en que se calibraron los umbrales del grabador).
                # Se usan las manos ya corregidas: con dos manos MediaPipe a veces
                # intercambia Derecha/Izquierda y eso parecia un salto enorme
                # (la seña nunca se daba por "quieta").
                pts_img = {
                    "Right": fd["Right"]["image"] if fd.get("Right") else None,
                    "Left": fd["Left"]["image"] if fd.get("Left") else None,
                }
                mov = movimiento_global(pts_img_prev, pts_img) if pts_img_prev else 0.0
                tenia_prev = pts_img_prev is not None
                pts_img_prev = pts_img if hand_present else None

                ahora = ahora_ms()
                if hand_present and tenia_prev:
                    ruido.agregar(ahora, mov)
                frame_count += 1
                commit_ahora = None
                modo = modo_de_modelo(self.modelo_actual or "")

                # --- ausencia de mano: reset comun a todos los modos ---
                if not hand_present:
                    if estado != IDLE:
                        if sin_mano_desde_ms is None:
                            sin_mano_desde_ms = ahora
                        elif (grabando and ahora - sin_mano_desde_ms
                                >= MS_QUIETUD_PARA_FIN):
                            # Bajo las manos al terminar: la seña acabo ahi
                            # (antes se tiraba sin clasificar).
                            commit_ahora = cerrar_segmento(
                                sin_mano_desde_ms + MS_MARGEN_TRIM, ahora)
                        elif ahora - sin_mano_desde_ms > HAND_GONE_MS_RESET:
                            # La letra verde persiste; emitida se limpia para que la
                            # misma senia, repetida en un gesto nuevo, vuelva a
                            # emitir commit.
                            estado = IDLE
                            ventana.clear()
                            pred_history.clear()
                            reset_segmento()
                            emitida = ""
                            sin_mano_desde_ms = None
                else:
                    sin_mano_desde_ms = None
                    if estado == IDLE:
                        estado = DETECTANDO
                        ventana.clear()
                        pred_history.clear()
                        reset_segmento()

                    usa_ventana = modo == "estatico" or (modo == "combinado" and not grabando)
                    usa_segmento = modo in ("dinamico", "combinado")

                    # --- ventana deslizante (senias estaticas) ---
                    if usa_ventana:
                        ventana.append(feat)
                        if (len(ventana) >= MIN_FRAMES_INFER
                                and frame_count % INFER_CADA_FRAMES == 0):
                            X, mask = construir_tensor(list(ventana))
                            pred_idx, conf, probs = inferir_tta(
                                self.model, X, mask, self.device, n_tta=N_TTA_LIVE)
                            top_idx = np.argsort(-probs)[:3]
                            live_top3 = [[self.clases[i], float(probs[i])] for i in top_idx]

                            pred_history.append((pred_idx, conf))
                            estable, pred_moda, conf_media = prediccion_estable(
                                pred_history, ventana=LIVE_SWITCH_FRAMES, tolerancia=0)
                            if estable and conf_media >= MIN_SHOW_CONF:
                                letra = self.clases[pred_moda]
                                shown_txt = letra
                                shown_conf = conf_media
                                if conf_media >= COMMIT_CONF and letra != emitida:
                                    emitida = letra
                                    commit_ahora = (letra, conf_media)
                                    print(f"[seña] {letra}  ({conf_media*100:.0f}%)",
                                          flush=True)

                    # --- segmentacion por movimiento (senias dinamicas) ---
                    if usa_segmento and estado in (DETECTANDO, ESPERA):
                        if not grabando:
                            pre_buffer.append((feat, ahora, fd))
                            if mov > ruido.inicio and ahora >= cooldown_hasta_ms:
                                mov_seguidos += 1
                            else:
                                mov_seguidos = 0
                            if mov_seguidos >= MOV_START_FRAMES:
                                # arranca la senia: se conservan los frames previos
                                grabando = True
                                if DEBUG_SEG:
                                    print("[debug] inicio de segmento", flush=True)
                                quietud_desde_ms = None
                                mov_seguidos = 0
                                seg_feats[:] = [f for f, _, _ in pre_buffer]
                                seg_ts[:] = [t for _, t, _ in pre_buffer]
                                seg_fds[:] = [d for _, _, d in pre_buffer]
                                seg_movs[:] = [mov]
                                estado = DETECTANDO
                                if modo == "combinado":
                                    ventana.clear()
                                    pred_history.clear()
                        else:
                            seg_feats.append(feat)
                            seg_fds.append(fd)
                            seg_ts.append(ahora)
                            seg_movs.append(mov)

                            # Promedio de los ultimos frames: el temblor de
                            # MediaPipe daba picos sueltos que reiniciaban la
                            # quietud y la seña no se cerraba hasta los 6 s.
                            if float(np.mean(seg_movs[-4:])) < ruido.quietud:
                                if quietud_desde_ms is None:
                                    quietud_desde_ms = ahora
                            else:
                                quietud_desde_ms = None

                            dur_ms = seg_ts[-1] - seg_ts[0]
                            fin_por_quietud = (
                                quietud_desde_ms is not None
                                and ahora - quietud_desde_ms >= MS_QUIETUD_PARA_FIN
                            )
                            fin_por_maximo = dur_ms >= SEG_MAX_DINAMICO * 1000

                            if fin_por_quietud or fin_por_maximo:
                                if fin_por_quietud:
                                    # recorta la cola de quietud dejando un margen
                                    limite = quietud_desde_ms + MS_MARGEN_TRIM
                                else:
                                    limite = None
                                commit_ahora = cerrar_segmento(limite, ahora) or commit_ahora

                self._set_jpeg(frame)

                if resultado_ventanas[0] is not None and commit_ahora is None:
                    sena_v, conf_v = resultado_ventanas[0]
                    resultado_ventanas[0] = None
                    shown_txt, shown_conf = sena_v, conf_v
                    live_top3 = [[sena_v, conf_v]]
                    commit_ahora = (sena_v, conf_v)
                    print(f"[seña nueva] {sena_v}  ({conf_v*100:.0f}%) [ventanas]",
                          flush=True)

                if commit_ahora is not None:
                    self.broadcast({
                        "tipo": "commit",
                        "letra": commit_ahora[0],
                        "conf": round(float(commit_ahora[1]), 4),
                    })

                if frame_count % INFER_CADA_FRAMES == 0 or commit_ahora is not None:
                    buffer_len = len(seg_feats) if grabando else len(ventana)
                    self.broadcast({
                        "tipo": "status",
                        "estado": estado,
                        "letra": shown_txt,
                        "conf": round(float(shown_conf), 4),
                        "top3": live_top3,
                        "buffer": buffer_len,
                        "hand": hand_present,
                    })

        except Exception:
            # Cualquier fallo aqui (MediaPipe, torch, un indice fuera de rango
            # tras cambiar de modelo, un frame que cv2 no puede codificar) mataba
            # el hilo en silencio Y DEJABA LA CAMARA TOMADA por el proceso: la UI
            # seguia diciendo "conectado" sobre un video congelado, y ninguna otra
            # pantalla podia volver a abrir la camara hasta cerrar la app.
            self._fallo = traceback.format_exc()
            print("[engine] EXCEPCION en el bucle; el motor se detiene:", flush=True)
            traceback.print_exc()
            self.broadcast({
                "tipo": "error",
                "msg": "El motor de reconocimiento se detuvo por un error interno. "
                       "Reinicia SignAI.",
            })
        finally:
            # Liberar SIEMPRE: es lo unico que devuelve la camara al sistema.
            self._camara_ok = False
            if cap is not None:
                cap.release()
            if hands is not None:
                try:
                    hands.close()
                except Exception as e:
                    print(f"[engine] error al cerrar MediaPipe: {e}", flush=True)
            with self._jpeg_lock:
                self._jpeg = None
            print("[engine] bucle terminado; camara liberada.", flush=True)


def origen_sospechoso(origin: str | None) -> bool:
    """True si el Origin es el de una pagina web ajena.

    Hay tres casos que NO son concluyentes y que por tanto no se rechazan
    aqui (para eso esta el token):
      - sin Origin: una peticion de <img> (el MJPEG) no manda ninguno;
      - "null": documentos opacos;
      - "file://": es lo que manda Chromium cuando la app va empaquetada y
        se carga con loadFile. Rechazarlo dejaba la app instalada sin
        traductor mientras en desarrollo (http://localhost:5173) funcionaba.
    """
    if not origin or origin in ("null", "file://"):
        return False
    return origin not in ORIGENES_LOCALES


def autorizado(headers, query) -> bool:
    """Un origen web ajeno se rechaza siempre. El token se exige cuando hay
    uno configurado; si se arranca el servidor a mano (sin SIGNAI_TOKEN) se
    puede seguir usando `py "SignAI Server.py"` para depurar."""
    if origen_sospechoso(headers.get("origin")):
        return False
    if not TOKEN:
        return True
    dado = headers.get(CABECERA_TOKEN) or query.get("token") or ""
    return secrets.compare_digest(dado, TOKEN)


engine = Engine()


@asynccontextmanager
async def lifespan(app: FastAPI):
    engine.loop = asyncio.get_running_loop()
    if TOKEN:
        try:
            RUTA_TOKEN.write_text(TOKEN, encoding="utf-8")
        except OSError as e:
            print(f"[server] no se pudo escribir {RUTA_TOKEN}: {e}", flush=True)
    engine.start()
    yield
    engine.stop()
    if TOKEN:
        try:
            RUTA_TOKEN.unlink(missing_ok=True)
        except OSError:
            pass


app = FastAPI(title="SignAI Inference Server", lifespan=lifespan)
# Solo los origenes del propio frontend. Con "*" cualquier pagina podia
# leerse /video y /health desde otro sitio. Sin credenciales: no hay cookies
# ni sesion, la autorizacion va por cabecera de token.
app.add_middleware(
    CORSMiddleware,
    allow_origins=sorted(ORIGENES_LOCALES),
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    """Estado real del motor. Devuelve 503 si el hilo murio o la camara se
    perdio, para que Electron pueda detectarlo sin interpretar el cuerpo."""
    estado = engine.instantanea()
    return JSONResponse(estado, status_code=200 if estado["ok"] else 503)


@app.get("/modelos")
async def modelos():
    return JSONResponse({
        "modelos": list(engine.modelos.keys()),
        "actual": engine.modelo_actual,
    })


@app.post("/modelo")
async def cambiar_modelo(modelo: str, request: Request):
    if not autorizado(request.headers, request.query_params):
        return JSONResponse({"ok": False, "msg": "No autorizado."}, status_code=403)
    if not engine.set_modelo(modelo):
        return JSONResponse(
            {"ok": False,
             "msg": f"Modelo '{modelo}' no existe.",
             "modelos": list(engine.modelos.keys())},
            status_code=404,
        )
    return JSONResponse({"ok": True, "modelo": modelo})


@app.get("/camaras")
async def camaras():
    # Bloqueante (abre/cierra hasta 6 dispositivos): fuera del hilo del loop
    # para no congelar /health ni los WS mientras se prueba. Si el motor
    # tiene la camara activa ahora mismo, ese indice no se vuelve a abrir
    # (ver el porque en listar_camaras).
    saltar = engine.cam_index if engine.active else None
    disponibles = await asyncio.to_thread(listar_camaras, saltar)
    return JSONResponse({"camaras": disponibles, "actual": engine.cam_index})


@app.post("/camara")
async def cambiar_camara(indice: int, request: Request):
    if not autorizado(request.headers, request.query_params):
        return JSONResponse({"ok": False, "msg": "No autorizado."}, status_code=403)
    if not engine.set_camara(indice):
        return JSONResponse({"ok": False, "msg": "Índice de cámara inválido."}, status_code=400)
    return JSONResponse({"ok": True, "indice": indice})


@app.get("/ensenar")
async def ensenar_estado():
    return JSONResponse({
        "senas": engine.senas_nuevas.clases,
        "tomas": engine.senas_nuevas.tomas_usuario(),
        "activa": engine.ensenar,
    })


@app.post("/ensenar")
async def ensenar(request: Request, sena: str = ""):
    """sena="<NOMBRE>" empieza a guardar tomas de esa seña; vacio, termina."""
    if not autorizado(request.headers, request.query_params):
        return JSONResponse({"ok": False, "msg": "No autorizado."}, status_code=403)
    if sena and sena not in engine.senas_nuevas.clases:
        return JSONResponse({"ok": False, "msg": f"No conozco la seña '{sena}'."},
                            status_code=404)
    engine.ensenar = sena or None
    return JSONResponse({"ok": True, "activa": engine.ensenar})


@app.post("/ensenar/borrar")
async def ensenar_borrar(request: Request, sena: str = ""):
    """Borra las tomas propias de una seña (o de todas si sena="")."""
    if not autorizado(request.headers, request.query_params):
        return JSONResponse({"ok": False, "msg": "No autorizado."}, status_code=403)
    engine.senas_nuevas.borrar_tomas(sena or None)
    return JSONResponse({"ok": True, "tomas": engine.senas_nuevas.tomas_usuario()})


_video_generacion = 0


@app.get("/video")
async def video(request: Request):
    if not autorizado(request.headers, request.query_params):
        return JSONResponse({"ok": False, "msg": "No autorizado."}, status_code=403)

    async def gen():
        # add_consumer() va DENTRO del generador: si se hacia en el cuerpo del
        # endpoint y el cliente abortaba antes de iterar la respuesta, el
        # contador subia para siempre, la camara se quedaba abierta y ninguna
        # otra pantalla podia usarla. useSignServer pide /video?t=... en cada
        # reconexion, asi que ese camino se recorre a menudo.
        #
        # (2026-11-12) Solo vive el /video MAS NUEVO. La app muestra una sola
        # camara a la vez, pero Chromium no cortaba el stream al cerrar el
        # traductor: cada apertura dejaba una conexion colgada (un consumidor
        # mas, camara siempre encendida) y a la sexta se agotaba el limite de
        # 6 conexiones por servidor del navegador y la app se trababa. Al
        # cerrar aqui los streams viejos, el navegador recupera la conexion
        # aunque el cliente no la suelte.
        global _video_generacion
        _video_generacion += 1
        mia = _video_generacion
        engine.add_consumer()
        try:
            ultimo_chequeo = 0.0
            while _video_generacion == mia:
                ahora = time.monotonic()
                if ahora - ultimo_chequeo > 1.0:
                    ultimo_chequeo = ahora
                    if await request.is_disconnected():
                        break
                jpeg = engine.get_jpeg()
                if jpeg is not None:
                    yield (b"--frame\r\n"
                           b"Content-Type: image/jpeg\r\n\r\n" + jpeg + b"\r\n")
                await asyncio.sleep(1 / 30)
        finally:
            engine.remove_consumer()

    return StreamingResponse(
        gen(), media_type="multipart/x-mixed-replace; boundary=frame")


@app.websocket("/ws")
async def ws(websocket: WebSocket):
    # Comprobar ANTES de accept(): aceptar ya cuenta como consumidor y eso es
    # justo lo que enciende la camara.
    if not autorizado(websocket.headers, websocket.query_params):
        await websocket.close(code=1008)
        return
    await websocket.accept()
    engine.add_consumer()
    # Cola acotada: los eventos de status son instantaneas, no historia; si el
    # cliente se atrasa preferimos perder los viejos antes que acumular memoria.
    q: asyncio.Queue = asyncio.Queue(maxsize=WS_QUEUE_MAX)
    with engine._ws_lock:
        engine.ws_queues.add(q)
    try:
        # enviar clases y modelos al conectar (la UI los usa para el selector)
        estado = engine.instantanea()
        await websocket.send_json({
            "tipo": "hello",
            "clases": estado["clases"],
            "modelos": estado["modelos"],
            "modelo": estado["modelo"],
        })
        while True:
            event = await q.get()
            await websocket.send_json(event)
    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"[ws] conexion terminada por error: {e!r}", flush=True)
    finally:
        with engine._ws_lock:
            engine.ws_queues.discard(q)
        engine.remove_consumer()
        if not engine.active:
            # Se cerro la pantalla a media enseñanza: que el traductor vuelva
            # a traducir la proxima vez.
            engine.ensenar = None


if __name__ == "__main__":
    print("=" * 60)
    print(f"SignAI server  ->  http://127.0.0.1:{PORT}")
    print(f"  /video  (MJPEG)   /ws  (WebSocket)   /health")
    print(f"  manos={NUM_MANOS}  cam={CAM_INDEX}")
    print("=" * 60)
    uvicorn.run(app, host="127.0.0.1", port=PORT, log_level="warning")
