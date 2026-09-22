import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import PageHeader from "../../common/PageHeader";
import Tutorial from "../../common/Tutorial";
import PageLayout from "../../common/PageLayout";
import GameOverCard from "../../common/GameOverCard";
import ProgressHeader from "../../common/ProgressHeader";
import useCerrarSidebar from "../../../hooks/useCerrarSidebar";
import { barajar } from "../../../utils/aleatorio";

const MEMORAMA_TUTORIAL_STEPS = [
  {
    key: "memorama-progreso",
    title: "Tu progreso",
    text: "Aquí ves cuántos pares llevas, las cartas restantes y la barra que indica qué tanto te falta para completar el juego.",
    placement: "bottom",
  },
  {
    key: "memorama-tablero",
    title: "El tablero",
    text: "Toca una carta para voltearla. Encuentra el par entre la seña en LSM y el objeto que representa.",
    placement: "top",
  },
];

import dorsoImg from "../../../assets/reverso_carta.svg";
import elefanteImg from "../../../assets/elefante.svg";
import elefanteLSM from "../../../assets/elefante_lsm.svg"; 
import verdeImg from "../../../assets/verde.svg";
import verdeLSM from "../../../assets/verde_lsm.svg";
import heladoImg from "../../../assets/galleta.svg";
import heladoLSM from "../../../assets/galleta_lsm.svg";
import gatoImg from "../../../assets/gato.svg";
import gatoLSM from "../../../assets/gato_lsm.svg";
import carroImg from "../../../assets/carro.svg";
import carroLSM from "../../../assets/carro_lsm.svg";
import mesaImg from "../../../assets/mesa.svg";
import mesaLSM from "../../../assets/mesa_lsm.svg";
import hamburguesaImg from "../../../assets/hamburguesa.svg";
import hamburguesaLSM from "../../../assets/hamburguesa_lsm.svg";

