"""
exportar_fixture_features.py

Genera fixtures JSON para validar el port TypeScript del pipeline de features
de SignAI Mobile (lib/sign). Cada fixture contiene: landmarks de entrada
(coords de imagen), las features [T, 190] esperadas, el tensor [80, 442] con
su mask, y los logits del modelo unificado — todo calculado con el pipeline
Python de referencia (comun.py / SignAI.py).

Uso:
    py exportar_fixture_features.py
    py exportar_fixture_features.py --out "C:/SignAI Mobile/signai-mobile/lib/sign/__fixtures__/paridad.json"
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import torch

from comun import (
    DIR_ESTATICO, DIR_DINAMICO, FRAMES_ESTATICO,
    features_frame, leer_json, tuplas_de_dicts,
)
from SignAI import construir_tensor

RAIZ = Path(__file__).parent
DIR_MODELO = RAIZ / "modelos" / "unificado"
OUT_DEFAULT = Path("C:/SignAI Mobile/signai-mobile/lib/sign/__fixtures__/paridad.json")

R = 9  # decimales en el JSON (suficiente para tolerancias de 1e-5 en el test TS)


def rr(x):
    """Redondeo recursivo para adelgazar el JSON."""
    if isinstance(x, float):
        return round(x, R)
    if isinstance(x, (list, tuple)):
        return [rr(v) for v in x]
    if isinstance(x, np.ndarray):
        return rr(x.tolist())
    return x


def pts_imagen(entrada_mano):
    if entrada_mano is None:
        return None
    pts = entrada_mano.get("image") if isinstance(entrada_mano, dict) else entrada_mano
    if not pts:
        return None
    if isinstance(pts[0], dict):
        return tuplas_de_dicts(pts)
    return [tuple(p) for p in pts]


def frames_de_muestra_dinamica(data: dict):
    """[{right: [[x,y,z]]|None, left: ...}] desde un JSON del grabador."""
    frames = []
    for f in data["secuencia"]:
        frames.append({
            "right": pts_imagen(f.get("Right")),
            "left": pts_imagen(f.get("Left")),
        })
    return frames


def frames_de_muestra_estatica(data: dict):
    """Secuencia sintética de FRAMES_ESTATICO frames idénticos (como
    normalizar.py): una sola mano, la contraria ausente."""
    pts = tuplas_de_dicts(data["landmarks"])
    lado = data.get("hand_type", "Right")
    frame = {"right": pts if lado == "Right" else None,
             "left": pts if lado == "Left" else None}
    return [dict(frame) for _ in range(FRAMES_ESTATICO)]


def procesar(nombre: str, gesto: str, frames):
    feats = [features_frame(
        [tuple(p) for p in f["right"]] if f["right"] else None,
        [tuple(p) for p in f["left"]] if f["left"] else None,
    ) for f in frames]
    X, mask = construir_tensor(feats)
    return {
        "nombre": nombre,
        "gesto": gesto,
        "frames": rr([{ "right": f["right"], "left": f["left"] } for f in frames]),
        "features": rr(np.stack(feats)),
        "X": rr(X),
        "mask": rr(mask),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=str(OUT_DEFAULT))
    ap.add_argument("--n-dinamicas", type=int, default=2)
    ap.add_argument("--n-estaticas", type=int, default=2)
    args = ap.parse_args()

    muestras = []

    din = sorted(DIR_DINAMICO.glob("*.json"))[: args.n_dinamicas]
    for p in din:
        data = leer_json(p)
        muestras.append(procesar(p.name, data["gesto"],
                                  frames_de_muestra_dinamica(data)))

    est = sorted(DIR_ESTATICO.glob("*.json"))[: args.n_estaticas]
    for p in est:
        data = leer_json(p)
        muestras.append(procesar(p.name, data["gesto"],
                                  frames_de_muestra_estatica(data)))

    if not muestras:
        raise SystemExit("No se encontraron muestras en los datasets crudos.")

    # Logits de referencia con el modelo unificado (mismo .onnx que va al
    # teléfono; aquí se usa PyTorch, cuya paridad con ONNX valida
    # exportar_onnx.py --validar).
    from exportar_onnx import cargar_modelo
    model, meta, clases = cargar_modelo(DIR_MODELO)
    for m in muestras:
        X = np.asarray(m["X"], dtype=np.float32)[None]
        mask = np.asarray(m["mask"], dtype=np.float32)[None]
        with torch.no_grad():
            logits = model(torch.from_numpy(X), torch.from_numpy(mask))[0].numpy()
        m["logits"] = rr(logits)
        m["pred"] = clases[int(np.argmax(logits))]
        print(f"  {m['nombre']}: gesto={m['gesto']} pred={m['pred']}")

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    with open(out, "w", encoding="utf-8") as f:
        json.dump({"clases": clases, "muestras": muestras}, f)
    print(f"[fixture] {len(muestras)} muestras -> {out} "
          f"({out.stat().st_size / 1e6:.1f} MB)")


if __name__ == "__main__":
    main()
