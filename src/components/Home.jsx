import React from "react";
import manos from "../assets/hands.jpeg";
import manosKid from "../assets/kid/manos-kid.png";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Play, BookOpen, Lightbulb, Hand, Target, Camera, Zap, Volume2 } from "lucide-react";
import Tutorial from "./common/Tutorial";
import PageLayout from "./common/PageLayout";
import ResponsiveContainer from "./common/ResponsiveContainer";
import useKidMode from "../hooks/useKidMode";
import { usePerfil } from "../utils/perfil";
import { FirmaAnimada } from "./common/Firma";
import TarjetaProgreso from "./common/TarjetaProgreso";
import NombreEnSenas from "./common/NombreEnSenas";
import { useIdioma } from "../i18n";

// BASE_URL lleva el prefijo con que se compiló ("/" en desarrollo, "./" en la
// app empaquetada). Una ruta absoluta a secas ("/kid/...") funciona en el
// servidor de Vite pero se rompe bajo file:// en la app instalada, donde "/"
// apunta a la raíz del disco y no a la carpeta de la app (ver VisorMano.jsx,
// que resuelve lo mismo para Mano.glb).
const RUTA_VIDEO_HOLA = `${import.meta.env.BASE_URL}kid/hola-video.mp4`;

const HOME_TUTORIAL_STEPS = [
  {
    key: "iniciar",
    title: "Iniciar traducción",
    text: "Para iniciar la traducción presiona este botón, recuerda hacer las señas correctamente.",
    placement: "top",
    padding: 10,
    radius: 16,
  },
  {
    key: "traductor",
    title: "Traductor",
    text: "En este apartado puedes regresar a la pantalla principal e iniciar la traducción de señas en cualquier momento.",
    placement: "right",
  },
  {
    key: "ajustes",
    title: "Ajustes",
    text: "En este apartado puedes escoger diferentes voces, color de fondo, cámara y velocidad de voz.",
    placement: "right",
  },
  {
    key: "aprendizaje",
    title: "Aprendizaje",
    text: "En este apartado puedes acceder a lecciones y juegos interactivos para aprender Lengua de Señas Mexicana.",
    placement: "right",
  },
  {
    key: "acerca",
    title: "Acerca de nosotros",
    text: "En este apartado puedes conocer al equipo detrás de SignAI y la finalidad del proyecto.",
    placement: "right",
  },
];

// `tono` es una posición de la rampa de categorías (ver --cat-N en
// styles/tokens.css). Antes cada consejo llevaba su propio degradado
// (ámbar-naranja, esmeralda-teal…) elegido al margen del resto de la app.
const TIPS = [
  {
    icon: Lightbulb,
    title: "Buena iluminación",
    text: "Ubícate en un lugar bien iluminado con fondo claro.",
    tono: 8,
  },
  {
    icon: Hand,
    title: "Manos enfocadas",
    text: "Mantén tus manos visibles y centradas en la cámara.",
    tono: 9,
  },
  {
    icon: Target,
    title: "Señas claras",
    text: "Realiza las señas con precisión y evita movimientos bruscos.",
    tono: 1,
  },
];

const STEPS = [
  { icon: Camera, label: "Activa la cámara", color: "from-sky-400 to-blue-500" },
  { icon: Hand, label: "Haz la seña", color: "from-fuchsia-400 to-pink-500" },
  { icon: Volume2, label: "Escucha la traducción", color: "from-emerald-400 to-teal-500" },
];

const waitForTransition = (element, propertyName, fallback = 800) =>
  new Promise((resolve) => {
    if (!element) return resolve();
    const handler = (e) => {
      if (e.target !== element || e.propertyName !== propertyName) return;
      cleanup();
    };
    const cleanup = () => {
      element.removeEventListener("transitionend", handler);
      clearTimeout(timeoutId);
      resolve();
    };
    const timeoutId = setTimeout(cleanup, fallback);
    element.addEventListener("transitionend", handler);
  });

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay: i * 0.1, ease: "easeOut" },
  }),
};

