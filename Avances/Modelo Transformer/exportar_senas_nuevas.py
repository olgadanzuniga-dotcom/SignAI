"""
exportar_senas_nuevas.py

Precalcula las referencias del reconocedor de señas nuevas (senas_nuevas.py)
a partir de las grabaciones del grabador y las guarda en
modelos/senas_nuevas/refs.json, que el servidor carga y el instalador incluye.

Uso:
    venv310\\Scripts\\python.exe exportar_senas_nuevas.py AMARILLO AZUL ROJO ...
    (sin argumentos: todas las señas con al menos 3 grabaciones)

Por seña se usan las tomas sin avisos; si hay menos de 3, tambien las que
tienen avisos (camara lenta, muy larga...).
"""
from __future__ import annotations

import json
import re
import sys
from collections import defaultdict
from pathlib import Path

import numpy as np

from senas_nuevas import (DIR_SENAS_NUEVAS, PATH_REFS, VERSION_FEATURES, calibrar,
                          distancia_a_refs, features_secuencia)

DIR_GRABACIONES = Path(__file__).resolve().parents[3] / "grabador_lsm" / "dataset_dinamico"
PATRON = re.compile(r"^DIN_(.+?)_\d{8}_\d{6}_\d{8}_\d{6}_\d+\.json$")


FRACCION_CORTA = 0.4   # toma cortada: dura < 40% de lo normal en su seña
QUITAR_CORTADAS = False  # medido: no ayudo a AZUL y le quito aciertos a ROJO
FACTOR_SEPARACION = 1.6  # TODAS las tomas de otras señas a >= 1.6 umbrales (puntaje <= 40)


def quitar_raras(sena, refs):
    """Quita tomas cortadas: duran menos del 40% de lo normal en esa seña."""
    if len(refs) <= 3:
        return refs
    med = float(np.median([len(r) for r in refs]))
    buenas = [r for r in refs if len(r) >= FRACCION_CORTA * med]
    if len(buenas) < 3:
        return refs
    if len(buenas) < len(refs):
        print(f"  {sena}: se quitan {len(refs) - len(buenas)} toma(s) cortada(s) "
              f"(frames {[len(r) for r in refs if len(r) < FRACCION_CORTA * med]}, "
              f"lo normal {med:.0f})")
    return buenas


def separar_umbrales(salida):
    """
    El umbral de cada seña sale de que tanto varian sus propias tomas; si es
    flojo, las tomas de OTRA seña parecida le alcanzan el 70%. Se aprieta lo
    necesario para que las demas señas queden lejos, sin bajar del punto en
    que sus propias tomas dejarian de reconocerse.
    """
    refs = {n: [np.asarray(r) for r in s["refs"]] for n, s in salida.items()}
    for n, s in salida.items():
        otras = [distancia_a_refs(f, refs[n]) for m in refs if m != n for f in refs[m]]
        if not otras:
            continue
        _, loo = calibrar(refs[n])
        minimo = float(np.percentile(loo, 90))
        tope = float(min(otras)) / FACTOR_SEPARACION
        nuevo = max(min(s["umbral"], tope), minimo)
        if nuevo < s["umbral"] - 1e-9:
            print(f"  {n}: umbral {s['umbral']:.3f} -> {nuevo:.3f} "
                  f"(para no confundirse con otras señas)")
            s["umbral"] = nuevo


def main():
    por_sena = defaultdict(list)
    for p in sorted(DIR_GRABACIONES.glob("DIN_*.json")):
        m = PATRON.match(p.name)
        if m:
            por_sena[m.group(1).upper()].append(p)

    pedidas = [a.upper() for a in sys.argv[1:]] or sorted(por_sena)
    salida = {}
    for sena in pedidas:
        datos = [json.loads(p.read_text(encoding="utf-8")) for p in por_sena.get(sena, [])]
        limpias = [d for d in datos if not d.get("avisos")]
        usadas = limpias if len(limpias) >= 3 else datos
        refs = [f for f in (features_secuencia(d["secuencia"]) for d in usadas)
                if f is not None]
        if len(refs) < 3:
            print(f"  {sena}: solo {len(refs)} grabaciones, se omite (minimo 3).")
            continue
        # Una toma que no se parece a sus compañeras (cortada, sin movimiento)
        # aflojaba el umbral de toda la seña: AZUL tenia una de 0.4 s y por
        # ella AMARILLO le salia 60% AZUL.
        refs = quitar_raras(sena, refs) if QUITAR_CORTADAS else refs
        umbral, _ = calibrar(refs)
        num_manos = max(int(d.get("num_manos_esperadas", 1)) for d in usadas)
        # Lado en que quedo la mano en las grabaciones de una mano.
        cuenta = {"Right": 0, "Left": 0}
        for d in usadas:
            for fd in d["secuencia"]:
                for lado in cuenta:
                    cuenta[lado] += 1 if fd.get(lado) else 0
        lado = max(cuenta, key=cuenta.get)
        salida[sena] = {"umbral": umbral, "num_manos": num_manos, "lado": lado,
                        "refs": [r.round(5).tolist() for r in refs]}
        nota = "" if usadas is limpias else "  (incluye tomas con avisos)"
        print(f"  {sena}: {len(refs)} grabaciones, {num_manos} mano(s), "
              f"umbral {umbral:.3f}{nota}")

    separar_umbrales(salida)

    DIR_SENAS_NUEVAS.mkdir(parents=True, exist_ok=True)
    PATH_REFS.write_text(json.dumps({"version": VERSION_FEATURES, "senas": salida},
                                    ensure_ascii=False),
                         encoding="utf-8")
    print(f"\n{len(salida)} señas -> {PATH_REFS}")


if __name__ == "__main__":
    main()
