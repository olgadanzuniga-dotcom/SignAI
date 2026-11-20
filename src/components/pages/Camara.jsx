import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Undo2, Delete, Eraser, Copy, Check, Volume2, SpaceIcon, GraduationCap } from "lucide-react";
import EnsenarSena from "../common/EnsenarSena";
import useSignServer from "../../hooks/useSignServer";
import useSpeech from "../../hooks/useSpeech";
import useTranscripcion from "../../hooks/useTranscripcion";
import { esLetra } from "../../data/palabras";
import Tutorial from "../common/Tutorial";
import ServerStatusOverlay from "../common/ServerStatusOverlay";
import { useIdioma, palabraSena } from "../../i18n";
import VideoMotor from "../common/VideoMotor";

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
      className={`font-llamativa flex items-center gap-2 rounded-2xl px-5 py-3 text-base font-semibold tracking-wide transition-all active:scale-95 disabled:opacity-40 disabled:active:scale-100 ${
        destacado
          ? "bg-gradient-to-r from-amber-300 via-pink-400 to-violet-500 text-white shadow-lg shadow-pink-500/30 hover:brightness-110"
          : "bg-white/15 text-white ring-1 ring-white/20 hover:bg-white/25"
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
  const { t } = useIdioma();
  const [fadeIn, setFadeIn] = useState(false);
  const [copiado, setCopiado] = useState(false);
  // El WebSocket puede seguir vivo y el stream MJPEG haberse cortado (el motor
  // perdió la cámara, el <img> se quedó a medias). Sin esto la pantalla se
  // quedaba en negro con el icono de imagen rota y ni un mensaje.
  const [videoFallo, setVideoFallo] = useState(false);
  // Entre "el WS ya conectó" y "llegó el primer frame JPEG" (la cámara del
  // motor tarda un instante en abrir) la pantalla se quedaba en negro sin
  // ninguna pista de que algo estaba pasando.
  const [videoCargado, setVideoCargado] = useState(false);

  const { texto, vacio, ultimaPalabra, deletreando, agregar, espacio, borrar, limpiar } =
    useTranscripcion();

  // Cada seña confirmada se escribe en el mensaje.
  //
  // Solo se pronuncian las PALABRAS. Deletrear en voz alta ("a, ge, u, a") no
  // le sirve a quien escucha y tapa el audio útil; una seña de palabra, en
  // cambio, ya es una unidad completa. Lo que se deletrea se lee al cerrar la
  // palabra con «Espacio» o con el botón «Leer todo».
  // «Enseñar seña»: mientras se graban tomas, lo que se ve no se escribe.
  const [ensenarAbierto, setEnsenarAbierto] = useState(false);
  const [ensenando, setEnsenando] = useState(false);
  const [eventoEnsenar, setEventoEnsenar] = useState(null);
  const ensenandoRef = React.useRef(false);
  ensenandoRef.current = ensenarAbierto || ensenando;
  const handleEnsenar = useCallback(
    (m) => setEventoEnsenar({ ...m, id: Date.now() + Math.random() }),
    []
  );

  const handleCommit = useCallback(
    (c) => {
      if (ensenandoRef.current) return;
      // En inglés las señas de palabra se escriben y se leen traducidas
      // (HOLA -> HELLO); las letras se deletrean igual.
      const valor = esLetra(c.letra) ? c.letra : palabraSena(c.letra);
      agregar(valor);
      if (!esLetra(c.letra)) speak(valor);
    },
    [agregar, speak]
  );

  // El traductor debe reconocer letras y palabras en el mismo flujo: pide el
  // modelo "unificado" al conectar y deja el selector para cambiarlo a mano.
  const { connected, serverDown, engineError, videoUrl, status, modelos, modelo, setModelo } =
    useSignServer({
      modeloPreferido: "unificado",
      onCommit: handleCommit,
      onEnsenar: handleEnsenar,
    });

  useEffect(() => {
    if (typeof setSidebarOpen === "function") setSidebarOpen(false);
  }, [setSidebarOpen]);

  useEffect(() => {
    const t = setTimeout(() => setFadeIn(true), 120);
    return () => clearTimeout(t);
  }, []);

  // Cada reconexión trae una URL nueva (lleva cache-bust): hay que volver a
  // darle una oportunidad al stream.
  useEffect(() => {
    setVideoFallo(false);
    setVideoCargado(false);
  }, [videoUrl]);

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
      {videoUrl && !videoFallo && (
        <VideoMotor
          src={videoUrl}
          data-tutorial="camara-video"
          alt={t("Cámara")}
          onError={() => setVideoFallo(true)}
          onLoad={() => setVideoCargado(true)}
          className="fixed inset-0 w-full h-full object-cover"
        />
      )}

      {/* El motor tarda un instante en abrir la cámara tras conectar (más la
          primera vez, en frío): sin esto la pantalla se veía negra y parecía
          que el traductor no cargaba. */}
      {connected && videoUrl && !videoCargado && !videoFallo && (
        <div className="fixed inset-0 flex flex-col items-center justify-center gap-3 text-white/80">
          <div className="h-10 w-10 rounded-full border-2 border-white/25 border-t-white animate-spin" />
          <p className="font-llamativa text-lg font-medium">{t("Abriendo la cámara…")}</p>
        </div>
      )}

      <div className="absolute top-0 left-0 w-full bg-black/40 py-4 text-center backdrop-blur-sm">
        <h1 className="font-llamativa text-3xl font-bold tracking-wide">
          <span className="bg-gradient-to-r from-amber-300 via-pink-400 to-violet-400 bg-clip-text text-transparent drop-shadow">
            {t("Traductor LSM")}
          </span>
        </h1>
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
              {t(etiquetaModelo(m))}
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
        <span className="hidden sm:inline font-llamativa font-medium text-lg">{t("Volver")}</span>
      </button>

      {connected && !ensenarAbierto && (
        <button
          onClick={() => setEnsenarAbierto(true)}
          className={`absolute ${
            modelos.length > 1 ? "top-20" : "top-6"
          } right-6 z-20 flex items-center gap-2 rounded-lg bg-black/40 px-4 py-2 text-white transition-all hover:bg-black/60`}
        >
          <GraduationCap size={22} strokeWidth={2.2} />
          <span className="hidden sm:inline font-llamativa font-medium text-lg">{t("Enseñar seña")}</span>
        </button>
      )}

      {/* Letra reconocida (la mas probable). Se mantiene hasta ver otra. */}
      {status.letra && !ensenarAbierto && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center">
          <div
            key={status.letra}
            className="font-llamativa font-bold leading-none text-8xl bg-gradient-to-b from-lime-200 via-emerald-400 to-teal-500 bg-clip-text text-transparent animate-[aparecer_.25s_ease-out]"
            style={{ filter: "drop-shadow(0 4px 14px rgba(16,185,129,.55))" }}
          >
            {esLetra(status.letra) ? status.letra : palabraSena(status.letra)}
          </div>
          <div className="font-llamativa mt-2 text-base font-semibold bg-black/55 ring-1 ring-emerald-300/40 px-4 py-1 rounded-full">
            {Math.round((status.conf || 0) * 100)}%
          </div>
        </div>
      )}

      {/* Mensaje que se va formando. Es la salida real del traductor: sin esto
          la seña se pronuncia y se pierde, y nadie puede leer lo que se dijo. */}
      {connected && (
        <EnsenarSena
          abierto={ensenarAbierto}
          onCerrar={() => setEnsenarAbierto(false)}
          evento={eventoEnsenar}
          onActivoChange={setEnsenando}
        />
      )}

      {connected && !ensenarAbierto && (
        <div className="absolute bottom-0 left-0 z-20 w-full bg-gradient-to-t from-black/95 via-black/70 to-transparent px-4 pb-5 pt-12">
          <div className="mx-auto flex max-w-3xl flex-col gap-3">
            <div
              data-tutorial="camara-transcripcion"
              className="min-h-[5.5rem] rounded-3xl bg-black/60 px-6 py-4 ring-1 ring-white/15 backdrop-blur-sm"
            >
              <p
                aria-live="polite"
                aria-label={t("Mensaje traducido")}
                className={`font-llamativa break-words text-4xl font-semibold leading-snug tracking-wide sm:text-5xl ${
                  vacio ? "text-white/45" : "text-white"
                }`}
                style={vacio ? undefined : { textShadow: "0 2px 18px rgba(236,72,153,.35)" }}
              >
                {vacio ? t("Haz una seña para empezar…") : texto}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2">
              <BotonAccion
                Icon={SpaceIcon}
                onClick={handleEspacio}
                disabled={vacio || texto.endsWith(" ")}
                destacado
              >
                {t("Espacio")}
              </BotonAccion>
              <BotonAccion Icon={Delete} onClick={borrar} disabled={vacio}>
                {t("Borrar")}
              </BotonAccion>
              <BotonAccion Icon={Eraser} onClick={limpiar} disabled={vacio}>
                {t("Limpiar")}
              </BotonAccion>
              <BotonAccion
                Icon={Volume2}
                onClick={() => speak(texto.trim())}
                disabled={vacio}
              >
                {t("Leer todo")}
              </BotonAccion>
              <BotonAccion
                Icon={copiado ? Check : Copy}
                onClick={handleCopiar}
                disabled={vacio}
              >
                {copiado ? t("Copiado") : t("Copiar")}
              </BotonAccion>
            </div>
          </div>
        </div>
      )}

      {(!connected || videoFallo) && (
        <ServerStatusOverlay
          serverDown={serverDown}
          engineError={
            engineError ||
            (videoFallo && connected ? t("Se cortó la imagen de la cámara.") : "")
          }
          className="absolute inset-0 flex items-center justify-center p-6 z-30"
          boxClassName="bg-black/70 rounded-xl p-6 max-w-md text-center space-y-3 text-white"
        />
      )}

      {connected && <Tutorial steps={CAMARA_TUTORIAL_STEPS} storageKey="tourSignAI_camara" />}
    </div>
  );
}