export default function Memorama({ sidebarOpen, setSidebarOpen }) {
  const navigate = useNavigate();
  const [cards, setCards] = useState([]);
  const [selected, setSelected] = useState([]);
  const [blocked, setBlocked] = useState(false);
  const [intentos, setIntentos] = useState(0);
  const timeoutRef = useRef(null);

  // Si el jugador sale a media comparación, el timer pendiente intentaría
  // actualizar estado de un componente ya desmontado.
  useEffect(() => () => clearTimeout(timeoutRef.current), []);

  const totalPairs = Math.floor(cards.length / 2);
  const matchedPairs = Math.floor(cards.filter((card) => card.matched).length / 2);
  const progress = totalPairs > 0 ? Math.min(100, (matchedPairs / totalPairs) * 100) : 0;
  
  const juegoTerminado = totalPairs > 0 && matchedPairs === totalPairs;

  useCerrarSidebar(setSidebarOpen);

  useEffect(() => {
    const dataset = [
      { palabra: "ELEFANTE", img: elefanteImg, tipo: "objeto" },
      { palabra: "ELEFANTE", img: elefanteLSM, tipo: "seña" },
      { palabra: "VERDE", img: verdeImg, tipo: "objeto" },
      { palabra: "VERDE", img: verdeLSM, tipo: "seña" },
      { palabra: "GALLETA", img: heladoImg, tipo: "objeto" },
      { palabra: "GALLETA", img: heladoLSM, tipo: "seña" },
      { palabra: "GATO", img: gatoImg, tipo: "objeto" },
      { palabra: "GATO", img: gatoLSM, tipo: "seña" },
      { palabra: "CARRO", img: carroImg, tipo: "objeto" },
      { palabra: "CARRO", img: carroLSM, tipo: "seña" },
      { palabra: "MESA", img: mesaImg, tipo: "objeto" },
      { palabra: "MESA", img: mesaLSM, tipo: "seña" },
      { palabra: "HAMBURGUESA", img: hamburguesaImg, tipo: "objeto" },
      { palabra: "HAMBURGUESA", img: hamburguesaLSM, tipo: "seña" },
    ];

    const shuffled = barajar(dataset).map((item, index) => ({
      ...item,
      id: `card-${index}`,
      flipped: false,
      matched: false,
    }));

    setCards(shuffled);
  }, []);

  // Marca las cartas de `indices` con `patch`, siempre creando objetos nuevos:
  // React compara por referencia, así que mutar las cartas en sitio (o volver a
  // pasar el mismo array) hace que se salte el re-render y el tablero se quede
  // congelado a medio voltear.
  const parchearCartas = (indices, patch) =>
    setCards((prev) =>
      prev.map((card, i) => (indices.includes(i) ? { ...card, ...patch } : card))
    );

  const handleFlip = (index) => {
    if (blocked || cards[index].flipped || cards[index].matched) return;

    parchearCartas([index], { flipped: true });

    const newSelected = [...selected, index];
    setSelected(newSelected);

    if (newSelected.length === 2) {
      setBlocked(true);
      setIntentos((n) => n + 1);
      const [firstIdx, secondIdx] = newSelected;
      const acierto = cards[firstIdx].palabra === cards[secondIdx].palabra;

      timeoutRef.current = setTimeout(
        () => {
          parchearCartas(
            [firstIdx, secondIdx],
            acierto ? { matched: true } : { flipped: false }
          );
          setSelected([]);
          setBlocked(false);
        },
        acierto ? 600 : 1000
      );
    }
  };

  const reiniciarJuego = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    const newCards = barajar(
      cards.map((card) => ({ ...card, flipped: false, matched: false }))
    );
    setCards(newCards);
    setSelected([]);
    setBlocked(false);
    setIntentos(0);
  };

  return (
    // Ni `min-h-screen` (el <main> ya mide la ventana: pedir 100vh dentro de
    // un contenedor con relleno saca barra de desplazamiento sola) ni
    // `overflow-hidden` (lo que no cupiera quedaba cortado y sin alcanzar).
    <PageLayout
      contentClassName="items-center text-texto"
      contentStyle={{
        paddingTop: "clamp(3.25rem, 7vh, 4.5rem)",
        paddingBottom: "clamp(0.75rem, 3vh, 2.5rem)",
        paddingInline: "clamp(0.75rem, 2.5vw, 3rem)",
      }}
    >
      <PageHeader />

      <div className="z-10 w-full max-w-6xl 2xl:max-w-[1500px] flex flex-col items-center">
        
        {juegoTerminado ? (
          <GameOverCard
            titulo="¡Excelente!"
            className="p-8 sm:p-12 2xl:p-16 shadow-xl mt-12 sm:mt-20 max-w-2xl 2xl:max-w-3xl w-full border-borde"
            onReiniciar={reiniciarJuego}
            onSalir={() => navigate(-1)}
          >
            <p className="text-lg sm:text-xl 2xl:text-2xl text-sutil mb-8 2xl:mb-10">
              Encontraste los <strong className="text-acento">{totalPairs}</strong> pares
              en <strong className="text-acento">{intentos}</strong> intentos.
              {intentos === totalPairs && " ¡Partida perfecta!"}
            </p>
          </GameOverCard>
        ) : (
          <>
            <ProgressHeader
              dataTutorial="memorama-progreso"
              descripcion="Encuentra las parejas entre la seña en LSM y el objeto correspondiente. Observa con atención antes de voltear la siguiente carta."
              progreso={progress}
              pills={[
                {
                  punto: "bg-acento",
                  contenido: (
                    <>
                      Pares encontrados: <span className="text-acento">{matchedPairs}</span> / {totalPairs || 7}
                    </>
                  ),
                },
                {
                  punto: "bg-exito",
                  contenido: (
                    <>
                      Cartas restantes: <span className="text-exito">{cards.filter((c) => !c.matched).length}</span>
                    </>
                  ),
                },
                {
                  punto: "bg-[rgb(var(--cat-8))]",
                  contenido: (
                    <>
                      Intentos: <span className="text-[rgb(var(--cat-8))]">{intentos}</span>
                    </>
                  ),
                },
              ]}
            />

            <div className="w-full relative mt-2">
              {/* Catorce cartas: con menos de siete columnas salen tres o
                  cuatro filas y el tablero se sale de la ventana — en el
                  mínimo llegaba a quedar 519px por debajo del borde, o sea
                  que no se podía jugar. Siete columnas son siempre dos filas,
                  y las cartas encogen con el ancho en vez de tirar de alto. */}
              <div
                data-tutorial="memorama-tablero"
                className="relative bg-superficie rounded-[2rem] shadow-xl border border-borde"
                style={{ padding: "clamp(0.6rem, 1.6vw, 2.5rem)" }}
              >
                <div
                  className="grid grid-cols-4 sm:grid-cols-7 mx-auto w-full"
                  style={{ gap: "clamp(0.4rem, 1.1vw, 2rem)" }}
                >
                  {cards.map((card, index) => (
                    <motion.div
                      key={card.id}
                      whileHover={{ scale: blocked ? 1 : 1.03 }}
                      whileTap={{ scale: blocked ? 1 : 0.97 }}
                      className="relative w-full aspect-[3/4] cursor-pointer perspective-1000"
                      onClick={() => handleFlip(index)}
                    >
                      <motion.div
                        className="w-full h-full preserve-3d relative"
                        animate={{ rotateY: card.flipped || card.matched ? 180 : 0 }}
                        transition={{ duration: 0.6, type: "spring", stiffness: 200, damping: 20 }}
                      >
                        <div
                          className="absolute inset-0 backface-hidden rounded-2xl shadow-lg overflow-hidden bg-[#005c8f]"
                          style={{ transform: "rotateY(0deg)" }}
                        >
                          <img
                            src={dorsoImg}
                            alt="Dorso"
                            className="w-full h-full object-cover"
                          />
                        </div>

                        {/* La cara de la carta es blanca en los dos temas a
                            propósito: las ilustraciones de las señas son
                            línea sobre transparente y sobre fondo oscuro
                            desaparecen. Por eso aquí el texto también va a
                            color fijo y no a `text-texto`. */}
                        <div
                          className="absolute inset-0 backface-hidden rounded-2xl border-4 border-[rgb(var(--cat-1))] bg-white shadow-xl flex flex-col items-center justify-center overflow-hidden"
                          style={{ transform: "rotateY(180deg)", padding: "clamp(0.25rem, 0.6vw, 1rem)" }}
                        >
                          {/* La imagen se queda con el hueco que sobre
                              (`flex-1 min-h-0`) y la palabra reserva el suyo:
                              antes iban a 3/4 y 1/4 del alto pase lo que
                              pase, y «HAMBURGUESA» se salía 16px por el lado
                              — la carta va `overflow-hidden`, así que se
                              comía las letras. */}
                          <img
                            src={card.img}
                            alt={card.palabra}
                            className="w-3/4 min-h-0 flex-1 object-contain"
                          />
                          <p
                            style={{ fontSize: "clamp(0.6875rem, 0.9vw, 1.125rem)" }}
                            className={`w-full shrink-0 break-words pt-0.5 text-center font-bold uppercase leading-tight tracking-tight ${card.tipo === "seña" ? "text-[#4f46e5]" : "text-[#4b5563]"}`}
                          >
                            {card.palabra}
                          </p>

                          {card.matched && (
                            <div className="absolute top-3 right-3 bg-[#22c55e] w-4 h-4 rounded-full border-2 border-[#ffffff] shadow-sm" />
                          )}
                        </div>
                      </motion.div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {!juegoTerminado && cards.length > 0 && (
        <Tutorial steps={MEMORAMA_TUTORIAL_STEPS} storageKey="tourSignAI_memorama" />
      )}
    </PageLayout>
  );
}