"""
senas_nuevas.py

Reconocedor de señas NUEVAS por comparacion directa (DTW) contra las
grabaciones, al lado del Transformer. Sirve para agregar señas sin reentrenar
el modelo (los datos originales con que se entreno no estan en esta PC: un
reentrenamiento haria que olvidara AGUA, HOLA, PERRO, etc.).

Mismo metodo que grabador_lsm/probar_senia.py:
  - cada seña se recorta igual que en el grabador (rellenar huecos de mano,
    reinterpolar a 25 fps),
  - features = forma de cada mano + trayectoria de la muñeca,
  - distancia DTW a las K grabaciones mas parecidas, con castigo por durar
    distinto,
  - umbral por seña calibrado con lo que se alejan entre si sus grabaciones.

Las referencias van precalculadas en modelos/senas_nuevas/refs.json (lo genera
exportar_senas_nuevas.py).
"""
from __future__ import annotations

import json
import os
from pathlib import Path

import numpy as np

from comun import DIR_MODELOS

DIR_SENAS_NUEVAS = DIR_MODELOS / "senas_nuevas"
PATH_REFS = DIR_SENAS_NUEVAS / "refs.json"

FPS_OBJETIVO = 25
MS_HUECO_MAX = 250
K_VECINOS = 3
PESO_DURACION = 0.6
# Puntaje minimo para dar por reconocida una seña nueva, y ventaja minima
# sobre la segunda mas parecida (si dos se parecen igual, no se decide).
PCT_MINIMO = 70
MARGEN_MINIMO = 15


# ============================================================================
# PREPARACION DE LA SECUENCIA (igual que el grabador)
# ============================================================================

def frame_dict(manos) -> dict:
    out = {}
    for lado in ("Right", "Left"):
        m = manos.get(lado)
        out[lado] = None if m is None else {
            "image": [list(p) for p in m["image"]],
            "score": float(m["score"]),
        }
    return out


