import React from "react";
import { useIdioma } from "../../i18n";

// Botón ES/EN junto a los de tema y modo infantil.
export default function IdiomaToggle({ className = "", tabIndex }) {
  const { idioma, setIdioma, t } = useIdioma();
  const otro = idioma === "en" ? "es" : "en";

  return (
    <button
      type="button"
      onClick={() => setIdioma(otro)}
      aria-label={t("Cambiar idioma")}
      title={idioma === "en" ? "Cambiar a español" : "Switch to English"}
      tabIndex={tabIndex}
      className={`relative inline-flex items-center justify-center h-10 min-w-10 px-2 rounded-xl
                  backdrop-blur-md border transition-all duration-300 hover:scale-105 active:scale-95
                  bg-white/80 dark:bg-white/5 border-gray-200/80 dark:border-white/10
                  text-gray-600 dark:text-gray-300 shadow-sm hover:shadow-md
                  text-xs font-bold tracking-wider ${className}`}
    >
      {idioma === "en" ? "EN" : "ES"}
    </button>
  );
}
