"""
entrenar_estatico_rapido.py

Entrena un clasificador de letras ESTATICAS a partir de un frame unico (sin
buffer de 80 frames ni velocidad/aceleracion). Usa el dataset de landmarks ya
extraidos (MediaPipe Holistic, ambas manos) de:

    "Mexican Sign Language's Dactylology and Ten First Numbers -
     Extracted Features and Models" (Mendeley Data, DOI 10.17632/hmsc33hmkz.1)

copiado en dataset_lsm_rapido/<letra>/<muestra>.npy (vector de 126 floats:
21 puntos x 3 coords de la mano IZQUIERDA + 21 puntos x 3 coords de la mano
DERECHA, en coordenadas de imagen normalizadas [0,1], igual que las devuelve
mediapipe.solutions.hands -- convencion "left luego right" del tutorial del
que viene este dataset).

Reusa la clase SignTransformer de comun.py (mismo formato de checkpoint que
el resto de modelos) pero con max_seq_len=1: al ser una pose estatica de un
solo frame no hace falta ver una secuencia, asi que en vivo el servidor
puede inferir con la mano recien detectada, sin esperar a llenar un buffer.

Uso:
    py entrenar_estatico_rapido.py
"""
from __future__ import annotations

import json
import random
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader

from comun import SignTransformer, DIR_MODELOS, normalizar_mano_plano

RAIZ = Path(__file__).parent
DIR_DATASET = RAIZ / "dataset_lsm_rapido"
DIR_SALIDA = DIR_MODELOS / "estatico_rapido"

SEED = 42
VAL_FRACCION = 0.15
EPOCAS = 120
BATCH = 32
LR = 3e-4
NOISE_STD = 0.01          # aumento de datos: ruido gaussiano sobre landmarks
D_MODEL = 96
N_HEADS = 4
N_LAYERS = 2
DIM_FF = 192
DROPOUT = 0.2

random.seed(SEED)
np.random.seed(SEED)
torch.manual_seed(SEED)


def espejar_muestra(vec126: np.ndarray) -> np.ndarray:
    """Refleja la muestra como si la camara/dataset hubiera espejado la
    imagen al reves: niega la coordenada X de cada punto (ya normalizado,
    origen en la muneca) y cambia el bloque izquierda<->derecha. El
    significado de la letra no cambia (se puede señar con cualquier mano),
    asi el modelo queda invariante a si el video de origen estaba volteado
    o no -- ambiguedad real entre nuestra camara en vivo (cv2.flip) y como
    se haya capturado el dataset externo."""
    left = vec126[:63].reshape(21, 3).copy()
    right = vec126[63:].reshape(21, 3).copy()
    left[:, 0] *= -1
    right[:, 0] *= -1
    return np.concatenate([right.ravel(), left.ravel()]).astype(np.float32)


def cargar_dataset():
    letras = sorted(p.name for p in DIR_DATASET.iterdir() if p.is_dir())
    clases = [l.upper() for l in letras]

    X, y = [], []
    for idx, letra in enumerate(letras):
        for f in sorted((DIR_DATASET / letra).glob("*.npy")):
            vec = np.load(f).astype(np.float32)
            if vec.shape != (126,):
                continue
            # normalizar cada mano (origen en la muneca, escala por tamaño)
            # para que el modelo aprenda la FORMA de la seña, no la posicion
            # ni el tamaño de mano/camara de las 5 personas del dataset.
            vec = np.concatenate([
                normalizar_mano_plano(vec[:63]),
                normalizar_mano_plano(vec[63:]),
            ])
            X.append(vec)
            y.append(idx)
            X.append(espejar_muestra(vec))
            y.append(idx)

    X = np.stack(X)
    y = np.array(y, dtype=np.int64)
    return X, y, clases


class DatasetManos(Dataset):
    def __init__(self, X, y, entrenar: bool):
        self.X = X
        self.y = y
        self.entrenar = entrenar

    def __len__(self):
        return len(self.y)

    def __getitem__(self, i):
        vec = self.X[i].copy()
        if self.entrenar:
            # ruido + pequeña escala aleatoria: la camara en vivo nunca da
            # landmarks identicos a los del dataset (persona/angulo/lente
            # distintos), asi que el modelo debe tolerar variacion.
            vec = vec + np.random.normal(0, NOISE_STD, size=vec.shape).astype(np.float32)
            escala = np.random.uniform(0.95, 1.05)
            vec = vec * escala
        X = vec.reshape(1, 126)             # [T=1, F=126]
        mask = np.ones(1, dtype=np.float32)  # [T=1]
        return X, mask, self.y[i]


