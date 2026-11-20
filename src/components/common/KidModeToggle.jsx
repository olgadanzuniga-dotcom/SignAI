import React from "react";
import { motion } from "framer-motion";
import { PartyPopper } from "lucide-react";
import useKidMode, { toggleKidMode } from "../../hooks/useKidMode";
import { tr } from "../../i18n";

export default function KidModeToggle({ className = "", tabIndex }) {
  const kidMode = useKidMode();

  return (
    <button
      type="button"
      onClick={toggleKidMode}
      aria-label={kidMode ? tr("Desactivar modo infantil") : tr("Activar modo infantil")}
      title={kidMode ? tr("Modo infantil activado") : tr("Modo infantil")}
      tabIndex={tabIndex}
      className={`relative inline-flex items-center justify-center w-10 h-10 rounded-xl
                  backdrop-blur-md border transition-all duration-300
                  hover:scale-105 active:scale-95 overflow-hidden
                  ${kidMode
                    ? "bg-gradient-to-br from-pink-400 via-orange-300 to-emerald-400 border-white/60 text-white shadow-md shadow-pink-500/30"
                    : "bg-white/80 dark:bg-white/5 border-gray-200/80 dark:border-white/10 text-gray-500 dark:text-gray-400 shadow-sm hover:shadow-md"
                  } ${className}`}
    >
      <motion.span
        animate={kidMode ? { rotate: [0, -10, 10, 0], scale: [1, 1.15, 1] } : { rotate: 0, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="relative flex items-center justify-center"
      >
        <PartyPopper size={18} strokeWidth={2.2} />
      </motion.span>
    </button>
  );
}
