import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Hand, BookOpen, Sparkles, Star } from "lucide-react";
import PageHeader from "../common/PageHeader";
import PageLayout from "../common/PageLayout";
import ResponsiveContainer from "../common/ResponsiveContainer";
import KidCard from "../common/KidCard";
import Tutorial from "../common/Tutorial";
import useKidMode, { applyKidMode } from "../../hooks/useKidMode";

import memoramaImg from "../../assets/kid/icon-memorama.png";
import quizImg from "../../assets/kid/icon-quiz.png";
import desafioImg from "../../assets/desafio.svg";
import letraAImg from "../../assets/kid/icon-abecedario.png";
import { tr } from "../../i18n";

const DECOR = [
  { Icon: Sparkles, color: "text-amber-400", left: "8%", top: "-0.5rem", duration: 4 },
  { Icon: Star, color: "text-pink-400", left: "24%", top: "2.5rem", duration: 5 },
  { Icon: Sparkles, color: "text-sky-400", left: "70%", top: "-0.5rem", duration: 4.5 },
  { Icon: Star, color: "text-emerald-400", left: "88%", top: "2.5rem", duration: 5.5 },
];

const INFANTIL_TUTORIAL_STEPS = [
  {
    key: "infantil-intro",
    title: "¡Zona Infantil!",
    text: "Aquí reunimos las lecciones y juegos más divertidos de SignAI para aprender Lengua de Señas jugando.",
    placement: "bottom",
  },
  {
    key: "infantil-card-aprender",
    title: "Aprender señas",
    text: "Empieza por aquí para conocer el abecedario, números, colores y más, con lecciones paso a paso.",
    placement: "bottom",
  },
];

export default function Infantil({ sidebarOpen, setSidebarOpen }) {
  const navigate = useNavigate();
  const kidMode = useKidMode();

  // Cerramos el sidebar al entrar, igual que en Juegos.
  useEffect(() => {
    if (typeof setSidebarOpen === "function") {
      setSidebarOpen(false);
    }
  }, [setSidebarOpen]);

  // RepasoABC solo vive en modo infantil (ver su guardia de navegación); sin
  // esto, entrar aquí con el modo apagado y tocar esa tarjeta rebotaba de
  // vuelta a Juegos sin explicación.
  useEffect(() => {
    applyKidMode(true);
  }, []);

  // Esta pantalla es 100% infantil, sin versión "normal": si apagan el modo
  // infantil estando aquí (el botón de la fiesta en la cabecera), no hay
  // nada que mostrar en su lugar. Antes se quedaba en la Zona Infantil de
  // todos modos, así que apagar el modo infantil aquí no parecía hacer nada.
  useEffect(() => {
    if (!kidMode) navigate("/", { replace: true });
  }, [kidMode, navigate]);

  if (!kidMode) return null;

  const goTo = (path) => {
    if (sidebarOpen && window.closeSidebar) window.closeSidebar();
    navigate(path);
  };

  const actividades = [
    {
      title: "Traductor",
      subtitle: "Muestra tus señas",
      icon: Hand,
      gradient: "from-sky-400 to-blue-500",
      path: "/Camara",
    },
    {
      title: "Aprender",
      subtitle: "Letras, números y más",
      icon: BookOpen,
      gradient: "from-emerald-400 to-teal-500",
      path: "/Aprender",
      tutorialKey: "infantil-card-aprender",
    },
    {
      title: "Memorama",
      subtitle: "Encuentra las parejas",
      img: memoramaImg,
      gradient: "from-fuchsia-400 to-purple-500",
      path: "/Memorama",
    },
    {
      title: "Quiz visual",
      subtitle: "Adivina la seña",
      img: quizImg,
      gradient: "from-amber-400 to-orange-500",
      path: "/Quiz",
    },
    {
      title: "Desafío",
      subtitle: "Reto contrarreloj",
      img: desafioImg,
      gradient: "from-rose-400 to-pink-500",
      path: "/Desafio",
    },
    {
      title: "Repaso ABC",
      subtitle: "Adivina la letra",
      img: letraAImg,
      gradient: "from-lime-400 to-green-500",
      path: "/RepasoABC",
    },
    {
      title: "Repaso de letras",
      subtitle: "Practica el abecedario",
      img: letraAImg,
      gradient: "from-sky-400 to-indigo-500",
      path: "/RepasoLetras",
    },
  ];

  return (
    <PageLayout contentClassName="items-center justify-start text-center text-gray-900 dark:text-gray-100 transition-colors duration-700 ease-in-out pt-10 pb-16">
      <PageHeader title="SignAI Kids" />

      <ResponsiveContainer size="xl">
        <motion.div
          data-tutorial="infantil-intro"
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative mt-6 sm:mt-8 mb-10 sm:mb-14"
        >
          {DECOR.map(({ Icon, color, left, top, duration }, i) => (
            <motion.span
              key={i}
              aria-hidden="true"
              className={`hidden sm:inline-block absolute select-none pointer-events-none ${color}`}
              style={{ left, top }}
              animate={{ y: [0, -10, 0], rotate: [0, 10, 0] }}
              transition={{ duration, repeat: Infinity, ease: "easeInOut", delay: i * 0.3 }}
            >
              <Icon className="w-7 h-7 2xl:w-9 2xl:h-9" fill="currentColor" strokeWidth={1} />
            </motion.span>
          ))}
          <h1 className="font-comic text-3xl sm:text-4xl lg:text-5xl 2xl:text-6xl font-bold tracking-tight mb-3">
            <span className="bg-gradient-to-r from-pink-500 via-orange-400 to-emerald-500 bg-clip-text text-transparent">{tr("¡Zona Infantil!")}</span>
          </h1>
          <p className="font-comic text-base sm:text-lg 2xl:text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">{tr("Aprende Lengua de Señas Mexicana jugando: elige una actividad y comienza la diversión.")}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="grid grid-cols-2 sm:grid-cols-3 gap-5 sm:gap-6 lg:gap-8 2xl:gap-10 max-w-4xl 2xl:max-w-5xl mx-auto"
        >
          {actividades.map((act) => (
            <KidCard
              key={act.title}
              title={act.title}
              subtitle={act.subtitle}
              icon={act.icon}
              img={act.img}
              gradient={act.gradient}
              tutorialKey={act.tutorialKey}
              onClick={() => goTo(act.path)}
            />
          ))}
        </motion.div>
      </ResponsiveContainer>

      <Tutorial steps={INFANTIL_TUTORIAL_STEPS} storageKey="tourSignAI_infantil" />
    </PageLayout>
  );
}
