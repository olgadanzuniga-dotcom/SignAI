# -*- coding: utf-8 -*-
"""Tests de las funciones puras de comun.py (sin MediaPipe, sin torch, sin camara).

Por que estos y no otros: el vector de features es el contrato que comparten
CUATRO sitios que pueden desincronizarse sin que nada avise —

  - normalizar.py, que construye el dataset;
  - entrenar.py, que ademas codifica desplazamientos a mano (SCALE_IDX,
    ROT_BLOCKS) en vez de derivarlos de las constantes;
  - SignAI Server.py, que arma el tensor en vivo;
  - y el port movil, que reescribe todo esto en JS con las dimensiones
    (63, 95, 190, 442) puestas como literales.

Si alguien reordena features_mano, el entrenamiento sigue "funcionando" y el
modelo sale malo sin un solo error. Estos tests fijan la disposicion.

Uso:  py -m unittest discover -s pruebas/unit -p "test_*.py"
"""
from __future__ import annotations

import math
import sys
import unittest
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "Avances" / "Modelo Transformer"))

from comun import (  # noqa: E402
    FEAT_COORDS, FEAT_PER_HAND, FEAT_STATIC_PER_FRAME, FEAT_DYNAMIC_PER_FRAME,
    WRIST, MIDDLE_MCP,
    distancia, angulo_3p, normal_palma, promedio_movimiento, movimiento_global,
    normalizar_mano, features_mano, vector_mano_ausente, features_frame,
    solo_coords_del_frame, velocidades, aceleraciones,
)

# Indices de las dos banderas categoricas dentro del bloque de una mano.
# features_mano las pone al final, en este orden: [..., hand_type, hand_present]
IDX_HAND_TYPE = FEAT_PER_HAND - 2      # 93
IDX_HAND_PRESENT = FEAT_PER_HAND - 1   # 94


def mano_de_prueba(desplazar=(0.0, 0.0, 0.0), escala=1.0):
    """21 landmarks deterministas, con forma de mano suficiente para que
    normal_palma y los angulos no salgan degenerados."""
    pts = []
    for i in range(21):
        pts.append((
            (0.01 * i + 0.1) * escala + desplazar[0],
            (0.02 * ((i * 7) % 5) + 0.2) * escala + desplazar[1],
            (0.005 * ((i * 3) % 4)) * escala + desplazar[2],
        ))
    return pts


class TestDimensiones(unittest.TestCase):
    def test_las_dimensiones_se_derivan_y_valen_lo_esperado(self):
        # El port movil las tiene como literales; si aqui cambian, alli hay que
        # tocarlas a mano o la inferencia da basura.
        self.assertEqual(FEAT_COORDS, 63)
        self.assertEqual(FEAT_PER_HAND, 95)
        self.assertEqual(FEAT_STATIC_PER_FRAME, 190)
        self.assertEqual(FEAT_DYNAMIC_PER_FRAME, 442)

    def test_la_parte_dinamica_es_estatica_mas_velocidad_y_aceleracion(self):
        self.assertEqual(
            FEAT_DYNAMIC_PER_FRAME,
            FEAT_STATIC_PER_FRAME + FEAT_COORDS * 2 + FEAT_COORDS * 2,
        )


class TestGeometria(unittest.TestCase):
    def test_distancia(self):
        self.assertAlmostEqual(distancia((0, 0, 0), (3, 4, 0)), 5.0)
        self.assertAlmostEqual(distancia((1, 1, 1), (1, 1, 1)), 0.0)

    def test_angulo_recto_y_llano(self):
        self.assertAlmostEqual(angulo_3p((1, 0, 0), (0, 0, 0), (0, 1, 0)), math.pi / 2)
        self.assertAlmostEqual(angulo_3p((1, 0, 0), (0, 0, 0), (-1, 0, 0)), math.pi)
        self.assertAlmostEqual(angulo_3p((1, 0, 0), (0, 0, 0), (1, 0, 0)), 0.0)

    def test_angulo_degenerado_devuelve_cero_en_vez_de_nan(self):
        # Dos puntos iguales dan vector nulo: sin la guarda saldria NaN y el
        # NaN se propagaria por todo el tensor hasta el modelo.
        self.assertEqual(angulo_3p((0, 0, 0), (0, 0, 0), (1, 0, 0)), 0.0)

    def test_normal_palma_es_unitaria(self):
        n = normal_palma(mano_de_prueba())
        self.assertAlmostEqual(np.linalg.norm(np.array(n)), 1.0, places=5)

    def test_normal_palma_degenerada(self):
        colineales = [(i * 0.1, 0.0, 0.0) for i in range(21)]
        self.assertEqual(normal_palma(colineales), (0.0, 0.0, 0.0))


