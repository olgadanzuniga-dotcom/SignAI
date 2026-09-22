import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { respuestasIncorrectasQuiz as respuestasIncorrectas } from "../../../data/palabras";
import PageHeader from "../../common/PageHeader";
import Tutorial from "../../common/Tutorial";
import PageLayout from "../../common/PageLayout";
import GameOverCard from "../../common/GameOverCard";
import useCerrarSidebar from "../../../hooks/useCerrarSidebar";
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

import perroImg from "../../../assets/perro.svg";
import holaImg from "../../../assets/hola.svg";
import tacosImg from "../../../assets/tacos.svg";
import amarilloImg from "../../../assets/amarillo.svg";
import carroImg from "../../../assets/carro_lsm.svg";
import elefanteImg from "../../../assets/elefante_lsm.svg";
import tiendaImg from "../../../assets/tienda.svg";
import adiosImg from "../../../assets/adios.svg";
import refrescoImg from "../../../assets/refresco.svg";
import gatoImg from "../../../assets/gato_lsm.svg";
import autobusImg from "../../../assets/autobus.svg";
import montanaImg from "../../../assets/montaña.svg";
import libroImg from "../../../assets/libro.svg";
import ventanaImg from "../../../assets/ventana.svg";
import cieloImg from "../../../assets/cielo.svg";

const PalabrasCorrectas = [
  { palabra: "Perro", img: perroImg },
  { palabra: "Hola", img: holaImg },
  { palabra: "Tacos", img: tacosImg },
  { palabra: "Amarillo", img: amarilloImg },
  { palabra: "Carro", img: carroImg },
  { palabra: "Elefante", img: elefanteImg },
  { palabra: "Tienda", img: tiendaImg },
  { palabra: "Adiós", img: adiosImg },
  { palabra: "Refresco", img: refrescoImg },
  { palabra: "Gato", img: gatoImg },
  { palabra: "Autobús", img: autobusImg },
  { palabra: "Montaña", img: montanaImg },
  { palabra: "Libro", img: libroImg },
  { palabra: "Ventana", img: ventanaImg },
  { palabra: "Cielo", img: cieloImg },
];

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

  const juegoTerminado = preguntaActual >= preguntasJuego.length;

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
    if (opcion === preguntasJuego[preguntaActual]?.palabra) {
      setAciertos((n) => n + 1);
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

      <PageHeader />

      <div className="z-10 w-full max-w-5xl 2xl:max-w-[1400px]">
        
        {juegoTerminado ? (
          <GameOverCard
            titulo={aciertos === preguntasJuego.length ? "¡Perfecto!" : "¡Terminaste!"}
            onReiniciar={reiniciarJuego}
            onSalir={() => navigate(-1)}
          >
            <p className="text-lg sm:text-xl 2xl:text-2xl text-sutil mb-8 2xl:mb-10">
              Acertaste{" "}
              <strong className="text-exito text-3xl">{aciertos}</strong> de{" "}
              {preguntasJuego.length} señas.
            </p>
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
                width: "min(100%, clamp(8rem, 42vh, 28rem))",
                aspectRatio: "1",
                padding: "clamp(0.75rem, 2vw, 3rem)",
              }}
              className="bg-superficie rounded-[2rem] shadow-xl border border-borde shrink-0 flex items-center justify-center"
            >
              {preguntasJuego[preguntaActual]?.img ? (
                <img 
                  src={preguntasJuego[preguntaActual].img} 
                  alt="Seña" 
                  className="w-full h-full object-contain"
                />
              ) : (
                <span className="text-sutil font-bold text-2xl">Imagen aquí</span>
              )}
            </motion.div>

            <div
              data-tutorial="quiz-opciones"
              className="w-full max-w-md 2xl:max-w-lg flex flex-col"
              style={{ gap: "clamp(0.5rem, 1.6vh, 1.25rem)" }}
            >

              <div className="flex flex-col items-center text-center mb-2">
                <span className="text-sm md:text-base 2xl:text-lg font-bold uppercase tracking-[0.2em] text-acento">
                  Pregunta {preguntaActual + 1} de {preguntasJuego.length}
                  <span className="ml-3 inline-flex items-center gap-1 text-exito">
                    {aciertos}
                    <Check className="w-4 h-4" strokeWidth={3} />
                  </span>
                </span>
                <p className="text-sm md:text-base 2xl:text-lg text-sutil mt-1">
                  Elige la palabra que corresponde a la seña mostrada.
                </p>
              </div>

              {opciones.map((opcion, index) => {
                
                // Determinar colores de estado
                let bgClass = "bg-superficie text-texto border-borde hover:border-acento hover:bg-acento-suave hover:shadow-md hover:-translate-y-0.5";
                
                if (seleccion) {
                  if (opcion === correctaActual) {
                    bgClass = "bg-exito text-acento-texto border-exito shadow-lg scale-[1.02]";
                  } else if (opcion === seleccion && opcion !== correctaActual) {
                    bgClass = "bg-error text-acento-texto border-error shadow-md";
                  } else {
                    bgClass = "bg-superficie text-sutil border-borde opacity-60";
                  }
                }

                return (
                  <motion.button
                    key={index}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => manejarClick(opcion)}
                    disabled={bloqueado}
                    style={{
                      paddingBlock: "clamp(0.5rem, 1.6vh, 1rem)",
                      paddingInline: "clamp(0.75rem, 1.6vw, 2rem)",
                    }}
                    className={`w-full rounded-2xl border-2 font-semibold text-base md:text-lg 2xl:text-xl text-center shadow-sm transition-all duration-300 ease-in-out ${bgClass}`}
                  >
                    {letras[index]}) {opcion}
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