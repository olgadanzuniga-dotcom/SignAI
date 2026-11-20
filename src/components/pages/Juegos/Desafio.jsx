import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { StopCircle, Timer, CheckCircle, XCircle, ScanLine } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import useSignServer from "../../../hooks/useSignServer";
import useCerrarSidebar from "../../../hooks/useCerrarSidebar";
import useAudioJuego from "../../../hooks/useAudioJuego";
import { registrarRespuesta, usePartidaTerminada } from "../../../utils/progreso";
import { sonar } from "../../../utils/sonidos";
import {
  palabrasDesafio,
  senasEstaticas,
  senasDinamicas,
} from "../../../data/palabras";
import PageHeader from "../../common/PageHeader";
import FondoJuego from "../../common/FondoJuego";
import Tutorial from "../../common/Tutorial";
import PageLayout from "../../common/PageLayout";
import GameOverCard from "../../common/GameOverCard";
import CameraStartScreen from "../../common/CameraStartScreen";
import ServerStatusOverlay from "../../common/ServerStatusOverlay";
import VideoMotor from "../../common/VideoMotor";
import { tr } from "../../../i18n";

const TIEMPO_POR_SENA = 20;

const DESAFIO_TUTORIAL_STEPS = [
  {
    key: "desafio-temporizador",
    title: "Tiempo",
    text: "Tendrás 20 segundos por seña. Si el reloj llega a cero, pierdes el desafío.",
    placement: "bottom",
  },
  {
    key: "desafio-aciertos",
    title: "Aciertos",
    text: "Aquí se cuentan tus aciertos consecutivos. Acumula los máximos posibles.",
    placement: "bottom",
  },
  {
    key: "desafio-palabra",
    title: "Seña objetivo",
    text: "Esta es la seña que debes representar con tus manos frente a la cámara. El modelo de IA la validará automáticamente.",
    placement: "top",
  },
  {
    key: "desafio-iniciar",
    title: "Iniciar Reto",
    text: "Cuando estés listo, pulsa aquí para activar la cámara. Podrás posicionarte antes de que arranque el cronómetro.",
    placement: "top",
  },
];