export default function Home({ sidebarOpen, setSidebarOpen, onTutorialChange }) {
  const navigate = useNavigate();
  const kidMode = useKidMode();
  const perfil = usePerfil();
  const { t } = useIdioma();
  // La firma a mano es para Kids; en adulto se saluda con el nombre en letra
  // normal (la firma solo si no escribió el nombre).
  const conFirma = perfil?.trazos?.length > 0 && (kidMode || !perfil?.nombre);

  const prepareStep = async (from, to) => {
    if (from === 0 && to === 1 && !sidebarOpen) {
      setSidebarOpen?.(true);
      const sidebarEl = document.querySelector("aside");
      await waitForTransition(sidebarEl, "transform");
    }
  };

  // Reutilizada en modo infantil (baja a la columna del video) y en modo
  // normal (se queda junto a "Cómo funciona"): mismo contenido, dos sitios.
  const recomendacionesCard = (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="relative min-w-0 bg-superficie rounded-2xl 2xl:rounded-3xl border border-borde shadow-lg p-[clamp(0.75rem,2.4vh,2.25rem)] overflow-hidden"
    >
      <div className="relative flex items-center gap-2 2xl:gap-3 mb-[clamp(0.5rem,2vh,1.75rem)]">
        <div className="w-8 h-8 2xl:w-11 2xl:h-11 rounded-lg bg-acento-suave flex items-center justify-center">
          <Lightbulb className="w-4 h-4 2xl:w-5 2xl:h-5 text-acento" />
        </div>
        <h2 className={`text-base 2xl:text-xl font-bold text-texto ${kidMode ? "font-comic" : ""}`}>
          {t("Recomendaciones")}
        </h2>
      </div>

      <div className="relative flex flex-col gap-[clamp(0.4rem,1.4vh,1.5rem)]">
        {TIPS.map((tip, i) => {
          const Icon = tip.icon;
          return (
            <div key={tip.title} className="flex items-start gap-3 2xl:gap-4">
              <div
                className="w-[clamp(1.75rem,3.4vh,3rem)] h-[clamp(1.75rem,3.4vh,3rem)] flex-shrink-0 rounded-lg bg-[rgb(var(--tono))]/[0.14] flex items-center justify-center"
                style={{ "--tono": `var(--cat-${tip.tono})` }}
              >
                <Icon className="w-1/2 h-1/2 text-[rgb(var(--tono))]" />
              </div>
              <div>
                <h3 className={`text-sm 2xl:text-base font-semibold text-texto mb-0.5 2xl:mb-1 ${kidMode ? "font-comic" : ""}`}>
                  {t(tip.title)}
                </h3>
                <p className={`text-xs sm:text-sm 2xl:text-base text-sutil leading-relaxed ${kidMode ? "font-comic" : ""}`}>
                  {t(tip.text)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );

  return (
    // Sin alto mínimo ni `overflow-hidden`: forzaba la portada a medir siempre
    // 100vh menos 6rem — daba igual la ventana — y lo que no cabía quedaba
    // recortado en vez de poder desplazarse. Ahora ocupa lo que necesita y el
    // <main> se encarga del resto.
    <PageLayout>
      <ResponsiveContainer size="xl" className="relative py-[clamp(0.25rem,1.6vh,5rem)]">
        <div className="grid md:grid-cols-2 gap-[clamp(0.75rem,3vh,3rem)] md:gap-[clamp(1.5rem,3vw,5rem)] items-center mb-[clamp(0.6rem,3.4vh,6rem)]">
          <motion.div
            className="relative order-2 md:order-1 min-w-0 flex flex-col gap-[clamp(0.6rem,2vh,1.5rem)]"
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={1}
          >
            {kidMode ? (
              <>
                <video
                  src={RUTA_VIDEO_HOLA}
                  autoPlay
                  loop
                  muted
                  playsInline
                  style={{ maxHeight: "clamp(9rem, 36vh, 35rem)" }}
                  className="w-full h-auto rounded-3xl shadow-2xl border border-borde object-cover"
                />
                {recomendacionesCard}
              </>
            ) : (
              <motion.div
                animate={{ y: [0, -12, 0] }}
                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                className="relative"
              >
                {/* El alto de la foto manda en el de toda la portada. Iba
                    clavado a 420px, así que en una ventana de 640 se comía dos
                    tercios de la pantalla y empujaba fuera la tarjeta de
                    Recomendaciones. En `vh` crece en un monitor grande y se
                    aparta en uno pequeño. */}
                <img
                  src={manos}
                  alt={t("Manos LSM")}
                  style={{ maxHeight: "clamp(9rem, 36vh, 35rem)" }}
                  className="w-full h-auto object-cover rounded-3xl shadow-2xl border border-borde"
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.8, type: "spring" }}
                  className="absolute top-4 right-4 flex items-center gap-2 bg-superficie/90 backdrop-blur-md px-3 py-1.5 rounded-full shadow-lg border border-borde"
                >
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-exito opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-exito" />
                  </span>
                  <span className="text-xs font-semibold text-texto">
                    {t("IA en tiempo real")}
                  </span>
                </motion.div>
              </motion.div>
            )}
          </motion.div>

          <div className="order-1 md:order-2 min-w-0 text-center md:text-left">
            {(conFirma || perfil?.nombre) && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="flex items-end justify-center md:justify-start gap-3 mb-[clamp(0.4rem,1.6vh,1.25rem)]"
              >
                <span className={`text-xl sm:text-2xl font-semibold text-sutil ${kidMode ? "font-comic" : ""}`}>
                  {t("Hola,")}
                  {!conFirma && <span className="text-texto font-bold"> {perfil.nombre}</span>}
                </span>
                {conFirma && (
                  <FirmaAnimada
                    trazos={perfil.trazos}
                    tintaId={perfil.tinta}
                    retraso={0.3}
                    duracion={1.6}
                    style={{ height: "clamp(2.5rem, 7vh, 4.5rem)", maxWidth: "70%" }}
                  />
                )}
                <motion.span
                  className="text-2xl sm:text-3xl"
                  animate={{ rotate: [0, 18, -8, 18, 0] }}
                  transition={{ duration: 1.2, delay: 2, repeat: 2 }}
                  style={{ transformOrigin: "70% 80%", display: "inline-block" }}
                >
                  👋
                </motion.span>
              </motion.div>
            )}
            {/* Tu nombre deletreado en LSM, siempre a la vista (pedido de la
                usuaria: en la bienvenida solo salía si se escribía el nombre). */}
            {perfil?.nombre && (
              <div className="mb-[clamp(0.5rem,1.8vh,1.25rem)]">
                <p className={`text-xs font-semibold uppercase tracking-wider text-sutil mb-1.5 ${kidMode ? "font-comic" : ""}`}>
                  {t("Tu nombre en señas")}
                </p>
                <NombreEnSenas nombre={perfil.nombre} tamano="chico" fuente={kidMode ? "font-comic" : ""} />
              </div>
            )}
            <motion.div
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              custom={0}
              className={`inline-flex items-center gap-2 px-3 py-1 mb-[clamp(0.3rem,1.4vh,1rem)] rounded-full border ${
                kidMode
                  ? "bg-gradient-to-r from-pink-100 to-orange-100 dark:from-pink-500/10 dark:to-orange-500/10 border-pink-200 dark:border-pink-500/20"
                  : "bg-acento-suave border-acento/25"
              }`}
            >
              <Zap className={`w-3.5 h-3.5 ${kidMode ? "text-pink-600 dark:text-pink-300" : "text-acento"}`} />
              <span className={`text-xs font-semibold ${kidMode ? "font-comic text-pink-600 dark:text-pink-300" : "text-acento"}`}>
                {kidMode ? t("SignAI Kids · a jugar con señas") : t("SignAI · Lengua de Señas Mexicana")}
              </span>
            </motion.div>

            <motion.h1
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              custom={1}
              className={`text-balance font-extrabold tracking-tight text-texto mb-[clamp(0.35rem,1.6vh,1.5rem)] ${kidMode ? "font-comic" : ""}`}
              style={{ fontSize: "clamp(2.25rem, 4.4vw, 4.5rem)", lineHeight: 1.08 }}
            >
              {kidMode ? (
                <>
                  {t("Aprende señas")}{" "}
                  <span className="heading-gradient">{t("jugando")}</span>
                </>
              ) : (
                <>
                  {t("Traduce señas")}{" "}
                  {/* El degradado es el de la marca (--degradado-marca): los mismos
                      tonos con que se ordenan las categorías. */}
                  <span
                    className="bg-clip-text text-transparent"
                    style={{ backgroundImage: "var(--degradado-marca)" }}
                  >
                    {t("en tiempo real")}
                  </span>
                </>
              )}
            </motion.h1>

            <motion.p
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              custom={2}
              className={`text-pretty text-base sm:text-lg 2xl:text-xl text-sutil mb-[clamp(0.6rem,2.6vh,2.5rem)] max-w-xl 2xl:max-w-2xl mx-auto md:mx-0 leading-relaxed ${kidMode ? "font-comic" : ""}`}
            >
              {kidMode
                ? t("Muestra tus manitas a la cámara y descubre cómo se dicen las cosas en Lengua de Señas Mexicana. ¡Es muy divertido!")
                : t("Conecta con la comunidad sorda a través de la inteligencia artificial. Convierte la Lengua de Señas Mexicana en voz, al instante.")}
            </motion.p>

            <motion.div
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              custom={3}
              className="flex flex-col sm:flex-row flex-wrap gap-3 justify-center md:justify-start"
            >
              <button
                data-tutorial="iniciar"
                onClick={() => navigate("/Camara")}
                className={
                  kidMode
                    ? "btn-primary group font-comic rounded-full px-8 2xl:px-10 py-3.5 2xl:py-4.5 text-base 2xl:text-lg bg-gradient-to-r from-pink-500 to-orange-400 hover:from-pink-400 hover:to-orange-300 text-white"
                    : "group inline-flex items-center justify-center gap-2 2xl:gap-3 whitespace-nowrap bg-acento hover:bg-acento-fuerte text-acento-texto px-8 2xl:px-10 py-3.5 2xl:py-4.5 rounded-xl font-semibold text-base 2xl:text-lg shadow-lg hover:scale-[1.02] active:scale-95 transition-all duration-300"
                }
              >
                <Play className="w-5 h-5 2xl:w-6 2xl:h-6" fill="currentColor" />
                <span>{kidMode ? t("¡Jugar y traducir!") : t("Iniciar Traducción")}</span>
              </button>

              <button
                onClick={() => navigate("/Aprendizaje")}
                className={
                  kidMode
                    ? "btn-secondary font-comic rounded-full px-8 2xl:px-10 py-3.5 2xl:py-4.5 text-base 2xl:text-lg"
                    : "inline-flex items-center justify-center gap-2 2xl:gap-3 whitespace-nowrap bg-superficie hover:bg-superficie-2 text-texto px-8 2xl:px-10 py-3.5 2xl:py-4.5 rounded-xl font-semibold text-base 2xl:text-lg border border-borde hover:scale-[1.02] active:scale-95 transition-all duration-300"
                }
              >
                <BookOpen className="w-5 h-5 2xl:w-6 2xl:h-6" />
                {kidMode ? t("Ver lecciones") : t("Aprender LSM")}
              </button>
            </motion.div>

            <TarjetaProgreso className="mt-[clamp(0.6rem,2vh,1.5rem)] max-w-xl mx-auto md:mx-0" />

            {kidMode && (
              <motion.div
                initial="hidden"
                animate="visible"
                variants={fadeUp}
                custom={4}
                className="relative mt-[clamp(0.6rem,2vh,1.5rem)]"
              >
                <img
                  src={manosKid}
                  alt={t("Manos LSM")}
                  style={{ maxHeight: "clamp(9rem, 30vh, 28rem)" }}
                  className="w-full h-auto object-cover rounded-3xl shadow-2xl border border-borde"
                />
                <div className="absolute top-4 right-4 flex items-center gap-2 bg-superficie/90 backdrop-blur-md px-3 py-1.5 rounded-full shadow-lg border border-borde">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-exito opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-exito" />
                  </span>
                  <span className="text-xs font-semibold text-texto">
                    {t("IA en tiempo real")}
                  </span>
                </div>
              </motion.div>
            )}
          </div>
        </div>

        <div className={`grid ${kidMode ? "md:grid-cols-1" : "md:grid-cols-2"} gap-[clamp(0.75rem,3vh,3rem)] md:gap-[clamp(1.5rem,3vw,5rem)] items-start`}>
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            variants={fadeUp}
            className={`min-w-0 text-center ${kidMode ? "" : "md:pl-4 md:text-left"}`}
          >
            <h2 className={`text-sm 2xl:text-base font-bold tracking-wider uppercase text-sutil mb-[clamp(0.5rem,2vh,2rem)] ${kidMode ? "font-comic" : ""}`}>
              {t("Cómo funciona")}
            </h2>
            <div className={kidMode ? "flex flex-col sm:flex-row justify-center gap-6 sm:gap-8 2xl:gap-12" : "flex flex-col gap-[clamp(0.6rem,2vh,1.75rem)]"}>
              {STEPS.map((step, i) => {
                const Icon = step.icon;
                return (
                  <motion.div
                    key={step.label}
                    variants={fadeUp}
                    custom={i}
                    className={kidMode ? "flex flex-col items-center gap-3 text-center max-w-[160px] mx-auto" : "flex items-center gap-4 2xl:gap-6"}
                  >
                    <div
                      style={{ width: "clamp(2.5rem, 5.5vh, 5rem)", height: "clamp(2.5rem, 5.5vh, 5rem)" }}
                      className={`relative flex-shrink-0 flex items-center justify-center rounded-2xl shadow-md ${
                        kidMode ? `bg-gradient-to-br ${step.color}` : "bg-superficie border border-borde"
                      }`}
                    >
                      <Icon className={`w-[45%] h-[45%] ${kidMode ? "text-white" : "text-acento"}`} />
                      <span className={`absolute -top-2 -right-2 w-6 h-6 2xl:w-8 2xl:h-8 rounded-full text-xs 2xl:text-sm font-bold flex items-center justify-center shadow ${
                        kidMode ? "bg-superficie text-texto border border-borde" : "bg-acento text-acento-texto"
                      }`}>
                        {i + 1}
                      </span>
                    </div>
                    <span className={`text-base 2xl:text-xl font-medium text-sutil ${kidMode ? "font-comic" : ""}`}>
                      {t(step.label)}
                    </span>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>

          {!kidMode && recomendacionesCard}
        </div>
      </ResponsiveContainer>

      {/* El recorrido guiado empieza cuando termina la bienvenida. */}
      {perfil && (
        <Tutorial
          steps={HOME_TUTORIAL_STEPS}
          storageKey="tourSignAICompleted"
          prepareStep={prepareStep}
          onStart={() => onTutorialChange?.(true)}
          onFinish={() => onTutorialChange?.(false)}
        />
      )}
    </PageLayout>
  );
}
