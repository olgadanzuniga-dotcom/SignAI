import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { abecedarioLSM } from "../../../data/abecedarioLSM";
import PageHeader from "../../common/PageHeader";
import FondoJuego from "../../common/FondoJuego";
import PageLayout from "../../common/PageLayout";
import useKidMode from "../../../hooks/useKidMode";
import useAudioJuego from "../../../hooks/useAudioJuego";
import { registrarRespuesta, usePartidaTerminada } from "../../../utils/progreso";
import { tr } from "../../../i18n";

const TOTAL_RONDAS = 10;
const barajar = (arr) => [...arr].sort(() => Math.random() - 0.5);

function generarRondas() {
  const letras = barajar(abecedarioLSM).slice(0, TOTAL_RONDAS);
  return letras.map((correcta) => {
    const incorrectas = barajar(
      abecedarioLSM.filter((l) => l.letra !== correcta.letra)
    ).slice(0, 2);
    const opciones = barajar([correcta, ...incorrectas]);
    return { correcta, opciones };
  });
}

export default function RepasoABC({ sidebarOpen, setSidebarOpen }) {
  const navigate = useNavigate();
  const kidMode = useKidMode();

  const [rondas, setRondas] = useState(() => generarRondas());
  const [rondaActual, setRondaActual] = useState(0);
  const [seleccion, setSeleccion] = useState(null);
  const [bloqueado, setBloqueado] = useState(false);
  const [puntaje, setPuntaje] = useState(0);
  const audio = useAudioJuego();
  const terminado = rondaActual >= rondas.length;

  useEffect(() => {
    if (terminado) audio.fin();
  }, [terminado, audio.fin]);
  usePartidaTerminada("repasoabc", terminado, puntaje, rondas.length);

  useEffect(() => {
    if (typeof setSidebarOpen === "function") setSidebarOpen(false);
  }, [setSidebarOpen]);

  // Este repaso solo existe en modo infantil; si no está activo, regresamos a Juegos.
  useEffect(() => {
    if (!kidMode) navigate("/Juegos", { replace: true });
  }, [kidMode, navigate]);

  if (!kidMode) return null;

  const juegoTerminado = rondaActual >= rondas.length;
  const ronda = rondas[rondaActual];

  const manejarClick = (opcion) => {
    if (bloqueado) return;
    setSeleccion(opcion.letra);
    setBloqueado(true);
    registrarRespuesta(ronda.correcta.letra, opcion.letra === ronda.correcta.letra);
    if (opcion.letra === ronda.correcta.letra) {
      setPuntaje((prev) => prev + 1);
      audio.acierto(ronda.correcta.letra);
    } else {
      audio.error(ronda.correcta.letra);
    }
    setTimeout(() => {
      setRondaActual((prev) => prev + 1);
      setSeleccion(null);
      setBloqueado(false);
    }, 1200);
  };

  const reiniciarJuego = () => {
    setRondas(generarRondas());
    setRondaActual(0);
    setSeleccion(null);
    setBloqueado(false);
    setPuntaje(0);
  };

  return (
    <PageLayout
      className="min-h-screen overflow-hidden"
      contentClassName="justify-center items-center pt-14 pb-8 px-4 sm:px-6 lg:px-8 2xl:px-12 text-gray-900 dark:text-gray-100"
    >
      <PageHeader title={tr("Repaso ABC")} />
      <FondoJuego tono={8} tono2={5} />

      <div className="z-10 w-full max-w-4xl 2xl:max-w-5xl px-4 sm:px-6 2xl:px-10">
        {juegoTerminado ? (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="glass-panel rounded-3xl p-8 sm:p-12 2xl:p-16 shadow-xl text-center mx-auto max-w-2xl"
          >
            <h2 className="font-comic text-4xl sm:text-5xl font-bold heading-gradient mb-4">{tr("¡Muy bien!")}</h2>
            <p className="text-lg sm:text-xl text-gray-600 dark:text-gray-300 mb-8">{tr("Acertaste")}{" "}<strong className="text-emerald-500">{puntaje}</strong>{" "}{tr("de")}{" "}{rondas.length}{" "}{tr("letras.")}</p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <button onClick={reiniciarJuego} className="btn-secondary rounded-full text-lg font-comic">{tr("Jugar de nuevo")}</button>
              <button onClick={() => navigate("/Juegos")} className="btn-primary rounded-full text-lg font-comic">{tr("Regresar al menú")}</button>
            </div>
          </motion.div>
        ) : (
          <>
            <div className="text-center mb-6">
              <span className="inline-block px-4 py-1 rounded-full bg-white dark:bg-white/10 shadow-sm font-comic font-bold text-indigo-600 dark:text-indigo-300">{tr("Letra")}{" "}{rondaActual + 1}{" "}{tr("de")}{" "}{rondas.length}{" "}{tr("· Aciertos:")}{" "}{puntaje}
              </span>
            </div>

            <div className="flex flex-col items-center gap-8">
              <AnimatePresence mode="wait">
                <motion.div
                  key={rondaActual}
                  initial={{ scale: 0.7, opacity: 0, rotate: -6 }}
                  animate={{ scale: 1, opacity: 1, rotate: 0 }}
                  exit={{ scale: 0.7, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 200, damping: 18 }}
                  className={`relative rounded-[2rem] p-6 sm:p-8 shadow-2xl bg-gradient-to-br ${ronda.correcta.color} w-64 h-64 sm:w-80 sm:h-80 flex items-center justify-center border-4 border-white`}
                >
                  <img
                    src={ronda.correcta.img}
                    alt={tr("Seña")}
                    className="w-48 h-48 sm:w-60 sm:h-60 object-contain drop-shadow-lg"
                  />
                </motion.div>
              </AnimatePresence>

              <p className="font-comic text-lg sm:text-xl font-bold text-gray-700 dark:text-gray-200">{tr("¿Qué letra es esta seña?")}</p>

              <div className="grid grid-cols-3 gap-4 sm:gap-6 w-full max-w-lg">
                {ronda.opciones.map((opcion) => {
                  let estilo =
                    "bg-white dark:bg-[#151822] text-gray-800 dark:text-gray-100 border-gray-200 dark:border-gray-700 hover:scale-105";
                  if (seleccion) {
                    if (opcion.letra === ronda.correcta.letra) {
                      estilo = "bg-emerald-400 text-white border-emerald-400 scale-105 shadow-lg";
                    } else if (opcion.letra === seleccion) {
                      estilo = "bg-rose-400 text-white border-rose-400";
                    } else {
                      estilo = "bg-white dark:bg-[#151822] text-gray-300 dark:text-gray-600 border-gray-100 dark:border-gray-800 opacity-60";
                    }
                  }
                  return (
                    <motion.button
                      key={opcion.letra}
                      whileTap={{ scale: 0.92 }}
                      onClick={() => manejarClick(opcion)}
                      disabled={bloqueado}
                      className={`font-comic aspect-square rounded-3xl border-4 text-4xl sm:text-5xl font-bold shadow-md transition-all duration-300 ${estilo}`}
                    >
                      {opcion.letra}
                    </motion.button>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </PageLayout>
  );
}
