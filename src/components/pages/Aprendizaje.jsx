import React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Gamepad2 } from "lucide-react";
import Tutorial from "../common/Tutorial";
import CategoriaCard from "../common/CategoriaCard";
import PantallaCuadricula from "../common/PantallaCuadricula";
import PageLayout from "../common/PageLayout";
import PageHeader from "../common/PageHeader";
import ResponsiveContainer from "../common/ResponsiveContainer";
import KidCard from "../common/KidCard";
import useKidMode from "../../hooks/useKidMode";
import abcImg from "../../assets/abc.svg";
import juegosImg from "../../assets/juegos.svg";
import abecedarioKidImg from "../../assets/kid/icon-abecedario.png";
import mascotaImg from "../../assets/mascota-signai.png";
import { tr } from "../../i18n";

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
  const kidMode = useKidMode();

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

  if (kidMode) {
    const tarjetasKid = [
      {
        title: "Aprender",
        subtitle: "Letras, números y más",
        img: abecedarioKidImg,
        gradient: "from-pink-400 to-rose-500",
        tutorialKey: "card-aprender",
        onClick: () => irA("/Aprender"),
      },
      {
        title: "Juegos",
        subtitle: "Aprende jugando",
        icon: Gamepad2,
        gradient: "from-orange-400 to-red-500",
        tutorialKey: "card-juegos",
        onClick: () => irA("/Juegos"),
      },
      {
        title: "Actividades",
        subtitle: "Zona infantil y repasos",
        img: mascotaImg,
        gradient: "from-sky-400 to-blue-500",
        onClick: () => irA("/Infantil"),
      },
    ];

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
              <span className="heading-gradient">{tr("¡Elige tu aventura!")}</span>
            </h1>
            <p className="font-comic text-base sm:text-lg text-gray-600 dark:text-gray-300 max-w-xl mx-auto">{tr("Aprende, juega y practica la Lengua de Señas Mexicana.")}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="grid grid-cols-2 sm:grid-cols-3 gap-5 sm:gap-6 lg:gap-8 max-w-3xl mx-auto"
          >
            {tarjetasKid.map((t) => (
              <KidCard
                key={t.title}
                title={t.title}
                subtitle={t.subtitle}
                icon={t.icon}
                img={t.img}
                gradient={t.gradient}
                tutorialKey={t.tutorialKey}
                onClick={t.onClick}
              />
            ))}
          </motion.div>
        </ResponsiveContainer>

        <Tutorial
          steps={APRENDIZAJE_TUTORIAL_STEPS}
          storageKey="tourSignAI_aprendizaje"
        />
      </PageLayout>
    );
  }

  return (
    <PantallaCuadricula
      titulo="Aprendizaje"
      subtitulo="Practica con lecciones o pon a prueba lo aprendido."
      columnas="grid-cols-1 sm:grid-cols-2"
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
