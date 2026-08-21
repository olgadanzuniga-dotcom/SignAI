"""
exportar_onnx.py

Exporta un modelo SignTransformer (.pth) a ONNX para la inferencia on-device
de SignAI Mobile (onnxruntime-react-native), y valida la paridad de logits
entre PyTorch y ONNX Runtime.

Shapes FIJAS [1, 80, input_dim] + mask [1, 80]: el pipeline en vivo siempre
padea/submuestrea a MAX_SEQ_LEN, y las shapes fijas rinden mejor en movil.

Uso:
    py exportar_onnx.py --modelo modelos/unificado
    py exportar_onnx.py --modelo modelos/unificado --validar
    py exportar_onnx.py --modelo modelos/unificado --out otra/ruta.onnx
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import torch

from comun import SignTransformer, MAX_SEQ_LEN, DIR_NORMALIZADO

RAIZ = Path(__file__).parent


def cargar_modelo(dir_modelo: Path):
    with open(dir_modelo / "feature_meta.json", "r", encoding="utf-8") as f:
        meta = json.load(f)
    with open(dir_modelo / "label_map.json", "r", encoding="utf-8") as f:
        clases = json.load(f)["classes"]

    model = SignTransformer(
        input_dim=meta["input_dim"],
        num_classes=meta["num_classes"],
        d_model=meta["d_model"],
        nhead=meta["n_heads"],
        num_layers=meta["n_layers"],
        dim_ff=meta["dim_ff"],
        dropout=meta["dropout"],
        max_len=meta["max_seq_len"],
    )
    state = torch.load(dir_modelo / "signai_transformer.pth", map_location="cpu")
    model.load_state_dict(state)
    model.eval()
    # El fast-path de nested tensors no es exportable a ONNX.
    model.encoder.enable_nested_tensor = False
    return model, meta, clases


def exportar(model, meta, out_path: Path):
    T = meta["max_seq_len"]
    F = meta["input_dim"]
    x = torch.randn(1, T, F, dtype=torch.float32)
    # Mask float (1=valido, 0=pad), igual que en inferencia real.
    mask = torch.ones(1, T, dtype=torch.float32)
    mask[0, T // 2:] = 0.0  # ejemplo con padding para trazar ambos caminos

    torch.onnx.export(
        model,
        (x, mask),
        str(out_path),
        opset_version=17,
        input_names=["x", "mask"],
        output_names=["logits"],
        dynamo=False,
    )
    print(f"[export] ONNX escrito en {out_path} "
          f"({out_path.stat().st_size / 1e6:.1f} MB)")


def validar(model, meta, out_path: Path, n_random: int = 20, n_real: int = 20):
    import onnxruntime as ort

    T = meta["max_seq_len"]
    F = meta["input_dim"]
    sess = ort.InferenceSession(str(out_path), providers=["CPUExecutionProvider"])

    casos = []
    rng = np.random.default_rng(42)
    for _ in range(n_random):
        t_real = int(rng.integers(5, T + 1))
        x = rng.standard_normal((1, T, F)).astype(np.float32)
        x[0, t_real:] = 0.0
        m = np.zeros((1, T), dtype=np.float32)
        m[0, :t_real] = 1.0
        casos.append(("random", x, m))

    npz_path = DIR_NORMALIZADO / "data.npz"
    if npz_path.exists():
        data = np.load(npz_path, allow_pickle=True)
        X, M = data["X"], data["mask"]
        if X.shape[2] == F:
            idx = rng.choice(len(X), size=min(n_real, len(X)), replace=False)
            for i in idx:
                casos.append((f"real[{i}]",
                              X[i:i+1].astype(np.float32),
                              M[i:i+1].astype(np.float32)))
        else:
            print(f"[validar] data.npz tiene input_dim {X.shape[2]} != {F}; "
                  f"solo se validan tensores aleatorios.")
    else:
        print("[validar] no hay dataset_normalizado/data.npz; "
              "solo tensores aleatorios.")

    max_delta = 0.0
    argmax_ok = 0
    for nombre, x, m in casos:
        with torch.no_grad():
            logits_pt = model(torch.from_numpy(x), torch.from_numpy(m)).numpy()
        logits_ort = sess.run(["logits"], {"x": x, "mask": m})[0]
        delta = float(np.max(np.abs(logits_pt - logits_ort)))
        max_delta = max(max_delta, delta)
        if int(np.argmax(logits_pt)) == int(np.argmax(logits_ort)):
            argmax_ok += 1

    total = len(casos)
    print(f"[validar] casos: {total}  max|dLogits|: {max_delta:.2e}  "
          f"argmax identico: {argmax_ok}/{total}")
    if max_delta >= 1e-3 or argmax_ok != total:
        raise SystemExit("[validar] FALLO de paridad PyTorch <-> ONNX")
    print("[validar] OK: paridad PyTorch <-> ONNX confirmada.")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--modelo", default="modelos/unificado",
                    help="carpeta del modelo (con .pth + label_map + feature_meta)")
    ap.add_argument("--out", default=None,
                    help="ruta del .onnx de salida (default: <modelo>/signai.onnx)")
    ap.add_argument("--validar", action="store_true",
                    help="valida paridad PyTorch vs onnxruntime")
    args = ap.parse_args()

    dir_modelo = (RAIZ / args.modelo) if not Path(args.modelo).is_absolute() \
        else Path(args.modelo)
    out_path = Path(args.out) if args.out else dir_modelo / "signai.onnx"

    model, meta, clases = cargar_modelo(dir_modelo)
    print(f"[export] modelo '{dir_modelo.name}' — {len(clases)} clases, "
          f"input_dim {meta['input_dim']}")
    exportar(model, meta, out_path)
    if args.validar:
        validar(model, meta, out_path)


if __name__ == "__main__":
    main()
