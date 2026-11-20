import React from "react";
import { useNavigate } from "react-router-dom";
import Tutorial from "../common/Tutorial";
import TarjetaJuego from "../common/TarjetaJuego";
import { useProgreso } from "../../utils/progreso";
import PantallaCuadricula from "../common/PantallaCuadricula";
import useCerrarSidebar from "../../hooks/useCerrarSidebar";

import memoramaImg from "../../assets/memorama.svg";
import quizImg from "../../assets/quiz.svg";
import desafioImg from "../../assets/desafio.svg";
import imitaImg from "../../assets/imita.svg";
import siNoImg from "../../assets/juegos.svg";
import letraFaltaImg from "../../assets/Juegoabc.svg";

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
  {
    key: "juego-sino",
    title: "¿Sí o no?",
    text: "Aparece una seña y una palabra: di si significan lo mismo.",
    placement: "top",
  },
  {
    key: "juego-letrafalta",
    title: "Letra que falta",
    text: "A la palabra le falta una letra: elige su seña.",
    placement: "top",
  },
];

export default function JuegosInteractivos({ sidebarOpen, setSidebarOpen }) {
  const navigate = useNavigate();
  const progreso = useProgreso();

  // Cerramos el sidebar al entrar
  useCerrarSidebar(setSidebarOpen);

  const juegos = [
    { title: "Memorama", desc: "Encuentra las parejas", img: memoramaImg, path: "/Memorama", tutorialKey: "juego-memorama", tono: 1 },
    { title: "Quiz visual", desc: "¿Qué palabra es esta seña?", img: quizImg, path: "/Quiz", tutorialKey: "juego-quiz", tono: 3 },
    { title: "Modo desafío", desc: "Haz la seña con la cámara", img: desafioImg, path: "/Desafio", tutorialKey: "juego-desafio", tono: 5 },
    { title: "Deletreo", desc: "Ordena las letras", img: imitaImg, path: "/Deletreo", tutorialKey: "juego-deletreo", tono: 9 },
    { title: "¿Sí o no?", desc: "¿La seña y la palabra coinciden?", img: siNoImg, path: "/SiNo", tutorialKey: "juego-sino", tono: 6 },
    { title: "Letra que falta", desc: "Completa la palabra", img: letraFaltaImg, path: "/LetraFalta", tutorialKey: "juego-letrafalta", tono: 2 },
  ];

  return (
    <PantallaCuadricula
      titulo="Juegos"
      subtitulo="Seis formas de practicar lo que ya sabes."
      columnas="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
      cuadriculaKey="juegos-cuadricula"
      tutorial={
        <Tutorial steps={JUEGOS_TUTORIAL_STEPS} storageKey="tourSignAI_juegos" />
      }
    >
      {juegos.map((game, i) => (
        <TarjetaJuego
          key={game.path}
          indice={i}
          titulo={game.title}
          descripcion={game.desc}
          img={game.img}
          tono={game.tono}
          tutorialKey={game.tutorialKey}
          record={progreso.juegos[game.path.slice(1).toLowerCase()]?.mejor ?? null}
          onClick={() => navigate(game.path)}
        />
      ))}
    </PantallaCuadricula>
  );
}
