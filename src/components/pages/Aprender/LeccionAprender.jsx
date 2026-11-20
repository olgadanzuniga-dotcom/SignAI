import React, { useEffect, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { StopCircle, CheckCircle, ScanLine, ArrowRight, Check } from "lucide-react";
import VisorMano, { RUTA_MANO } from "../../common/VisorMano";
import useCamera from "../../../hooks/useCamera";
import useSignServer from "../../../hooks/useSignServer";
import useCerrarSidebar from "../../../hooks/useCerrarSidebar";
import { senasEstaticas, senasDinamicas } from "../../../data/palabras";
import PageHeader from "../../common/PageHeader";
import Tutorial from "../../common/Tutorial";
import PageLayout from "../../common/PageLayout";
import CameraStartScreen from "../../common/CameraStartScreen";
import ServerStatusOverlay from "../../common/ServerStatusOverlay";
import VideoMotor from "../../common/VideoMotor";
import { tr } from "../../../i18n";

// Qué letras puede validar cada modelo del servidor. Con "unificado" también
// entran las letras con movimiento (J, Q, RR, X, Z, Ñ); con "estatico" solo las
// quietas. La K no está en ningún dataset todavía, así que nunca se valida.
const soportaLetra = (modelo, letra) => {
  if (modelo === "dinamico") return senasDinamicas.has(letra);
  if (modelo === "estatico") return senasEstaticas.has(letra);
  // unificado (o cualquier modelo combinado): estáticas + dinámicas
  return senasEstaticas.has(letra) || senasDinamicas.has(letra);
};

const LECCION_TUTORIAL_STEPS_INTRO = [
  {
    key: "leccion-iniciar",
    title: "Iniciar Cámara",
    text: "Pulsa este botón para activar la cámara y empezar a practicar las señas de esta lección.",
    placement: "top",
  },
  {
    key: "leccion-modelo",
    title: "Modelo 3D",
    text: "Aquí puedes ver una vista 3D de la mano. Arrastra para girarla y observar la seña desde cualquier ángulo.",
    placement: "left",
  },
  {
    key: "leccion-item",
    title: "Seña a practicar",
    text: "Esta es la seña que debes imitar. Cuando avances, irán apareciendo las siguientes.",
    placement: "top",
  },
];

const LECCION_TUTORIAL_STEPS_CAMARA = [
  {
    key: "leccion-camara-activa",
    title: "Vista en vivo",
    text: "Aquí te ves a ti mismo. Realiza la seña frente a la cámara con buena iluminación.",
    placement: "right",
  },
  {
    key: "leccion-acierto",
    title: "Confirmar acierto",
    text: "Cuando completes la seña correctamente, pulsa este botón para avanzar a la siguiente.",
    placement: "top",
  },
  {
    key: "leccion-detener",
    title: "Detener",
    text: "Si quieres pausar la práctica, pulsa aquí para apagar la cámara.",
    placement: "bottom",
  },
];

export default function LeccionAprender({
  items,
  itemInicial,
  modeloPath = RUTA_MANO,
  setSidebarOpen,
  validarConModelo = false,
}) {
  const [indiceActual, setIndiceActual] = useState(() => {
    if (itemInicial == null) return 0;
    const idx = items.findIndex((i) => i.id === itemInicial);
    return idx >= 0 ? idx : 0;
  });
  const [mostrarExito, setMostrarExito] = useState(false);

  // Una categoría vacía (o un índice que se salió de rango tras cambiar de
  // lección) dejaba `itemActual` en undefined y el render lanzaba. La ruta ya
  // filtra las categorías vacías, pero el componente no debe depender de eso.
  const itemActual = items[indiceActual] ?? items[0];
  const objetivo = (itemActual?.label || "").toUpperCase();

  // --- Cámara manual (categorías que NO usan el modelo) ---
  const {
    videoRef,
    active: camaraManualActiva,
    errorMsg,
    loading,
    start: startCamera,
    stop: stopStream,
  } = useCamera();

  // --- Motor del modelo (solo abecedario). enabled controla la conexión. ---
  const avanzarRef = useRef(null);
  const objetivoRef = useRef(objetivo);
  objetivoRef.current = objetivo;
  const exitoRef = useRef(false);
  const avanceTimerRef = useRef(null);

  useEffect(() => () => clearTimeout(avanceTimerRef.current), []);

  const onSignCommit = useCallback((c) => {
    // Acierto solo si la letra confirmada coincide con la lección actual.
    if (exitoRef.current) return;
    if (c.letra && c.letra.toUpperCase() === objetivoRef.current) {
      avanzarRef.current?.();
    }
  }, []);

  // Las lecciones validadas son de letras: el "unificado" las cubre todas
  // (incluidas J/Q/X/Z/Ñ); si no está compilado, el "estatico" es el mínimo
  // viable. Sin esto la lección heredaría el modelo que dejó otra pantalla.
  const { connected, serverDown, engineError, videoUrl, status, modelo } = useSignServer({
    enabled: validarConModelo,
    modeloPreferido: ["unificado", "estatico"],
    onCommit: onSignCommit,
  });

  const letraSoportada = validarConModelo && soportaLetra(modelo, objetivo);

  useCerrarSidebar(setSidebarOpen);

  const siguiente = () => {
    setIndiceActual((prev) => (prev + 1) % items.length);
    setMostrarExito(false);
    exitoRef.current = false;
  };

  const manejarAcierto = useCallback(() => {
    setMostrarExito(true);
    exitoRef.current = true;
    avanceTimerRef.current = setTimeout(() => {
      setMostrarExito(false);
      exitoRef.current = false;
      setIndiceActual((prev) => (prev + 1) % items.length);
    }, 1500);
  }, [items.length]);
  avanzarRef.current = manejarAcierto;

  // En modo modelo la "cámara activa" depende del feed del servidor.
  const camaraActiva = validarConModelo ? !!videoUrl : camaraManualActiva;
  const detectando =
    validarConModelo &&
    (status.estado === "DETECTANDO" || status.estado === "ESPERA");

  const tamanoLabel = (label) => {
    const n = label.length;
    if (n > 14) return "text-lg sm:text-2xl lg:text-3xl 2xl:text-5xl";
    if (n > 10) return "text-xl sm:text-3xl lg:text-4xl 2xl:text-6xl";
    if (n > 6) return "text-3xl sm:text-4xl lg:text-5xl 2xl:text-7xl";
    return "text-5xl sm:text-7xl lg:text-8xl 2xl:text-[9rem]";
  };

  return (
    <PageLayout
      contentClassName="text-texto"
      contentStyle={{
        paddingTop: "clamp(3.25rem, 7vh, 4.5rem)",
        paddingBottom: "clamp(0.5rem, 2.5vh, 2rem)",
        paddingInline: "clamp(0.75rem, 2.5vw, 2rem)",
      }}
    >
      <PageHeader />

      <div
        className="w-full max-w-7xl 2xl:max-w-[1600px] mx-auto flex-1 min-h-0 flex flex-col"
        style={{ marginTop: "clamp(0.5rem, 2vh, 2rem)" }}
      >
        <div
          className="grid grid-cols-1 md:grid-cols-[3fr_2fr] flex-1 min-h-0"
          style={{ gap: "clamp(0.6rem, 1.6vw, 2rem)" }}
        >
          <div className="aspect-video md:aspect-auto bg-superficie-2 rounded-3xl flex flex-col items-center justify-center border-2 border-dashed border-borde relative overflow-hidden shadow-inner">
            {camaraActiva ? (
              <>
                {validarConModelo ? (
                  <VideoMotor
                    src={videoUrl}
                    data-tutorial="leccion-camara-activa"
                    alt={tr("Cámara")}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                ) : (
                  <video
                    ref={videoRef}
                    data-tutorial="leccion-camara-activa"
                    autoPlay
                    playsInline
                    muted
                    className="absolute inset-0 w-full h-full object-cover"
                    style={{ transform: "scaleX(-1)" }}
                  />
                )}

                <AnimatePresence>
                  {mostrarExito && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 bg-green-500/30 backdrop-blur-sm flex items-center justify-center z-30"
                    >
                      <motion.div initial={{ scale: 0.5 }} animate={{ scale: 1, type: "spring" }}>
                        <CheckCircle size={100} className="text-white drop-shadow-lg" />
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Letra detectada en vivo (modo modelo) */}
                {detectando && status.letra && !mostrarExito && (
                  <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-white/10">
                    <ScanLine className="w-4 h-4 text-cyan-300" />
                    <span className="text-white font-bold text-lg">{status.letra}</span>
                    <span className="text-white/60 text-xs">
                      {Math.round((status.conf || 0) * 100)}%
                    </span>
                  </div>
                )}

                {/* Detener: solo en modo manual (el modelo se libera al salir) */}
                {!validarConModelo && (
                  <button
                    data-tutorial="leccion-detener"
                    onClick={stopStream}
                    className="absolute top-3 right-3 sm:top-4 sm:right-4 lg:top-5 lg:right-5 bg-red-500/90 hover:bg-red-600 text-white px-3 py-1.5 sm:px-4 sm:py-2 lg:px-5 lg:py-2.5 rounded-full text-[10px] sm:text-xs lg:text-sm font-bold backdrop-blur-sm transition z-20 flex items-center gap-1.5 sm:gap-2 shadow-lg"
                  >
                    <StopCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 lg:w-5 lg:h-5" />{tr("DETENER")}</button>
                )}

                <div className="absolute bottom-3 left-3 sm:bottom-5 sm:left-5 lg:bottom-7 lg:left-7 bg-black/60 backdrop-blur-md px-3 py-1.5 sm:px-4 sm:py-2 lg:px-5 lg:py-2.5 rounded-full text-[10px] sm:text-xs lg:text-sm font-medium border border-white/10 text-white flex items-center gap-1.5 sm:gap-2 z-20">
                  <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.8)]"></div>
                  {validarConModelo
                    ? letraSoportada
                      ? tr("Haz la seña de la letra")
                      : tr("Sin validación automática")
                    : tr("Cámara activa")}
                </div>

                {/* Acierto: manual en modo manual; en modo modelo solo para
                    letras NO soportadas (J,K,Q,X,Z) como salida de escape. */}
                {(!validarConModelo || !letraSoportada) && (
                  <button
                    data-tutorial="leccion-acierto"
                    onClick={manejarAcierto}
                    disabled={mostrarExito}
                    className="absolute bottom-3 right-3 sm:bottom-5 sm:right-5 lg:bottom-7 lg:right-7 bg-green-500 hover:bg-green-600 text-white px-4 py-2 sm:px-5 sm:py-2.5 lg:px-6 lg:py-3 rounded-full font-bold shadow-lg transition z-20 animate-bounce text-xs sm:text-sm lg:text-base inline-flex items-center gap-1.5"
                  >
                    {validarConModelo ? (
                      <>{tr("Siguiente")}<ArrowRight className="w-4 h-4" />
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" strokeWidth={3} />{tr("Simular Acierto")}</>
                    )}
                  </button>
                )}

                {/* Aviso para letras que el modelo activo no puede validar */}
                {validarConModelo && !letraSoportada && (
                  <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 bg-amber-500/90 text-black text-xs font-semibold px-3 py-1.5 rounded-full">
                    {modelo === "estatico" && senasDinamicas.has(objetivo)
                      ? tr("Esta letra lleva movimiento; el modelo estático no la detecta")
                      : tr("Esta letra aún no está en el modelo; avanza manualmente")}
                  </div>
                )}

                {/* Conectando al servidor (modo modelo) */}
                {validarConModelo && !connected && (
                  <ServerStatusOverlay serverDown={serverDown} engineError={engineError} />
                )}
              </>
            ) : (
              <CameraStartScreen
                size="lg"
                loading={loading}
                errorMsg={errorMsg}
                onStart={startCamera}
                dataTutorial="leccion-iniciar"
                startLabel="Iniciar Cámara"
                descripcion={
                  <>{tr("Dale clic a iniciar para empezar a practicar desde")}{" "}
                    <strong className="text-acento">{items[0]?.label}</strong>
                  </>
                }
              />
            )}
          </div>

          {/* PANEL DERECHO - proporción fija 3:1 entre modelo y label */}
          <div className="grid grid-rows-[3fr_1fr] gap-3 sm:gap-4 aspect-[2/3] md:aspect-auto min-h-0">
            <div data-tutorial="leccion-modelo" className="min-h-0 bg-superficie rounded-3xl shadow-xl border border-borde relative overflow-hidden flex flex-col">
              {/* Franja de la marca: los mismos tonos de la rampa que ordenan el temario. */}
              <div
                className="absolute top-0 left-0 w-full h-2 opacity-60 z-10"
                style={{ backgroundImage: "var(--degradado-marca)" }}
              ></div>

              <div className="flex-1 w-full h-full cursor-grab active:cursor-grabbing relative z-0">
                <VisorMano modeloPath={modeloPath} />
              </div>
            </div>

            <div data-tutorial="leccion-item" className="min-h-0 bg-superficie rounded-3xl shadow-xl border border-borde flex items-center justify-center overflow-hidden px-6">
              <AnimatePresence mode="wait">
                <motion.span
                  key={itemActual?.id}
                  initial={{ scale: 0.8, opacity: 0, y: -20 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 1.2, opacity: 0, y: 20 }}
                  className={`${tamanoLabel(itemActual?.label || "")} font-black leading-tight select-none text-texto text-center`}
                >
                  {itemActual?.label}
                </motion.span>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      {!camaraActiva && !loading && (
        <Tutorial steps={LECCION_TUTORIAL_STEPS_INTRO} storageKey="tourSignAI_leccion_intro" />
      )}
      {camaraActiva && (
        <Tutorial steps={LECCION_TUTORIAL_STEPS_CAMARA} storageKey="tourSignAI_leccion_camara" />
      )}
    </PageLayout>
  );
}
