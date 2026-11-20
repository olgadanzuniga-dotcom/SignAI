import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { respuestasIncorrectasQuiz as respuestasIncorrectas } from "../../../data/palabras";
import PageHeader from "../../common/PageHeader";
import FondoJuego from "../../common/FondoJuego";
import Tutorial from "../../common/Tutorial";
import PageLayout from "../../common/PageLayout";
import GameOverCard from "../../common/GameOverCard";
import useCerrarSidebar from "../../../hooks/useCerrarSidebar";
import useAudioJuego from "../../../hooks/useAudioJuego";
import { registrarRespuesta, usePartidaTerminada } from "../../../utils/progreso";
import { barajar } from "../../../utils/aleatorio";

const QUIZ_TUTORIAL_STEPS = [
  {
    key: "quiz-imagen",
    title: "La seña",
    text: "Observa con atención la seña mostrada en LSM. Es lo que tienes que identificar.",
    placement: "right",
  },
  {
    key: "quiz-opciones",
    title: "Tus opciones",
    text: "Elige la palabra que corresponde a la seña. Tienes 4 opciones por pregunta y al final verás tu resultado.",
    placement: "left",
  },
];

import { senasConImagen as PalabrasCorrectas } from "../../../data/senasConImagen";
import { tr } from "../../../i18n";

