import json, sys
from pathlib import Path

RAIZ = Path(r"C:\LSM Traductor\Avances\Modelo Transformer")
sys.path.insert(0, str(RAIZ))

import torch
from comun import SignTransformer


def cargar(dir_modelo, device):
    clases = json.loads((dir_modelo / "label_map.json").read_text(encoding="utf-8"))["classes"]
    meta = json.loads((dir_modelo / "feature_meta.json").read_text(encoding="utf-8"))
    m = SignTransformer(
        input_dim=meta["input_dim"], num_classes=meta["num_classes"],
        d_model=meta["d_model"], nhead=meta["n_heads"],
        num_layers=meta["n_layers"], dim_ff=meta["dim_ff"],
        dropout=meta["dropout"], max_len=meta["max_seq_len"],
    ).to(device)
    m.load_state_dict(torch.load(dir_modelo / "signai_transformer.pth", map_location=device))
    m.eval()
    return m, meta, clases


salida = {"torch": torch.__version__, "modelos": {}}
for nombre in ("estatico", "dinamico", "unificado"):
    d = RAIZ / "modelos" / nombre
    m, meta, clases = cargar(d, torch.device("cpu"))
    T, D = 40, meta["input_dim"]
    g = torch.Generator().manual_seed(1234)
    X = torch.rand((1, T, D), generator=g)
    mask = torch.ones((1, T))  # 1 = frame valido
    with torch.no_grad():
        logits = m(X, mask)
    salida["modelos"][nombre] = {
        "argmax": int(logits.argmax(-1)),
        "clase": clases[int(logits.argmax(-1))],
        "logits": [round(float(v), 6) for v in logits.squeeze(0)],
    }
print(json.dumps(salida))