class TestNormalizacion(unittest.TestCase):
    def test_la_muneca_queda_en_el_origen(self):
        norm = normalizar_mano(mano_de_prueba())
        for c in norm[WRIST]:
            self.assertAlmostEqual(c, 0.0)

    def test_la_escala_queda_fijada_por_muneca_a_mcp9(self):
        norm = normalizar_mano(mano_de_prueba())
        self.assertAlmostEqual(distancia(norm[WRIST], norm[MIDDLE_MCP]), 1.0, places=5)

    def test_es_invariante_a_traslacion(self):
        a = normalizar_mano(mano_de_prueba())
        b = normalizar_mano(mano_de_prueba(desplazar=(0.5, -0.3, 0.2)))
        np.testing.assert_allclose(np.array(a), np.array(b), atol=1e-6)

    def test_es_invariante_a_escala(self):
        # Es lo que permite que la mano valga igual cerca o lejos de la camara.
        a = normalizar_mano(mano_de_prueba())
        b = normalizar_mano(mano_de_prueba(escala=3.0))
        np.testing.assert_allclose(np.array(a), np.array(b), atol=1e-6)

    def test_mano_degenerada_no_divide_por_cero(self):
        norm = normalizar_mano([(0.0, 0.0, 0.0)] * 21)
        self.assertTrue(np.all(np.isfinite(np.array(norm))))


class TestVectorDeMano(unittest.TestCase):
    def test_longitud_y_finitud(self):
        v = features_mano(normalizar_mano(mano_de_prueba()), "Right")
        self.assertEqual(len(v), FEAT_PER_HAND)
        self.assertTrue(np.all(np.isfinite(v)))

    def test_banderas_de_mano_presente(self):
        der = features_mano(normalizar_mano(mano_de_prueba()), "Right")
        izq = features_mano(normalizar_mano(mano_de_prueba()), "Left")
        self.assertEqual(der[IDX_HAND_TYPE], 0.0)
        self.assertEqual(izq[IDX_HAND_TYPE], 1.0)
        self.assertEqual(der[IDX_HAND_PRESENT], 1.0)
        self.assertEqual(izq[IDX_HAND_PRESENT], 1.0)

    def test_banderas_de_mano_ausente(self):
        # hand_present a 0 pero hand_type conserva el lado: el modelo tiene que
        # poder distinguir "no hay mano izquierda" de "no hay mano derecha".
        self.assertEqual(vector_mano_ausente("Left")[IDX_HAND_TYPE], 1.0)
        self.assertEqual(vector_mano_ausente("Right")[IDX_HAND_TYPE], 0.0)
        self.assertEqual(vector_mano_ausente("Left")[IDX_HAND_PRESENT], 0.0)

    def test_las_banderas_son_categoricas(self):
        # Solo pueden valer 0 o 1. El remuestreo a fps y el aumento por
        # deformacion temporal interpolan el vector entero, incluidas estas dos
        # columnas, y producen valores como 0.37 que features_frame no genera
        # jamas. Este test fija la propiedad que ahi se rompe.
        for v in (features_mano(normalizar_mano(mano_de_prueba()), "Left"),
                  vector_mano_ausente("Right")):
            self.assertIn(v[IDX_HAND_TYPE], (0.0, 1.0))
            self.assertIn(v[IDX_HAND_PRESENT], (0.0, 1.0))


