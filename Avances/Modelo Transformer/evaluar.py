"""
evaluar.py

Evaluacion formal de un modelo entrenado con entrenar.py:
  - accuracy global y por clase sobre el val set POR SESION (split.json
    guardado al entrenar; sin fuga de sesiones).
  - matriz de confusion (texto + CSV, y PNG si matplotlib esta disponible).
  - modo "condicion en vivo" (--ventana N): evalua usando solo los primeros
    N frames validos de cada muestra, simulando la ventana deslizante del
    servidor (mide que tan pronto acierta el modelo).

Salida: modelos/<nombre>/eval/{reporte.txt, confusion.csv, confusion.png}

Uso:
    py evaluar.py <nombre>
    py evaluar.py <nombre> --ventana 15
"""
from __future__ import annotations

import sys
import json
import argparse
from pathlib import Path

import numpy as np
import torch

from comun import DIR_NORMALIZADO, DIR_MODELOS, SignTransformer

PATH_DATA = DIR_NORMALIZADO / "data.npz"
BATCH = 256


def cargar_modelo(dir_modelo: Path, device):
    with open(dir_modelo / "label_map.json", "r", encoding="utf-8") as f:
        clases = json.load(f)["classes"]
    with open(dir_modelo / "feature_meta.json", "r", encoding="utf-8") as f:
        meta = json.load(f)
    model = SignTransformer(
        input_dim=meta["input_dim"], num_classes=meta["num_classes"],
        d_model=meta["d_model"], nhead=meta["n_heads"],
        num_layers=meta["n_layers"], dim_ff=meta["dim_ff"],
        dropout=meta["dropout"], max_len=meta["max_seq_len"],
    ).to(device)
    state = torch.load(dir_modelo / "signai_transformer.pth", map_location=device)
    model.load_state_dict(state)
    model.eval()
    return model, clases, meta


def truncar_a_ventana(X, mask, n):
    """Deja solo los primeros n frames validos de cada muestra (simula la
    ventana deslizante en vivo, que ve el arranque de la senia)."""
    X2 = np.zeros_like(X)
    m2 = np.zeros_like(mask)
    for i in range(X.shape[0]):
        T = int(mask[i].sum())
        k = min(n, T)
        X2[i, :k] = X[i, :k]
        m2[i, :k] = 1.0
    return X2, m2


@torch.no_grad()
def predecir(model, X, mask, device):
    preds = []
    for i in range(0, X.shape[0], BATCH):
        xb = torch.from_numpy(X[i:i + BATCH]).to(device)
        mb = torch.from_numpy(mask[i:i + BATCH]).to(device)
        logits = model(xb, mb)
        preds.append(logits.argmax(dim=1).cpu().numpy())
    return np.concatenate(preds)


def main():
    ap = argparse.ArgumentParser(description="Evalua un modelo SignAI.")
    ap.add_argument("nombre", help="Nombre del modelo (subcarpeta en modelos/).")
    ap.add_argument("--ventana", type=int, default=0,
                    help="Evaluar solo con los primeros N frames validos.")
    args = ap.parse_args()

    dir_modelo = DIR_MODELOS / args.nombre
    if not (dir_modelo / "signai_transformer.pth").exists():
        print(f"ERROR: no existe el modelo en {dir_modelo}")
        sys.exit(1)
    path_split = dir_modelo / "split.json"
    if not path_split.exists():
        print(f"ERROR: {path_split} no existe (el modelo no fue entrenado con "
              "entrenar.py). No hay val set reproducible que evaluar.")
        sys.exit(1)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model, clases, meta = cargar_modelo(dir_modelo, device)

    z = np.load(PATH_DATA)
    with open(path_split, "r", encoding="utf-8") as f:
        split = json.load(f)
    va = np.array(split["val"], dtype=np.int64)

    clases_full = z["clases"].tolist()
    X, mask = z["X"][va], z["mask"][va]
    y = np.array([clases.index(clases_full[c]) for c in z["y"][va]], dtype=np.int64)

    etiqueta = f"val ({len(va)} muestras, split por sesion)"
    if args.ventana > 0:
        X, mask = truncar_a_ventana(X, mask, args.ventana)
        etiqueta += f", ventana={args.ventana} frames"

    y_pred = predecir(model, X, mask, device)

    acc = (y_pred == y).mean()
    C = len(clases)
    conf = np.zeros((C, C), dtype=np.int64)
    for t, p in zip(y, y_pred):
        conf[t, p] += 1

    lineas = []
    lineas.append(f"Modelo: {args.nombre}  ({meta.get('num_classes')} clases, "
                  f"coords={meta.get('coords', '?')}, split={meta.get('split', '?')})")
    lineas.append(f"Evaluacion: {etiqueta}")
    lineas.append(f"Accuracy global: {acc*100:.2f}%")
    lineas.append("")
    lineas.append(f"{'clase':12s} {'n':>5s} {'acc':>7s}   principales confusiones")
    for c in range(C):
        n = conf[c].sum()
        if n == 0:
            lineas.append(f"{clases[c]:12s} {0:5d}      -")
            continue
        acc_c = conf[c, c] / n
        errores = [(conf[c, j], clases[j]) for j in range(C) if j != c and conf[c, j] > 0]
        errores.sort(reverse=True)
        txt_err = ", ".join(f"{nom}({k})" for k, nom in errores[:3])
        lineas.append(f"{clases[c]:12s} {n:5d} {acc_c*100:6.1f}%   {txt_err}")

    reporte = "\n".join(lineas)
    print(reporte)

    dir_eval = dir_modelo / "eval"
    dir_eval.mkdir(exist_ok=True)
    sufijo = f"_ventana{args.ventana}" if args.ventana > 0 else ""
    with open(dir_eval / f"reporte{sufijo}.txt", "w", encoding="utf-8") as f:
        f.write(reporte + "\n")

    # CSV de la matriz de confusion (filas = real, columnas = prediccion)
    with open(dir_eval / f"confusion{sufijo}.csv", "w", encoding="utf-8") as f:
        f.write("real\\pred," + ",".join(clases) + "\n")
        for c in range(C):
            f.write(clases[c] + "," + ",".join(str(v) for v in conf[c]) + "\n")

    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        fig, ax = plt.subplots(figsize=(max(6, C * 0.4),) * 2)
        with np.errstate(invalid="ignore"):
            norm = conf / np.maximum(conf.sum(axis=1, keepdims=True), 1)
        ax.imshow(norm, cmap="Blues", vmin=0, vmax=1)
        ax.set_xticks(range(C)); ax.set_xticklabels(clases, rotation=90, fontsize=7)
        ax.set_yticks(range(C)); ax.set_yticklabels(clases, fontsize=7)
        ax.set_xlabel("prediccion"); ax.set_ylabel("real")
        ax.set_title(f"{args.nombre} — acc {acc*100:.1f}% ({etiqueta})", fontsize=8)
        fig.tight_layout()
        fig.savefig(dir_eval / f"confusion{sufijo}.png", dpi=150)
        print(f"\nPNG: {dir_eval / f'confusion{sufijo}.png'}")
    except ImportError:
        print("\n(matplotlib no disponible: solo reporte.txt y confusion.csv)")

    print(f"Guardado en: {dir_eval}")


if __name__ == "__main__":
    main()
