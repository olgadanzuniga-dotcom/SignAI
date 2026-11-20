import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sun, Moon } from "lucide-react";
import { useThemeContext } from "../../context/ThemeContext";
import { tr } from "../../i18n";

export default function ThemeToggle({ className = "", tabIndex }) {
  const { isDark, setTheme } = useThemeContext();

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? tr("Cambiar a modo claro") : tr("Cambiar a modo oscuro")}
      title={isDark ? tr("Modo claro") : tr("Modo oscuro")}
      tabIndex={tabIndex}
      className={`relative inline-flex items-center justify-center w-10 h-10 rounded-xl
                  bg-white/80 dark:bg-white/5 backdrop-blur-md
                  border border-gray-200/80 dark:border-white/10
                  shadow-sm hover:shadow-md
                  text-amber-500 dark:text-indigo-300
                  hover:scale-105 active:scale-95
                  transition-all duration-300 overflow-hidden ${className}`}
    >
      <span className="absolute inset-0 bg-gradient-to-br from-indigo-400/0 to-fuchsia-400/0 dark:from-indigo-500/20 dark:to-fuchsia-500/10 pointer-events-none" />
      <AnimatePresence mode="wait" initial={false}>
        {isDark ? (
          <motion.span
            key="moon"
            initial={{ rotate: -90, opacity: 0, scale: 0.5 }}
            animate={{ rotate: 0, opacity: 1, scale: 1 }}
            exit={{ rotate: 90, opacity: 0, scale: 0.5 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="relative flex items-center justify-center"
          >
            <Moon size={18} strokeWidth={2.2} />
          </motion.span>
        ) : (
          <motion.span
            key="sun"
            initial={{ rotate: 90, opacity: 0, scale: 0.5 }}
            animate={{ rotate: 0, opacity: 1, scale: 1 }}
            exit={{ rotate: -90, opacity: 0, scale: 0.5 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="relative flex items-center justify-center"
          >
            <Sun size={18} strokeWidth={2.2} />
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}
