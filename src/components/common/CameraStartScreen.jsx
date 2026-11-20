import React from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Camera, Play } from "lucide-react";
import { tr } from "../../i18n";

// Clases por variante para conservar el diseño exacto de cada pantalla:
// "sm" = la caja compacta del Desafío, "lg" = la versión amplia de las lecciones.
const VARIANTES = {
  sm: {
    contenedor: "p-4",
    iconoWrap: "p-5 sm:p-6 mb-4 shadow-md",
    icono: "w-10 h-10",
    titulo: "text-xl sm:text-2xl mb-2",
    descripcion: "max-w-sm mb-5 text-sm sm:text-base",
    boton:
      "gap-2 px-6 py-3 rounded-xl text-lg shadow-lg",
    playWrap: "",
    play: "w-5 h-5",
    spinner: "h-10 w-10",
    loadingTexto: "text-sm",
  },
  lg: {
    contenedor: "p-3 sm:p-5 lg:p-7 2xl:p-9",
    iconoWrap: "p-4 sm:p-6 lg:p-7 2xl:p-9 mb-3 sm:mb-5 lg:mb-6 shadow-xl",
    icono: "w-9 h-9 sm:w-11 sm:h-11 lg:w-12 lg:h-12 2xl:w-14 2xl:h-14",
    titulo: "text-lg sm:text-2xl lg:text-3xl 2xl:text-4xl mb-1.5 sm:mb-2 lg:mb-3",
    descripcion:
      "max-w-xs sm:max-w-sm lg:max-w-md mb-4 sm:mb-6 lg:mb-7 text-xs sm:text-base lg:text-lg 2xl:text-xl",
    boton:
      "gap-2 sm:gap-2.5 lg:gap-3 px-4 sm:px-7 lg:px-10 2xl:px-12 py-2 sm:py-3.5 lg:py-4 2xl:py-5 rounded-xl sm:rounded-2xl text-sm sm:text-lg lg:text-xl 2xl:text-2xl shadow-xl",
    playWrap: "bg-white/20 p-1 sm:p-1.5 lg:p-2 rounded-full group-hover:bg-white/30 transition",
    play: "ml-0.5 w-3.5 h-3.5 sm:w-5 sm:h-5 lg:w-6 lg:h-6 2xl:w-7 2xl:h-7",
    spinner: "h-8 w-8 sm:h-10 sm:w-10 lg:h-12 lg:w-12",
    loadingTexto: "text-sm sm:text-base lg:text-lg",
  },
};

// Pantalla "Cámara Desactivada" con botón de inicio, compartida por el
// Desafío y las lecciones de Aprender.
export default function CameraStartScreen({
  size = "lg",
  titulo = "Cámara Desactivada",
  descripcion,
  errorMsg,
  loading = false,
  loadingTexto = "Iniciando cámara...",
  onStart,
  startLabel = "Iniciar Cámara",
  dataTutorial,
}) {
  const v = VARIANTES[size] || VARIANTES.lg;

  return (
    <div className={`flex flex-col items-center justify-center text-center z-10 relative ${v.contenedor}`}>
      {loading ? (
        <div className="flex flex-col items-center">
          <div className={`animate-spin rounded-full border-4 border-acento border-t-transparent mb-3 ${v.spinner}`}></div>
          <p className={`text-acento font-medium animate-pulse ${v.loadingTexto}`}>{tr(loadingTexto)}</p>
        </div>
      ) : (
        <>
          <div className={`bg-superficie rounded-full ring-4 ring-borde transition-transform hover:scale-105 ${v.iconoWrap}`}>
            <Camera className={`text-sutil ${v.icono}`} />
          </div>
          <h3 className={`font-bold text-texto ${v.titulo}`}>{tr(titulo)}</h3>
          <p className={`text-sutil ${v.descripcion}`}>{tr(descripcion)}</p>
          {errorMsg && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-error text-xs sm:text-sm mb-3 sm:mb-5 bg-error/10 px-3 py-2 rounded-xl border border-error/30 flex items-center gap-2"
            >
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{tr(errorMsg)}</span>
            </motion.div>
          )}
          <button
            data-tutorial={dataTutorial}
            onClick={onStart}
            disabled={loading}
            className={`group flex items-center bg-acento hover:bg-acento-fuerte text-acento-texto font-bold transition-all transform hover:-translate-y-1 active:scale-95 ${v.boton}`}
          >
            {v.playWrap ? (
              <div className={v.playWrap}>
                <Play fill="currentColor" className={v.play} />
              </div>
            ) : (
              <Play fill="currentColor" className={v.play} />
            )}
            {tr(startLabel)}
          </button>
        </>
      )}
    </div>
  );
}
