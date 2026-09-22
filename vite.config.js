import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Host del servidor local de inferencia. Tiene que coincidir con el que usa
// src/hooks/useSignServer.js, porque la CSP de abajo lo declara explicitamente.
const SIGNAI_HOST = process.env.VITE_SIGNAI_HOST || '127.0.0.1:8765'

// Plugin que elimina del código fuente de three.js la línea que emite el aviso
// `THREE.Clock: This module has been deprecated.` El warning lo dispara
// @react-three/fiber v8 al instanciar internamente `new THREE.Clock()`. Como
// no podemos reasignar la clase (el namespace de un módulo ES es inmutable),
// la modificamos directamente en el código que Vite sirve.
function removeThreeClockDeprecation() {
  return {
    name: 'remove-three-clock-deprecation',
    enforce: 'pre',
    transform(code, id) {
      if (!id.includes('three')) return null
      if (!code.includes('THREE.Clock: This module has been deprecated')) return null
      return code.replace(
        /console\.warn\(\s*['"`]THREE\.Clock: This module has been deprecated[^'"`]*['"`]\s*\)\s*;?/g,
        ''
      )
    },
  }
}

// Content-Security-Policy para la app EMPAQUETADA. No había ninguna: cualquier
// script inyectado en el renderer tenía fetch y WebSocket sin restricciones, y
// podía leerse la API key de ElevenLabs de localStorage y mandarla fuera.
//
// Va solo en la compilación (`apply: 'build'`) porque el servidor de desarrollo
// de Vite necesita scripts en línea y eval para el HMR.
//
// - style-src permite 'unsafe-inline': Tailwind y framer-motion escriben
//   estilos en línea; sin eso la interfaz se queda sin animaciones.
// - connect-src abre solo el motor local y ElevenLabs (la voz de pago).
// - img-src incluye el motor porque el <img> del traductor consume su MJPEG.
// - script-src añade 'wasm-unsafe-eval': el cargador de glTF de drei instancia
//   el decodificador Meshopt, que es un módulo WebAssembly. Sin esa palabra
//   clave la lección de abecedario lanzaba «Refused to compile or instantiate
//   WebAssembly module» **solo en la app instalada**. Es la forma acotada de
//   permitirlo: habilita WebAssembly y NO habilita `eval()` de JavaScript.
function cspDeProduccion() {
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'wasm-unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: http://" + SIGNAI_HOST,
    "media-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src 'self' http://${SIGNAI_HOST} ws://${SIGNAI_HOST} https://api.elevenlabs.io`,
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    // frame-ancestors NO se puede entregar en un <meta> (el navegador lo
    // ignora y avisa por consola); solo vale como cabecera. Aqui no hace
    // falta: la app no se sirve por HTTP y nadie puede meterla en un iframe.
  ].join('; ')

  return {
    name: 'csp-de-produccion',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace(
        // Detras del charset: la declaracion de codificacion debe caer en los
        // primeros 1024 bytes del documento.
        '<meta charset="UTF-8" />',
        `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${csp}" />`
      )
    },
  }
}

export default defineConfig({
  plugins: [react(), removeThreeClockDeprecation(), cspDeProduccion()],
  base: './',
})
