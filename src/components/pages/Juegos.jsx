import React from "react";
import { useNavigate } from "react-router-dom";
import Tutorial from "../common/Tutorial";
import CategoriaCard from "../common/CategoriaCard";
import PantallaCuadricula from "../common/PantallaCuadricula";
import useCerrarSidebar from "../../hooks/useCerrarSidebar";

import memoramaImg from "../../assets/memorama.svg";
import quizImg from "../../assets/quiz.svg";
import desafioImg from "../../assets/desafio.svg";
import imitaImg from "../../assets/imita.svg";

const JUEGOS_TUTORIAL_STEPS = [
  {
    key: "juego-memorama",
    title: "Memorama",
    text: "Encuentra las parejas entre la seña en LSM y el objeto correspondiente.",
    placement: "bottom",
  },
  {
    key: "juego-quiz",
    title: "Quiz visual",
    text: "Observa una seña y elige la palabra correcta entre cuatro opciones.",
    placement: "bottom",
  },
  {
    key: "juego-desafio",
    title: "Modo desafío",
    text: "Reto contrarreloj: realiza la seña indicada frente a la cámara antes que se acabe el tiempo.",
    placement: "top",
  },
  {
    key: "juego-deletreo",
    title: "Deletreo",
    text: "Arma palabras arrastrando las señas en el orden correcto.",
    placement: "top",
  },
];

export default function JuegosInteractivos({ sidebarOpen, setSidebarOpen }) {
  const navigate = useNavigate();

  // Cerramos el sidebar al entrar
  useCerrarSidebar(setSidebarOpen);

  const juegos = [
    { title: "Memorama", img: memoramaImg, path: "/Memorama", tutorialKey: "juego-memorama" },
    { title: "Quiz visual", img: quizImg, path: "/Quiz", tutorialKey: "juego-quiz" },
    { title: "Modo desafío", img: desafioImg, path: "/Desafio", tutorialKey: "juego-desafio" },
    { title: "Deletreo", img: imitaImg, path: "/Deletreo", tutorialKey: "juego-deletreo" },
  ];

  return (
    <PantallaCuadricula
      titulo="Juegos"
      subtitulo="Cuatro formas de practicar lo que ya sabes."
      columnas="grid-cols-1 sm:grid-cols-2"
      cuadriculaKey="juegos-cuadricula"
      tutorial={
        <Tutorial steps={JUEGOS_TUTORIAL_STEPS} storageKey="tourSignAI_juegos" />
      }
    >
      {juegos.map((game, i) => (
        <CategoriaCard
          key={game.path}
          titulo={game.title}
          img={game.img}
          tono={[1, 4, 6, 9][i] ?? 1}
          variante="tarjeta"
          tutorialKey={game.tutorialKey}
          onClick={() => navigate(game.path)}
        />
      ))}
    </PantallaCuadricula>
  );
}
