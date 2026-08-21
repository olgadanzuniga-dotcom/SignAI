"""
normalizar.py

Convierte los datasets crudos (dataset_estatico/ y dataset_dinamico/) en el
tensor unificado dataset_normalizado/data.npz que consume entrenar.py.

Formatos de entrada:
  A) dataset_estatico/*.json — single-frame, una mano:
       {"gesto": "A", "hand_type": "Right|Left", "timestamp": iso,
        "landmarks": [21 dicts {x,y,z}]}          (coords de IMAGEN, 0..1)
     Cada archivo se convierte en una secuencia sintetica de FRAMES_ESTATICO
     frames identicos con la mano contraria ausente (vel/acc = 0, correcto
     para un gesto estatico).
  B) dataset_dinamico/*.json — secuencia, del grabador:
       {"tipo": "DIN", "gesto": ..., "session_id": ...,
        "secuencia": [{"Right": {"image": [...], "world": [...]}|null,
                       "Left": ...}, ...]}

Espacio de coordenadas: se usan SIEMPRE las coords de IMAGEN (0..1), porque el
dataset estatico solo tiene imagen y un modelo unificado necesita un espacio
consistente. (La version anterior usaba world para dinamico e imagen para
estatico, y el modelo estatico recibia world en vivo: doble desfase.)
El espacio queda declarado en meta.json ("coords": "image") y entrenar.py lo
copia al feature_meta.json del modelo para que el servidor use el mismo.

Salida (contrato que espera entrenar.py):
  data.npz: X [N, 80, 442] float32 · mask [N, 80] float32 · y [N] int64
            tipos [N] ("estatico"|"dinamico") · sessions [N] · nombres [N]
            clases [C]
  meta.json: dims, clases, conteos, coords.

Uso:
    py normalizar.py
"""
from __future__ import annotations

import sys
import json
from pathlib import Path
from collections import Counter, defaultdict

import numpy as np

from comun import (
    DIR_ESTATICO, DIR_DINAMICO, DIR_NORMALIZADO,
    MAX_SEQ_LEN, FRAMES_ESTATICO,
    FEAT_STATIC_PER_FRAME, FEAT_DYNAMIC_PER_FRAME, FEAT_COORDS, FEAT_PER_HAND,
    features_frame, solo_coords_del_frame, velocidades, aceleraciones,
    tuplas_de_dicts, leer_json,
)

PATH_SALIDA = DIR_NORMALIZADO / "data.npz"
PATH_META = DIR_NORMALIZADO / "meta.json"

COORDS = "image"


def listar_json(carpeta: Path) -> list[Path]:
    if not carpeta.exists():
        return []
    return sorted(p for p in carpeta.iterdir() if p.suffix == ".json")


def pts_imagen(entrada_mano) -> list[tuple[float, float, float]] | None:
    """Coords de imagen de una mano del grabador dinamico. None si ausente."""
    if entrada_mano is None:
        return None
    pts = entrada_mano.get("image") if isinstance(entrada_mano, dict) else entrada_mano
    if not pts:
        return None
    if isinstance(pts[0], dict):
        return tuplas_de_dicts(pts)
    return [tuple(p) for p in pts]


def secuencia_desde_single_frame(data: dict) -> list[dict]:
    """
    Convierte un JSON single-frame single-hand en una "secuencia" sintetica de
    FRAMES_ESTATICO frames identicos, con la mano contraria ausente. Asi las
    velocidades y aceleraciones quedan en 0 (correcto para un gesto estatico).
    """
    hand_type = data.get("hand_type", "Right")
    pts = tuplas_de_dicts(data["landmarks"])
    frame = {"Right": None, "Left": None}
    frame[hand_type if hand_type in ("Right", "Left") else "Right"] = pts
    return [frame] * FRAMES_ESTATICO


def session_id_de(data: dict, archivo: Path) -> str:
    """
    session_id usable para el split train/val.
    Prioridad: campo session_id del JSON > timestamp truncado al minuto
    > prefijo del nombre del archivo.
    """
    sid = data.get("session_id")
    if sid:
        return str(sid)
    ts = data.get("timestamp", "")
    if ts:
        return ts[:16]  # "2026-05-26T11:15" (minuto)
    return archivo.stem.rsplit("_", 1)[0]


def muestra_a_matriz(data: dict) -> tuple[np.ndarray, np.ndarray]:
    """
    Convierte una muestra (dict del JSON) en:
      X: np.ndarray [T_real, FEAT_DYNAMIC_PER_FRAME]
      mask: np.ndarray [T_real] (todos 1)
    """
    if "secuencia" in data:
        frames = [
            {"Right": pts_imagen(f.get("Right")), "Left": pts_imagen(f.get("Left"))}
            for f in data["secuencia"]
        ]
    elif "landmarks" in data:
        frames = secuencia_desde_single_frame(data)
    else:
        raise ValueError("muestra sin secuencia ni landmarks")

    estaticos = np.stack(
        [features_frame(f["Right"], f["Left"]) for f in frames], axis=0
    )                                                            # [T, 190]
    coords = np.stack([solo_coords_del_frame(v) for v in estaticos], axis=0)
    vel = velocidades(coords)
    acc = aceleraciones(vel)
    X = np.concatenate([estaticos, vel, acc], axis=1).astype(np.float32)

    if X.shape[1] != FEAT_DYNAMIC_PER_FRAME:
        raise ValueError(
            f"shape {X.shape} no coincide con FEAT_DYNAMIC_PER_FRAME={FEAT_DYNAMIC_PER_FRAME}"
        )
    return X, np.ones(X.shape[0], dtype=np.float32)


