import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Undo2, Delete, Eraser, Copy, Check, Volume2, SpaceIcon } from "lucide-react";
import useSignServer from "../../hooks/useSignServer";
import useSpeech from "../../hooks/useSpeech";
import useTranscripcion from "../../hooks/useTranscripcion";
import { esLetra } from "../../data/palabras";
import Tutorial from "../common/Tutorial";
import ServerStatusOverlay from "../common/ServerStatusOverlay";

const CAMARA_TUTORIAL_STEPS = [
  {
    key: "camara-volver",
    title: "Volver",
    text: "Pulsa aquí en cualquier momento para detener la cámara y regresar a la pantalla anterior.",
    placement: "bottom",
    padding: 12,
  },
  {
    key: "camara-video",
    title: "Vista en vivo",
    text: "Aquí se muestra tu cámara con las manos detectadas. Realiza la seña y mantenla un instante para que se confirme.",
    placement: "top",
    padding: 4,
  },
  {
    key: "camara-transcripcion",
    title: "Tu mensaje",
    text: "Cada seña confirmada se va escribiendo aquí. Las letras se encadenan para deletrear y las palabras entran completas. Con «Espacio» cierras la palabra y se lee en voz alta.",
    placement: "top",
    padding: 8,
  },
];

// Etiquetas bonitas para el selector de modelos. La clave es el nombre de la
// carpeta del modelo en el servidor; si no esta aquí se capitaliza la clave.
const MODELO_LABELS = {
  estatico: "Estático",
  dinamico: "Dinámico",
};
const etiquetaModelo = (k) =>
  MODELO_LABELS[k] || (k ? k.charAt(0).toUpperCase() + k.slice(1) : k);

