import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { palabrasDeletreo as listaPalabras } from "../../../data/palabras";
import PageHeader from "../../common/PageHeader";
import Tutorial from "../../common/Tutorial";
import PageLayout from "../../common/PageLayout";
import GameOverCard from "../../common/GameOverCard";
import ProgressHeader from "../../common/ProgressHeader";
import useCerrarSidebar from "../../../hooks/useCerrarSidebar";
import { barajar } from "../../../utils/aleatorio";

const DELETREO_TUTORIAL_STEPS = [
  {
    key: "deletreo-progreso",
    title: "Tu progreso",
    text: "Aquí se muestra el nivel actual, tus aciertos acumulados y la barra de avance del juego.",
    placement: "bottom",
  },
  {
    key: "deletreo-disponibles",
    title: "Letras disponibles",
    text: "Estas son las señas que debes ordenar. Arrástralas o tócalas para colocarlas.",
    placement: "bottom",
  },
  {
    key: "deletreo-slots",
    title: "Forma la palabra",
    text: "Coloca cada seña en su espacio para formar la palabra correcta. Si te equivocas, puedes regresar la letra arriba.",
    placement: "top",
  },
];

// Placeholder temporal: todas las letras usan la misma imagen hasta tener assets reales
import imgPlaceholder from "../../../assets/elefante_lsm.svg";

const obtenerImagenLetra = () => imgPlaceholder;

// Las fichas de arriba y los huecos de abajo tienen que medir EXACTAMENTE lo
// mismo (una ficha se arrastra de un sitio al otro), así que la medida vive en
// un solo lugar. Iba en escalones fijos por punto de ruptura — 112px de alto
// pasara lo que pasara — y en una ventana baja las dos bandejas juntas se
// salían de la pantalla. Con `vw` para el ancho y `vh` para el alto, el juego
// entra igual en 800x600 que en un monitor de 27 pulgadas.
const FICHA = {
  width: "clamp(3.75rem, 8.5vw, 11rem)",
  height: "clamp(4.5rem, 13vh, 13rem)",
};