def pad_o_truncar(X: np.ndarray, mask: np.ndarray, max_len: int):
    """Pad con ceros, o submuestreo lineal si T > max_len (igual que
    construir_tensor en inferencia)."""
    T = X.shape[0]
    if T < max_len:
        pad = np.zeros((max_len - T, X.shape[1]), dtype=X.dtype)
        X = np.concatenate([X, pad], axis=0)
        mask = np.concatenate(
            [mask, np.zeros(max_len - T, dtype=mask.dtype)], axis=0)
    elif T > max_len:
        idx = np.linspace(0, T - 1, num=max_len).round().astype(int)
        X = X[idx]
        mask = np.ones(max_len, dtype=mask.dtype)
    return X, mask


def procesar_carpeta(carpeta: Path, tipo_etiqueta: str, logs: list[str]):
    """Devuelve listas paralelas: Xs, masks, labels, tipos, sessions, nombres."""
    Xs, masks, labels, tipos, sessions, nombres = [], [], [], [], [], []
    archivos = listar_json(carpeta)
    if not archivos:
        logs.append(f"[aviso] {carpeta.name}: sin JSONs")
        return Xs, masks, labels, tipos, sessions, nombres

    for archivo in archivos:
        try:
            data = leer_json(archivo)
            gesto = str(data.get("gesto", "")).strip().upper()
            if not gesto:
                logs.append(f"[skip] {archivo.name}: gesto vacio")
                continue
            X, mask = muestra_a_matriz(data)
            X, mask = pad_o_truncar(X, mask, MAX_SEQ_LEN)
            Xs.append(X)
            masks.append(mask)
            labels.append(gesto)
            tipos.append(tipo_etiqueta)
            sessions.append(session_id_de(data, archivo))
            nombres.append(archivo.name)
        except Exception as e:
            logs.append(f"[error] {archivo.name}: {e}")
    return Xs, masks, labels, tipos, sessions, nombres


def main():
    print("=" * 64)
    print("SignAI - Normalizacion del dataset")
    print("=" * 64)

    logs: list[str] = []
    est = procesar_carpeta(DIR_ESTATICO, "estatico", logs)
    din = procesar_carpeta(DIR_DINAMICO, "dinamico", logs)

    for linea in logs:
        print(linea)

    Xs = est[0] + din[0]
    masks = est[1] + din[1]
    labels = est[2] + din[2]
    tipos = est[3] + din[3]
    sessions = est[4] + din[4]
    nombres = est[5] + din[5]

    if not Xs:
        print("ERROR: no hay muestras validas en dataset_estatico/ ni dataset_dinamico/")
        sys.exit(1)

    clases = sorted(set(labels))
    idx_de = {c: i for i, c in enumerate(clases)}
    y = np.array([idx_de[l] for l in labels], dtype=np.int64)

    X = np.stack(Xs, axis=0).astype(np.float32)
    mask = np.stack(masks, axis=0).astype(np.float32)

    DIR_NORMALIZADO.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(
        PATH_SALIDA,
        X=X, mask=mask, y=y,
        tipos=np.array(tipos), sessions=np.array(sessions),
        nombres=np.array(nombres), clases=np.array(clases),
    )

    meta = {
        "max_seq_len": MAX_SEQ_LEN,
        "feat_per_frame": FEAT_DYNAMIC_PER_FRAME,
        "feat_static_per_frame": FEAT_STATIC_PER_FRAME,
        "feat_coords": FEAT_COORDS,
        "feat_per_hand": FEAT_PER_HAND,
        "coords": COORDS,
        "num_clases": len(clases),
        "clases": clases,
        "total_muestras": int(len(y)),
        "muestras_estaticas": int(sum(1 for t in tipos if t == "estatico")),
        "muestras_dinamicas": int(sum(1 for t in tipos if t == "dinamico")),
    }
    with open(PATH_META, "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)

    print(f"\nMuestras totales: {len(y)}")
    print(f"  Estaticas:  {meta['muestras_estaticas']}")
    print(f"  Dinamicas:  {meta['muestras_dinamicas']}")
    print(f"Clases ({len(clases)}): {clases}")
    print(f"Tensor X: {X.shape}  dtype={X.dtype}")
    print(f"Tensor mask: {mask.shape}")
    print("\nMuestras por clase:")
    cnt = Counter(labels)
    for c in clases:
        print(f"  {c:20s} {cnt[c]:4d}")
    print(f"  total={len(y)}")
    print(f"\nGuardado: {PATH_SALIDA}")
    print(f"Meta:     {PATH_META}")


if __name__ == "__main__":
    main()