class TestVectorDeFrame(unittest.TestCase):
    def test_longitud(self):
        self.assertEqual(len(features_frame(mano_de_prueba(), None)),
                         FEAT_STATIC_PER_FRAME)
        self.assertEqual(len(features_frame(None, None)), FEAT_STATIC_PER_FRAME)

    def test_el_orden_es_derecha_y_luego_izquierda(self):
        v = features_frame(mano_de_prueba(), None)
        self.assertEqual(v[IDX_HAND_PRESENT], 1.0)                    # derecha
        self.assertEqual(v[FEAT_PER_HAND + IDX_HAND_PRESENT], 0.0)    # izquierda

    def test_sin_manos_todo_finito(self):
        v = features_frame(None, None)
        self.assertTrue(np.all(np.isfinite(v)))
        self.assertEqual(v[IDX_HAND_PRESENT], 0.0)

    def test_solo_coords_saca_las_dos_manos(self):
        v = features_frame(mano_de_prueba(), mano_de_prueba())
        c = solo_coords_del_frame(v)
        self.assertEqual(len(c), FEAT_COORDS * 2)
        np.testing.assert_allclose(c[:FEAT_COORDS], v[:FEAT_COORDS])
        np.testing.assert_allclose(
            c[FEAT_COORDS:], v[FEAT_PER_HAND:FEAT_PER_HAND + FEAT_COORDS])


class TestDerivadas(unittest.TestCase):
    def test_el_primer_frame_no_tiene_velocidad(self):
        seq = np.arange(5 * 126, dtype=np.float32).reshape(5, 126)
        vel = velocidades(seq)
        self.assertEqual(vel.shape, seq.shape)
        np.testing.assert_allclose(vel[0], np.zeros(126))

    def test_velocidad_es_la_diferencia_entre_frames(self):
        seq = np.zeros((3, 126), dtype=np.float32)
        seq[1] = 1.0
        seq[2] = 4.0
        vel = velocidades(seq)
        np.testing.assert_allclose(vel[1], np.ones(126))
        np.testing.assert_allclose(vel[2], np.full(126, 3.0))

    def test_aceleracion_es_la_diferencia_de_velocidad(self):
        seq = np.zeros((3, 126), dtype=np.float32)
        seq[1] = 1.0
        seq[2] = 4.0
        acc = aceleraciones(velocidades(seq))
        np.testing.assert_allclose(acc[2], np.full(126, 2.0))

    def test_un_solo_frame_no_revienta(self):
        uno = np.ones((1, 126), dtype=np.float32)
        np.testing.assert_allclose(velocidades(uno), np.zeros((1, 126)))
        np.testing.assert_allclose(aceleraciones(uno), np.zeros((1, 126)))

    def test_una_seña_quieta_tiene_velocidad_cero(self):
        # Es la propiedad en la que se apoya normalizar.py al expandir una
        # muestra estatica en 15 frames identicos.
        quieta = np.tile(np.arange(126, dtype=np.float32), (15, 1))
        np.testing.assert_allclose(velocidades(quieta), np.zeros((15, 126)))


class TestMovimiento(unittest.TestCase):
    def test_sin_movimiento(self):
        pts = mano_de_prueba()
        self.assertAlmostEqual(promedio_movimiento(pts, pts), 0.0)

    def test_desplazamiento_uniforme(self):
        a = mano_de_prueba()
        b = [(x + 0.1, y, z) for (x, y, z) in a]
        self.assertAlmostEqual(promedio_movimiento(a, b), 0.1, places=6)

    def test_entradas_incompatibles_dan_cero(self):
        self.assertEqual(promedio_movimiento(None, mano_de_prueba()), 0.0)
        self.assertEqual(promedio_movimiento(mano_de_prueba(), None), 0.0)
        self.assertEqual(promedio_movimiento(mano_de_prueba(), [(0, 0, 0)]), 0.0)

    def test_movimiento_global_solo_cuenta_manos_en_ambos_frames(self):
        a = mano_de_prueba()
        b = [(x + 0.2, y, z) for (x, y, z) in a]
        # La izquierda aparece de nuevas: no puede contar como movimiento.
        prev = {"Right": a, "Left": None}
        curr = {"Right": b, "Left": a}
        self.assertAlmostEqual(movimiento_global(prev, curr), 0.2, places=6)

    def test_movimiento_global_sin_manos(self):
        vacio = {"Right": None, "Left": None}
        self.assertEqual(movimiento_global(vacio, vacio), 0.0)


if __name__ == "__main__":
    unittest.main(verbosity=2)
