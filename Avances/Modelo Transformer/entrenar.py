"""
entrenar.py

Entrena el SignAI Transformer (arquitectura en comun.py) sobre el dataset
unificado dataset_normalizado/data.npz generado por normalizar.py.

Receta (recuperada del entrenar.py original + mejoras):
  - AdamW, warmup lineal + coseno, label smoothing, grad clip, AMP en CUDA.
  - Augmentacion on-the-fly: ruido gaussiano, escala, frame-dropout, time-warp.
  - Hard-negative mining: cada N epocas las clases con val_acc baja pesan mas
    en el sampler.
  - Split POR SESION estratificado por clase (el original hacia split
    estratificado por muestra, con fuga: frames casi identicos de la misma
    rafaga de captura caian en train y val, inflando val_acc a ~1.0).
    Clases con una sola sesion caen a split por muestra CON AVISO.

Salida: modelos/<nombre>/{signai_transformer.pth, label_map.json,
        feature_meta.json, split.json}
  - feature_meta.json incluye "coords" (espacio de coordenadas del dataset)
    para que el servidor construya las features en el mismo espacio.
  - split.json guarda los indices train/val para que evaluar.py evalue
    exactamente el mismo val set.

Uso:
    py entrenar.py <nombre> [--clases estaticas|dinamicas|todas]
                   [--epochs N] [--val-ratio F] [--batch N] [--seed N]
    py entrenar.py unificado --clases todas
"""
from __future__ import annotations

import sys
import json
import time
import random
import argparse
from pathlib import Path
from collections import Counter

import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader, WeightedRandomSampler

from comun import (
    DIR_NORMALIZADO, DIR_MODELOS, MAX_SEQ_LEN, FEAT_DYNAMIC_PER_FRAME,
    FEAT_COORDS, FEAT_PER_HAND, SignTransformer,
)

PATH_DATA = DIR_NORMALIZADO / "data.npz"
PATH_META_DATA = DIR_NORMALIZADO / "meta.json"

SEED = 42
BATCH_SIZE = 64
EPOCHS = 120
PATIENCE = 20
LR_BASE = 1e-4
LR_MIN = 1e-6
WARMUP_EPOCHS = 5
WEIGHT_DECAY = 0.01
GRAD_CLIP = 1.0
LABEL_SMOOTHING = 0.1

D_MODEL = 256
N_HEADS = 8
N_LAYERS = 6
DIM_FF = 1024
DROPOUT = 0.15

# Hard-negative mining: cada HN_CADA_EPOCAS, las clases con val_acc por debajo
# de HN_UMBRAL_ACC multiplican su peso de muestreo por HN_FACTOR (tope HN_PESO_MAX).
HN_CADA_EPOCAS = 10
HN_UMBRAL_ACC = 0.85
HN_FACTOR = 1.3
HN_PESO_MAX = 5.0

AUG_NOISE_STD = 0.01
AUG_SCALE_MIN = 0.95
AUG_SCALE_MAX = 1.05
AUG_FRAME_DROPOUT_P = 0.1
AUG_FRAME_DROPOUT_MAX = 0.15
AUG_TIME_WARP_P = 0.3
AUG_TIME_WARP_MIN = 0.9
AUG_TIME_WARP_MAX = 1.1
# Rotacion 3D aleatoria de la escena (no estaba en la receta original).
# Ataca el modo de fallo dominante del split por sesion: sesiones enteras de
# letras parecidas (R->U, S->A/T, I->C, P->U) colapsan porque la orientacion
# de la mano cambia entre sesiones y el modelo no es invariante a rotacion.
AUG_ROT_P = 0.5
AUG_ROT_MAX = 0.15   # radianes (~8.6 grados)

VAL_RATIO_SESIONES = 0.2


def fijar_semillas(seed: int):
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)


def indices_escalables() -> np.ndarray:
    """Mascara booleana [442] de features que escalan linealmente con las
    coords (coords + distancias + vel + acc). Angulos, normal de palma y flags
    no se tocan al augmentar escala."""
    idx = np.zeros(FEAT_DYNAMIC_PER_FRAME, dtype=bool)
    for base in (0, FEAT_PER_HAND):            # Right, Left
        idx[base:base + FEAT_COORDS] = True    # 63 coords
        idx[base + FEAT_COORDS:base + FEAT_COORDS + 12] = True  # 12 distancias
    idx[FEAT_PER_HAND * 2:] = True             # 126 vel + 126 acc
    return idx


