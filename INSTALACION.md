# SignAI — Guía de instalación

Traductor y app de aprendizaje de **Lengua de Señas Mexicana (LSM)**.
Esta guía es para quien recibe el instalador (`SignAI Setup 1.2.0.exe`).

---

## Requisitos

- **Windows 10 o 11** de 64 bits.
- **Cámara web** (integrada o USB) para traducir señas.
- **Espacio en disco**: el instalador pesa ~360 MB y la app ocupa ~1.3 GB
  una vez instalada. Ten al menos **2 GB libres**.
- **No hace falta instalar Python ni nada más**: el motor de reconocimiento
  viene incluido dentro de la app.
- Internet **no** es necesario: el reconocimiento corre en tu propia
  computadora. Solo se usa internet si activas la voz de ElevenLabs.

---

## Instalación

1. Haz doble clic en `SignAI Setup 1.2.0.exe`.

2. **Windows va a mostrar una advertencia azul** que dice
   *"Windows protegió tu PC"*. Es normal: el instalador no tiene firma digital
   (un certificado de código cuesta varios cientos de dólares al año).
   Para continuar:

   - Haz clic en **"Más información"**.
   - Luego en **"Ejecutar de todas formas"**.

3. Sigue el asistente. Puedes elegir la carpeta de instalación y si quieres
   acceso directo en el escritorio.

4. Si tu antivirus marca `signai-server.exe`, márcalo como seguro. Los
   ejecutables generados con PyInstaller (la herramienta que empaqueta el
   motor de Python) suelen dar falsos positivos.

---

## Permiso de cámara

Si al abrir la pantalla de traducción no ves imagen, revisa el permiso:

**Configuración › Privacidad y seguridad › Cámara** →
activa **"Permitir que las aplicaciones de escritorio accedan a la cámara"**.

También asegúrate de que ningún otro programa esté usando la cámara
(Zoom, Teams, Meet, OBS). Solo un programa puede usarla a la vez.

---

## Cómo traducir

1. Entra a la pantalla de traducción. La cámara se enciende sola.
2. Haz una seña y **mantenla un instante** hasta que se confirme.
3. Cada seña confirmada se va escribiendo en el mensaje de abajo:
   - Las **letras se encadenan** para deletrear (A-G-U-A → `AGUA`).
   - Las **palabras** (AGUA, HOLA, PERRO) entran completas y se leen en voz alta.
4. Con **Espacio** cierras la palabra que estabas deletreando y se lee en voz
   alta. Con **Borrar** quitas la última seña y con **Limpiar** empiezas de cero.
   También funcionan las teclas `Espacio` y `Retroceso`.
5. **Leer todo** pronuncia el mensaje completo y **Copiar** lo lleva al
   portapapeles para pegarlo donde quieras.

## Primer uso

- Al abrir SignAI, el motor de traducción tarda **unos segundos** en cargar.
  Verás "Conectando con el motor de traducción…". Es normal.
- La cámara se enciende **solo** cuando entras a una pantalla que traduce, y
  se apaga al salir.

---

## Qué reconoce hoy

- **Letras (mano quieta)**: A B C D E F G H I L M N O P R S T U V W Y
- **Letras con movimiento**: J Q RR X Z Ñ
- **Palabras**: AGUA, HOLA, PERRO

> La **K** todavía no está entrenada, y el vocabulario de palabras aún es
> pequeño. Es un proyecto en desarrollo.

---

## Voz

- Por defecto SignAI usa **Web Speech**, la voz que ya trae Windows. Funciona
  sin internet y sin configurar nada.
- Si quieres voces de mayor calidad puedes usar **ElevenLabs**, pero necesitas
  **tu propia cuenta y tu propia API key** (es un servicio de pago):
  **Ajustes › Motor de voz › ElevenLabs**, y pega tu key en el campo que
  aparece. Se guarda solo en tu computadora.

---

## Problemas frecuentes

| Qué ves | Qué hacer |
|---|---|
| "El motor de traducción no está disponible" | Cierra SignAI por completo y vuelve a abrirlo. Si sigue, reinicia la computadora: puede haber quedado un `signai-server.exe` ocupando el puerto 8765. |
| "No se pudo abrir la cámara" | Revisa el permiso de cámara (arriba) y cierra Zoom/Teams/Meet. |
| La app abre pero la pantalla está en blanco | Espera unos segundos; si sigue, reinstala. |
| El antivirus borró algo | Restaura `signai-server.exe` desde la cuarentena y agrégalo a excepciones. |

---

## Desinstalar

**Configuración › Aplicaciones › Aplicaciones instaladas › SignAI › Desinstalar.**