export default function Quiz({ sidebarOpen, setSidebarOpen }) {
  const navigate = useNavigate();

  // Preguntas barajadas para esta partida
  const [preguntasJuego, setPreguntasJuego] = useState(() =>
    barajar(PalabrasCorrectas)
  );

  const [preguntaActual, setPreguntaActual] = useState(0);
  const [opciones, setOpciones] = useState([]);
  const [seleccion, setSeleccion] = useState(null);
  const [bloqueado, setBloqueado] = useState(false);
  const [aciertos, setAciertos] = useState(0);
  const timeoutRef = useRef(null);
  const audio = useAudioJuego();

  const juegoTerminado = preguntaActual >= preguntasJuego.length;

  useEffect(() => {
    if (juegoTerminado) audio.fin();
  }, [juegoTerminado, audio.fin]);
  usePartidaTerminada("quiz", juegoTerminado, aciertos, preguntasJuego.length);

  useCerrarSidebar(setSidebarOpen);

  // El avance automático de pregunta no debe sobrevivir al desmontaje.
  useEffect(() => () => clearTimeout(timeoutRef.current), []);

  // Lógica para generar las 4 opciones revueltas cada vez que cambia la pregunta
  useEffect(() => {
    // Solo revolvemos si el juego NO ha terminado
    if (!juegoTerminado && preguntasJuego.length > 0) {
      const respuestaCorrecta = preguntasJuego[preguntaActual].palabra;
      
      // Elegir 3 incorrectas al azar que NO sean la respuesta correcta
      const incorrectasAleatorias = barajar(
        respuestasIncorrectas.filter((p) => p !== respuestaCorrecta)
      ).slice(0, 3);

      // Juntarlas y revolverlas
      const opcionesRevueltas = barajar([...incorrectasAleatorias, respuestaCorrecta]);

      setOpciones(opcionesRevueltas);
      setSeleccion(null);
      setBloqueado(false);
    }
  }, [preguntaActual, juegoTerminado, preguntasJuego]);

  const manejarClick = (opcion) => {
    if (bloqueado) return;
    setSeleccion(opcion);
    setBloqueado(true);
    const correcta = preguntasJuego[preguntaActual]?.palabra;
    registrarRespuesta(correcta, opcion === correcta);
    if (opcion === correcta) {
      setAciertos((n) => n + 1);
      audio.acierto(correcta);
    } else {
      audio.error(correcta);
    }

    // Esperar 2 segundos para ver el resultado y avanzar
    timeoutRef.current = setTimeout(() => {
      setPreguntaActual((prev) => prev + 1);
    }, 2000);
  };

  const reiniciarJuego = () => {
    clearTimeout(timeoutRef.current);
    setPreguntasJuego(barajar(PalabrasCorrectas));
    setPreguntaActual(0);
    setSeleccion(null);
    setBloqueado(false);
    setAciertos(0);
  };

  const letras = ["A", "B", "C", "D"];
  const correctaActual = preguntasJuego[preguntaActual]?.palabra;

  return (
    <PageLayout
      contentClassName="justify-center items-center text-texto"
      contentStyle={{
        paddingTop: "clamp(3.25rem, 7vh, 4.5rem)",
        paddingBottom: "clamp(0.75rem, 3vh, 2rem)",
        paddingInline: "clamp(0.75rem, 2.5vw, 3rem)",
      }}
    >

      <PageHeader title={tr("Quiz visual")} />
      <FondoJuego tono={3} tono2={9} />

      <div className="z-10 w-full max-w-6xl 2xl:max-w-[1500px]">
        
        {juegoTerminado ? (
          <GameOverCard
            titulo={aciertos === preguntasJuego.length ? "¡Perfecto!" : "¡Terminaste!"}
            onReiniciar={reiniciarJuego}
            onSalir={() => navigate(-1)}
          >
            <p className="text-lg sm:text-xl 2xl:text-2xl text-sutil mb-8 2xl:mb-10">{tr("Acertaste")}{" "}
              <strong className="text-exito text-3xl">{aciertos}</strong>{" "}{tr("de")}{" "}
              {preguntasJuego.length}{" "}{tr("señas.")}</p>
          </GameOverCard>
        ) : (
          // La seña y las opciones se ponen en fila desde `md` (768) y no
          // desde `lg`: apiladas suman el alto de la imagen más el de los
          // cuatro botones, que en una ventana baja se salía 265px. Y la caja
          // de la seña se mide con `vh` además de con `vw`, para que sea el
          // alto disponible —no el ancho— quien la limite cuando toca.
          <div className="flex flex-col md:flex-row gap-[clamp(1rem,3vh,4rem)] md:gap-[clamp(1.5rem,4vw,6rem)] items-center justify-center">

            <motion.div
              key={`img-${preguntaActual}`}
              data-tutorial="quiz-imagen"
              initial={{ x: -50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ type: "spring", stiffness: 100 }}
              style={{
                width: "min(100%, clamp(10rem, 56vh, 36rem))",
                aspectRatio: "1",
                padding: "clamp(0.6rem, 1.4vw, 1.5rem)",
                backgroundImage: "linear-gradient(135deg, rgb(var(--cat-3)), rgb(var(--cat-5)))",
              }}
              className="rounded-[2.5rem] shadow-2xl shrink-0"
            >
              <div className="h-full w-full rounded-[1.9rem] bg-white p-3 flex items-center justify-center">
                <img
                  src={preguntasJuego[preguntaActual]?.img}
                  alt={tr("Seña")}
                  className="w-full h-full object-contain"
                />
              </div>
            </motion.div>

            <div
              data-tutorial="quiz-opciones"
              className="w-full max-w-lg 2xl:max-w-xl flex flex-col"
              style={{ gap: "clamp(0.5rem, 1.6vh, 1.25rem)" }}
            >

              <div className="flex flex-col items-center text-center mb-2">
                <span className="text-base md:text-xl 2xl:text-2xl font-black uppercase tracking-[0.15em] text-acento">{tr("Pregunta")}{" "}{preguntaActual + 1}{" "}{tr("de")}{" "}{preguntasJuego.length}
                  <span className="ml-3 inline-flex items-center gap-1 text-exito">
                    {aciertos}
                    <Check className="w-4 h-4" strokeWidth={3} />
                  </span>
                </span>
                <p className="text-base md:text-lg 2xl:text-xl font-medium text-texto/80 mt-1">{tr("Elige la palabra que corresponde a la seña mostrada.")}</p>
              </div>

              {opciones.map((opcion, index) => {
                // Cada opción tiene su color (la letra A-D va en una pastilla
                // de ese tono); al responder manda el verde/rojo.
                const tono = [1, 3, 5, 9][index];
                let bgClass = "bg-superficie text-texto hover:shadow-xl";
                let estiloBorde = { borderColor: `rgb(var(--cat-${tono}))` };
                let pastilla = { backgroundColor: `rgb(var(--cat-${tono}))` };

                if (seleccion) {
                  estiloBorde = {};
                  pastilla = {};
                  if (opcion === correctaActual) {
                    bgClass = "bg-exito text-acento-texto border-exito shadow-xl scale-[1.04]";
                  } else if (opcion === seleccion && opcion !== correctaActual) {
                    bgClass = "bg-error text-acento-texto border-error shadow-md";
                  } else {
                    bgClass = "bg-superficie text-sutil border-borde opacity-50";
                  }
                }

                return (
                  <motion.button
                    key={`${preguntaActual}-${index}`}
                    initial={{ x: 40, opacity: 0 }}
                    animate={
                      seleccion && opcion === seleccion && opcion !== correctaActual
                        ? { x: [0, -10, 10, -8, 8, 0], opacity: 1 }
                        : { x: 0, opacity: 1 }
                    }
                    transition={{ type: "spring", stiffness: 260, damping: 20, delay: seleccion ? 0 : index * 0.07 }}
                    whileHover={!bloqueado ? { x: 6, scale: 1.02 } : undefined}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => manejarClick(opcion)}
                    disabled={bloqueado}
                    style={{
                      ...estiloBorde,
                      paddingBlock: "clamp(0.6rem, 2vh, 1.4rem)",
                      paddingInline: "clamp(0.75rem, 1.4vw, 1.5rem)",
                      fontSize: "clamp(1.1rem, 1.8vw, 1.9rem)",
                    }}
                    className={`w-full flex items-center gap-4 rounded-3xl border-4 font-bold text-left shadow-md transition-colors duration-300 ${bgClass}`}
                  >
                    <span
                      style={pastilla}
                      className={`grid shrink-0 place-items-center rounded-2xl font-black h-[1.9em] w-[1.9em] ${
                        seleccion ? "bg-white/25" : "text-white"
                      }`}
                    >
                      {letras[index]}
                    </span>
                    {opcion}
                  </motion.button>
                );
              })}
            </div>

          </div>
        )}
      </div>

      {!juegoTerminado && opciones.length > 0 && (
        <Tutorial steps={QUIZ_TUTORIAL_STEPS} storageKey="tourSignAI_quiz" />
      )}
    </PageLayout>
  );
}