SCALE_IDX = indices_escalables()

# Bloques de features que son vectores 3D y deben rotarse juntos con la misma
# rotacion de escena: coords de cada mano (21 pts), normal de palma (1 vec),
# velocidades y aceleraciones (42 pts cada una: 21 por mano).
ROT_BLOCKS = [
    (0, 21),                                   # coords Right
    (FEAT_PER_HAND, 21),                       # coords Left
    (FEAT_COORDS + 27, 1),                     # normal palma Right (offset 90)
    (FEAT_PER_HAND + FEAT_COORDS + 27, 1),     # normal palma Left
    (FEAT_PER_HAND * 2, 42),                   # velocidades
    (FEAT_PER_HAND * 2 + FEAT_COORDS * 2, 42), # aceleraciones
]


def rotacion_aleatoria(rng, max_rad: float) -> np.ndarray:
    """Matriz de rotacion 3D alrededor de un eje aleatorio (Rodrigues)."""
    eje = rng.normal(size=3)
    eje /= max(np.linalg.norm(eje), 1e-8)
    ang = rng.uniform(-max_rad, max_rad)
    K = np.array([
        [0, -eje[2], eje[1]],
        [eje[2], 0, -eje[0]],
        [-eje[1], eje[0], 0],
    ])
    return (np.eye(3) + np.sin(ang) * K
            + (1 - np.cos(ang)) * (K @ K)).astype(np.float32)


class SignDataset(Dataset):
    """Dataset con augmentacion on-the-fly (solo si augmentar=True)."""

    def __init__(self, X, mask, y, augmentar: bool, rng: np.random.RandomState):
        self.X = X
        self.mask = mask
        self.y = y
        self.augmentar = augmentar
        self.rng = rng

    def __len__(self):
        return len(self.y)

    def _time_warp(self, X, mask):
        T = int(mask.sum())
        if T < 4:
            return X, mask
        f = self.rng.uniform(AUG_TIME_WARP_MIN, AUG_TIME_WARP_MAX)
        T2 = int(np.clip(round(T * f), 2, MAX_SEQ_LEN))
        if T2 == T:
            return X, mask
        idx = np.linspace(0, T - 1, num=T2)
        i0 = np.floor(idx).astype(int)
        i1 = np.minimum(i0 + 1, T - 1)
        w = (idx - i0).astype(np.float32)[:, None]
        seq = X[i0] * (1.0 - w) + X[i1] * w
        X2 = np.zeros_like(X)
        X2[:T2] = seq
        m2 = np.zeros_like(mask)
        m2[:T2] = 1.0
        return X2, m2

    def _augmentar(self, X, mask):
        X = X.copy()
        mask = mask.copy()
        if self.rng.rand() < AUG_TIME_WARP_P:
            X, mask = self._time_warp(X, mask)
        T = int(mask.sum())
        if T == 0:
            return X, mask
        if self.rng.rand() < AUG_ROT_P:
            R = rotacion_aleatoria(self.rng, AUG_ROT_MAX)
            for ini, npts in ROT_BLOCKS:
                seg = X[:T, ini:ini + npts * 3].reshape(T, npts, 3)
                X[:T, ini:ini + npts * 3] = (seg @ R.T).reshape(T, -1)
        f = self.rng.uniform(AUG_SCALE_MIN, AUG_SCALE_MAX)
        X[:T, SCALE_IDX] *= f
        if self.rng.rand() < AUG_FRAME_DROPOUT_P and T > 2:
            k = self.rng.randint(1, max(2, int(T * AUG_FRAME_DROPOUT_MAX) + 1))
            drop = self.rng.choice(T, size=min(k, T - 2), replace=False)
            X[drop] = 0.0   # simula frames sin deteccion (mano "ausente")
        X[:T] += self.rng.normal(0.0, AUG_NOISE_STD, size=X[:T].shape).astype(np.float32)
        return X, mask

    def __getitem__(self, i):
        X, mask = self.X[i], self.mask[i]
        if self.augmentar:
            X, mask = self._augmentar(X, mask)
        return (
            torch.from_numpy(np.ascontiguousarray(X)),
            torch.from_numpy(np.ascontiguousarray(mask)),
            int(self.y[i]),
        )


