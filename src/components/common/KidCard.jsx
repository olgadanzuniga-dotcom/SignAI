import React from "react";
import { motion } from "framer-motion";
import { Star } from "lucide-react";
import { useIdioma } from "../../i18n";

// Tarjeta grande y colorida para el apartado infantil: más juguetona que
// NavCard (rotación al pasar el mouse, gradiente de color propio, ícono
// grande) pero mantiene la misma mecánica de navegación por tarjetas.
export default function KidCard({
  title,
  subtitle,
  icon: Icon,
  img,
  gradient = "from-indigo-400 to-indigo-600",
  onClick,
  tutorialKey,
  className = "",
}) {
  const { t } = useIdioma();
  return (
    <div className="relative w-full">
      <span
        className={`absolute left-1/2 -translate-x-1/2 bottom-0 w-[85%] h-6 rounded-full bg-gradient-to-r ${gradient} opacity-30 blur-lg pointer-events-none`}
        aria-hidden="true"
      />
      <motion.button
        type="button"
        data-tutorial={tutorialKey}
        onClick={onClick}
        whileHover={{ scale: 1.06, rotate: -1, y: -4 }}
        whileTap={{ scale: 0.95, rotate: 0, y: 0 }}
        className={`group relative flex flex-col items-center justify-center text-center overflow-hidden
                    rounded-[2rem] p-5 sm:p-6 lg:p-7 2xl:p-9
                    w-full aspect-square
                    bg-gradient-to-br ${gradient}
                    shadow-lg shadow-black/15 hover:shadow-2xl
                    border-4 border-white/60 dark:border-white/10
                    ring-2 ring-white/30
                    transition-shadow duration-300 ${className}`}
      >
      <span className="absolute -top-10 -left-10 w-28 h-28 rounded-full bg-white/15 blur-xl pointer-events-none" />
      <span className="absolute -bottom-12 -right-8 w-32 h-32 rounded-full bg-black/10 blur-2xl pointer-events-none" />
      <span
        className="absolute -top-1/2 -left-1/3 w-2/3 h-[200%] bg-white/10 rotate-[25deg] pointer-events-none"
        aria-hidden="true"
      />

      <span
        className="absolute -top-3 -right-3 w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/90 dark:bg-white/80
                   flex items-center justify-center shadow-md
                   transition-transform duration-300 group-hover:scale-125 group-hover:rotate-12"
        aria-hidden="true"
      >
        <Star className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-amber-400 fill-amber-400" strokeWidth={1.5} />
      </span>

      <div
        className="relative w-24 h-24 sm:w-28 sm:h-28 lg:w-32 lg:h-32 2xl:w-40 2xl:h-40 mb-2 sm:mb-3 lg:mb-4
                   flex items-center justify-center rounded-full bg-white/25 shadow-inner
                   transition-transform duration-300 group-hover:-translate-y-1 group-hover:scale-105"
      >
        {img ? (
          <img src={img} alt="" className="w-16 h-16 sm:w-20 sm:h-20 lg:w-24 lg:h-24 2xl:w-32 2xl:h-32 object-contain drop-shadow-lg" />
        ) : Icon ? (
          <Icon className="w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 2xl:w-20 2xl:h-20 text-white" strokeWidth={2.2} />
        ) : null}
      </div>

      <h3 className="font-comic text-base sm:text-lg lg:text-xl 2xl:text-2xl font-bold text-white drop-shadow-sm">
        {t(title)}
      </h3>
      {subtitle && (
        <p className="font-comic mt-1 text-xs sm:text-sm 2xl:text-base font-medium text-white/85">
          {t(subtitle)}
        </p>
      )}
      </motion.button>
    </div>
  );
}
