import React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import Tutorial from "../common/Tutorial";
import CategoriaCard from "../common/CategoriaCard";
import PantallaCuadricula from "../common/PantallaCuadricula";
import abcImg from "../../assets/abc.svg";
import juegosImg from "../../assets/juegos.svg";

const APRENDIZAJE_TUTORIAL_STEPS = [
  {
    key: "card-aprender",
    title: "Aprender",
    text: "Aquí encontrarás lecciones organizadas por categorías para aprender la Lengua de Señas Mexicana desde cero.",
    placement: "bottom",
  },
  {
    key: "card-juegos",
    title: "Juegos",
    text: "Pon a prueba lo aprendido con juegos interactivos: memorama, quiz, desafíos y deletreo.",
    placement: "bottom",
  },
];

export default function Aprendizaje({ sidebarOpen, setSidebarOpen }) {
  const navigate = useNavigate();

  const irA = (ruta) => {
    if (sidebarOpen && typeof setSidebarOpen === "function") setSidebarOpen(false);
    navigate(ruta);
  };

  const cards = [
    {
      title: "Aprender",
      img: abcImg,
      tutorialKey: "card-aprender",
      onClick: () => irA("/Aprender"),
    },
    {
      title: "Juegos",
      img: juegosImg,
      tutorialKey: "card-juegos",
      onClick: () => irA("/Juegos"),
    },
  ];

  return (
    <PantallaCuadricula
      titulo="Aprendizaje"
      subtitulo="Practica con lecciones o pon a prueba lo aprendido."
      columnas="grid-cols-1 sm:grid-cols-2"
      mostrarVolver={false}
      tutorial={
        <Tutorial
          steps={APRENDIZAJE_TUTORIAL_STEPS}
          storageKey="tourSignAI_aprendizaje"
        />
      }
    >
      {cards.map((card, i) => (
        <CategoriaCard
          key={card.title}
          titulo={card.title}
          img={card.img}
          tono={i === 0 ? 1 : 5}
          variante="tarjeta"
          tutorialKey={card.tutorialKey}
          onClick={card.onClick}
        />
      ))}
    </PantallaCuadricula>
  );
}