def split_por_sesion(sessions, y, val_ratio, rng):
    """Split train/val asignando SESIONES completas de cada clase a val
    (sin fuga entre rafagas de captura). Clases con una sola sesion caen a
    split por muestra; se devuelven como avisos."""
    train_idx, val_idx, avisos = [], [], []
    for c in np.unique(y):
        idx_c = np.where(y == c)[0]
        por_sesion: dict = {}
        for i in idx_c:
            por_sesion.setdefault(sessions[i], []).append(int(i))
        ses = sorted(por_sesion)
        rng.shuffle(ses)
        if len(ses) >= 2:
            n_val = min(len(ses) - 1, max(1, int(round(len(ses) * val_ratio))))
            for s in ses[:n_val]:
                val_idx.extend(por_sesion[s])
            for s in ses[n_val:]:
                train_idx.extend(por_sesion[s])
        else:
            avisos.append(int(c))
            idx = list(idx_c)
            rng.shuffle(idx)
            n_val = max(1, int(round(len(idx) * val_ratio))) if len(idx) > 1 else 0
            val_idx.extend(idx[:n_val])
            train_idx.extend(idx[n_val:])
    return np.array(sorted(train_idx)), np.array(sorted(val_idx)), avisos


def split_estratificado(y, val_ratio, rng):
    """Split por muestra estratificado por clase. Val con FUGA entre sesiones:
    NO sirve para medir generalizacion, solo como senal de early-stopping al
    entrenar el modelo de DESPLIEGUE con todas las sesiones en train (asi el
    modelo ve todas las condiciones de captura, como el estatico original)."""
    train_idx, val_idx = [], []
    for c in np.unique(y):
        idx = list(np.where(y == c)[0])
        rng.shuffle(idx)
        n_val = max(1, int(round(len(idx) * val_ratio))) if len(idx) > 1 else 0
        val_idx.extend(idx[:n_val])
        train_idx.extend(idx[n_val:])
    return np.array(sorted(train_idx)), np.array(sorted(val_idx)), []


def crear_scheduler(optimizer, total_epochs, warmup_epochs, lr_base, lr_min):
    def lr_lambda(epoch):
        if epoch < warmup_epochs:
            return (epoch + 1) / warmup_epochs
        prog = (epoch - warmup_epochs) / max(1, total_epochs - warmup_epochs)
        cos = 0.5 * (1.0 + np.cos(np.pi * min(1.0, prog)))
        return (lr_min + (lr_base - lr_min) * cos) / lr_base
    return torch.optim.lr_scheduler.LambdaLR(optimizer, lr_lambda)


def accuracy_por_clase(y_true, y_pred, num_classes):
    acc = np.full(num_classes, np.nan, dtype=np.float32)
    for c in range(num_classes):
        m = y_true == c
        if m.sum() > 0:
            acc[c] = (y_pred[m] == c).mean()
    return acc


def entrenar_epoca(model, loader, optimizer, criterion, scaler, device, use_amp):
    model.train()
    loss_total, correct, total = 0.0, 0, 0
    for xb, mb, yb in loader:
        xb, mb, yb = xb.to(device), mb.to(device), yb.to(device)
        optimizer.zero_grad(set_to_none=True)
        with torch.autocast(device_type="cuda", dtype=torch.float16, enabled=use_amp):
            logits = model(xb, mb)
            loss = criterion(logits, yb)
        if use_amp:
            scaler.scale(loss).backward()
            scaler.unscale_(optimizer)
            nn.utils.clip_grad_norm_(model.parameters(), GRAD_CLIP)
            scaler.step(optimizer)
            scaler.update()
        else:
            loss.backward()
            nn.utils.clip_grad_norm_(model.parameters(), GRAD_CLIP)
            optimizer.step()
        loss_total += loss.item() * yb.size(0)
        correct += (logits.argmax(dim=1) == yb).sum().item()
        total += yb.size(0)
    return loss_total / max(1, total), correct / max(1, total)


@torch.no_grad()
def evaluar(model, loader, criterion, device):
    model.eval()
    loss_total, total = 0.0, 0
    ys, preds = [], []
    for xb, mb, yb in loader:
        xb, mb, yb = xb.to(device), mb.to(device), yb.to(device)
        logits = model(xb, mb)
        loss_total += criterion(logits, yb).item() * yb.size(0)
        total += yb.size(0)
        ys.append(yb.cpu().numpy())
        preds.append(logits.argmax(dim=1).cpu().numpy())
    y_true = np.concatenate(ys) if ys else np.array([], dtype=np.int64)
    y_pred = np.concatenate(preds) if preds else np.array([], dtype=np.int64)
    acc = (y_true == y_pred).mean() if total else 0.0
    return loss_total / max(1, total), float(acc), y_true, y_pred


