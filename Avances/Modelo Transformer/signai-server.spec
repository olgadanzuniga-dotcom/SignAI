# -*- mode: python ; coding: utf-8 -*-
# PyInstaller spec del servidor de inferencia (SignAI Server.py).
#
# Genera dist-server/signai-server/signai-server.exe (onedir), que Electron
# empaqueta via build.extraResources en package.json y lanza desde
# resources/signai-server/ cuando la app esta instalada (ver electron/main.js).
#
# Uso (desde la raiz del repo):
#   npm run build:server
import os

from PyInstaller.utils.hooks import collect_data_files

base = os.path.dirname(os.path.abspath(SPEC))

# mediapipe carga sus grafos/.tflite como archivos de datos.
datas = collect_data_files("mediapipe")

# Solo se distribuye el modelo unificado: cubre senias estaticas y dinamicas
# en un solo juego de pesos, asi que "estatico" y "dinamico" ya solo sirven
# para entrenar y comparar. Meterlos sumaba ~40 MB al instalador sin que la
# app los usara. comun.py resuelve modelos/ relativo a __file__, que en el
# bundle apunta a _internal/, asi que este destino relativo queda donde el
# servidor lo espera.
ARCHIVOS_MODELO = ("signai_transformer.pth", "label_map.json", "feature_meta.json")
for nombre in ("unificado",):
    carpeta = os.path.join(base, "modelos", nombre)
    if os.path.isdir(carpeta):
        for archivo in ARCHIVOS_MODELO:
            ruta = os.path.join(carpeta, archivo)
            if os.path.isfile(ruta):
                datas.append((ruta, os.path.join("modelos", nombre)))

# Señas nuevas agregadas sin reentrenar (senas_nuevas.py): referencias
# precalculadas por exportar_senas_nuevas.py.
refs_nuevas = os.path.join(base, "modelos", "senas_nuevas", "refs.json")
if os.path.isfile(refs_nuevas):
    datas.append((refs_nuevas, os.path.join("modelos", "senas_nuevas")))

a = Analysis(
    [os.path.join(base, "SignAI Server.py")],
    pathex=[base],
    binaries=[],
    datas=datas,
    hiddenimports=["websockets"],
    excludes=[
        # Sin relacion con el servidor; recortan cientos de MB del bundle.
        "torchvision",
        "torchaudio",
        "jax",
        "jaxlib",
        "pygame",
        "sounddevice",
        "PyQt5",
        "PySide6",
        "tkinter",
        "pandas",
        "IPython",
        "onnx",
        "onnxruntime",
        # Verificado con un import del servidor completo: nada de esto entra en
        # sys.modules. Son ~120 MB que PyInstaller arrastra por imports
        # opcionales. (matplotlib y PIL SI se quedan: mediapipe los importa.)
        "scipy",
        "cryptography",
        "Pythonwin",
        "win32com",
        "win32comext",
    ],
    noarchive=False,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="signai-server",
    debug=False,
    console=True,
    disable_windowed_traceback=False,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=False,
    name="signai-server",
)
