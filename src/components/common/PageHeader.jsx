import React from "react";
import { useNavigate } from "react-router-dom";
import { Undo2 } from "lucide-react";
import useScrolled from "../../hooks/useScrolled";
import ThemeToggle from "./ThemeToggle";
import KidModeToggle from "./KidModeToggle";
import IdiomaToggle from "./IdiomaToggle";
import { useIdioma, tr } from "../../i18n";

export default function PageHeader({ showBack = true, onBack, title = "SignAI" }) {
  const { t } = useIdioma();
  const navigate = useNavigate();
  const handleBack = onBack || (() => navigate(-1));
  const scrolled = useScrolled(80);

  return (
    <>
      {showBack && (
        <button
          onClick={handleBack}
          className="absolute top-3 left-3 sm:top-4 sm:left-5 lg:top-5 lg:left-7 flex items-center gap-1.5 sm:gap-2 lg:gap-2.5 text-texto hover:text-acento transition-all duration-300 z-20"
        >
          <Undo2 className="w-5 h-5 sm:w-6 sm:h-6 lg:w-7 lg:h-7" strokeWidth={2.2} />
          <span className="hidden sm:inline font-medium text-sm sm:text-base lg:text-lg">{tr("Volver")}</span>
        </button>
      )}
      <h1 className="absolute top-4 right-28 sm:top-5 sm:right-32 lg:right-36 text-base sm:text-xl lg:text-2xl font-semibold z-20">
        {t(title)}
      </h1>
      <div className="absolute top-3 right-3 sm:top-4 sm:right-6 lg:top-5 lg:right-8 z-20 flex items-center gap-2">
        <IdiomaToggle />
        <ThemeToggle />
        <KidModeToggle />
      </div>

      {/* Barra fija que aparece al hacer scroll */}
      <div
        className={`fixed top-0 left-0 right-0 z-30 flex items-center justify-between px-4 sm:px-8 py-3
          bg-fondo/80 backdrop-blur-md
          border-b border-borde
          transition-all duration-300 ease-out
          ${scrolled ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0 pointer-events-none"}`}
      >
        <div className="flex items-center min-w-[40px]">
          {showBack && (
            <button
              onClick={handleBack}
              className="flex items-center gap-2 text-texto hover:text-acento transition-colors"
            >
              <Undo2 size={22} strokeWidth={2.2} />
              <span className="hidden sm:inline font-medium">{tr("Volver")}</span>
            </button>
          )}
        </div>
        <h1 className="text-lg font-semibold text-texto">
          {t(title)}
        </h1>
        <div className="flex items-center gap-2">
          <IdiomaToggle />
          <ThemeToggle />
          <KidModeToggle />
        </div>
      </div>
    </>
  );
}