def separar_train_val(X, y, val_frac=VAL_FRACCION):
    idx_train, idx_val = [], []
    rng = np.random.RandomState(SEED)
    for c in np.unique(y):
        idx_c = np.where(y == c)[0]
        rng.shuffle(idx_c)
        n_val = max(1, int(len(idx_c) * val_frac))
        idx_val.extend(idx_c[:n_val])
        idx_train.extend(idx_c[n_val:])
    rng.shuffle(idx_train)
    rng.shuffle(idx_val)
    return np.array(idx_train), np.array(idx_val)


def evaluar(model, loader, device):
    model.eval()
    correctos = 0
    total = 0
    with torch.no_grad():
        for X, mask, y in loader:
            X, mask, y = X.to(device), mask.to(device), y.to(device)
            logits = model(X, mask)
            pred = logits.argmax(dim=1)
            correctos += (pred == y).sum().item()
            total += y.size(0)
    return correctos / max(1, total)


def main():
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Dispositivo: {device}")

    X, y, clases = cargar_dataset()
    print(f"Muestras: {len(y)}  Clases ({len(clases)}): {clases}")

    idx_train, idx_val = separar_train_val(X, y)
    print(f"Train: {len(idx_train)}  Val: {len(idx_val)}")

    ds_train = DatasetManos(X[idx_train], y[idx_train], entrenar=True)
    ds_val = DatasetManos(X[idx_val], y[idx_val], entrenar=False)
    dl_train = DataLoader(ds_train, batch_size=BATCH, shuffle=True)
    dl_val = DataLoader(ds_val, batch_size=BATCH, shuffle=False)

    model = SignTransformer(
        input_dim=126,
        num_classes=len(clases),
        d_model=D_MODEL,
        nhead=N_HEADS,
        num_layers=N_LAYERS,
        dim_ff=DIM_FF,
        dropout=DROPOUT,
        max_len=1,
    ).to(device)

    opt = torch.optim.AdamW(model.parameters(), lr=LR, weight_decay=1e-4)
    sched = torch.optim.lr_scheduler.CosineAnnealingLR(opt, T_max=EPOCAS)
    crit = nn.CrossEntropyLoss(label_smoothing=0.05)

    mejor_acc = 0.0
    DIR_SALIDA.mkdir(parents=True, exist_ok=True)

    for epoca in range(1, EPOCAS + 1):
        model.train()
        loss_total = 0.0
        for X_b, mask_b, y_b in dl_train:
            X_b, mask_b, y_b = X_b.to(device), mask_b.to(device), y_b.to(device)
            opt.zero_grad()
            logits = model(X_b, mask_b)
            loss = crit(logits, y_b)
            loss.backward()
            opt.step()
            loss_total += loss.item() * y_b.size(0)
        sched.step()

        if epoca % 5 == 0 or epoca == EPOCAS:
            acc_val = evaluar(model, dl_val, device)
            print(f"[{epoca:3d}/{EPOCAS}] loss={loss_total/len(ds_train):.4f} "
                  f"val_acc={acc_val*100:.1f}%")
            if acc_val >= mejor_acc:
                mejor_acc = acc_val
                torch.save(model.state_dict(), DIR_SALIDA / "signai_transformer.pth")

    print(f"Mejor val_acc: {mejor_acc*100:.1f}% -> guardado en {DIR_SALIDA}")

    with open(DIR_SALIDA / "label_map.json", "w", encoding="utf-8") as f:
        json.dump({"classes": clases}, f, ensure_ascii=False, indent=2)

    with open(DIR_SALIDA / "feature_meta.json", "w", encoding="utf-8") as f:
        json.dump({
            "input_dim": 126,
            "num_classes": len(clases),
            "d_model": D_MODEL,
            "n_heads": N_HEADS,
            "n_layers": N_LAYERS,
            "dim_ff": DIM_FF,
            "dropout": DROPOUT,
            "max_seq_len": 1,
            "best_val_acc": mejor_acc,
            "features": "manos_crudas_126 (21 pts x XYZ imagen, izquierda+derecha, frame unico)",
        }, f, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    main()
