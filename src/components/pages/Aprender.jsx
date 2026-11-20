import React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import Tutorial from "../common/Tutorial";
import CategoriaCard from "../common/CategoriaCard";
import PantallaCuadricula from "../common/PantallaCuadricula";
import PageLayout from "../common/PageLayout";
import PageHeader from "../common/PageHeader";
import ResponsiveContainer from "../common/ResponsiveContainer";
import KidCard from "../common/KidCard";
import useKidMode from "../../hooks/useKidMode";

import abcImg from "../../assets/Juegoabc.svg";
import numerosImg from "../../assets/numeros.svg";
import coloresImg from "../../assets/colores.svg";
import presentacionesImg from "../../assets/presentacion.svg";
import saludosImg from "../../assets/saludo.svg";
import diasImg from "../../assets/tiempo.svg";
import comidaImg from "../../assets/comida.svg";
import lugaresImg from "../../assets/lugares.svg";
import transporteImg from "../../assets/transporte.svg";
import { tr } from "../../i18n";

const APRENDER_TUTORIAL_STEPS = [
  {
    key: "aprender-primera",
    title: "Elige una categoría",
    text: "Cada tarjeta abre una lección con las señas de esa categoría. Te recomendamos empezar por el abecedario.",
    placement: "bottom",
  },
  {
    key: "aprender-cuadricula",
    title: "Explora todas las categorías",
    text: "Aquí están todas las lecciones disponibles: números, colores, saludos, comida, lugares y más. Avanza a tu propio ritmo.",
    placement: "top",
  },
];

// El orden de esta lista es el del temario, y también el de la rampa de color
// (ver `--cat-N` en styles/tokens.css): el color va indicando por dónde vas.
// `gradient` solo lo usa el modo infantil (ver KidCard); el modo normal sigue
// resolviendo su color con `tono` + los tokens `--cat-N`.
const CATEGORIAS = [
  { titulo: "Abecedario", img: abcImg, slug: "abecedario", gradient: "from-sky-400 to-blue-500" },
  { titulo: "Números", img: numerosImg, slug: "numeros", gradient: "from-fuchsia-400 to-purple-500" },
  { titulo: "Colores", img: coloresImg, slug: "colores", gradient: "from-amber-400 to-orange-500" },
  { titulo: "Presentaciones personales", img: presentacionesImg, slug: "presentaciones", gradient: "from-emerald-400 to-teal-500" },
  { titulo: "Saludos y despedidas", img: saludosImg, slug: "saludos", gradient: "from-rose-400 to-pink-500" },
  { titulo: "Días y tiempo", img: diasImg, slug: "dias", gradient: "from-violet-400 to-indigo-500" },
  { titulo: "Comida y bebidas", img: comidaImg, slug: "comida", gradient: "from-lime-400 to-green-500" },
  { titulo: "Lugares", img: lugaresImg, slug: "lugares", gradient: "from-cyan-400 to-sky-500" },
  { titulo: "Transporte y direcciones", img: transporteImg, slug: "transporte", gradient: "from-red-400 to-rose-500" },
];

export default function Aprender() {
  const navigate = useNavigate();
  const kidMode = useKidMode();

  if (kidMode) {
    return (
      <PageLayout contentClassName="items-center justify-start text-center text-gray-900 dark:text-gray-100 pt-10 pb-16">
        <PageHeader title="SignAI" />

        <ResponsiveContainer size="xl">
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mt-6 sm:mt-8 mb-10 sm:mb-14"
          >
            <h1 className="font-comic text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-3">
              <span className="heading-gradient">{tr("Lengua de Señas Mexicana")}</span>
            </h1>
            <p className="font-comic text-base sm:text-lg text-gray-600 dark:text-gray-300 max-w-xl mx-auto">{tr("Elige una categoría y aprende jugando.")}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            data-tutorial="aprender-cuadricula"
            className="grid grid-cols-3 gap-4 sm:gap-6 lg:gap-8 max-w-4xl mx-auto"
          >
            {CATEGORIAS.map((cat, i) => (
              <KidCard
                key={cat.slug}
                title={cat.titulo}
                img={cat.img}
                gradient={cat.gradient}
                tutorialKey={i === 0 ? "aprender-primera" : undefined}
                onClick={() => navigate(`/Aprender/${cat.slug}`)}
              />
            ))}
          </motion.div>
        </ResponsiveContainer>

        <Tutorial steps={APRENDER_TUTORIAL_STEPS} storageKey="tourSignAI_aprender" />
      </PageLayout>
    );
  }

  return (
    <PantallaCuadricula
      titulo="Lengua de Señas Mexicana"
      subtitulo="Nueve categorías para practicar a tu ritmo."
      cuadriculaKey="aprender-cuadricula"
      tutorial={
        <Tutorial steps={APRENDER_TUTORIAL_STEPS} storageKey="tourSignAI_aprender" />
      }
    >
      {CATEGORIAS.map((cat, i) => (
        <CategoriaCard
          key={cat.slug}
          titulo={cat.titulo}
          img={cat.img}
          tono={i + 1}
          tutorialKey={i === 0 ? "aprender-primera" : undefined}
          onClick={() => navigate(`/Aprender/${cat.slug}`)}
        />
      ))}
    </PantallaCuadricula>
  );
}