function BotonAccion({ Icon, children, onClick, disabled, destacado }) {
  return (
    <button
      onClick={(e) => {
        e.currentTarget.blur();
        onClick();
      }}
      disabled={disabled}
      className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all active:scale-95 disabled:opacity-40 disabled:active:scale-100 ${
        destacado
          ? "bg-white text-black hover:bg-white/90"
          : "bg-white/15 text-white hover:bg-white/25"
      }`}
    >
      <Icon size={18} strokeWidth={2.2} />
      {children}
    </button>
  );
}

export default function Camara({ setSidebarOpen }) {
  const navigate = useNavigate();
  const { speak } = useSpeech();
  const [fadeIn, setFadeIn] = useState(false);
  const [copiado, setCopiado] = useState(false);

  const { texto, vacio, ultimaPalabra, deletreando, agregar, espacio, borrar, limpiar } =
    useTranscripcion();

  // Cada seña confirmada se escribe en el mensaje.
  //
  // Solo se pronuncian las PALABRAS. Deletrear en voz alta ("a, ge, u, a") no
  // le sirve a quien escucha y tapa el audio útil; una seña de palabra, en
  // cambio, ya es una unidad completa. Lo que se deletrea se lee al cerrar la
  // palabra con «Espacio» o con el botón «Leer todo».
  const handleCommit = useCallback(
    (c) => {
      agregar(c.letra);
      if (!esLetra(c.letra)) speak(c.letra);
    },
    [agregar, speak]
  );

  // El traductor debe reconocer letras y palabras en el mismo flujo: pide el
  // modelo "unificado" al conectar y deja el selector para cambiarlo a mano.
  const { connected, serverDown, engineError, videoUrl, status, modelos, modelo, setModelo } =
    useSignServer({ modeloPreferido: "unificado", onCommit: handleCommit });

  useEffect(() => {
    if (typeof setSidebarOpen === "function") setSidebarOpen(false);
  }, [setSidebarOpen]);

  useEffect(() => {
    const t = setTimeout(() => setFadeIn(true), 120);
    return () => clearTimeout(t);
  }, []);

  const handleEspacio = useCallback(() => {
    // Sin nada que cerrar (mensaje vacío o ya terminado en espacio) no hay que
    // hacer nada: evita espacios dobles.
    if (!texto || texto.endsWith(" ")) return;
    // Solo se lee lo que se estaba deletreando: una seña de palabra ya se
    // pronunció al confirmarse y repetirla aquí sonaría dos veces.
    if (deletreando && ultimaPalabra) speak(ultimaPalabra);
    espacio();
  }, [texto, ultimaPalabra, deletreando, espacio, speak]);

  const handleCopiar = useCallback(async () => {
    if (!texto.trim()) return;
    try {
      await navigator.clipboard.writeText(texto.trim());
      setCopiado(true);
    } catch (err) {
      console.warn("No se pudo copiar al portapapeles:", err);
    }
  }, [texto]);

  useEffect(() => {
    if (!copiado) return;
    const t = setTimeout(() => setCopiado(false), 1800);
    return () => clearTimeout(t);
  }, [copiado]);

  // Atajos de teclado: escribir con las manos y corregir con el teclado es más
  // rápido que ir al botón.
  useEffect(() => {
    const onKeyDown = (e) => {
      const tag = e.target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || e.target?.isContentEditable) return;

      if (e.code === "Space") {
        // El navegador ya activa con Espacio el botón que tenga el foco; si
        // además insertáramos un espacio, la acción se duplicaría. Esto solo
        // ocurre al llegar al botón con el teclado: el clic de ratón le quita
        // el foco (ver BotonAccion).
        if (tag === "BUTTON") return;
        e.preventDefault();
        handleEspacio();
      } else if (e.key === "Backspace") {
        // Backspace sí funciona con un botón enfocado: ningún botón lo usa, y
        // exigir quitar el foco antes de poder corregir sería absurdo.
        e.preventDefault();
        borrar();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleEspacio, borrar]);

  const handleVolver = () => navigate(-1);

  return (
    <div
      className={`fixed inset-0 bg-black text-white ${
        fadeIn ? "opacity-100" : "opacity-0"
      } transition-opacity duration-500`}
    >
      {videoUrl && (
        <img
          src={videoUrl}
          data-tutorial="camara-video"
          alt="Cámara"
          className="fixed inset-0 w-full h-full object-cover"
        />
      )}

      <div className="absolute top-0 left-0 w-full bg-black/40 py-4 text-center backdrop-blur-sm">
        <h1 className="text-white text-2xl font-semibold tracking-wide">LSM Traductor</h1>
      </div>

      {/* Selector de modelo (solo si hay más de uno disponible) */}
      {connected && modelos.length > 1 && (
        <div className="absolute top-6 right-6 z-20 flex gap-1 rounded-lg bg-black/40 p-1 backdrop-blur-sm">
          {modelos.map((m) => (
            <button
              key={m}
              onClick={() => setModelo(m)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
                m === modelo
                  ? "bg-white text-black"
                  : "text-white hover:bg-white/20"
              }`}
            >
              {etiquetaModelo(m)}
            </button>
          ))}
        </div>
      )}

      <button
        data-tutorial="camara-volver"
        onClick={handleVolver}
        className="absolute top-6 left-6 flex items-center gap-2 text-white bg-black/40 hover:bg-black/60 px-4 py-2 rounded-lg transition-all z-20"
      >
        <Undo2 size={22} strokeWidth={2.2} />
        <span className="hidden sm:inline font-medium">Volver</span>
      </button>

      {/* Letra reconocida (la mas probable). Se mantiene hasta ver otra. */}
      {status.letra && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center">
          <div className="font-black leading-none drop-shadow-lg text-8xl text-green-400">
            {status.letra}
          </div>
          <div className="mt-1 text-sm font-medium bg-black/50 px-3 py-1 rounded-full">
            {Math.round((status.conf || 0) * 100)}%
          </div>
        </div>
      )}

      {/* Mensaje que se va formando. Es la salida real del traductor: sin esto
          la seña se pronuncia y se pierde, y nadie puede leer lo que se dijo. */}
      {connected && (
        <div className="absolute bottom-0 left-0 z-20 w-full bg-gradient-to-t from-black/95 via-black/70 to-transparent px-4 pb-5 pt-12">
          <div className="mx-auto flex max-w-3xl flex-col gap-3">
            <div
              data-tutorial="camara-transcripcion"
              className="min-h-[5rem] rounded-2xl bg-black/60 px-5 py-4 backdrop-blur-sm"
            >
              <p
                aria-live="polite"
                aria-label="Mensaje traducido"
                className={`break-words text-3xl font-semibold leading-snug sm:text-4xl ${
                  vacio ? "text-white/40" : "text-white"
                }`}
              >
                {vacio ? "Haz una seña para empezar…" : texto}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2">
              <BotonAccion
                Icon={SpaceIcon}
                onClick={handleEspacio}
                disabled={vacio || texto.endsWith(" ")}
                destacado
              >
                Espacio
              </BotonAccion>
              <BotonAccion Icon={Delete} onClick={borrar} disabled={vacio}>
                Borrar
              </BotonAccion>
              <BotonAccion Icon={Eraser} onClick={limpiar} disabled={vacio}>
                Limpiar
              </BotonAccion>
              <BotonAccion
                Icon={Volume2}
                onClick={() => speak(texto.trim())}
                disabled={vacio}
              >
                Leer todo
              </BotonAccion>
              <BotonAccion
                Icon={copiado ? Check : Copy}
                onClick={handleCopiar}
                disabled={vacio}
              >
                {copiado ? "Copiado" : "Copiar"}
              </BotonAccion>
            </div>
          </div>
        </div>
      )}

      {!connected && (
        <ServerStatusOverlay
          serverDown={serverDown}
          engineError={engineError}
          className="absolute inset-0 flex items-center justify-center p-6 z-30"
          boxClassName="bg-black/70 rounded-xl p-6 max-w-md text-center space-y-3 text-white"
        />
      )}

      {connected && <Tutorial steps={CAMARA_TUTORIAL_STEPS} storageKey="tourSignAI_camara" />}
    </div>
  );
}