def corregir_intercambio(fd, ultimas_munecas):
    """Deshace los cambios Derecha/Izquierda de MediaPipe entre frames."""
    r, l = fd.get("Right"), fd.get("Left")
    pr, pl = ultimas_munecas.get("Right"), ultimas_munecas.get("Left")
    if r and l and pr and pl:
        d = lambda p, q: (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2
        directo = d(r["image"][0], pr) + d(l["image"][0], pl)
        cruzado = d(r["image"][0], pl) + d(l["image"][0], pr)
        if cruzado < directo * 0.5:
            fd = {"Right": l, "Left": r}
    for lado in ("Right", "Left"):
        if fd.get(lado):
            ultimas_munecas[lado] = fd[lado]["image"][0]
    return fd


def _lerp(a, b, w):
    return [[pa[k] * (1 - w) + pb[k] * w for k in range(len(pa))]
            for pa, pb in zip(a, b)]


def rellenar_huecos(frames, ts, max_ms=MS_HUECO_MAX):
    frames = [dict(fd) for fd in frames]
    for lado in ("Right", "Left"):
        i = 0
        while i < len(frames):
            if frames[i].get(lado) is not None:
                i += 1
                continue
            j = i
            while j < len(frames) and frames[j].get(lado) is None:
                j += 1
            if i > 0 and j < len(frames) and ts[j] - ts[i - 1] <= max_ms:
                a, b = frames[i - 1][lado], frames[j][lado]
                for k in range(i, j):
                    w = (ts[k] - ts[i - 1]) / max(ts[j] - ts[i - 1], 1e-6)
                    frames[k][lado] = {"image": _lerp(a["image"], b["image"], w),
                                       "score": min(a["score"], b["score"])}
            i = j
    return frames


def resamplear(frames, ts, fps=FPS_OBJETIVO):
    if len(frames) < 2 or ts[-1] <= ts[0]:
        return list(frames)
    n = max(2, int(round((ts[-1] - ts[0]) / 1000.0 * fps)) + 1)
    paso = (ts[-1] - ts[0]) / (n - 1)
    out, j = [], 0
    for k in range(n):
        t = ts[0] + k * paso
        while j < len(ts) - 2 and ts[j + 1] <= t:
            j += 1
        w = min(max((t - ts[j]) / max(ts[j + 1] - ts[j], 1e-6), 0.0), 1.0)
        fd = {}
        for lado in ("Right", "Left"):
            a, b = frames[j].get(lado), frames[j + 1].get(lado)
            if a and b:
                fd[lado] = {"image": _lerp(a["image"], b["image"], w),
                            "score": min(a["score"], b["score"])}
            else:
                fd[lado] = a if w < 0.5 else b
        out.append(fd)
    return out


# ============================================================================
# FEATURES Y DISTANCIA (igual que probar_senia.py)
# ============================================================================

# v2 (2026-11-12): la forma de cada mano se mide con SU propio tamaño. Antes
# se dividia por el tamaño de mano promedio de la escena, y la mano quieta de
# las señas de dos manos (mas cerca o lejos de la camara en otra lap) cambiaba
# de "forma" y la seña dejaba de parecerse. refs.json y las tomas propias
# guardan la version para no mezclar features viejas con nuevas.
VERSION_FEATURES = 2


def _feat_frame(fd, centro, escala, tam_mano=None):
    out = []
    for lado in ("Right", "Left"):
        m = fd.get(lado)
        if m is None:
            out.extend([0.0] * 44 + [1.0])
            continue
        pts = np.asarray(m["image"], dtype=np.float64)[:, :2]
        forma = (pts - pts[0]) / (tam_mano or {}).get(lado, escala)
        pos = (pts[0] - centro) / escala
        out.extend(forma.ravel().tolist())
        out.extend((pos * 3).tolist())
        out.append(0.0)
    return out


def features_secuencia(secuencia):
    munecas, tamanos = [], []
    por_lado = {"Right": [], "Left": []}
    for fd in secuencia:
        for lado in ("Right", "Left"):
            m = fd.get(lado)
            if m:
                pts = np.asarray(m["image"], dtype=np.float64)[:, :2]
                munecas.append(pts[0])
                t = float(np.linalg.norm(pts[9] - pts[0]))
                tamanos.append(t)
                por_lado[lado].append(t)
    if not munecas:
        return None
    centro = np.mean(munecas, axis=0)
    escala = max(float(np.median(tamanos)), 1e-3)
    tam_mano = {l: max(float(np.median(v)), 1e-3) for l, v in por_lado.items() if v}
    return np.asarray([_feat_frame(fd, centro, escala, tam_mano) for fd in secuencia])


def dtw(a, b):
    """DTW media por paso. Bucles sobre listas: ~3x mas rapido que numpy celda
    a celda, y aqui las secuencias son cortas (<= ~80 frames)."""
    n, m = len(a), len(b)
    costo = np.linalg.norm(a[:, None, :] - b[None, :, :], axis=2).tolist()
    inf = float("inf")
    acc_prev = [0.0] + [inf] * m
    pas_prev = [0] * (m + 1)
    for i in range(1, n + 1):
        acc = [inf] * (m + 1)
        pas = [0] * (m + 1)
        fila = costo[i - 1]
        for j in range(1, m + 1):
            d, p = acc_prev[j - 1], pas_prev[j - 1]
            if acc_prev[j] < d:
                d, p = acc_prev[j], pas_prev[j]
            if acc[j - 1] < d:
                d, p = acc[j - 1], pas[j - 1]
            acc[j] = fila[j - 1] + d
            pas[j] = p + 1
        acc_prev, pas_prev = acc, pas
    return acc_prev[m] / max(pas_prev[m], 1)


def distancia(a, b):
    return dtw(a, b) * (1.0 + PESO_DURACION * abs(np.log(len(a) / len(b))))


def distancia_a_refs(feats, refs):
    ds = sorted(distancia(feats, r) for r in refs)
    return float(np.mean(ds[:K_VECINOS]))


def calibrar(refs):
    loo = [distancia_a_refs(r, refs[:i] + refs[i + 1:]) for i, r in enumerate(refs)]
    return max(float(np.percentile(loo, 90)) * 1.25, 1e-6), loo


def puntaje(dist, umbral):
    return int(round(100 * float(np.clip(2.0 - dist / umbral, 0.0, 1.0))))


# ============================================================================
# RECONOCEDOR
# ============================================================================

def solo_mano_activa(frames, lado_destino):
    """
    Para señas de UNA mano: el servidor busca dos manos, y la otra (quieta, a
    la vista) hacia que la seña no se pareciera a sus grabaciones. Se queda la
    mano que mas se movio y se pone en el lado en que quedo al grabar.
    """
    recorrido = {}
    for lado in ("Right", "Left"):
        prev, total = None, 0.0
        for fd in frames:
            m = fd.get(lado)
            if m:
                w = m["image"][0]
                if prev is not None:
                    total += ((w[0] - prev[0]) ** 2 + (w[1] - prev[1]) ** 2) ** 0.5
                prev = w
        recorrido[lado] = total
    presentes = {lado: sum(1 for fd in frames if fd.get(lado)) for lado in recorrido}
    candidatos = [l for l in recorrido if presentes[l] > 0]
    if not candidatos:
        return frames
    activa = max(candidatos, key=lambda l: (recorrido[l], presentes[l]))
    otro = "Left" if lado_destino == "Right" else "Right"
    return [{lado_destino: fd.get(activa), otro: None} for fd in frames]


def _ruta_usuario() -> Path:
    """Tomas que la persona le enseña a la app en SU compu (pantalla «Enseñar
    seña»). Van fuera de la carpeta de instalacion para que sobrevivan a
    reinstalar y no haga falta permiso de escritura ahi."""
    base = os.environ.get("APPDATA") or str(Path.home())
    return Path(base) / "SignAI" / "senas_usuario.json"


MAX_TOMAS_USUARIO = 8
MIN_TOMAS_USUARIO = 2
UMBRAL_USUARIO_MAX = 3.0


class ReconocedorSenasNuevas:
    def __init__(self, path=PATH_REFS, path_usuario=None):
        self.senas: dict[str, tuple[list, float]] = {}
        self.forma: dict[str, tuple[int, str]] = {}   # (num_manos, lado)
        # Tomas propias de esta compu: nombre -> lista de features.
        self.usuario: dict[str, list] = {}
        self._umbral_usuario: dict[str, float] = {}
        self.path_usuario = Path(path_usuario) if path_usuario else _ruta_usuario()
        p = Path(path)
        if p.exists():
            data = json.loads(p.read_text(encoding="utf-8"))
            if data.get("version", 1) != VERSION_FEATURES:
                print(f"[señas nuevas] AVISO: {p.name} es de otra version de "
                      f"features (regenerar con exportar_senas_nuevas.py).",
                      flush=True)
            for nombre, info in data.get("senas", {}).items():
                refs = [np.asarray(r, dtype=np.float64) for r in info["refs"]]
                if len(refs) >= 3:
                    self.senas[nombre] = (refs, float(info["umbral"]))
                    self.forma[nombre] = (int(info.get("num_manos", 2)),
                                          info.get("lado", "Right"))
        self._cargar_usuario()

    # ------------------------------------------------------------------
    # Tomas enseñadas por la persona
    # ------------------------------------------------------------------
    def _cargar_usuario(self):
        try:
            if not self.path_usuario.exists():
                return
            data = json.loads(self.path_usuario.read_text(encoding="utf-8"))
            if data.get("version", 1) != VERSION_FEATURES:
                print("[señas nuevas] las tomas propias son de una version "
                      "anterior; hay que volver a enseñarlas.", flush=True)
                return
            for nombre, tomas in data.get("senas", {}).items():
                if nombre in self.senas and tomas:
                    self.usuario[nombre] = [np.asarray(t, dtype=np.float64)
                                            for t in tomas][-MAX_TOMAS_USUARIO:]
                    self._recalibrar_usuario(nombre)
        except Exception as e:  # un archivo dañado no debe tumbar el traductor
            print(f"[señas nuevas] no se pudieron leer las tomas propias: {e}",
                  flush=True)
            self.usuario, self._umbral_usuario = {}, {}

    def _guardar_usuario(self):
        try:
            self.path_usuario.parent.mkdir(parents=True, exist_ok=True)
            data = {"version": VERSION_FEATURES,
                    "senas": {n: [t.round(5).tolist() for t in ts]
                              for n, ts in self.usuario.items() if ts}}
            tmp = self.path_usuario.with_suffix(".tmp")
            tmp.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
            os.replace(tmp, self.path_usuario)
        except Exception as e:
            print(f"[señas nuevas] no se pudieron guardar las tomas: {e}", flush=True)

    def _recalibrar_usuario(self, nombre):
        tomas = self.usuario.get(nombre) or []
        if len(tomas) < MIN_TOMAS_USUARIO:
            self._umbral_usuario.pop(nombre, None)
            return
        u_base = self.senas[nombre][1]
        u, _ = calibrar(tomas)
        # Con 2-3 tomas casi identicas la calibracion sale demasiado estricta
        # (en vivo nunca se repite igual); y sin tope, una toma rara la afloja
        # tanto que todo se pareceria.
        # Medido: tomas de la misma seña quedan a 1-3 entre si y señas
        # distintas a 7-8 (puntaje 0 al doble del umbral).
        tope = min(max(u_base, 1.5) * 1.2, UMBRAL_USUARIO_MAX)
        self._umbral_usuario[nombre] = float(np.clip(u, 1.2, tope))

    def _features_para(self, nombre, sec):
        num_manos, lado = self.forma[nombre]
        s = sec if num_manos >= 2 else solo_mano_activa(sec, lado)
        return features_secuencia(s)

    def agregar_toma(self, nombre, frames, ts) -> int:
        """Guarda un segmento en vivo como toma propia de `nombre`. Devuelve
        cuantas tomas propias tiene ahora (0 si no se pudo usar)."""
        if nombre not in self.senas or len(frames) < 2:
            return 0
        sec = resamplear(rellenar_huecos(frames, ts), ts)
        f = self._features_para(nombre, sec)
        if f is None:
            return 0
        tomas = (self.usuario.get(nombre) or []) + [f]
        self.usuario[nombre] = tomas[-MAX_TOMAS_USUARIO:]
        self._recalibrar_usuario(nombre)
        self._guardar_usuario()
        return len(self.usuario[nombre])

    def borrar_tomas(self, nombre=None):
        if nombre is None:
            self.usuario, self._umbral_usuario = {}, {}
        else:
            self.usuario.pop(nombre, None)
            self._umbral_usuario.pop(nombre, None)
        self._guardar_usuario()

    def tomas_usuario(self) -> dict:
        return {n: len(ts) for n, ts in self.usuario.items() if ts}

    @property
    def clases(self) -> list[str]:
        return list(self.senas)

    def reconocer(self, frames, ts):
        """
        frames: frame_dicts (ya con corregir_intercambio) del segmento
        recortado; ts: sus tiempos en ms. Devuelve (seña, conf 0..1, pcts) si
        alguna seña nueva coincide con claridad; si no, (None, 0, pcts).
        """
        if not self.senas or len(frames) < 2:
            return None, 0.0, {}
        sec = resamplear(rellenar_huecos(frames, ts), ts)
        cache = {}

        def feats_para(nombre):
            num_manos, lado = self.forma[nombre]
            clave = "2" if num_manos >= 2 else lado
            if clave not in cache:
                s = sec if num_manos >= 2 else solo_mano_activa(sec, lado)
                cache[clave] = features_secuencia(s)
            return cache[clave]

        pcts = {}
        for n, (refs, u) in self.senas.items():
            f = feats_para(n)
            if f is None:
                pcts[n] = 0
                continue
            p = puntaje(distancia_a_refs(f, refs), u)
            # Si la persona la enseño en esta compu, vale la que mas se parezca
            # (sus tomas o las grabaciones originales).
            tomas, uu = self.usuario.get(n), self._umbral_usuario.get(n)
            if tomas and uu:
                p = max(p, puntaje(distancia_a_refs(f, tomas), uu))
            pcts[n] = p
        if not pcts:
            return None, 0.0, {}
        orden = sorted(pcts, key=pcts.get, reverse=True)
        mejor = orden[0]
        segundo = pcts[orden[1]] if len(orden) > 1 else 0
        if pcts[mejor] >= PCT_MINIMO and pcts[mejor] - segundo >= MARGEN_MINIMO:
            return mejor, pcts[mejor] / 100.0, pcts
        return None, 0.0, pcts

    def reconocer_ventanas(self, frames, ts, anchos_ms=(1500, 2500), paso=4,
                           min_votos=5, min_fraccion=0.6):
        """Para segmentos largos (la persona repitio la seña o no se quedo
        quieta): busca la seña en ventanas deslizantes y vota. Devuelve
        (seña, conf, votos) o (None, 0, votos)."""
        votos, confs = {}, {}
        for ancho in anchos_ms:
            j = 0
            for i in range(0, len(ts), paso):
                while j + 1 < len(ts) and ts[j + 1] - ts[i] <= ancho:
                    j += 1
                if j <= i or ts[j] - ts[i] < ancho * 0.8:
                    continue
                sena, conf, _ = self.reconocer(frames[i:j + 1], ts[i:j + 1])
                if sena is not None:
                    votos[sena] = votos.get(sena, 0) + 1
                    confs.setdefault(sena, []).append(conf)
        if not votos:
            return None, 0.0, votos
        mejor = max(votos, key=votos.get)
        total = sum(votos.values())
        if votos[mejor] >= min_votos and votos[mejor] / total >= min_fraccion:
            return mejor, float(np.mean(confs[mejor])), votos
        return None, 0.0, votos
