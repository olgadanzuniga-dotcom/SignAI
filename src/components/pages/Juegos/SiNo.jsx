import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import FondoJuego from "../../common/FondoJuego";
import { Check, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import PageHeader from "../../common/PageHeader";
import PageLayout from "../../common/PageLayout";
import GameOverCard from "../../common/GameOverCard";
import ProgressHeader from "../../common/ProgressHeader";
import useCerrarSidebar from "../../../hooks/useCerrarSidebar";
import useAudioJuego from "../../../hooks/useAudioJuego";
import { registrarRespuesta, usePartidaTerminada } from "../../../utils/progreso";
import { barajar } from "../../../utils/aleatorio";
import { senasConImagen } from "../../../data/senasConImagen";
import { tr } from "../../../i18n";

const TOTAL_RONDAS = 10;
const MS_AVANCE = 1600;

// Cada ronda muestra una seña y una palabra; la mitad de las veces coinciden.
// La palabra falsa sale de la misma lista, para que sea una trampa creíble.
function generarRondas() {
  return barajar(senasConImagen)
    .slice(0, TOTAL_RONDAS)
    .map((sena) => {
      const coincide = Math.random() < 0.5;
      const palabra = coincide
        ? sena.palabra
        : barajar(senasConImagen.filter((s) => s.palabra !== sena.palabra))[0].palabra;
      return { sena, palabra, coincide };
    });
}

export default function SiNo({ setSidebarOpen }) {
  const navigate = useNavigate();
  useCerrarSidebar(setSidebarOpen);

  const [rondas, setRondas] = useState(() => generarRondas());
  const [actual, setActual] = useState(0);
  const [respuesta, setRespuesta] = useState(null); // true = "Sí", false = "No"
  const [aciertos, setAciertos] = useState(0);
  const timeoutRef = useRef(null);
  const audio = useAudioJuego();

  useEffect(() => () => clearTimeout(timeoutRef.current), []);

  const terminado = actual >= rondas.length;
  const ronda = rondas[actual];

  useEffect(() => {
    if (terminado) audio.fin();
  }, [terminado, audio.fin]);
  usePartidaTerminada("sino", terminado, aciertos, rondas.length);

  const responder = (dijoSi) => {
    if (respuesta !== null) return;
    setRespuesta(dijoSi);
    registrarRespuesta(ronda.sena.palabra, dijoSi === ronda.coincide);
    if (dijoSi === ronda.coincide) {
      setAciertos((n) => n + 1);
      audio.acierto(ronda.sena.palabra);
    } else {
      audio.error(ronda.sena.palabra);
    }
    timeoutRef.current = setTimeout(() => {
      setRespuesta(null);
      setActual((n) => n + 1);
    }, MS_AVANCE);
  };

  const reiniciar = () => {
    clearTimeout(timeoutRef.current);
    setRondas(generarRondas());
    setActual(0);
    setRespuesta(null);
    setAciertos(0);
  };

  const acerto = respuesta !== null && respuesta === ronda?.coincide;

  const estiloBoton = (esSi) => {
    if (respuesta === null) {
      return esSi
        ? "bg-exito text-acento-texto border-white/40 hover:shadow-2xl"
        : "bg-error text-acento-texto border-white/40 hover:shadow-2xl";
    }
    // Tras responder se resalta la respuesta correcta y se apaga la otra.
    return esSi === ronda.coincide
      ? `${esSi ? "bg-exito" : "bg-error"} text-acento-texto border-white scale-105 shadow-2xl`
      : "bg-superficie text-sutil border-borde opacity-50";
  };

  return (
    <PageLayout
      contentClassName="justify-center items-center text-texto"
      contentStyle={{
        paddingTop: "clamp(3.25rem, 7vh, 4.5rem)",
        paddingBottom: "clamp(0.75rem, 3vh, 2rem)",
        paddingInline: "clamp(0.75rem, 2.5vw, 3rem)",
      }}
    >
      <PageHeader title={tr("¿Sí o no?")} />
      <FondoJuego tono={6} tono2={2} />

      <div className="z-10 w-full max-w-6xl 2xl:max-w-7xl">
        {terminado ? (
          <GameOverCard
            titulo={aciertos === rondas.length ? "¡Perfecto!" : "¡Terminaste!"}
            onReiniciar={reiniciar}
            onSalir={() => navigate("/Juegos")}
          >
            <p className="text-lg sm:text-xl 2xl:text-2xl text-sutil mb-8 2xl:mb-10">{tr("Acertaste")}{" "}<strong className="text-exito text-3xl">{aciertos}</strong>{" "}{tr("de")}{" "}
              {rondas.length}.
            </p>
          </GameOverCard>
        ) : (
          <div className="flex flex-col items-center" style={{ gap: "clamp(0.75rem, 3vh, 2.5rem)" }}>
            <ProgressHeader
              className="mb-0"
              descripcion="¿La seña significa esa palabra?"
              pills={[
                { punto: "bg-acento", contenido: `Ronda ${actual + 1} de ${rondas.length}` },
                { punto: "bg-exito", contenido: `${aciertos} ${aciertos === 1 ? "acierto" : "aciertos"}` },
              ]}
              progreso={(actual / rondas.length) * 100}
            />

            {/* En ventana ancha: seña a la izquierda, palabra y botones a la derecha. */}
            <div className="flex w-full flex-col md:flex-row items-center justify-center" style={{ gap: "clamp(1rem, 4vw, 5rem)" }}>
              <motion.div
                key={`sena-${actual}`}
                initial={{ scale: 0.8, opacity: 0, rotate: -4 }}
                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 200, damping: 16 }}
                style={{
                  width: "min(100%, clamp(10rem, 52vh, 34rem))",
                  aspectRatio: "1",
                  padding: "clamp(0.75rem, 1.8vw, 2rem)",
                  backgroundImage: "linear-gradient(135deg, rgb(var(--cat-6)), rgb(var(--cat-7)))",
                }}
                className="relative shrink-0 rounded-[2.5rem] shadow-2xl"
              >
                <div className="h-full w-full rounded-[1.8rem] bg-white p-3 flex items-center justify-center">
                  <img src={ronda.sena.img} alt={tr("Seña")} className="w-full h-full object-contain" />
                </div>
                <AnimatePresence>
                  {respuesta !== null && (
                    <motion.div
                      initial={{ scale: 0, rotate: -30 }}
                      animate={{ scale: 1, rotate: 0 }}
                      exit={{ scale: 0 }}
                      transition={{ type: "spring", stiffness: 320, damping: 14 }}
                      className={`absolute -right-4 -top-4 grid h-20 w-20 sm:h-24 sm:w-24 place-items-center rounded-full border-4 border-white text-acento-texto shadow-xl ${
                        acerto ? "bg-exito" : "bg-error"
                      }`}
                    >
                      {acerto ? <Check className="h-12 w-12" strokeWidth={4} /> : <X className="h-12 w-12" strokeWidth={4} />}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>

              <div className="flex w-full max-w-md flex-col items-center" style={{ gap: "clamp(0.75rem, 2.5vh, 1.75rem)" }}>
                <motion.p
                  key={`palabra-${actual}`}
                  initial={{ y: 16, opacity: 0, scale: 0.9 }}
                  animate={{ y: 0, opacity: 1, scale: 1 }}
                  transition={{ type: "spring", stiffness: 220, damping: 18, delay: 0.1 }}
                  className="w-full rounded-3xl bg-superficie border-4 border-[rgb(var(--cat-6))] px-6 py-4 text-center font-extrabold tracking-wide text-texto shadow-lg"
                  style={{ fontSize: "clamp(2rem, 4.2vw, 4rem)", lineHeight: 1.1 }}
                >
                  {ronda.palabra}
                </motion.p>

                <div className="grid w-full grid-cols-2 gap-4 sm:gap-5">
                  {[true, false].map((esSi) => (
                    <motion.button
                      key={esSi ? "si" : "no"}
                      whileHover={respuesta === null ? { y: -4, scale: 1.03 } : undefined}
                      whileTap={{ scale: 0.93 }}
                      onClick={() => responder(esSi)}
                      disabled={respuesta !== null}
                      style={{ paddingBlock: "clamp(1rem, 3.2vh, 2rem)", fontSize: "clamp(1.5rem, 2.6vw, 2.6rem)" }}
                      className={`flex items-center justify-center gap-2 rounded-3xl border-4 font-extrabold shadow-lg transition-all duration-300 ${estiloBoton(esSi)}`}
                    >
                      {esSi ? <Check className="h-[1.1em] w-[1.1em]" strokeWidth={3.5} /> : <X className="h-[1.1em] w-[1.1em]" strokeWidth={3.5} />}
                      {esSi ? tr("Sí") : tr("No")}
                    </motion.button>
                  ))}
                </div>

                {/* Reserva el alto para que nada salte al aparecer el mensaje. */}
                <div className="min-h-[3.25rem] flex items-center">
                  <AnimatePresence mode="wait">
                    {respuesta !== null && (
                      <motion.p
                        key={`fb-${actual}`}
                        initial={{ y: 8, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className={`rounded-full px-5 py-2 text-center text-base sm:text-xl font-bold text-acento-texto shadow-md ${acerto ? "bg-exito" : "bg-error"}`}
                      >
                        {acerto ? tr("¡Correcto! ") : tr("¡Uy! ")}
                        {ronda.coincide ? tr("Sí, es ") : tr("No, esa seña es ")}
                        <strong>{ronda.sena.palabra}</strong>
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageLayout>
  );
}