export default function Desafio({ sidebarOpen, setSidebarOpen }) {
  const [juegoIniciado, setJuegoIniciado] = useState(false);
  const [rondaActual, setRondaActual] = useState(0);
  const [estadoRonda, setEstadoRonda] = useState("esperando");
  const [tiempoRestante, setTiempoRestante] = useState(TIEMPO_POR_SENA);
  const [puntaje, setPuntaje] = useState(0);
  const audio = useAudioJuego();

  useCerrarSidebar(setSidebarOpen);
  // `rondas` se define más abajo (depende del modelo); para la partida basta
  // el total que quedó al terminar, que se lee del ref.
  const totalRondasRef = useRef(0);
  usePartidaTerminada(
    "desafio",
    estadoRonda === "terminado" || estadoRonda === "fracaso",
    puntaje,
    Math.max(totalRondasRef.current, puntaje, 1)
  );

  // Se acabó el tiempo / se rindió, o completó todas las rondas.
  useEffect(() => {
    if (estadoRonda === "fracaso") {
      sonar("error");
      registrarRespuesta(objetivoRef.current, false);
    }
    if (estadoRonda === "terminado") sonar("fin");
  }, [estadoRonda]);

  // El acierto lo confirma el servidor de inferencia: cuando el modelo emite
  // un commit cuya seña coincide con el objetivo de la ronda, avanzamos.
  // Refs para que el callback (estable) siempre vea el estado actual.
  const estadoRef = useRef(estadoRonda);
  estadoRef.current = estadoRonda;
  const objetivoRef = useRef("");
  const manejarAciertoRef = useRef(null);
  // Timer del "éxito → siguiente ronda": si el jugador se rinde o sale a media
  // animación, no debe seguir avanzando rondas de un componente desmontado.
  const avanceRef = useRef(null);

  useEffect(() => () => clearTimeout(avanceRef.current), []);

  const onCommit = useCallback((c) => {
    if (estadoRef.current !== "jugando") return;
    if ((c.letra || "").toUpperCase() === objetivoRef.current) {
      manejarAciertoRef.current?.();
    }
  }, []);

  // El desafío mezcla letras estáticas y palabras dinámicas, así que pide el
  // modelo "unificado" al conectar. Si no está disponible, las rondas se
  // filtran a lo que el modelo activo sí puede reconocer.
  const { connected, serverDown, engineError, videoUrl, status, modelo } = useSignServer({
    enabled: juegoIniciado,
    modeloPreferido: "unificado",
    onCommit,
  });

  const cameraActive = !!videoUrl;

  const rondas = useMemo(() => {
    if (modelo === "estatico") return palabrasDesafio.filter((p) => senasEstaticas.has(p));
    if (modelo === "dinamico") return palabrasDesafio.filter((p) => senasDinamicas.has(p));
    return palabrasDesafio;
  }, [modelo]);
  totalRondasRef.current = rondas.length;

  // El modelo activo es estado del servidor y puede cambiar a media partida
  // (otra ventana, el selector del traductor): la lista de rondas se acorta y
  // `rondaActual` se queda apuntando fuera. Sin este ajuste el reto mostraba
  // «???» con el cronómetro corriendo y no había forma de acertar.
  const indiceRonda = rondas.length ? Math.min(rondaActual, rondas.length - 1) : 0;
  const objetivo = juegoIniciado ? rondas[indiceRonda] || "" : "";
  objetivoRef.current = objetivo;

  // La ronda arranca cuando el stream de la cámara ya está en pantalla.
  useEffect(() => {
    if (juegoIniciado && cameraActive && estadoRonda === "esperando") {
      setEstadoRonda("jugando");
      setTiempoRestante(TIEMPO_POR_SENA);
    }
  }, [juegoIniciado, cameraActive, estadoRonda]);

  // Cronómetro: solo corre con la cámara visible (si el servidor se cae a
  // media ronda, el tiempo se pausa junto con el overlay de reconexión).
  useEffect(() => {
    let timer;
    if (juegoIniciado && cameraActive && estadoRonda === "jugando" && tiempoRestante > 0) {
      timer = setInterval(() => {
        setTiempoRestante((prev) => prev - 1);
      }, 1000);
    } else if (tiempoRestante === 0 && estadoRonda === "jugando") {
      setEstadoRonda("fracaso");
      setJuegoIniciado(false); // cierra WS y libera la cámara del servidor
    }
    return () => clearInterval(timer);
  }, [juegoIniciado, cameraActive, estadoRonda, tiempoRestante]);

  const manejarAcierto = () => {
    if (estadoRonda !== "jugando") return;

    setEstadoRonda("exito");
    setPuntaje((prev) => prev + 1);
    registrarRespuesta(objetivo, true);
    audio.acierto(objetivo.length > 1 ? objetivo.charAt(0) + objetivo.slice(1).toLowerCase() : objetivo);

    avanceRef.current = setTimeout(() => {
      if (indiceRonda + 1 < rondas.length) {
        setRondaActual(indiceRonda + 1);
        setTiempoRestante(TIEMPO_POR_SENA);
        setEstadoRonda("jugando");
      } else {
        setEstadoRonda("terminado");
        setJuegoIniciado(false);
      }
    }, 2000);
  };
  manejarAciertoRef.current = manejarAcierto;

  const rendirse = () => {
    clearTimeout(avanceRef.current);
    setEstadoRonda("fracaso");
    setJuegoIniciado(false);
  };

  const reiniciarJuego = () => {
    clearTimeout(avanceRef.current);
    setRondaActual(0);
    setPuntaje(0);
    setEstadoRonda("esperando");
    setJuegoIniciado(false);
    setTiempoRestante(TIEMPO_POR_SENA);
  };

  return (
    // El relleno superior empuja el contenido justo debajo del botón Volver;
    // en `clamp()` para que en una ventana baja no se coma el hueco de la
    // cámara, que es lo único que aquí importa de verdad.
    <PageLayout
      contentClassName="text-texto"
      contentStyle={{
        paddingTop: "clamp(3.25rem, 7vh, 4.5rem)",
        paddingBottom: "clamp(0.5rem, 2vh, 1.5rem)",
        paddingInline: "clamp(0.75rem, 2.5vw, 3rem)",
      }}
    >

      <PageHeader title={tr("Modo desafío")} />
      <FondoJuego tono={5} tono2={7} />

      <div className="flex-1 w-full max-w-4xl 2xl:max-w-6xl mx-auto flex flex-col items-center justify-center">

        {estadoRonda === "fracaso" || estadoRonda === "terminado" ? (
          <GameOverCard
            titulo={estadoRonda === "fracaso" ? "¡Tiempo Agotado!" : "¡Desafío Completado!"}
            tituloClassName={`text-3xl sm:text-4xl font-extrabold mb-3 ${
              estadoRonda === "fracaso" ? "text-error" : "text-exito"
            }`}
            className="p-8 sm:p-12 shadow-2xl w-full border-borde"
            icono={
              estadoRonda === "fracaso" ? (
                <XCircle size={70} className="mx-auto text-error mb-4" />
              ) : (
                <CheckCircle size={70} className="mx-auto text-exito mb-4" />
              )
            }
            acciones={
              <button
                onClick={reiniciarJuego}
                className="bg-acento text-acento-texto px-8 py-3 rounded-xl font-bold text-lg shadow-lg hover:bg-acento-fuerte transition"
              >{tr("Volver a intentar")}</button>
            }
          >
            <p className="text-lg sm:text-xl text-sutil mb-6">
              {estadoRonda === "fracaso" ? (
                <>{tr("Lograste acertar")}{" "}<strong className="text-acento">{puntaje}</strong>{" "}{tr("señas consecutivas.")}</>
              ) : (
                <>{tr("¡Increíble! Acertaste todas las señas.")}</>
              )}
            </p>
          </GameOverCard>
        ) : (

          <div className="w-full flex-1 flex flex-col gap-3 justify-between">

            <div className="flex-none w-full flex justify-between items-end px-2 2xl:px-4">
              <div data-tutorial="desafio-temporizador" className="flex flex-col">
                <span className="text-xs sm:text-sm 2xl:text-base font-bold tracking-widest text-sutil uppercase">{tr("Tiempo")}</span>
                <div className={`flex items-center gap-1.5 2xl:gap-2 text-3xl sm:text-4xl 2xl:text-5xl font-black ${tiempoRestante <= 5 ? 'text-error animate-pulse' : 'text-texto'}`}>
                  <Timer className="w-7 h-7 sm:w-8 sm:h-8 2xl:w-10 2xl:h-10" />
                  0:{tiempoRestante.toString().padStart(2, '0')}
                </div>
              </div>
              <div data-tutorial="desafio-aciertos" className="text-right">
                <span className="text-xs sm:text-sm 2xl:text-base font-bold tracking-widest text-sutil uppercase">{tr("Aciertos")}</span>
                <div className="text-3xl sm:text-4xl 2xl:text-5xl font-black text-acento leading-none">{puntaje}</div>
              </div>
            </div>

            {/* flex-1: esta caja ocupa todo el espacio vertical sobrante */}
            <div
              style={{ minHeight: "clamp(9rem, 34vh, 25rem)" }}
              className="flex-1 w-full bg-superficie-2 rounded-3xl flex flex-col items-center justify-center border-2 border-dashed border-borde relative overflow-hidden shadow-inner"
            >

              {cameraActive ? (
                <>
                  {/* El stream MJPEG llega ya anotado (landmarks) desde el servidor */}
                  <VideoMotor
                    src={videoUrl}
                    alt={tr("Cámara con detección de señas")}
                    className="absolute inset-0 w-full h-full object-cover"
                  />

                  <AnimatePresence>
                    {estadoRonda === "exito" && (
                      <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-green-500/30 backdrop-blur-sm flex items-center justify-center z-30"
                      >
                        <motion.div initial={{ scale: 0.5 }} animate={{ scale: 1, type: "spring" }}>
                          <CheckCircle size={80} className="text-white drop-shadow-lg" />
                        </motion.div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Seña detectada en vivo por el modelo.
                      Este chip y el botón RENDIRSE van sobre la imagen de la
                      cámara, no sobre el fondo de la app: por eso llevan color
                      fijo (negro translucido, blanco, rojo) y no tokens. Si
                      siguieran al tema claro dejarían de leerse. */}
                  {estadoRonda === "jugando" && status.letra && (
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-white/10">
                      <ScanLine className="w-4 h-4 text-cyan-300" />
                      <span className="text-white font-bold text-lg">{status.letra}</span>
                      <span className="text-white/60 text-xs">
                        {Math.round((status.conf || 0) * 100)}%
                      </span>
                    </div>
                  )}

                  <button
                    onClick={rendirse}
                    className="absolute top-4 right-4 bg-red-500/90 hover:bg-red-600 text-white px-4 py-2 rounded-full text-xs font-bold backdrop-blur-sm transition z-20 flex items-center gap-2 shadow-md"
                  >
                    <StopCircle size={16} />{" "}{tr("RENDIRSE")}</button>
                </>
              ) : juegoIniciado ? (
                <ServerStatusOverlay
                  serverDown={serverDown}
                  engineError={engineError}
                  className="absolute inset-0 flex items-center justify-center bg-black/60 z-10"
                />
              ) : (
                <CameraStartScreen
                  size="sm"
                  loading={false}
                  onStart={() => setJuegoIniciado(true)}
                  startLabel="Iniciar Reto"
                  dataTutorial="desafio-iniciar"
                  descripcion="Activa la cámara para comenzar. La IA validará tus señas y el tiempo correrá en cuanto te veas en pantalla."
                />
              )}
            </div>

            {/* Compactada para no robar espacio a la cámara */}
            <div data-tutorial="desafio-palabra" className="flex-none w-full bg-superficie rounded-3xl shadow-lg border border-borde py-3 2xl:py-5 flex flex-col items-center justify-center text-center">
              <span className="text-xs 2xl:text-sm font-bold tracking-widest text-acento uppercase mb-0.5 2xl:mb-1">{tr("Haz la seña para:")}</span>
              <AnimatePresence mode="wait">
                <motion.h2
                  key={indiceRonda}
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                  className="text-4xl sm:text-5xl 2xl:text-7xl font-black text-texto tracking-wider leading-none"
                >
                  {objetivo || "???"}
                </motion.h2>
              </AnimatePresence>
            </div>

          </div>
        )}
      </div>

      <Tutorial steps={DESAFIO_TUTORIAL_STEPS} storageKey="tourSignAI_desafio" />
    </PageLayout>
  );
}