def main():
    ap = argparse.ArgumentParser(description="Entrena el SignAI Transformer.")
    ap.add_argument("nombre", help="Nombre del modelo (subcarpeta en modelos/).")
    ap.add_argument("--clases", choices=["estaticas", "dinamicas", "todas"],
                    default="todas")
    ap.add_argument("--split", choices=["sesion", "muestras"], default="sesion",
                    help="'sesion' = honesto (medir); 'muestras' = todas las "
                         "sesiones en train (modelo de despliegue).")
    ap.add_argument("--epochs", type=int, default=EPOCHS)
    ap.add_argument("--val-ratio", type=float, default=VAL_RATIO_SESIONES)
    ap.add_argument("--batch", type=int, default=BATCH_SIZE)
    ap.add_argument("--seed", type=int, default=SEED)
    args = ap.parse_args()

    fijar_semillas(args.seed)

    if not PATH_DATA.exists():
        print(f"ERROR: no existe {PATH_DATA}. Corre primero normalizar.py.")
        sys.exit(1)

    print("=" * 64)
    print(f"SignAI - Entrenamiento  ->  modelos/{args.nombre}/  ({args.clases})")
    print("=" * 64)

    z = np.load(PATH_DATA)
    X, mask = z["X"], z["mask"]
    y_full, tipos = z["y"].astype(np.int64), z["tipos"]
    sessions, clases_full = z["sessions"], z["clases"].tolist()
    coords = "image"
    if PATH_META_DATA.exists():
        with open(PATH_META_DATA, "r", encoding="utf-8") as f:
            coords = json.load(f).get("coords", "image")

    if args.clases == "estaticas":
        sel = tipos == "estatico"
    elif args.clases == "dinamicas":
        sel = tipos == "dinamico"
    else:
        sel = np.ones(len(y_full), dtype=bool)

    idx_sel = np.where(sel)[0]
    clases = sorted(set(clases_full[c] for c in y_full[idx_sel]))
    remap = {clases_full.index(c): i for i, c in enumerate(clases)}
    y = np.array([remap[c] for c in y_full[idx_sel]], dtype=np.int64)
    X, mask, sessions = X[idx_sel], mask[idx_sel], sessions[idx_sel]

    print(f"Muestras: {len(y)}  Clases ({len(clases)}): {clases}")
    print(f"Coords: {coords}")

    rng = np.random.RandomState(args.seed)
    if args.split == "sesion":
        tr, va, avisos = split_por_sesion(sessions, y, args.val_ratio, rng)
        print(f"Split por sesion: train={len(tr)}  val={len(va)}")
        if avisos:
            print("[aviso] clases con UNA sola sesion (split por muestra, con "
                  f"posible fuga): {[clases[c] for c in avisos]}")
    else:
        tr, va, avisos = split_estratificado(y, args.val_ratio, rng)
        print(f"Split por muestras (despliegue): train={len(tr)}  val={len(va)}")
        print("[aviso] val con fuga entre sesiones: metricas NO miden "
              "generalizacion; usar una corrida --split sesion para medir.")

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    use_amp = device.type == "cuda"
    print(f"Dispositivo: {device}  AMP: {use_amp}")

    rng_aug = np.random.RandomState(args.seed + 1)
    train_ds = SignDataset(X[tr], mask[tr], y[tr], augmentar=True, rng=rng_aug)
    val_ds = SignDataset(X[va], mask[va], y[va], augmentar=False, rng=rng_aug)
    val_loader = DataLoader(val_ds, batch_size=args.batch, shuffle=False)

    class_w = np.ones(len(clases), dtype=np.float64)

    def crear_train_loader():
        pesos = class_w[y[tr]]
        sampler = WeightedRandomSampler(
            torch.from_numpy(pesos), num_samples=len(tr), replacement=True)
        return DataLoader(train_ds, batch_size=args.batch, sampler=sampler)

    train_loader = crear_train_loader()

    model = SignTransformer(
        input_dim=FEAT_DYNAMIC_PER_FRAME, num_classes=len(clases),
        d_model=D_MODEL, nhead=N_HEADS, num_layers=N_LAYERS,
        dim_ff=DIM_FF, dropout=DROPOUT, max_len=MAX_SEQ_LEN,
    ).to(device)
    n_params = sum(p.numel() for p in model.parameters())
    print(f"Parametros: {n_params/1e6:.2f}M")

    criterion = nn.CrossEntropyLoss(label_smoothing=LABEL_SMOOTHING)
    optimizer = torch.optim.AdamW(
        model.parameters(), lr=LR_BASE, weight_decay=WEIGHT_DECAY)
    scheduler = crear_scheduler(optimizer, args.epochs, WARMUP_EPOCHS, LR_BASE, LR_MIN)
    scaler = torch.amp.GradScaler("cuda", enabled=use_amp)

    dir_salida = DIR_MODELOS / args.nombre
    dir_salida.mkdir(parents=True, exist_ok=True)

    best_acc, best_loss, best_epoca = -1.0, float("inf"), 0
    best_state = None
    sin_mejora = 0
    t0 = time.time()

    for epoca in range(1, args.epochs + 1):
        tr_loss, tr_acc = entrenar_epoca(
            model, train_loader, optimizer, criterion, scaler, device, use_amp)
        va_loss, va_acc, y_true, y_pred = evaluar(model, val_loader, criterion, device)
        scheduler.step()

        mejor = va_acc > best_acc or (va_acc == best_acc and va_loss < best_loss)
        if mejor:
            best_acc, best_loss, best_epoca = va_acc, va_loss, epoca
            best_state = {k: v.detach().cpu().clone() for k, v in model.state_dict().items()}
            sin_mejora = 0
        else:
            sin_mejora += 1

        print(f"Epoca {epoca:03d} | train {tr_loss:.4f}/{tr_acc*100:5.1f}% | "
              f"val {va_loss:.4f}/{va_acc*100:5.1f}% | "
              f"lr {optimizer.param_groups[0]['lr']:.2e}"
              + ("  *" if mejor else ""))

        # hard-negative mining: clases flojas pesan mas en el sampler
        if epoca % HN_CADA_EPOCAS == 0:
            acc_c = accuracy_por_clase(y_true, y_pred, len(clases))
            flojas = [i for i, a in enumerate(acc_c)
                      if not np.isnan(a) and a < HN_UMBRAL_ACC]
            if flojas:
                for c in flojas:
                    class_w[c] = min(HN_PESO_MAX, class_w[c] * HN_FACTOR)
                train_loader = crear_train_loader()
                print(f"  [HN] refuerzo: {[clases[c] for c in flojas]}")

        if sin_mejora >= PATIENCE:
            print(f"Early stopping (sin mejora en {PATIENCE} epocas).")
            break

    dur = time.time() - t0
    print(f"\nMejor val_acc={best_acc:.4f} (epoca {best_epoca})  [{dur/60:.1f} min]")

    torch.save(best_state, dir_salida / "signai_transformer.pth")
    with open(dir_salida / "label_map.json", "w", encoding="utf-8") as f:
        json.dump({"classes": clases}, f, ensure_ascii=False, indent=2)
    with open(dir_salida / "feature_meta.json", "w", encoding="utf-8") as f:
        json.dump({
            "input_dim": FEAT_DYNAMIC_PER_FRAME,
            "num_classes": len(clases),
            "d_model": D_MODEL,
            "n_heads": N_HEADS,
            "n_layers": N_LAYERS,
            "dim_ff": DIM_FF,
            "dropout": DROPOUT,
            "max_seq_len": MAX_SEQ_LEN,
            "coords": coords,
            "split": args.split,
            "best_val_loss": best_loss,
            "best_val_acc": best_acc,
            "epoca": best_epoca,
        }, f, ensure_ascii=False, indent=2)
    with open(dir_salida / "split.json", "w", encoding="utf-8") as f:
        json.dump({
            "seed": args.seed,
            "val_ratio": args.val_ratio,
            "clases_arg": args.clases,
            "split": args.split,
            "train": [int(idx_sel[i]) for i in tr],   # indices sobre data.npz
            "val": [int(idx_sel[i]) for i in va],
        }, f)

    print(f"Guardado en: {dir_salida}")


if __name__ == "__main__":
    main()