export default function Deletreo({ sidebarOpen, setSidebarOpen }) {
  const navigate = useNavigate();
  const timeoutRef = useRef(null);
  const slotRefs = useRef([]);
  const disponiblesRef = useRef(null);

  const [nivelActual, setNivelActual] = useState(0);
  const [letrasDisponibles, setLetrasDisponibles] = useState([]);
  // letrasColocadas es un array disperso: cada índice es un objeto letra o null
  const [letrasColocadas, setLetrasColocadas] = useState([]);
  const [verificando, setVerificando] = useState(false);
  const [juegoTerminado, setJuegoTerminado] = useState(false);
  const [puntaje, setPuntaje] = useState(0);

  useCerrarSidebar(setSidebarOpen);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (nivelActual >= listaPalabras.length) {
      setJuegoTerminado(true);
      return;
    }
    const palabraSecreta = listaPalabras[nivelActual];
    const letras = palabraSecreta.split("").map((letra, index) => ({
      id: `n${nivelActual}-${letra}-${index}`,
      caracter: letra,
      img: obtenerImagenLetra(letra),
    }));
    const letrasRevueltas = barajar(letras);

    slotRefs.current = [];
    setLetrasDisponibles(letrasRevueltas);
    setLetrasColocadas(Array(palabraSecreta.length).fill(null));
    setVerificando(false);
  }, [nivelActual]);

  const palabraObjetivo = listaPalabras[nivelActual] || "";

  // Verificación: solo cuando TODOS los slots están llenos y no estemos ya verificando
  useEffect(() => {
    if (verificando) return;
    if (!palabraObjetivo) return;
    if (letrasColocadas.length !== palabraObjetivo.length) return;
    if (letrasColocadas.some((l) => l === null)) return;

    setVerificando(true);
    const palabraFormada = letrasColocadas.map((l) => l.caracter).join("");
    if (palabraFormada === palabraObjetivo) {
      setPuntaje((prev) => prev + 1);
    }

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setNivelActual((prev) => prev + 1);
    }, 3000);
  }, [letrasColocadas, palabraObjetivo, verificando]);

  // Colocar/mover una letra en un slot específico
  const dropEnSlot = (letra, slotIndex, origen) => {
    if (verificando) return;

    if (origen.tipo === "disponibles") {
      // Guarda anti-duplicado: si la letra ya está en algún slot, no volver a colocarla
      if (letrasColocadas.some((l) => l && l.id === letra.id)) return;

      const existente = letrasColocadas[slotIndex];
      setLetrasColocadas((prev) => {
        const nuevas = [...prev];
        nuevas[slotIndex] = letra;
        return nuevas;
      });
      setLetrasDisponibles((d) => {
        const filtradas = d.filter((l) => l.id !== letra.id);
        return existente ? [...filtradas, existente] : filtradas;
      });
    } else if (origen.tipo === "slot") {
      if (origen.index === slotIndex) return;
      setLetrasColocadas((prev) => {
        const nuevas = [...prev];
        const existente = nuevas[slotIndex];
        nuevas[origen.index] = existente; // swap (puede ser null)
        nuevas[slotIndex] = letra;
        return nuevas;
      });
    }
  };

  const devolverADisponibles = (slotIndex) => {
    if (verificando) return;
    // La ficha se lee ANTES, no dentro del actualizador. Meter un
    // `setLetrasDisponibles` dentro de `setLetrasColocadas` convierte el
    // actualizador en impuro, y React se reserva el derecho de ejecutarlo dos
    // veces (lo hace, de hecho, en StrictMode y al descartar un render
    // concurrente): la ficha volvía por duplicado a la bandeja, con la misma
    // `key` y todo.
    const letra = letrasColocadas[slotIndex];
    if (!letra) return;

    setLetrasColocadas((prev) => {
      if (!prev[slotIndex]) return prev;
      const nuevas = [...prev];
      nuevas[slotIndex] = null;
      return nuevas;
    });
    // Idempotente a propósito: si el actualizador se repite, no duplica.
    setLetrasDisponibles((d) =>
      d.some((l) => l.id === letra.id) ? d : [...d, letra]
    );
  };

  // Tap: colocar en el primer slot vacío
  const colocarEnPrimerVacio = (letra) => {
    if (verificando) return;
    // Guarda anti-duplicado
    if (letrasColocadas.some((l) => l && l.id === letra.id)) return;

    const slotIndex = letrasColocadas.findIndex((l) => l === null);
    if (slotIndex === -1) return;
    setLetrasColocadas((prev) => {
      const nuevas = [...prev];
      nuevas[slotIndex] = letra;
      return nuevas;
    });
    setLetrasDisponibles((d) => d.filter((l) => l.id !== letra.id));
  };

  // Detección del drop según la posición del puntero
  const handleDragEnd = (letra, info, origen) => {
    if (verificando) return;
    const { x, y } = info.point;

    for (let i = 0; i < slotRefs.current.length; i++) {
      const el = slotRefs.current[i];
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        dropEnSlot(letra, i, origen);
        return;
      }
    }

    // Si se soltó fuera de todos los slots y venía de un slot, regresarla a disponibles
    if (origen.tipo === "slot") {
      devolverADisponibles(origen.index);
    }
    // Si venía de disponibles, dragSnapToOrigin la regresa sola
  };

  const haRespondido =
    verificando &&
    palabraObjetivo.length > 0 &&
    letrasColocadas.length === palabraObjetivo.length &&
    letrasColocadas.every((l) => l !== null);

  const progreso = Math.min(
    100,
    Math.max(0, (nivelActual / listaPalabras.length) * 100)
  );

  return (
    <PageLayout
      contentClassName="items-center text-texto"
      contentStyle={{
        paddingTop: "clamp(3.25rem, 7vh, 4.5rem)",
        paddingBottom: "clamp(0.5rem, 2vh, 1.5rem)",
        paddingInline: "clamp(0.75rem, 2.5vw, 3rem)",
      }}
    >
      <PageHeader />

      <div className="z-10 w-full max-w-5xl 2xl:max-w-[1400px] flex flex-col items-stretch">
        <ProgressHeader
          dataTutorial="deletreo-progreso"
          descripcion="Arrastra las señas a los espacios para formar la palabra correcta. Puedes moverlas entre huecos o regresarlas arriba si te equivocas."
          progreso={progreso}
          className="mb-4"
          pills={[
            {
              punto: "bg-acento",
              contenido: (
                <>
                  Nivel {Math.min(nivelActual + 1, listaPalabras.length)} / {listaPalabras.length}
                </>
              ),
            },
            {
              punto: "bg-exito",
              contenido: (
                <>
                  Aciertos: <span className="text-exito">{puntaje}</span>
                </>
              ),
            },
          ]}
        />

        {juegoTerminado ? (
          <div className="flex-1 flex items-center justify-center">
            <GameOverCard
              titulo="¡Juego Completado!"
              tituloClassName="text-3xl sm:text-4xl font-extrabold text-acento mb-4"
              className="p-10 shadow-xl border-borde"
              onSalir={() => navigate(-1)}
            >
              <p className="text-xl sm:text-2xl text-sutil mb-6">
                Acertaste <strong className="text-exito text-3xl">{puntaje}</strong> de {listaPalabras.length} palabras.
              </p>
            </GameOverCard>
          </div>
        ) : (
          <React.Fragment key={nivelActual}>
            <div
              ref={disponiblesRef}
              data-tutorial="deletreo-disponibles"
              style={{
                minHeight: "clamp(6rem, 18vh, 14rem)",
                gap: "clamp(0.5rem, 1.2vw, 1.5rem)",
                padding: "clamp(0.75rem, 1.6vw, 2.5rem)",
                marginBottom: "clamp(0.6rem, 2vh, 2rem)",
              }}
              className="w-full flex flex-wrap justify-center items-center rounded-3xl bg-superficie border border-borde shadow-xl"
            >
              <AnimatePresence>
                {letrasDisponibles.map((letra) => (
                  <motion.div
                    key={letra.id}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                    drag={!verificando}
                    dragSnapToOrigin
                    dragElastic={0.2}
                    dragMomentum={false}
                    onDragEnd={(e, info) =>
                      handleDragEnd(letra, info, { tipo: "disponibles" })
                    }
                    onTap={() => colocarEnPrimerVacio(letra)}
                    whileHover={{ scale: 1.05, y: -4 }}
                    whileTap={{ scale: 0.95 }}
                    whileDrag={{ scale: 1.1, zIndex: 50 }}
                    /* Cara blanca en los dos temas: la ilustración de la
                       seña es línea oscura sobre transparente y sobre fondo
                       oscuro no se ve. Misma excepción que las cartas del
                       memorama. */
                    style={FICHA}
                    className="cursor-grab active:cursor-grabbing bg-white rounded-2xl shadow-sm border border-borde p-2 sm:p-3 flex flex-col items-center justify-center hover:shadow-md hover:border-acento touch-none select-none"
                  >
                    <img
                      src={letra.img}
                      alt="Seña"
                      draggable={false}
                      className="w-full h-full object-contain drop-shadow-sm pointer-events-none"
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            <div className="w-full relative mt-2 flex-1 flex flex-col items-center justify-start">
              <div
                data-tutorial="deletreo-slots"
                style={{
                  minHeight: "clamp(6.5rem, 20vh, 17.5rem)",
                  padding: "clamp(0.75rem, 1.6vw, 3rem)",
                }}
                className="relative w-full bg-superficie rounded-[2rem] shadow-xl border border-borde flex flex-col items-center justify-center"
              >
                <div
                  className="flex flex-wrap justify-center z-10 relative"
                  style={{ gap: "clamp(0.5rem, 1.2vw, 1.5rem)" }}
                >
                  {Array.from({ length: palabraObjetivo.length }).map((_, index) => {
                    const letra = letrasColocadas[index];

                    // Blanca siempre, por lo mismo que las fichas de arriba.
                    // El resultado se marca con borde y halo en vez de teñir
                    // el fondo, que apagaría el dibujo.
                    let bgClass = "bg-white border-borde";
                    if (haRespondido && letra) {
                      const esCorrecta = letra.caracter === palabraObjetivo[index];
                      bgClass = esCorrecta
                        ? "bg-white border-exito ring-4 ring-exito/40"
                        : "bg-white border-error ring-4 ring-error/40";
                    }

                    return (
                      <div
                        key={`slot-${index}`}
                        ref={(el) => (slotRefs.current[index] = el)}
                        style={FICHA}
                        className="relative rounded-2xl group"
                      >
                        <div className="absolute inset-0 rounded-2xl border-2 border-dashed border-borde bg-superficie-2/60 transition-colors group-hover:border-acento group-hover:bg-acento-suave/50" />

                        <AnimatePresence>
                          {letra && (
                            <motion.div
                              key={letra.id}
                              initial={{ scale: 0.6, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              exit={{ scale: 0.6, opacity: 0 }}
                              transition={{ type: "spring", stiffness: 300, damping: 25 }}
                              drag={!verificando}
                              dragSnapToOrigin
                              dragElastic={0.2}
                              dragMomentum={false}
                              onDragEnd={(e, info) =>
                                handleDragEnd(letra, info, { tipo: "slot", index })
                              }
                              onTap={() => devolverADisponibles(index)}
                              whileHover={{ scale: verificando ? 1 : 1.05 }}
                              whileTap={{ scale: verificando ? 1 : 0.95 }}
                              whileDrag={{ scale: 1.1, zIndex: 50 }}
                              className={`absolute inset-0 cursor-grab active:cursor-grabbing rounded-2xl shadow-md border p-2 sm:p-3 flex flex-col items-center justify-center z-10 ${bgClass}`}
                            >
                              <img
                                src={letra.img}
                                alt="Seña"
                                draggable={false}
                                className="w-full h-full object-contain pointer-events-none"
                              />

                              {haRespondido && palabraObjetivo[index] && (
                                <motion.span
                                  initial={{ opacity: 0, scale: 0.5 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  className={`absolute -bottom-3 sm:-bottom-4 font-black text-xl sm:text-2xl px-3 py-1 rounded-lg shadow-sm bg-superficie ${
                                    letra.caracter === palabraObjetivo[index]
                                      ? "text-exito border border-exito/40"
                                      : "text-error border border-error/40"
                                  }`}
                                >
                                  {letra.caracter}
                                </motion.span>
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>

                <AnimatePresence>
                  {haRespondido && (
                    <motion.div
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      style={{ marginTop: "clamp(1.25rem, 4vh, 2.5rem)" }}
                      className="text-center bg-acento-suave px-8 py-3 rounded-2xl border border-acento/25"
                    >
                      <p className="text-acento font-bold uppercase tracking-widest text-xs mb-1">
                        La palabra es
                      </p>
                      <p className="text-3xl sm:text-4xl font-black text-acento tracking-widest">
                        {palabraObjetivo}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </React.Fragment>
        )}
      </div>

      {!juegoTerminado && letrasDisponibles.length > 0 && (
        <Tutorial steps={DELETREO_TUTORIAL_STEPS} storageKey="tourSignAI_deletreo" />
      )}
    </PageLayout>
  );
}
