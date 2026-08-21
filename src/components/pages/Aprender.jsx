import React from "react";
import { useNavigate } from "react-router-dom";
import Tutorial from "../common/Tutorial";
import CategoriaCard from "../common/CategoriaCard";
import PantallaCuadricula from "../common/PantallaCuadricula";

import abcImg from "../../assets/Juegoabc.svg";
import numerosImg from "../../assets/numeros.svg";
import coloresImg from "../../assets/colores.svg";
import presentacionesImg from "../../assets/presentacion.svg";
import saludosImg from "../../assets/saludo.svg";
import diasImg from "../../assets/tiempo.svg";
import comidaImg from "../../assets/comida.svg";
import lugaresImg from "../../assets/lugares.svg";
import transporteImg from "../../assets/transporte.svg";

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
const CATEGORIAS = [
  { titulo: "Abecedario", img: abcImg, slug: "abecedario" },
  { titulo: "Números", img: numerosImg, slug: "numeros" },
  { titulo: "Colores", img: coloresImg, slug: "colores" },
  { titulo: "Presentaciones personales", img: presentacionesImg, slug: "presentaciones" },
  { titulo: "Saludos y despedidas", img: saludosImg, slug: "saludos" },
  { titulo: "Días y tiempo", img: diasImg, slug: "dias" },
  { titulo: "Comida y bebidas", img: comidaImg, slug: "comida" },
  { titulo: "Lugares", img: lugaresImg, slug: "lugares" },
  { titulo: "Transporte y direcciones", img: transporteImg, slug: "transporte" },
];

export default function Aprender() {
  const navigate = useNavigate();

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
