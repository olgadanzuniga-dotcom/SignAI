import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import FondoJuego from "../../common/FondoJuego";
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
import { abecedarioLSM } from "../../../data/abecedarioLSM";
import { tr } from "../../../i18n";

const TOTAL_RONDAS = 10;
const MS_AVANCE = 1800;

// Solo se pueden esconder letras con tarjeta en LSM y sin acento: "Á" no
// tiene seña propia.
const tarjetaDe = Object.fromEntries(abecedarioLSM.map((l) => [l.letra, l]));

function generarRondas() {
  return barajar(senasConImagen)
    .slice(0, TOTAL_RONDAS)
    .map((sena) => {
      const letras = [...sena.palabra.toUpperCase()];
      const posibles = letras
        .map((letra, i) => (tarjetaDe[letra] ? i : -1))
        .filter((i) => i >= 0);
      const oculta = barajar(posibles)[0];
      const correcta = tarjetaDe[letras[oculta]];
      const distractores = barajar(
        abecedarioLSM.filter((l) => l.letra !== correcta.letra)
      ).slice(0, 2);
      return { sena, letras, oculta, correcta, opciones: barajar([correcta, ...distractores]) };
    });
}

export default function LetraFalta({ setSidebarOpen }) {
  const navigate = useNavigate();
  useCerrarSidebar(setSidebarOpen);

  const [rondas, setRondas] = useState(() => generarRondas());
  const [actual, setActual] = useState(0);
  const [eleccion, setEleccion] = useState(null); // letra elegida
  const [aciertos, setAciertos] = useState(0);
  const timeoutRef = useRef(null);
  const audio = useAudioJuego();

  useEffect(() => () => clearTimeout(timeoutRef.current), []);

  const terminado = actual >= rondas.length;
  const ronda = rondas[actual];

  useEffect(() => {
    if (terminado) audio.fin();
  }, [terminado, audio.fin]);
  usePartidaTerminada("letrafalta", terminado, aciertos, rondas.length);

  const elegir = (opcion) => {
    if (eleccion) return;
    setEleccion(opcion.letra);
    // Se lee la palabra ya completa, para unir letra, seña y sonido.
    registrarRespuesta(ronda.correcta.letra, opcion.letra === ronda.correcta.letra);
    if (opcion.letra === ronda.correcta.letra) {
      setAciertos((n) => n + 1);
      audio.acierto(ronda.sena.palabra);
    } else {
      audio.error(ronda.sena.palabra);
    }
    timeoutRef.current = setTimeout(() => {
      setEleccion(null);
      setActual((n) => n + 1);
    }, MS_AVANCE);
  };

  const reiniciar = () => {
    clearTimeout(timeoutRef.current);
    setRondas(generarRondas());
    setActual(0);
    setEleccion(null);
    setAciertos(0);
  };

  // Estado visual de cada opción tras responder.
  const estadoOpcion = (opcion) => {
    if (!eleccion) return "libre";
    if (opcion.letra === ronda.correcta.letra) return "correcta";
    if (opcion.letra === eleccion) return "fallada";
    return "apagada";
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
      <PageHeader title={tr("Letra que falta")} />
      <FondoJuego tono={2} tono2={9} />

      <div className="z-10 w-full max-w-6xl 2xl:max-w-7xl">
        {terminado ? (
          <GameOverCard
            titulo={aciertos === rondas.length ? "¡Perfecto!" : "¡Terminaste!"}
            onReiniciar={reiniciar}
            onSalir={() => navigate("/Juegos")}
          >
            <p className="text-lg sm:text-xl 2xl:text-2xl text-sutil mb-8 2xl:mb-10">{tr("Completaste")}{" "}<strong className="text-exito text-3xl">{aciertos}</strong>{" "}{tr("de")}{" "}
              {rondas.length}{" "}{tr("palabras.")}</p>
          </GameOverCard>
        ) : (
          <div className="flex flex-col items-center" style={{ gap: "clamp(0.75rem, 2.5vh, 2rem)" }}>
            <ProgressHeader
              className="mb-0"
              descripcion="Elige la seña de la letra que falta."
              pills={[
                { punto: "bg-acento", contenido: `Palabra ${actual + 1} de ${rondas.length}` },
                { punto: "bg-exito", contenido: `${aciertos} ${aciertos === 1 ? "acierto" : "aciertos"}` },
              ]}
              progreso={(actual / rondas.length) * 100}
            />

            <div className="flex flex-wrap items-center justify-center rounded-[2rem] bg-superficie/80 border border-borde shadow-xl"
              style={{ gap: "clamp(0.75rem, 2vw, 2rem)", padding: "clamp(0.75rem, 2vh, 1.75rem) clamp(1rem, 2.5vw, 2.5rem)" }}
            >
              {/* La seña de la palabra completa, como pista. */}
              <div
                className="shrink-0 rounded-3xl p-1.5 shadow-lg"
                style={{
                  width: "clamp(5.5rem, 19vh, 11rem)",
                  aspectRatio: "1",
                  backgroundImage: "linear-gradient(135deg, rgb(var(--cat-2)), rgb(var(--cat-4)))",
                }}
              >
                <div className="h-full w-full rounded-[1.25rem] bg-white p-1.5">
                  <img src={ronda.sena.img} alt={`Seña de ${ronda.sena.palabra}`} className="w-full h-full object-contain" />
                </div>
              </div>

              <div className="flex flex-wrap justify-center" style={{ gap: "clamp(0.3rem, 0.6vw, 0.75rem)" }}>
                {ronda.letras.map((letra, i) => {
                  const esOculta = i === ronda.oculta;
                  const revelada = esOculta && eleccion;
                  const tono = (i % 7) + 1;
                  return (
                    <motion.span
                      key={`${actual}-${i}`}
                      initial={{ y: -24, opacity: 0, rotate: -8 }}
                      animate={
                        esOculta && !revelada
                          ? { y: [0, -6, 0], opacity: 1, rotate: 0 }
                          : { y: 0, opacity: 1, rotate: 0, scale: revelada ? [1, 1.3, 1] : 1 }
                      }
                      transition={
                        esOculta && !revelada
                          ? { y: { repeat: Infinity, duration: 1.2 }, opacity: { delay: i * 0.05 } }
                          : { type: "spring", stiffness: 300, damping: 15, delay: revelada ? 0 : i * 0.05 }
                      }
                      style={{
                        width: "clamp(2.4rem, 4.8vw, 5rem)",
                        height: "clamp(3rem, 6vw, 6rem)",
                        fontSize: "clamp(1.5rem, 3.2vw, 3.4rem)",
                        ...(esOculta
                          ? {}
                          : { color: `rgb(var(--cat-${tono}))`, borderBottomColor: `rgb(var(--cat-${tono}))` }),
                      }}
                      className={`flex items-center justify-center rounded-2xl font-black shadow-md
                        ${esOculta
                          ? revelada
                            ? "border-4 border-exito bg-exito text-acento-texto"
                            : "border-4 border-dashed border-acento bg-acento-suave text-acento"
                          : "border-2 border-b-[6px] border-borde bg-superficie"}`}
                    >
                      {esOculta && !revelada ? "?" : letra}
                    </motion.span>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-3 w-full max-w-4xl" style={{ gap: "clamp(0.75rem, 2.5vw, 2.5rem)" }}>
              {ronda.opciones.map((opcion, idx) => {
                const estado = estadoOpcion(opcion);
                return (
                  <motion.button
                    key={`${actual}-${opcion.letra}`}
                    initial={{ y: 30, opacity: 0 }}
                    animate={
                      estado === "fallada"
                        ? { y: 0, opacity: 1, x: [0, -10, 10, -8, 8, 0] }
                        : { y: 0, opacity: estado === "apagada" ? 0.35 : 1, scale: estado === "correcta" ? 1.06 : 1 }
                    }
                    transition={{ type: "spring", stiffness: 260, damping: 18, delay: eleccion ? 0 : 0.15 + idx * 0.07 }}
                    whileHover={estado === "libre" ? { y: -8, rotate: idx === 1 ? 0 : idx === 0 ? -2 : 2 } : undefined}
                    whileTap={{ scale: 0.94 }}
                    onClick={() => elegir(opcion)}
                    disabled={!!eleccion}
                    aria-label={`Seña de la letra ${opcion.letra}`}
                    className={`relative rounded-[2rem] bg-gradient-to-br ${opcion.color} p-2 shadow-xl hover:shadow-2xl ${
                      estado === "correcta" ? "ring-[6px] ring-exito" : estado === "fallada" ? "ring-[6px] ring-error" : ""
                    }`}
                  >
                    <div className="rounded-[1.6rem] bg-white p-2 sm:p-3">
                      <img
                        src={opcion.img}
                        alt=""
                        className="w-full object-contain"
                        style={{ height: "clamp(6rem, 27vh, 17rem)" }}
                      />
                    </div>
                    {/* La letra solo aparece al responder: antes sería la respuesta. */}
                    <AnimatePresence>
                      {eleccion && (
                        <motion.span
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: "spring", stiffness: 400, damping: 14 }}
                          className={`absolute -top-4 left-1/2 -translate-x-1/2 grid h-14 w-14 place-items-center rounded-full border-4 border-white text-3xl font-black shadow-lg ${
                            estado === "correcta" ? "bg-exito text-acento-texto" : estado === "fallada" ? "bg-error text-acento-texto" : "bg-superficie text-texto"
                          }`}
                        >
                          {opcion.letra}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </motion.button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </PageLayout>
  );
}
